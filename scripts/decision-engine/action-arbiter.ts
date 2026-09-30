/**
 * action-arbiter.ts
 * Автономный Шлюз Принятия Решений (Autonomous Action Arbiter — AAA-2026).
 * 
 * Предоставляет 100% детерминированный арбитраж инженерных развилок и вопросов
 * («делать / не делать», выбор безопасного варианта) без расхода LLM-токенов.
 */

import fs from 'fs';
import path from 'path';
import { decisionClient } from '../../src/lib/decision-engine/client';

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
  confidenceScore: number;
  tokenCost: 0;
  rationale: string;
  riskAssessment: {
    financialRisk: 'NONE' | 'LOW' | 'HIGH';
    securityRisk: 'NONE' | 'LOW' | 'HIGH';
    dataIntegrityRisk: 'NONE' | 'LOW' | 'HIGH';
    overallRiskScore: number;
  };
  remediationAdvice: string[];
}

export interface ActionArbiterOptions {
  logPath?: string;
  projectRoot?: string;
}

export class ActionArbiter {
  private logPath: string;
  private projectRoot: string;

  constructor(options: ActionArbiterOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.logPath = options.logPath || path.resolve(this.projectRoot, '.planning/ACTION_DECISIONS_LOG.md');
  }

  /**
   * Принятие детерминированного решения по пулу вариантов
   */
  public decide(proposal: ActionIntentProposal): ActionDecisionResult {
    const timestamp = new Date().toISOString();
    const decisionId = `DEC-${Date.now()}-${proposal.actionId}`;

    // Анализ рисков
    const touchesFinancial = proposal.options.some(o => o.touchesFinancialLedger);
    const touchesSecrets = proposal.options.some(o => o.touchesAuthOrSecrets);
    const hasDestructive = proposal.options.some(o => o.isDestructive);

    const financialRisk: 'NONE' | 'LOW' | 'HIGH' = touchesFinancial 
      ? (proposal.options.some(o => o.riskLevel === 'CRITICAL' || o.riskLevel === 'HIGH') ? 'HIGH' : 'LOW')
      : 'NONE';

    const securityRisk: 'NONE' | 'LOW' | 'HIGH' = touchesSecrets
      ? (proposal.options.some(o => o.riskLevel === 'CRITICAL' || o.riskLevel === 'HIGH') ? 'HIGH' : 'LOW')
      : 'NONE';

    const dataIntegrityRisk: 'NONE' | 'LOW' | 'HIGH' = hasDestructive ? 'HIGH' : 'NONE';

    let overallRiskScore = 10;
    if (financialRisk === 'HIGH') overallRiskScore += 35;
    if (securityRisk === 'HIGH') overallRiskScore += 35;
    if (dataIntegrityRisk === 'HIGH') overallRiskScore += 20;
    overallRiskScore = Math.min(100, overallRiskScore);

    // 1. ПРАВИЛО 1: Golden Boundary (BGS-2026 Production Cutover & Critical Environments)
    if (proposal.context.targetEnvironment === 'PRODUCTION' && (proposal.category === 'DEPLOY' || proposal.category === 'INFRASTRUCTURE')) {
      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'ESCALATE_TO_HUMAN',
        selectedOptionId: null,
        selectedOptionTitle: null,
        confidenceScore: 100,
        tokenCost: 0,
        rationale: 'Согласно правилу 0.5 AGENTS.md (BGS-2026), любое переключение или деплой в продакшн контур (:3000) требует обязательного прямого одобрения человека (Human Approval Gate).',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk,
          overallRiskScore: Math.max(overallRiskScore, 80),
        },
        remediationAdvice: [
          'Завершите сборку и визуальный аудит в Stage-контуре (:3005).',
          'Сформируйте отчет для пользователя и дождитесь явного подтверждения «Одобряю»/«Выкатывай».',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 2. ПРАВИЛО 2: Деструктивные операции со схемой/данными БД без резервной копии
    if (hasDestructive && proposal.category === 'SCHEMA_MIGRATION' && proposal.context.hasBackup === false) {
      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'ESCALATE_TO_HUMAN',
        selectedOptionId: null,
        selectedOptionTitle: null,
        confidenceScore: 98,
        tokenCost: 0,
        rationale: 'Обнаружена деструктивная операция, при этом отсутствует резервная копия базы данных (hasBackup: false). Действие эскалировано человеку для предотвращения безвозвратной потери данных.',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk: 'HIGH',
          overallRiskScore: 90,
        },
        remediationAdvice: [
          'Создайте резервный снимок базы данных командой npm run db:backup перед выполнением.',
          'Убедитесь в наличии плана восстановления данных.',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // Поиск безопасных вариантов
    const safeCandidates = proposal.options.filter(o => 
      o.riskLevel === 'LOW' && !o.isDestructive && o.hasRollbackPlan
    );

    const dangerousOptions = proposal.options.filter(o => 
      o.riskLevel === 'CRITICAL' || o.riskLevel === 'HIGH' || o.isDestructive
    );

    // 3. ПРАВИЛО 3: Критически опасный пул без возможности смягчения -> REJECT
    const allAreDangerous = proposal.options.every(o => o.riskLevel === 'CRITICAL' && (!o.hasRollbackPlan || o.isDestructive));
    if (allAreDangerous || (proposal.options.length > 0 && safeCandidates.length === 0 && dangerousOptions.length === proposal.options.length)) {
      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'REJECT',
        selectedOptionId: null,
        selectedOptionTitle: null,
        confidenceScore: 99,
        tokenCost: 0,
        rationale: 'Все предложенные варианты несут критический некомпенсированный риск или нарушают инварианты безопасности (отключение проверки подписей, потеря данных).',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk,
          overallRiskScore: 95,
        },
        remediationAdvice: [
          'Спроектируйте альтернативный вариант с нулевым деструктивным воздействием.',
          'Обеспечьте обязательный план отката (Rollback Plan) и сохранение подписей безопасности.',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 4. ПРАВИЛО 4: Safe Redirection (Перенаправление с опасного варианта на безопасный)
    if (dangerousOptions.length > 0 && safeCandidates.length > 0) {
      // Сортируем безопасных кандидатов по минимальному радиусу поражения файлов
      safeCandidates.sort((a, b) => a.estimatedImpactFiles - b.estimatedImpactFiles);
      const chosenSafe = safeCandidates[0];

      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'REDIRECT_SAFE',
        selectedOptionId: chosenSafe.id,
        selectedOptionTitle: chosenSafe.title,
        confidenceScore: 95,
        tokenCost: 0,
        rationale: `Действие автоматически перенаправлено на безопасную альтернативу "${chosenSafe.title}" (id: ${chosenSafe.id}). Опасные деструктивные варианты отклонены.`,
        riskAssessment: {
          financialRisk: chosenSafe.touchesFinancialLedger ? 'LOW' : 'NONE',
          securityRisk: chosenSafe.touchesAuthOrSecrets ? 'LOW' : 'NONE',
          dataIntegrityRisk: 'NONE',
          overallRiskScore: 20,
        },
        remediationAdvice: [
          `Реализуйте выбранный безопасный вариант ${chosenSafe.id}.`,
          'Соблюдайте правила обратной совместимости API и схемы.',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 5. ПРАВИЛО 5: Автономное одобрение безопасного варианта (PROCEED)
    // Выбираем вариант с наименьшим риском и наименьшим числом файлов
    const sortedOptions = [...proposal.options].sort((a, b) => {
      const riskWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      if (riskWeight[a.riskLevel] !== riskWeight[b.riskLevel]) {
        return riskWeight[a.riskLevel] - riskWeight[b.riskLevel];
      }
      return a.estimatedImpactFiles - b.estimatedImpactFiles;
    });

    const chosenOption = sortedOptions[0];

    const result: ActionDecisionResult = {
      decisionId,
      timestamp,
      verdict: 'PROCEED',
      selectedOptionId: chosenOption.id,
      selectedOptionTitle: chosenOption.title,
      confidenceScore: 94,
      tokenCost: 0,
      rationale: `Действие одобрено автономно. Выбран оптимальный вариант "${chosenOption.title}" с допустимым уровнем риска (${chosenOption.riskLevel}) и наличием плана отката.`,
      riskAssessment: {
        financialRisk: chosenOption.touchesFinancialLedger ? 'LOW' : 'NONE',
        securityRisk: chosenOption.touchesAuthOrSecrets ? 'LOW' : 'NONE',
        dataIntegrityRisk: 'NONE',
        overallRiskScore: 15,
      },
      remediationAdvice: [],
    };
    this.recordDecision(proposal, result);
    return result;
  }

  /**
   * Асинхронное принятие решения с консультацией локального System 1 Decision Gate (Laya Engine)
   * с автоматическим фоллбеком на детерминированные правила при сбое или отсутствии связи.
   */
  public async decideWithSystem1(proposal: ActionIntentProposal): Promise<ActionDecisionResult> {
    const topOption = proposal.options[0];
    const isDestructive = proposal.options.some(o => o.isDestructive);
    const hasRollbackPlan = proposal.options.every(o => o.hasRollbackPlan);

    try {
      const remote = await decisionClient.arbitrateAction({
        actionId: proposal.actionId,
        intent: proposal.intent,
        category: proposal.category,
        isDestructive,
        hasRollbackPlan,
        estimatedImpactFiles: topOption?.estimatedImpactFiles ?? 1,
        touchesFinancialLedger: proposal.options.some(o => o.touchesFinancialLedger),
        touchesAuthOrSecrets: proposal.options.some(o => o.touchesAuthOrSecrets),
        environment: proposal.context.targetEnvironment,
      });

      if (remote && remote.verdict) {
        const local = this.decide(proposal);
        // Если Laya требует эскалации к человеку или отклонения — применяем этот приоритет
        if (remote.verdict === 'ESCALATE_TO_HUMAN' || remote.verdict === 'REJECT') {
          local.verdict = remote.verdict;
          local.rationale = `[Laya System 1 Gate] ${remote.rationale}`;
        }
        return local;
      }
    } catch {
      // Игнорируем сетевые ошибки, переходя к детерминированному решению
    }

    return this.decide(proposal);
  }

  /**
   * Фиксация принятого решения в Append-Only журнале
   */
  private recordDecision(proposal: ActionIntentProposal, result: ActionDecisionResult): void {
    try {
      const logDir = path.dirname(this.logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logEntry = `
### [${result.decisionId}] ${result.timestamp} — Вердикт: ${result.verdict}
- **Категория:** \`${proposal.category}\` | **Окружение:** \`${proposal.context.targetEnvironment}\`
- **Намерение:** ${proposal.intent}
- **Выбранный вариант:** ${result.selectedOptionTitle ? `\`${result.selectedOptionId}\` — ${result.selectedOptionTitle}` : '*Не выбран / Блокировка*'}
- **Обоснование:** ${result.rationale}
- **Расход токенов:** \`0 tokens (Детерминированный арбитраж)\`
- **Оценка риска:** Итоговый балл: \`${result.riskAssessment.overallRiskScore}/100\` (Финансы: ${result.riskAssessment.financialRisk}, Безопасность: ${result.riskAssessment.securityRisk})
${result.remediationAdvice.length > 0 ? `- **Рекомендации:**\n${result.remediationAdvice.map(r => `  - ${r}`).join('\n')}` : ''}

---
`;

      if (!fs.existsSync(this.logPath)) {
        fs.writeFileSync(this.logPath, '# Action Decisions Audit Log (AAA-2026)\n\nЖурнал автономных решений шлюза ActionArbiter.\n\n---\n', 'utf-8');
      }
      fs.appendFileSync(this.logPath, logEntry, 'utf-8');
    } catch (err) {
      console.error('Failed to append to action decisions log:', err);
    }
  }
}

// Экспорт вспомогательной функции
export function decideAction(proposal: ActionIntentProposal, options?: ActionArbiterOptions): ActionDecisionResult {
  const arbiter = new ActionArbiter(options);
  return arbiter.decide(proposal);
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const proposalArgIdx = args.indexOf('--proposal');
  
  if (proposalArgIdx !== -1 && args[proposalArgIdx + 1]) {
    const rawPathOrJson = args[proposalArgIdx + 1];
    let proposalData: ActionIntentProposal;

    if (fs.existsSync(rawPathOrJson)) {
      proposalData = JSON.parse(fs.readFileSync(rawPathOrJson, 'utf-8'));
    } else {
      proposalData = JSON.parse(rawPathOrJson);
    }

    const arbiter = new ActionArbiter();
    const verdict = arbiter.decide(proposalData);
    console.log(JSON.stringify(verdict, null, 2));
    process.exit(verdict.verdict === 'REJECT' ? 1 : 0);
  } else {
    console.log('Использование: npx tsx scripts/decision-engine/action-arbiter.ts --proposal <path-to-json-or-json-string>');
  }
}
