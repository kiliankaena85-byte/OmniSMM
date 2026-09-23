import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiFunnelAnalystService, type FunnelMetricsInput } from '@/services/analytics/ai-funnel-analyst.service';

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('@/services/ai/gemini-client', () => ({
  GeminiClient: {
    generateContent: vi.fn(),
  },
}));

describe('AiFunnelAnalystService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute deterministic fallback correctly for normal funnel', async () => {
    const input: FunnelMetricsInput = {
      linkPasted: 1000,
      serviceSelected: 600,
      checkoutInitiated: 300,
      paymentClicked: 150,
      periodDays: 7,
      tenantId: 'smmplan',
      topServices: [{ name: 'Telegram Подписчики', clicks: 250 }],
    };

    const res = await AiFunnelAnalystService.analyzeFunnel(input);

    expect(res).toBeDefined();
    expect(res.healthScore).toBeGreaterThanOrEqual(80);
    expect(res.healthStatus).toBe('EXCELLENT');
    expect(res.bottleneck.step).toBeDefined();
    expect(res.growthRecommendations.length).toBe(3);
    expect(res.strengths.length).toBeGreaterThanOrEqual(1);
  });

  it('should safely handle zero events without NaN or division by zero', async () => {
    const input: FunnelMetricsInput = {
      linkPasted: 0,
      serviceSelected: 0,
      checkoutInitiated: 0,
      paymentClicked: 0,
      periodDays: 1,
      tenantId: 'flux',
    };

    const res = await AiFunnelAnalystService.analyzeFunnel(input);

    expect(res).toBeDefined();
    expect(res.healthScore).toBe(35);
    expect(res.healthStatus).toBe('CRITICAL');
    expect(res.bottleneck.dropOffRate).toBe(100);
    expect(Number.isNaN(res.bottleneck.dropOffRate)).toBe(false);
  });

  it('should identify bottleneck at checkout when step 3 has highest drop-off', () => {
    const metrics: FunnelMetricsInput = {
      linkPasted: 1000,
      serviceSelected: 900, // Drop 10%
      checkoutInitiated: 200, // Drop 77.8% (BIGGEST)
      paymentClicked: 150, // Drop 25%
      periodDays: 7,
      tenantId: 'smmplan',
    };

    const rates = {
      crStep1To2: 90,
      crStep2To3: 22.2,
      crStep3To4: 75,
      finalCr: 15,
      drop1To2: 10,
      drop2To3: 77.8,
      drop3To4: 25,
    };

    const fallback = AiFunnelAnalystService.buildDeterministicFallback(metrics, rates);

    expect(fallback.bottleneck.step).toContain('Шаг 3: Ввод параметров и чекаут');
    expect(fallback.growthRecommendations.length).toBe(3);
  });
});
