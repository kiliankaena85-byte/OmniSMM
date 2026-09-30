import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ActionArbiter, ActionIntentProposal } from '../../../scripts/decision-engine/action-arbiter';

describe('Autonomous Action Arbiter (AAA-2026 / Zero-Token Intent Gatekeeper)', () => {
  const testLogPath = path.resolve(process.cwd(), '.planning/test_action_decisions_log.md');

  beforeEach(() => {
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLogPath)) {
      fs.unlinkSync(testLogPath);
    }
  });

  it('1. should autonomously approve safe low-risk option (PROCEED) with exactly 0 tokens', () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-001',
      intent: 'Вынести дублирующийся парсер ссылок в отдельный переиспользуемый модуль',
      category: 'REFACTOR',
      options: [
        {
          id: 'OPT-A',
          title: 'Создать чистый модуль link-validator.ts с тестами',
          description: 'Изолированный новый модуль с обратной совместимостью',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 2,
          touchesFinancialLedger: false,
          touchesAuthOrSecrets: false,
        },
        {
          id: 'OPT-B',
          title: 'Оставить дублирование как есть',
          description: 'Ничего не менять',
          riskLevel: 'MEDIUM',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 0,
        },
      ],
      context: {
        targetEnvironment: 'STAGE',
        hasBackup: true,
        userIntentExplicit: false,
      },
    };

    const decision = arbiter.decide(proposal);

    expect(decision.verdict).toBe('PROCEED');
    expect(decision.selectedOptionId).toBe('OPT-A');
    expect(decision.tokenCost).toBe(0);
    expect(decision.confidenceScore).toBeGreaterThanOrEqual(90);
    expect(decision.rationale).toContain('автономно');
    expect(fs.existsSync(testLogPath)).toBe(true);
  });

  it('2. should automatically redirect dangerous proposal to safe alternative (REDIRECT_SAFE)', () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-002',
      intent: 'Изменить тип поля amountRub в базе данных',
      category: 'SCHEMA_MIGRATION',
      options: [
        {
          id: 'OPT-DANGEROUS',
          title: 'Удалить колонку и создать заново (In-place DROP COLUMN)',
          description: 'Быстро, но приводит к потере исторических данных транзакций',
          riskLevel: 'CRITICAL',
          isDestructive: true,
          hasRollbackPlan: false,
          estimatedImpactFiles: 5,
          touchesFinancialLedger: true,
        },
        {
          id: 'OPT-SAFE-EXPAND',
          title: 'Паттерн Expand/Contract с добавлением amountKopecksBigInt',
          description: 'Двухфазная миграция с сохранением данных и двойной записью',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 8,
          touchesFinancialLedger: true,
        },
      ],
      context: {
        targetEnvironment: 'STAGE',
        hasBackup: true,
        userIntentExplicit: false,
      },
    };

    const decision = arbiter.decide(proposal);

    expect(decision.verdict).toBe('REDIRECT_SAFE');
    expect(decision.selectedOptionId).toBe('OPT-SAFE-EXPAND');
    expect(decision.tokenCost).toBe(0);
    expect(decision.rationale).toContain('перенаправлено на безопасную альтернативу');
  });

  it('3. should strictly escalate production deployment to human (ESCALATE_TO_HUMAN)', () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-003',
      intent: 'Переключить боевой трафик на новый Docker-контейнер',
      category: 'DEPLOY',
      options: [
        {
          id: 'OPT-CUTOVER',
          title: 'Zero-Downtime Cutover на боевой порт :3000',
          description: 'Мгновенное переключение трафика',
          riskLevel: 'MEDIUM',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 1,
        },
      ],
      context: {
        targetEnvironment: 'PRODUCTION',
        hasBackup: true,
        userIntentExplicit: false,
      },
    };

    const decision = arbiter.decide(proposal);

    expect(decision.verdict).toBe('ESCALATE_TO_HUMAN');
    expect(decision.rationale).toContain('BGS-2026');
    expect(decision.selectedOptionId).toBeNull();
  });

  it('4. should escalate destructive schema operation when hasBackup is false (ESCALATE_TO_HUMAN)', () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-004',
      intent: 'Очистка архивных таблиц логов',
      category: 'SCHEMA_MIGRATION',
      options: [
        {
          id: 'OPT-TRUNCATE',
          title: 'TRUNCATE TABLE ArchiveLogs',
          description: 'Удаление всех старых записей',
          riskLevel: 'HIGH',
          isDestructive: true,
          hasRollbackPlan: false,
          estimatedImpactFiles: 1,
        },
      ],
      context: {
        targetEnvironment: 'STAGE',
        hasBackup: false, // Бекап отсутствует!
        userIntentExplicit: false,
      },
    };

    const decision = arbiter.decide(proposal);

    expect(decision.verdict).toBe('ESCALATE_TO_HUMAN');
    expect(decision.rationale).toContain('отсутствует резервная копия');
  });

  it('5. should reject proposal when all options have CRITICAL unmitigated risks (REJECT)', () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-005',
      intent: 'Отключить проверку подписей вебхуков для ускорения тестов',
      category: 'OPTIMIZATION',
      options: [
        {
          id: 'OPT-DISABLE-SIGNATURE',
          title: 'Убрать timingSafeEqual и проверку секрета',
          description: 'Сделает систему уязвимой для подделки платежей',
          riskLevel: 'CRITICAL',
          isDestructive: true,
          hasRollbackPlan: false,
          estimatedImpactFiles: 3,
          touchesAuthOrSecrets: true,
          touchesFinancialLedger: true,
        },
      ],
      context: {
        targetEnvironment: 'LOCAL',
        hasBackup: false,
      },
    };

    const decision = arbiter.decide(proposal);

    expect(decision.verdict).toBe('REJECT');
    expect(decision.tokenCost).toBe(0);
    expect(decision.remediationAdvice.length).toBeGreaterThan(0);
  });

  it('6. should asynchronously arbitrate via System 1 Laya Engine (PROCEED on safe refactor)', async () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-SYS1-001',
      intent: 'Безопасный рефакторинг UI хелпера',
      category: 'REFACTOR',
      options: [
        {
          id: 'OPT-SAFE',
          title: 'Вынести функцию форматирования даты в отдельный модуль',
          description: 'Локальная чистая функция без побочных эффектов',
          riskLevel: 'LOW',
          isDestructive: false,
          hasRollbackPlan: true,
          estimatedImpactFiles: 1,
        },
      ],
      context: {
        targetEnvironment: 'LOCAL',
        hasBackup: true,
      },
    };

    const decision = await arbiter.decideWithSystem1(proposal);

    expect(decision.verdict).toBe('PROCEED');
    expect(decision.selectedOptionId).toBe('OPT-SAFE');
    expect(decision.tokenCost).toBe(0);
  });

  it('7. should escalate via System 1 Laya Engine on destructive action in PRODUCTION without rollback', async () => {
    const arbiter = new ActionArbiter({ logPath: testLogPath });
    const proposal: ActionIntentProposal = {
      actionId: 'ACT-SYS1-002',
      intent: 'DROP TABLE users в продакшне',
      category: 'SCHEMA_MIGRATION',
      options: [
        {
          id: 'OPT-DROP',
          title: 'Удалить таблицу без плана отката',
          description: 'Деструктивное удаление данных',
          riskLevel: 'CRITICAL',
          isDestructive: true,
          hasRollbackPlan: false,
          estimatedImpactFiles: 5,
        },
      ],
      context: {
        targetEnvironment: 'PRODUCTION',
        hasBackup: false,
      },
    };

    const decision = await arbiter.decideWithSystem1(proposal);

    expect(decision.verdict).toBe('ESCALATE_TO_HUMAN');
    expect(decision.tokenCost).toBe(0);
  });
});

