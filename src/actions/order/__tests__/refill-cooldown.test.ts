import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestClientRefillAction } from '../refill';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    order: {
      findFirst: vi.fn(),
    },
    refill: {
      create: vi.fn(),
    },
  };
  return { db: mockDb };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@/lib/queue-manager', () => ({
  refillQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
  getRedisConnection: () => ({
    set: vi.fn().mockResolvedValue('OK'),
  }),
}));

describe('Refill Client Cooldown & Anti-Spam Protections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
  });

  it('blocks refill request if previous refill was REJECTED less than 24h ago', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [
        {
          id: 'refill-rej',
          status: 'REJECTED',
          createdAt: twoHoursAgo,
        },
      ],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('отклонена');
      expect(res.error).toContain('Повторный запрос будет доступен через 22 ч');
      expect(res.refill?.status).toBe('REJECTED');
    }
    expect(db.refill.create).not.toHaveBeenCalled();
  });

  it('allows refill request if previous refill was REJECTED more than 24h ago', async () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);

    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [
        {
          id: 'refill-rej-old',
          status: 'REJECTED',
          createdAt: twentyFiveHoursAgo,
        },
      ],
    } as any);

    vi.mocked(db.refill.create).mockResolvedValue({
      id: 'refill-new',
      status: 'PENDING',
      createdAt: new Date(),
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });

    expect(res.success).toBe(true);
    expect(db.refill.create).toHaveBeenCalled();
  });

  it('blocks refill request if previous refill was COMPLETED less than 24h ago', async () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [
        {
          id: 'refill-comp',
          status: 'COMPLETED',
          createdAt: tenHoursAgo,
        },
      ],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('успешно выполнена');
      expect(res.error).toContain('через 14 ч');
    }
    expect(db.refill.create).not.toHaveBeenCalled();
  });

  it('blocks refill request if previous refill was ERROR less than 1h ago', async () => {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [
        {
          id: 'refill-err',
          status: 'ERROR',
          createdAt: twentyMinsAgo,
        },
      ],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('произошла ошибка');
      expect(res.error).toContain('40 мин');
    }
    expect(db.refill.create).not.toHaveBeenCalled();
  });
});
