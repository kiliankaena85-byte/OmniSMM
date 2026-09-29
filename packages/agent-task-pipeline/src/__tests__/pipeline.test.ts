import { describe, it, expect } from 'vitest';
import { WbsDecomposer, ActionArbiter, CreativityCatalyst, BusinessRequest, ActionIntentProposal } from '../index';

describe('Standalone Agent Task Pipeline (@omnismm/agent-task-pipeline)', () => {
  it('1. WbsDecomposer should split a large feature across 6 files into atomic tasks touching <= 2 files each', () => {
    const decomposer = new WbsDecomposer();
    const req: BusinessRequest = {
      id: 'REQ-101',
      title: 'Внедрение платежного шлюза СБП и авто-фискализации',
      description: 'Интеграция СБП QR кодов и чеков 54-ФЗ',
      businessGoals: ['Прием платежей через СБП', 'Формирование фискальных чеков'],
    };

    const files = [
      'src/services/sbp-gateway.ts',
      'src/actions/payment/sbp.ts',
      'src/components/checkout/SbpQrModal.tsx',
      'src/services/fiscal/receipt.ts',
      'src/__tests__/unit/sbp.test.ts',
      'src/__tests__/unit/fiscal.test.ts',
    ];

    const result = decomposer.decompose(req, files);

    expect(result.totalTasks).toBe(3); // 6 files / 2 files per task = 3 atomic tasks
    expect(result.isWbsCompliant).toBe(true);
    expect(result.atomicTasks.every(t => t.targetFiles.length <= 2)).toBe(true);
    expect(result.criticalPath.length).toBe(3);
  });

  it('2. ActionArbiter should autonomously approve safe refactoring with 0 tokens', () => {
    const arbiter = new ActionArbiter();
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-PKG-01',
      intent: 'Вынос чистого парсера в утилиту',
      category: 'REFACTOR',
      options: [
        {
          id: 'OPT-CLEAN',
          title: 'Изолированный парсер',
          description: 'Чистая функция без побочных эффектов',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 1,
        },
      ],
      context: {
        targetEnvironment: 'STAGE',
        hasBackup: true,
      },
    };

    const decision = arbiter.decide(proposal);
    expect(decision.verdict).toBe('PROCEED');
    expect(decision.selectedOptionId).toBe('OPT-CLEAN');
    expect(decision.tokenCost).toBe(0);
  });

  it('3. ActionArbiter should redirect dangerous operation to safe alternative', () => {
    const arbiter = new ActionArbiter();
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-PKG-02',
      intent: 'Обновление схемы хранения баланса',
      category: 'SCHEMA_MIGRATION',
      options: [
        {
          id: 'OPT-DANGER',
          title: 'DROP COLUMN balanceRub',
          description: 'Удаление старой колонки наживую',
          riskLevel: 'CRITICAL',
          isDestructive: true,
          hasRollbackPlan: false,
          estimatedImpactFiles: 3,
        },
        {
          id: 'OPT-SAFE',
          title: 'Expand/Contract migration',
          description: 'Постепенная миграция с двойной записью',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 4,
        },
      ],
      context: {
        targetEnvironment: 'STAGE',
        hasBackup: true,
      },
    };

    const decision = arbiter.decide(proposal);
    expect(decision.verdict).toBe('REDIRECT_SAFE');
    expect(decision.selectedOptionId).toBe('OPT-SAFE');
    expect(decision.tokenCost).toBe(0);
  });

  it('4. CreativityCatalyst should calculate diversity score and generate triad brief', () => {
    const brief = CreativityCatalyst.generateDialecticalBrief('Ликвидация гонки состояний', 'BUGFIX');
    expect(brief).toContain('CONSERVATIVE');
    expect(brief).toContain('RADICAL_CLEAN');
    expect(brief).toContain('INVERSION_TRIZ');

    const diverseOptions = [
      {
        id: 'OPT-1',
        title: 'Локальный лок',
        description: 'Обычный мьютекс',
        riskLevel: 'LOW' as const,
        isDestructive: false,
        hasRollbackPlan: true,
        estimatedImpactFiles: 1,
        paradigm: 'CONSERVATIVE' as const,
      },
      {
        id: 'OPT-2',
        title: 'Transactional Outbox',
        description: 'Событийная шина',
        riskLevel: 'LOW' as const,
        isDestructive: false,
        hasRollbackPlan: true,
        estimatedImpactFiles: 3,
        paradigm: 'RADICAL_CLEAN' as const,
      },
      {
        id: 'OPT-3',
        title: 'Атомарный CAS инверсия',
        description: 'Устранение локов через updateMany',
        riskLevel: 'LOW' as const,
        isDestructive: false,
        hasRollbackPlan: true,
        estimatedImpactFiles: 2,
        paradigm: 'INVERSION_TRIZ' as const,
      },
    ];

    const diversity = CreativityCatalyst.calculateDiversity(diverseOptions);
    expect(diversity).toBeGreaterThanOrEqual(0.7);
  });

  it('5. ActionArbiter should CHALLENGE_CREATIVITY when proposed options are mediocre', () => {
    const arbiter = new ActionArbiter();
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-MEDIOCRE-01',
      intent: 'Исправление утечки точности в платежах',
      category: 'BUGFIX',
      options: [
        {
          id: 'OPT-HACK-1',
          title: 'Округление Math.round в месте вызова',
          description: 'Поверхностная заплатка',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 1,
          qualityScore: 40, // Mediocre quality
        },
        {
          id: 'OPT-HACK-2',
          title: 'Округление toFixed(2)',
          description: 'Вторая поверхностная заплатка',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 1,
          qualityScore: 45, // Mediocre quality
        },
      ],
      context: {
        targetEnvironment: 'STAGE',
        hasBackup: true,
      },
    };

    const decision = arbiter.decide(proposal);
    expect(decision.verdict).toBe('CHALLENGE_CREATIVITY');
    expect(decision.selectedOptionId).toBeNull();
    expect(decision.creativeVectors?.length).toBeGreaterThan(0);
    expect(decision.remediationAdvice.some(a => a.includes('CONSERVATIVE'))).toBe(true);
  });
});
