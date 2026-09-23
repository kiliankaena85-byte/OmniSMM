/**
 * @file ai-draft-caching-speed.test.ts
 * @description Unit tests for AI draft caching, prefetch, and instant response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = new Map<string, string>();
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockImplementation(async (key: string) => mockRedis.get(key) || null),
    set: vi.fn().mockImplementation(async (key: string, val: string) => {
      mockRedis.set(key, val);
      return 'OK';
    }),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findFirst: vi.fn().mockResolvedValue({
        id: 't-100',
        tenantId: 'smmplan',
        messages: [
          { id: 'm-1', sender: 'USER', text: 'Заказ #1234 оформлен 20 минут назад, когда начнется накрутка?' }
        ],
        user: {
          email: 'client@example.com',
          balance: BigInt(50000),
          orders: [
            {
              id: 'ord-1234',
              status: 'IN_PROGRESS',
              charge: BigInt(6316),
              remains: 100,
              quantity: 100,
              error: null,
              service: { name: 'Telegram Просмотры' },
            }
          ]
        }
      })
    }
  }
}));

vi.mock('@/services/ai/gemini-client', () => ({
  GeminiClient: {
    generateContent: vi.fn().mockResolvedValue(JSON.stringify({
      client_sentiment: 'NEUTRAL',
      escalate_to_senior: false,
      internal_reasoning: 'Заказ в обработке, сообщаем регламентные сроки старта.',
      draft_reply: 'Здравствуйте! Заказ #ord-1234 находится в процессе запуска. Обычно старт занимает от 5 до 30 минут.'
    })),
    resolveLatestModel: vi.fn().mockResolvedValue('gemini-3-flash-preview'),
    getDispatchers: vi.fn().mockResolvedValue([undefined]),
  }
}));

describe('AI Draft Caching & Fast Response Performance', () => {
  beforeEach(() => {
    mockRedis.clear();
    vi.clearAllMocks();
  });

  it('generates reply on first call and caches in Redis', async () => {
    const { aiSupportService } = await import('@/services/admin/ai-support.service');
    const res1 = await aiSupportService.generateReply('t-100', 'smmplan');

    expect(res1.draft_reply).toContain('Здравствуйте!');
    expect(res1.fromCache).toBe(false);
    expect(mockRedis.size).toBe(1);
  });

  it('serves from Redis cache on second call with zero latency LLM overhead', async () => {
    const { aiSupportService } = await import('@/services/admin/ai-support.service');
    const { GeminiClient } = await import('@/services/ai/gemini-client');

    await aiSupportService.generateReply('t-100', 'smmplan');
    const res2 = await aiSupportService.generateReply('t-100', 'smmplan');

    expect(res2.draft_reply).toContain('Здравствуйте!');
    expect(res2.fromCache).toBe(true);
    expect(GeminiClient.generateContent).toHaveBeenCalledTimes(1); // Not called again
  });

  it('bypasses cache when forceRefresh is true', async () => {
    const { aiSupportService } = await import('@/services/admin/ai-support.service');
    const { GeminiClient } = await import('@/services/ai/gemini-client');

    await aiSupportService.generateReply('t-100', 'smmplan');
    const res3 = await aiSupportService.generateReply('t-100', 'smmplan', { forceRefresh: true });

    expect(res3.fromCache).toBe(false);
    expect(GeminiClient.generateContent).toHaveBeenCalledTimes(2);
  });
});
