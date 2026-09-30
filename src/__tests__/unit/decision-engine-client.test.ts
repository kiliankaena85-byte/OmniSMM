import { describe, it, expect } from 'vitest';
import { OmniDecisionClient } from '@/lib/decision-engine/client';

describe('OmniDecisionClient & Circuit Breaker', () => {
  const client = new OmniDecisionClient({
    baseUrl: 'http://127.0.0.1:9999', // Недоступный порт для проверки мгновенного Circuit Breaker фоллбека
    timeoutMs: 20,
    maxConsecutiveFailures: 2,
  });

  it('autonomously falls back to safe choice when offline', async () => {
    const res = await client.choice({
      context: 'Тестовый контекст выбора',
      instruction: 'Выбрать вариант',
      options: [
        { id: 'opt_a', label: 'Вариант А' },
        { id: 'opt_b', label: 'Вариант Б' },
      ],
    });

    expect(res.selectedId).toBe('opt_a');
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
    expect(res.engineVersion).toBeDefined();
  });

  it('autonomously falls back to safe score when offline', async () => {
    const res = await client.score({
      context: 'https://example.com/clean-link',
      metricName: 'FRAUD_RISK',
    });

    expect(res.metricName).toBe('FRAUD_RISK');
    expect(res.isCriticalThresholdExceeded).toBe(false);
  });

  it('autonomously falls back to order routing with in-house priority', async () => {
    const res = await client.routeOrder({
      orderId: 'ord_123',
      serviceCategory: 'telegram_boost',
      targetUrl: 'https://t.me/good_channel',
      quantity: 50,
      inHouseAvailable: true,
      inHouseUnitCostRub: 0.0,
      candidates: [
        {
          providerId: 'prov_external_1',
          costRub: 35.0,
          historicalSuccessRate: 98,
          avgFulfillmentSpeedMinutes: 2,
          activeErrorsLastHour: 0,
        },
      ],
    });

    expect(res.destinationType).toBe('IN_HOUSE_PRODUCTION');
    expect(res.selectedTargetId).toBe('in_house_mtproto');
    expect(res.estimatedMarginPercent).toBe(100.0);
  });

  it('autonomously handles Dialectical Self-Loop Improving when offline', async () => {
    const res = await client.arbitrateDialecticalSynthesis({
      taskId: 'task_refactor_cache',
      taskContext: 'Высокая нагрузка на базу данных',
      businessObjective: 'Оптимизировать чтение без усложнения стека',
      hardInvariants: ['ACID', 'Ledger-First'],
      candidates: [
        {
          role: 'ALPHA_RADICAL',
          title: 'Переход на ScyllaDB кластер',
          philosophy: 'Максималистский подход',
          implementationSummary: 'Развернуть 3 ноды ScyllaDB',
          pros: ['100k RPS'],
          cons: ['Тяжелая инфраструктура'],
          riskLevel: 'HIGH',
          estimatedBlastRadius: 7,
        },
        {
          role: 'BETA_CONSERVATIVE',
          title: 'Только PostgreSQL Memory Buffer',
          philosophy: 'Zero-overhead',
          implementationSummary: 'Увеличить shared_buffers',
          pros: ['0 новой инфраструктуры'],
          cons: ['Предел масштабирования'],
          riskLevel: 'LOW',
          estimatedBlastRadius: 1,
        },
        {
          role: 'GAMMA_SYNTHESIS',
          title: 'Redis Outbox + Tiered Cache',
          philosophy: 'Снятие противоречия',
          implementationSummary: 'Двухуровневый кэш на существующем Redis',
          pros: ['Без новой инфраструктуры', 'Высокая скорость'],
          cons: ['Инвалидация кэша'],
          riskLevel: 'LOW',
          estimatedBlastRadius: 2,
        },
      ],
    });

    expect(res.winningRole).toBe('GAMMA_SYNTHESIS');
    expect(res.recommendedAction).toBe('EXECUTE_IMMEDIATELY');
    expect(res.confidenceScore).toBeGreaterThanOrEqual(0.95);
  });
});
