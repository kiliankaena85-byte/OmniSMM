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
    add: vi.fn().mockResolvedValue({ id: 'job-refill-1' }),
  },
}));

describe('R2 Refill Feature Challenge & Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. IDOR Protection Tests', () => {
    it('blocks User A from requesting refill on User B order', async () => {
      // Session belongs to User A
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      
      // db.order.findFirst returns null because query is scoped where: { id: 'order-belonging-to-user-B', userId: 'user-A' }
      vi.mocked(db.order.findFirst).mockResolvedValue(null as any);

      const res = await requestClientRefillAction({ orderId: 'order-belonging-to-user-B' });
      
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Заказ не найден или недоступен');
      }

      // Verify db query explicitly scoped to session userId
      expect(db.order.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'order-belonging-to-user-B',
            userId: 'user-A',
          }),
        })
      );
    });

    it('rejects unauthenticated user', async () => {
      vi.mocked(verifySession).mockResolvedValue(null as any);

      const res = await requestClientRefillAction({ orderId: 'order-123' });
      
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Пользователь не авторизован');
      }
      expect(db.order.findFirst).not.toHaveBeenCalled();
    });

    it('rejects invalid or missing orderId', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);

      const res1 = await requestClientRefillAction({ orderId: '' });
      expect(res1.success).toBe(false);

      const res2 = await requestClientRefillAction(null as any);
      expect(res2.success).toBe(false);
    });
  });

  describe('2. Order Status Guard Tests', () => {
    const invalidStatuses = ['PENDING', 'PROCESSING', 'CANCELLED', 'REFUNDED', 'FAILED', 'AWAITING_PAYMENT', 'DRAFT'];

    invalidStatuses.forEach((status) => {
      it(`rejects refill request when order status is ${status}`, async () => {
        vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
        vi.mocked(db.order.findFirst).mockResolvedValue({
          id: 'order-1',
          userId: 'user-A',
          status: status,
          service: { isRefillEnabled: true },
          refills: [],
        } as any);

        const res = await requestClientRefillAction({ orderId: 'order-1' });

        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('Докрутка доступна только для завершенных или частично выполненных заказов');
        }
      });
    });

    it('allows refill request when order status is COMPLETED', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [],
      } as any);

      const now = new Date();
      vi.mocked(db.refill.create).mockResolvedValue({
        id: 'refill-comp-1',
        orderId: 'order-1',
        status: 'PENDING',
        createdAt: now,
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });
      expect(res.success).toBe(true);
    });

    it('allows refill request when order status is PARTIAL', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-2',
        userId: 'user-A',
        status: 'PARTIAL',
        service: { isRefillEnabled: true },
        refills: [],
      } as any);

      const now = new Date();
      vi.mocked(db.refill.create).mockResolvedValue({
        id: 'refill-part-1',
        orderId: 'order-2',
        status: 'PENDING',
        createdAt: now,
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-2' });
      expect(res.success).toBe(true);
    });
  });

  describe('3. Duplicate Refill Guard Tests', () => {
    it('blocks refill when an active refill has status PENDING', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [
          { id: 'refill-p', status: 'PENDING', createdAt: new Date() },
        ],
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Заявка на докрутку уже принята и находится в обработке');
      }
      expect(db.refill.create).not.toHaveBeenCalled();
    });

    it('blocks refill when an active refill has status IN_PROGRESS', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [
          { id: 'refill-ip', status: 'IN_PROGRESS', createdAt: new Date() },
        ],
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Заявка на докрутку уже принята и находится в обработке');
      }
      expect(db.refill.create).not.toHaveBeenCalled();
    });

    it('allows new refill when previous refill status is COMPLETED or FAILED or REJECTED', async () => {
      vi.mocked(verifySession).mockResolvedValue({ userId: 'user-A', tenantId: 'smmplan' } as any);
      vi.mocked(db.order.findFirst).mockResolvedValue({
        id: 'order-1',
        userId: 'user-A',
        status: 'COMPLETED',
        service: { isRefillEnabled: true },
        refills: [
          { id: 'refill-old-comp', status: 'COMPLETED', createdAt: new Date(Date.now() - 86400000) },
          { id: 'refill-old-failed', status: 'FAILED', createdAt: new Date(Date.now() - 43200000) },
        ],
      } as any);

      const now = new Date();
      vi.mocked(db.refill.create).mockResolvedValue({
        id: 'refill-new-2',
        orderId: 'order-1',
        status: 'PENDING',
        createdAt: now,
      } as any);

      const res = await requestClientRefillAction({ orderId: 'order-1' });

      expect(res.success).toBe(true);
      expect(db.refill.create).toHaveBeenCalledWith({
        data: {
          orderId: 'order-1',
          status: 'PENDING',
        },
      });
    });
  });
});
