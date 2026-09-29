/**
 * action-arbiter.ts
 * Автономный Шлюз Принятия Решений (Autonomous Action Arbiter — AAA Core).
 * 
 * 100% детерминированный арбитраж рисков и автоматическое подтверждение
 * безопасных вариантов действий без привлечения человека.
 */

import fs from 'fs';
import path from 'path';
import { ActionIntentProposal, ActionDecisionResult } from './types';
import { CreativityCatalyst } from './creativity-catalyst';

export interface ActionArbiterOptions {
  logPath?: string;
  projectRoot?: string;
}

export class ActionArbiter {
  private logPath?: string;
  private projectRoot: string;

  constructor(options: ActionArbiterOptions = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.logPath = options.logPath;
  }

  public decide(proposal: ActionIntentProposal): ActionDecisionResult {
    const timestamp = new Date().toISOString();
    const decisionId = `DEC-${Date.now()}-${proposal.actionId}`;

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

    // 1. Golden Boundary: Production Cutover & Deployment
    if (proposal.context.targetEnvironment === 'PRODUCTION' && (proposal.category === 'DEPLOY' || proposal.category === 'INFRASTRUCTURE')) {
      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'ESCALATE_TO_HUMAN',
        selectedOptionId: null,
        selectedOptionTitle: null,
        confidenceScore: 100,
        tokenCost: 0,
        rationale: 'Переключение или деплой в продакшн-контур требует обязательного прямого одобрения человека (Human Approval Gate).',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk,
          overallRiskScore: Math.max(overallRiskScore, 80),
        },
        remediationAdvice: [
          'Завершите сборку и тестирование в изолированном Stage-контуре.',
          'Предоставьте отчет с доказательствами тестов и запросите подтверждение человека.',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 2. Деструктивные операции со схемой БД без бекапа
    if (hasDestructive && proposal.category === 'SCHEMA_MIGRATION' && proposal.context.hasBackup === false) {
      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'ESCALATE_TO_HUMAN',
        selectedOptionId: null,
        selectedOptionTitle: null,
        confidenceScore: 98,
        tokenCost: 0,
        rationale: 'Обнаружена деструктивная операция со схемой/данными при отсутствии резервной копии. Действие эскалировано человеку.',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk: 'HIGH',
          overallRiskScore: 90,
        },
        remediationAdvice: [
          'Создайте резервную копию базы данных перед применением деструктивных миграций.',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 3. Анализ вариантов
    const safeCandidates = proposal.options.filter(o => 
      o.riskLevel === 'LOW' && !o.isDestructive && o.hasRollbackPlan
    );

    const dangerousOptions = proposal.options.filter(o => 
      o.riskLevel === 'CRITICAL' || o.riskLevel === 'HIGH' || o.isDestructive
    );

    // 3.0. Creativity & Quality Bar Check (Стимуляция креативности генератора)
    const allHaveQualityScore = proposal.options.length > 0 && proposal.options.every(o => o.qualityScore !== undefined);
    const maxQualityScore = allHaveQualityScore 
      ? Math.max(...proposal.options.map(o => o.qualityScore!)) 
      : 100;
    const diversity = CreativityCatalyst.calculateDiversity(proposal.options);

    // Если все варианты посредственные (qualityScore < 65) или отсутствует разнообразие при среднем качестве
    const isTrappedInMediocrity = allHaveQualityScore && maxQualityScore < 65;
    const isLowDiversityMediocre = allHaveQualityScore && diversity < 0.25 && maxQualityScore < 75;

    if (isTrappedInMediocrity || isLowDiversityMediocre) {
      const creativeVectors = CreativityCatalyst.generateEpistemicVectors(proposal.intent, proposal.category);
      const result: ActionDecisionResult = {
        decisionId,
        timestamp,
        verdict: 'CHALLENGE_CREATIVITY',
        selectedOptionId: null,
        selectedOptionTitle: null,
        confidenceScore: 92,
        tokenCost: 0,
        rationale: 'Все предложенные варианты не дотягивают до порога архитектурного качества или являются поверхностными вариациями одной идеи. Требуется активировать ортогональное мышление (Диалектика Гегеля / ТРИЗ).',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk,
          overallRiskScore: 60,
        },
        creativeVectors,
        remediationAdvice: [
          'Сгенерируйте варианты из трех ортогональных парадигм: CONSERVATIVE (минимальный безопасный diff), RADICAL_CLEAN (DDD изоляция) и INVERSION_TRIZ (устранение первопричины конструктивно).',
          ...creativeVectors,
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 3.1. Некомпенсированный критический риск -> REJECT
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
        rationale: 'Все предложенные варианты несут критический некомпенсированный риск или нарушают инварианты безопасности.',
        riskAssessment: {
          financialRisk,
          securityRisk,
          dataIntegrityRisk,
          overallRiskScore: 95,
        },
        remediationAdvice: [
          'Спроектируйте альтернативный вариант с сохранением обратной совместимости и плана отката.',
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 3.2. Safe Redirection (Перенаправление на безопасную альтернативу)
    if (dangerousOptions.length > 0 && safeCandidates.length > 0) {
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
        rationale: `Действие автоматически перенаправлено на безопасную альтернативу "${chosenSafe.title}" (id: ${chosenSafe.id}). Опасные варианты отклонены.`,
        riskAssessment: {
          financialRisk: chosenSafe.touchesFinancialLedger ? 'LOW' : 'NONE',
          securityRisk: chosenSafe.touchesAuthOrSecrets ? 'LOW' : 'NONE',
          dataIntegrityRisk: 'NONE',
          overallRiskScore: 20,
        },
        remediationAdvice: [
          `Реализуйте выбранный безопасный вариант ${chosenSafe.id}.`,
        ],
      };
      this.recordDecision(proposal, result);
      return result;
    }

    // 3.3. Autonomous Approval (PROCEED)
    const sortedOptions = [...proposal.options].sort((a, b) => {
      const riskWeight = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
      if (riskWeight[a.riskLevel] !== riskWeight[b.riskLevel]) {
        return riskWeight[a.riskLevel] - riskWeight[b.riskLevel];
      }
      if (a.qualityScore !== undefined && b.qualityScore !== undefined && a.qualityScore !== b.qualityScore) {
        return b.qualityScore - a.qualityScore; // Преимущество более высокому качеству и продуманности
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

  private recordDecision(proposal: ActionIntentProposal, result: ActionDecisionResult): void {
    if (!this.logPath) return;
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
- **Оценка риска:** \`${result.riskAssessment.overallRiskScore}/100\`

---
`;

      if (!fs.existsSync(this.logPath)) {
        fs.writeFileSync(this.logPath, '# Action Decisions Audit Log (AAA-2026)\n\n---\n', 'utf-8');
      }
      fs.appendFileSync(this.logPath, logEntry, 'utf-8');
    } catch {
      // Игнорируем ошибки логирования в автономном режиме
    }
  }
}
