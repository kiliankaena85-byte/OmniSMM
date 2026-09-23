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
}));

describe('requestClientRefillAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when user is not authenticated', async () => {
    vi.mocked(verifySession).mockResolvedValue(null as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Пользователь не авторизован');
    }
  });

  it('returns error when order is not found or owned by another user', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue(null as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Заказ не найден или недоступен');
    }
  });

  it('returns error when service does not support refill', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: false },
      refills: [],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Для данной услуги бесплатная докрутка не предусмотрена');
    }
  });

  it('returns error when order status is AWAITING_PAYMENT', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'AWAITING_PAYMENT',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Докрутка доступна только для завершенных или частично выполненных заказов');
    }
  });

  it('returns error when an active refill is already PENDING', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [
        {
          id: 'refill-existing',
          status: 'PENDING',
          createdAt: new Date('2026-07-26T10:00:00Z'),
        },
      ],
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe('Заявка на докрутку уже принята и находится в обработке');
    }
  });

  it('successfully creates refill when order is eligible', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    const now = new Date();
    vi.mocked(db.refill.create).mockResolvedValue({
      id: 'refill-new-123',
      numericId: 101,
      orderId: 'order-1',
      status: 'PENDING',
      externalId: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-1' });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.message).toBe('Заявка на докрутку принята');
      expect(res.refill.id).toBe('refill-new-123');
      expect(res.refill.status).toBe('PENDING');
    }
    expect(db.refill.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        status: 'PENDING',
      },
    });
  });

  it('successfully creates refill when orderId is passed as string directly', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'user-1', tenantId: 'smmplan' } as any);
    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PARTIAL',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    const now = new Date();
    vi.mocked(db.refill.create).mockResolvedValue({
      id: 'refill-str-123',
      numericId: 102,
      orderId: 'order-1',
      status: 'PENDING',
      externalId: null,
      createdAt: now,
      updatedAt: now,
    } as any);

    const res = await requestClientRefillAction('order-1');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.message).toBe('Заявка на докрутку принята');
      expect(res.refill.id).toBe('refill-str-123');
      expect(res.refill.status).toBe('PENDING');
    }
  });
});

