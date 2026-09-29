# SPEC-2026-09-29: Autonomous Action Arbiter (AAA-2026 / Zero-Token Intent Gatekeeper)

## 1. Контекст и Проблематика (Context & Motivation)
В современных мультиагентных системах (Gemini, Claude, Antigravity) на каждой инженерной развилке агенты склонны либо:
1. **Прерывать автономный поток и отвлекать пользователя:** задавать вопросы «делать / не делать?», «вариант 1 или вариант 2?», превращая разработчика в диспетчера рутины и нарушая закон потока ТОС (TOC POOGI Throughput $T$).
2. **Действовать вслепую (Confirmation Bias / Slop):** выбирать рискованные, деструктивные или неоптимальные варианты реализации, не имея независимой оценки рисков.
3. **Расходовать миллионы токенов:** привлекать вторую вероятностную модель для ответов на базовые вопросы архитектурной гигиены, получая вероятностные галлюцинации и сикофантию.

## 2. Архитектурное Решение (The Solution)
Внедрение **Автономного Шлюза Принятия Решений (Autonomous Action Arbiter — AAA-2026)**, основанного на теории ограничений Эли Голдратта (TOC POOGI) и непараметрических моделях принятия решений (НПУ).

### Ключевые Принципы:
1. **0 Tokens (Детерминированный арбитраж):** Решение принимается математической матрицей политик безопасности и весов рисков без обращений к внешним LLM.
2. **Fail-Closed Gatekeeper:** При малейшем нарушении ключевых инвариантов (BGS-2026 cutover, отсутствие бекапа при деструктивных DDL, уязвимости в биллинге) действие блокируется или эскалируется человеку.
3. **Safe Redirection (Анти-техдолг):** Если агент предлагает костыль или опасное решение, но в пуле есть чистый обратно-совместимый вариант, арбитр директивно перенаправляет агента на безопасный путь.
4. **Append-Only Audit Log:** Каждое решение фиксируется в журнале аудита `.planning/ACTION_DECISIONS_LOG.md`.

---

## 3. Схема данных и Zod DTOs (Data Contracts)

```typescript
export type ActionCategory = 
  | 'REFACTOR'
  | 'BUGFIX'
  | 'OPTIMIZATION'
  | 'SCHEMA_MIGRATION'
  | 'DEPENDENCY'
  | 'DEPLOY'
  | 'INFRASTRUCTURE';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionOption {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  isDestructive: boolean;
  hasRollbackPlan: boolean;
  estimatedImpactFiles: number;
  touchesFinancialLedger?: boolean;
  touchesAuthOrSecrets?: boolean;
}

export interface ActionProposalContext {
  targetEnvironment: 'LOCAL' | 'STAGE' | 'PRODUCTION';
  userIntentExplicit?: boolean;
  hasBackup?: boolean;
  activeGitDiffLines?: number;
}

export interface ActionIntentProposal {
  actionId: string;
  intent: string;
  category: ActionCategory;
  options: ActionOption[];
  context: ActionProposalContext;
}

export type DecisionVerdict = 'PROCEED' | 'REDIRECT_SAFE' | 'ESCALATE_TO_HUMAN' | 'REJECT';

export interface ActionDecisionResult {
  decisionId: string;
  timestamp: string;
  verdict: DecisionVerdict;
  selectedOptionId: string | null;
  selectedOptionTitle: string | null;
  confidenceScore: number; // 0 - 100
  tokenCost: 0;
  rationale: string;
  riskAssessment: {
    financialRisk: 'NONE' | 'LOW' | 'HIGH';
    securityRisk: 'NONE' | 'LOW' | 'HIGH';
    dataIntegrityRisk: 'NONE' | 'LOW' | 'HIGH';
    overallRiskScore: number; // 0 (минимальный) - 100 (максимальный)
  };
  remediationAdvice: string[];
}
```

---

## 4. Правила Матрицы Решений (Decision Policy Engine)

### Правило 1: BGS-2026 Golden Boundary (Эскалация человеку)
- Если `targetEnvironment === 'PRODUCTION'` и `category === 'DEPLOY'` $\to$ **`ESCALATE_TO_HUMAN`** (Прямое соблюдение правила 0.5 AGENTS.md — Zero-Defect Blue-Green Stage Gate).
- Если все опции имеют `isDestructive === true` и `hasBackup === false` $\to$ **`ESCALATE_TO_HUMAN`**.
- Если затрагивается `Ledger` с риском `HIGH`/`CRITICAL` без плана отката $\to$ **`ESCALATE_TO_HUMAN`**.

### Правило 2: Safe Redirection (Перенаправление на безопасный вариант)
- Если хотя бы один вариант деструктивен или имеет высокий риск, но в пуле присутствует вариант с `riskLevel === 'LOW'`, `isDestructive === false` и `hasRollbackPlan === true` $\to$ **`REDIRECT_SAFE`** с выбором безопасного варианта.

### Правило 3: Autonomous Approval (Мгновенное одобрение)
- Если выбранный вариант имеет `riskLevel === 'LOW'`, не деструктивен, имеет план отката, не затрагивает боевой прод `:3000` $\to$ **`PROCEED`** (Агент мгновенно продолжает работу).

### Правило 4: Total Rejection (Блокировка)
- Если все доступные варианты нарушают инварианты (все деструктивны, без откатов, содержат критический риск) $\to$ **`REJECT`**.

---

## 5. План тестирования (TDD Verification)
- [x] Автономное одобрение низкорискового варианта (`PROCEED`, 0 токенов).
- [x] Автоматическое перенаправление опасного решения на безопасное (`REDIRECT_SAFE`).
- [x] Принудительная эскалация человеку при попытке выкатки в прод (`ESCALATE_TO_HUMAN`).
- [x] Эскалация при деструктивных DDL операциях без бекапа.
- [x] Отклонение (`REJECT`) при отсутствии безопасных опций в пуле.
- [x] Верификация фиксации в `.planning/ACTION_DECISIONS_LOG.md`.
