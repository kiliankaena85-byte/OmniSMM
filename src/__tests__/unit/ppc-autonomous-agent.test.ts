/**
 * src/__tests__/unit/ppc-autonomous-agent.test.ts
 *
 * TDD Unit-тесты для Автономного PPC-Агента OmniSMM (SDD-TDD 2026).
 * Проверяют архитектурные инварианты SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md:
 * - INVARIANT-PPC-1: Budget Ceiling Guard (потолок бюджета)
 * - INVARIANT-PPC-6: Policy 15 Immunity (защита от стоп-слов)
 * - IntentClassifier: разделение коммерческих и мусорных запросов
 * - CircuitBreaker: защита от спама неработающих эндпоинтов
 * - Zod DTO валидация контрактов Direct и Metrika
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  YandexDirectBidUpdateSchema,
  YandexDirectBidsPayloadSchema,
  YandexMetrikaResponseSchema,
  IntentClassifierResultSchema,
  BudgetLimitExceededError,
  Policy15ViolationError,
  validateBudgetCeiling,
  validatePolicy15Compliant,
  CircuitBreaker,
} from '@/services/ppc/types';
import { classifySearchIntents } from '@/services/ppc/intent-classifier';
import { ClickFraudSentinel } from '@/services/ppc/clickfraud-sentinel';

describe('Autonomous PPC Growth Agent — Architecture Invariants & Contracts', () => {
  describe('INVARIANT-PPC-1: Budget Ceiling Guard', () => {
    it('should allow budgets within the agreed daily ceiling (<= 4000 ₽)', () => {
      expect(() => validateBudgetCeiling(4000, 4000)).not.toThrow();
      expect(() => validateBudgetCeiling(2500, 4000)).not.toThrow();
    });

    it('should throw BudgetLimitExceededError when daily budget exceeds ceiling', () => {
      expect(() => validateBudgetCeiling(4001, 4000)).toThrow(BudgetLimitExceededError);
      expect(() => validateBudgetCeiling(10000, 4000)).toThrow(
        /Daily budget of 10000 RUB exceeds authorized ceiling of 4000 RUB/
      );
    });
  });

  describe('INVARIANT-PPC-6: Policy 15 Immunity', () => {
    it('should pass white-hat B2B phrases without prohibited terms', () => {
      const whiteHatPhrases = [
        'продвижение каналов телеграм',
        'рост охватов и активности вк',
        'b2b api шлюз для smm панелей',
        'продвижение каналов в мессенджере max',
      ];
      for (const phrase of whiteHatPhrases) {
        expect(() => validatePolicy15Compliant(phrase)).not.toThrow();
      }
    });

    it('should block phrases containing blackhat terms like "накрутка", "боты", "инвайтинг"', () => {
      const prohibitedPhrases = [
        'накрутка подписчиков телеграм',
        'купить дешевые боты вк',
        'спам рассылка инвайтинг тг',
        'взлом и накрутка просмотров',
      ];
      for (const phrase of prohibitedPhrases) {
        expect(() => validatePolicy15Compliant(phrase)).toThrow(Policy15ViolationError);
      }
    });
  });

  describe('Zod Contract-First DTO Validation', () => {
    it('should validate valid Yandex Direct bid update payload', () => {
      const validPayload = {
        method: 'set' as const,
        params: {
          Bids: [
            { KeywordId: 1001, Bid: 36500000 }, // 36.50 ₽ in micros
            { KeywordId: 1002, Bid: 48000000 }, // 48.00 ₽ in micros
          ],
        },
      };

      const result = YandexDirectBidsPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should reject Direct bids with negative or zero amounts', () => {
      const invalidPayload = {
        method: 'set',
        params: {
          Bids: [{ KeywordId: 1001, Bid: -500 }],
        },
      };

      const result = YandexDirectBidsPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should validate Yandex Metrika search query telemetry response', () => {
      const metrikaMockResponse = {
        data: [
          {
            dimensions: [{ name: 'купить подписчиков телеграм' }],
            metrics: [45, 2, 3.4], // visits, bounces, pageDepth
          },
          {
            dimensions: [{ name: 'скачать бесплатно взлом тг' }],
            metrics: [12, 11, 1.0], // 11 bounces out of 12!
          },
        ],
        total_rows: 2,
      };

      const result = YandexMetrikaResponseSchema.safeParse(metrikaMockResponse);
      expect(result.success).toBe(true);
    });
  });

  describe('CircuitBreaker: Gateway Resilience', () => {
    let cb: CircuitBreaker;

    beforeEach(() => {
      cb = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 1000 });
    });

    it('should remain closed under successful operations', async () => {
      const op = vi.fn().mockResolvedValue('OK');
      const res = await cb.execute(op);
      expect(res).toBe('OK');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('should trip to OPEN state after 3 consecutive failures', async () => {
      const failingOp = vi.fn().mockRejectedValue(new Error('Yandex API 500'));

      for (let i = 0; i < 3; i++) {
        await expect(cb.execute(failingOp)).rejects.toThrow('Yandex API 500');
      }

      expect(cb.getState()).toBe('OPEN');

      // Next call should fail immediately without executing the operation
      const freshOp = vi.fn();
      await expect(cb.execute(freshOp)).rejects.toThrow(/Circuit breaker is OPEN/);
      expect(freshOp).not.toHaveBeenCalled();
    });
  });

  describe('IntentClassifier: Separation of Commercial vs Junk Queries', () => {
    it('should extract negative keywords from pirate, informational, and freeloader queries', async () => {
      const rawQueries = [
        'купить подписчиков телеграм',
        'продвижение группы вк',
        'скачать бесплатно взлом подписчиков',
        'смотреть фильм безумный макс бесплатно',
        'работа кликать лайки заработок без вложений',
      ];

      const result = await classifySearchIntents(rawQueries);
      expect(result.commercialKeywords).toContain('купить подписчиков телеграм');
      expect(result.commercialKeywords).toContain('продвижение группы вк');

      expect(result.negativeKeywordsToAdd).toEqual(
        expect.arrayContaining(['бесплатно', 'взлом', 'фильм', 'заработок'])
      );
    });
  });

  describe('ClickFraudSentinel: Botnet & Click-Fraud Detection', () => {
    it('should identify high bounce rapid clicks as BOUNCE_SPIKE', () => {
      const sentinel = new ClickFraudSentinel({ bounceThreshold: 75, minVisitsThreshold: 3, maxDurationSeconds: 4 });
      const analysis = sentinel.analyzePhrasePerformance([
        {
          phrase: 'взлом накрутка бот',
          visits: 12,
          bounceRate: 88,
          pageviews: 12,
          avgDurationSeconds: 2,
          isHighBounce: true,
        },
        {
          phrase: 'продвижение вк групп',
          visits: 20,
          bounceRate: 25,
          pageviews: 55,
          avgDurationSeconds: 120,
          isHighBounce: false,
        },
      ], 35.0);

      expect(analysis.fraudAlerts).toHaveLength(1);
      expect(analysis.fraudAlerts[0].type).toBe('BOUNCE_SPIKE');
      expect(analysis.fraudAlerts[0].severity).toBe('HIGH');
      expect(analysis.suspiciousPhrases).toContain('взлом накрутка бот');
      expect(analysis.estimatedBudgetSavedRub).toBe(420); // 12 * 35 = 420 ₽
    });

    it('should identify 100% bounce rate clusters as BOT_CLUSTER', () => {
      const sentinel = new ClickFraudSentinel();
      const analysis = sentinel.analyzePhrasePerformance([
        {
          phrase: 'случайный бот кликер',
          visits: 6,
          bounceRate: 100,
          pageviews: 6,
          avgDurationSeconds: 8,
          isHighBounce: true,
        },
      ]);

      expect(analysis.fraudAlerts).toHaveLength(1);
      expect(analysis.fraudAlerts[0].type).toBe('BOT_CLUSTER');
    });
  });

  describe('YandexMetrikaClient & CroRetentionWebhook', () => {
    it('should resolve default counter ID 113263331', async () => {
      const { YandexMetrikaClient } = await import('@/services/ppc/yandex-metrika-client');
      const client = new YandexMetrikaClient();
      expect(client.getCounterId()).toBe('113263331');
    });

    it('should generate personalized lead nurturing notification', async () => {
      const { CroRetentionWebhook } = await import('@/services/ppc/cro-retention-webhook');
      const webhook = new CroRetentionWebhook();
      const result = await webhook.triggerRetentionPush({
        id: 'usr_test123',
        email: 'lead@example.com',
        createdAt: new Date(),
      });

      expect(result.delivered).toBe(true);
      expect(result.message).toContain('приветственный тест SMMplan');
      expect(result.message).toContain('https://smmplan.pro/dashboard');
    });
  });
});
