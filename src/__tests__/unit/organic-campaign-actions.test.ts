import { describe, it, expect, vi } from 'vitest';
import { CreateCampaignSchema } from '@/actions/organic/contracts';

// RED PHASE
import { createCampaignAction, getCampaignStatusAction } from '@/actions/organic/campaign';

vi.mock('@/lib/db', () => ({
  db: {
    organicGrowthCampaign: {
      create: vi.fn().mockResolvedValue({ id: 'camp_test_123' }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'camp_test_123',
        channelUsername: 'test_channel',
        status: 'ACTIVE',
        targetNetGain: 500,
        netGainActual: 120,
        followsDelivered: 145,
        unfollowsDelivered: 25,
        startDate: new Date(),
        endDate: new Date(Date.now() + 20 * 86400000),
      }),
    },
    organicDailyPlan: {
      createMany: vi.fn().mockResolvedValue({ count: 30 }),
    },
  },
}));

vi.mock('@/services/organic/natural-churn-engine', () => ({
  NaturalChurnEngine: {
    generateCampaignSchedule: vi.fn().mockReturnValue(
      Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() + i * 86400000),
        follows: 20, unfollows: 2, netGain: 18, churnRate: 0.1,
        hourlySchedule: [],
      }))
    ),
  },
}));

describe('CreateCampaignSchema', () => {
  it('strips @ from channelUsername', () => {
    const r = CreateCampaignSchema.safeParse({
      channelUsername: '@my_channel',
      targetNetGain: 500,
      orderId: 'ord_123',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.channelUsername).toBe('my_channel');
  });

  it('rejects targetNetGain below 100', () => {
    const r = CreateCampaignSchema.safeParse({
      channelUsername: 'chan',
      targetNetGain: 50,
      orderId: 'ord_123',
    });
    expect(r.success).toBe(false);
  });

  it('rejects churnRateMin > churnRateMax', () => {
    const r = CreateCampaignSchema.safeParse({
      channelUsername: 'chan',
      targetNetGain: 500,
      orderId: 'ord_123',
      churnRateMin: 0.3,
      churnRateMax: 0.1,
    });
    expect(r.success).toBe(false);
  });
});

describe('createCampaignAction', () => {
  it('returns campaignId on valid input', async () => {
    const result = await createCampaignAction({
      channelUsername: 'my_channel',
      targetNetGain: 500,
      durationDays: 30,
      orderId: 'ord_test_123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.campaignId).toBeDefined();
  });

  it('returns error on invalid input', async () => {
    const result = await createCampaignAction({ channelUsername: '!!invalid!!' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('getCampaignStatusAction', () => {
  it('returns status with progressPercent', async () => {
    const result = await getCampaignStatusAction('camp_test_123');
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.progressPercent).toBeGreaterThanOrEqual(0);
      expect(result.data.progressPercent).toBeLessThanOrEqual(100);
    }
  });
});
