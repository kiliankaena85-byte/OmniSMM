import { describe, it, expect } from 'vitest';
import {
  DecisionChoiceRequestSchema,
  DecisionChoiceResponseSchema,
  DecisionScoreRequestSchema,
  DecisionScoreResponseSchema,
  DecisionNoulRequestSchema,
  DecisionNoulResponseSchema,
  OrderRoutingRequestSchema,
  OrderRoutingResponseSchema,
  ActionArbitrationRequestSchema,
  ActionArbitrationResponseSchema,
  DialecticalArbitrationRequestSchema,
  DialecticalVerdictSchema,
  DialecticalSynthesisRequestSchema,
  DialecticalSynthesisResponseSchema,
} from '@/lib/decision-engine/contracts';

describe('Decision Engine System 1 Contracts & Zod DTOs', () => {
  it('validates DecisionChoiceRequest correctly with valid and invalid options', () => {
    const valid = {
      context: 'Поступил заказ на буст Telegram-канала',
      instruction: 'Выбрать исполнителя',
      options: [
        { id: 'in_house_mtproto', label: 'Внутренний пул роботов MTProto' },
        { id: 'provider_10', label: 'Оптовый шлюз FixedMember' },
      ],
      temperature: 0.0,
    };
    const parsed = DecisionChoiceRequestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);

    // Менее 2 опций должно падать
    const invalid = {
      ...valid,
      options: [{ id: 'single_option', label: 'Один вариант' }],
    };
    const parsedInvalid = DecisionChoiceRequestSchema.safeParse(invalid);
    expect(parsedInvalid.success).toBe(false);
  });

  it('validates DecisionChoiceResponse with entropy and distribution', () => {
    const response = {
      selectedId: 'in_house_mtproto',
      confidence: 0.94,
      distribution: { in_house_mtproto: 0.94, provider_10: 0.06 },
      entropy: 0.12,
      latencyMs: 24,
      engineVersion: 'laya-modernbert-v1',
    };
    const parsed = DecisionChoiceResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
  });

  it('validates DecisionScoreRequest and Response', () => {
    const req = {
      context: 'https://t.me/good_channel_123',
      metricName: 'FRAUD_RISK',
      evidence: ['domain: t.me', 'clean_telegram_link'],
    };
    expect(DecisionScoreRequestSchema.safeParse(req).success).toBe(true);

    const res = {
      metricName: 'FRAUD_RISK',
      score: 0.02,
      isCriticalThresholdExceeded: false,
      latencyMs: 18,
    };
    expect(DecisionScoreResponseSchema.safeParse(res).success).toBe(true);
  });

  it('validates DecisionNoulRequest and Response', () => {
    const req = {
      proposition: 'Заказ безопасен для автоматического исполнения без ручной модерации',
      context: 'Клиент имеет 15 успешных заказов, сумма 45 руб, ссылка валидна',
      riskWeight: 1.0,
    };
    expect(DecisionNoulRequestSchema.safeParse(req).success).toBe(true);

    const res = {
      verdict: true,
      probabilityYes: 0.98,
      riskAdjustedThreshold: 0.75,
      isUncertain: false,
      latencyMs: 19,
    };
    expect(DecisionNoulResponseSchema.safeParse(res).success).toBe(true);
  });

  it('validates OrderRoutingRequest and Response', () => {
    const req = {
      orderId: 'cmumquzj7001ym30h41trjk1r',
      serviceCategory: 'telegram_boosts',
      targetUrl: 'https://t.me/testchannel',
      quantity: 4,
      inHouseAvailable: true,
      inHouseUnitCostRub: 0.0,
      candidates: [
        {
          providerId: 'fixedmember',
          costRub: 14.5,
          historicalSuccessRate: 98.5,
          avgFulfillmentSpeedMinutes: 5,
          activeErrorsLastHour: 0,
        },
      ],
    };
    expect(OrderRoutingRequestSchema.safeParse(req).success).toBe(true);

    const res = {
      orderId: 'cmumquzj7001ym30h41trjk1r',
      destinationType: 'IN_HOUSE_PRODUCTION',
      selectedTargetId: 'in_house_mtproto',
      confidence: 0.99,
      estimatedMarginPercent: 100.0,
      routingReason: 'In-house MTProto pool has 4 available slots with 0 marginal cost',
      latencyMs: 27,
    };
    expect(OrderRoutingResponseSchema.safeParse(res).success).toBe(true);
  });

  it('validates ActionArbitration with Zero-Token-Cost Invariant', () => {
    const req = {
      actionId: 'act_refactor_123',
      intent: 'Оптимизация кэша Redis',
      category: 'OPTIMIZATION',
      isDestructive: false,
      hasRollbackPlan: true,
      estimatedImpactFiles: 2,
      touchesFinancialLedger: false,
      touchesAuthOrSecrets: false,
      environment: 'LOCAL',
    };
    expect(ActionArbitrationRequestSchema.safeParse(req).success).toBe(true);

    const res = {
      actionId: 'act_refactor_123',
      verdict: 'PROCEED',
      confidenceScore: 0.95,
      rationale: 'Локальная оптимизация с планом отката и малым радиусом поражения разрешена',
      latencyMs: 15,
      tokenCost: 0,
    };
    expect(ActionArbitrationResponseSchema.safeParse(res).success).toBe(true);
  });

  it('validates Dialectical Self-Loop Improving (Anti-Mediocrity) contracts', () => {
    const dialecticalReq = {
      taskId: 'task_queue_architecture_456',
      taskContext: 'Необходимо масштабировать обработку заказов при нагрузке 5000 RPS',
      businessObjective: 'Максимизировать надежность и исключить потерю заказов',
      hardInvariants: ['Ledger-First', 'ACID transactions', 'Zero financial loss'],
      candidates: [
        {
          role: 'ALPHA_RADICAL' as const,
          title: 'Асинхронная Kafka + Rust Worker Cluster',
          philosophy: 'Максималистский подход к пропускной способности',
          implementationSummary: 'Развертывание 10 микросервисов на Rust с партиционированием Kafka',
          pros: ['Сверхвысокая скорость до 50k RPS', 'Минимальная задержка'],
          cons: ['Высокая сложность инфраструктуры', 'Риск рассинхронизации леджера'],
          riskLevel: 'HIGH' as const,
          estimatedBlastRadius: 8,
        },
        {
          role: 'BETA_CONSERVATIVE' as const,
          title: 'Строгий PostgreSQL Row-Level Lock + pg_advisory_lock',
          philosophy: 'Zero-overhead, fail-closed, абсолютная безопасность',
          implementationSummary: 'Синхронная запись в PostgreSQL с блокировкой строки пользователя',
          pros: ['100% гарантия ACID', 'Нулевая новая инфраструктура'],
          cons: ['Предел масштабирования 1200 RPS', 'Возможны таймауты при пиках'],
          riskLevel: 'LOW' as const,
          estimatedBlastRadius: 2,
        },
        {
          role: 'GAMMA_SYNTHESIS' as const,
          title: 'Redis Outbox + BullMQ Sharded Stream Buffer',
          philosophy: 'Синтез ТРИЗ: снятие конфликта скорости и надежности',
          implementationSummary: 'Атомарный Outbox в существующий Redis с шардированными потоками BullMQ',
          pros: ['Не требует Kafka', '5000+ RPS без деградации ACID', 'Использует стек OmniSMM'],
          cons: ['Требует настройки идемпотентности воркеров'],
          riskLevel: 'LOW' as const,
          estimatedBlastRadius: 3,
        }
      ],
    };

    const parsedReq = DialecticalArbitrationRequestSchema.safeParse(dialecticalReq);
    expect(parsedReq.success).toBe(true);

    const dialecticalVerdict = {
      taskId: 'task_queue_architecture_456',
      winningRole: 'GAMMA_SYNTHESIS' as const,
      confidenceScore: 0.98,
      invariantViolations: {
        ALPHA_RADICAL: ['Violates infrastructure budget invariant'],
        BETA_CONSERVATIVE: ['Violates 5000 RPS throughput requirement'],
      },
      riskAssessment: {
        alphaRiskScore: 0.85,
        betaRiskScore: 0.40,
        gammaRiskScore: 0.12,
      },
      rationale: 'Синтез GAMMA снимает противоречие: обеспечивает пропускную способность без усложнения инфраструктуры',
      recommendedAction: 'EXECUTE_IMMEDIATELY' as const,
      latencyMs: 34,
    };

    const parsedVerdict = DialecticalVerdictSchema.safeParse(dialecticalVerdict);
    expect(parsedVerdict.success).toBe(true);
  });

  it('validates MCP DialecticalSynthesisRequest and Response (Thesis Alpha, Antithesis Beta, Synthesis Gamma)', () => {
    const request = {
      problemStatement: 'Как организовать кеширование каталога услуг?',
      context: '100 провайдеров, 50 000 услуг, частое обновление цен',
      candidates: [
        {
          id: 'cand_alpha',
          role: 'THESIS_ALPHA' as const,
          title: 'Распределенный Redis Cluster с непрерывной синхронизацией',
          philosophy: 'Максималистская масштабируемость и real-time данные',
          solutionProposal: 'Создание отдельного Redis кластера с pub/sub шиной',
          identifiedRisks: ['Высокая стоимость серверов', 'Сложность мониторинга'],
          estimatedOverheadScore: 0.85,
        },
        {
          id: 'cand_beta',
          role: 'ANTITHESIS_BETA' as const,
          title: 'Локальный in-memory LRU кэш на 5 минут в каждом инстансе',
          philosophy: 'Zero-overhead, fail-closed, абсолютная простота',
          solutionProposal: 'Простая Map со счетчиком TTL 300 секунд',
          identifiedRisks: ['Рассинхронизация цен между подами', 'Устаревшие данные'],
          estimatedOverheadScore: 0.05,
        },
        {
          id: 'cand_gamma',
          role: 'SYNTHESIS_GAMMA' as const,
          title: 'Shadow Catalog в существующем Redis с SHA-256 хешированием и L1 LRU',
          philosophy: 'ТРИЗ синтез: скорость L1 памяти и консистентность Redis без новых кластеров',
          solutionProposal: 'Двухуровневый кэш L1 (in-memory 1000 записей) + L2 Redis Shadow Catalog',
          identifiedRisks: ['Необходимость сброса L1 при инвалидации'],
          estimatedOverheadScore: 0.25,
          contradictionResolution: 'Снимает противоречие стоимости и консистентности за счет двухуровневой архитектуры',
        },
      ],
      hardInvariants: ['Не создавать новые платные серверы', 'Цена не должна быть устаревшей более 60 секунд'],
    };

    expect(DialecticalSynthesisRequestSchema.safeParse(request).success).toBe(true);

    const response = {
      selectedCandidateId: 'cand_gamma',
      selectedRole: 'SYNTHESIS_GAMMA' as const,
      successProbability: 0.96,
      synergyScore: 0.92,
      vetoOverridden: false,
      arbitrationRationale: 'Вариант Gamma снимает противоречие между оверхедом Alpha и рассинхроном Beta',
      vectorScores: {
        safety: 0.98,
        latency: 0.95,
        impact: 0.90,
        resolution: 0.96,
      },
      latencyMs: 29,
    };

    expect(DialecticalSynthesisResponseSchema.safeParse(response).success).toBe(true);
  });
});
