import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestClientRefillAction } from '@/actions/order/refill';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

const mockRedis = {
  set: vi.fn(),
  del: vi.fn(),
};

const mockRefillQueue = {
  add: vi.fn(),
};

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    isRefillModuleEnabled: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findFirst: vi.fn(),
    },
    refill: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock('@/lib/queue-manager', () => ({
  getRedisConnection: () => mockRedis,
  refillQueue: mockRefillQueue,
}));

describe('Refill Lifecycle Invariants (Domain 9 - ActionArbiter Selected Option)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRefillQueue.add.mockResolvedValue({ id: 'job-refill-1' });
  });

  it('1. should acquire distributed lock BEFORE database queries to prevent TOCTOU double-click race', async () => {
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'smmplan',
      role: 'USER',
    } as any);

    // Lock is already taken by another concurrent request
    mockRedis.set.mockResolvedValue(null);

    const res = await requestClientRefillAction({ orderId: 'order-123' });

    expect(res.success).toBe(false);
    expect(res.error).toContain('уже обрабатывается');
    // Database query should NOT have been called because lock check short-circuits
    expect(db.order.findFirst).not.toHaveBeenCalled();
  });

  it('2. should enforce deterministic BullMQ jobId to prevent duplicate refills to external provider', async () => {
    vi.mocked(verifySession).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'smmplan',
      role: 'USER',
    } as any);

    vi.mocked(db.order.findFirst).mockResolvedValue({
      id: 'order-123',
      numericId: 456,
      userId: 'user-1',
      tenantId: 'smmplan',
      status: 'COMPLETED',
      service: { isRefillEnabled: true },
      refills: [],
    } as any);

    vi.mocked(db.refill.create).mockResolvedValue({
      id: 'refill-abc',
      orderId: 'order-123',
      status: 'PENDING',
      createdAt: new Date(),
    } as any);

    const res = await requestClientRefillAction({ orderId: 'order-123' });

    expect(res.success).toBe(true);
    expect(mockRefillQueue.add).toHaveBeenCalledTimes(1);

    const [jobName, payload, options] = mockRefillQueue.add.mock.calls[0];
    expect(jobName).toBe('process-refill');
    expect(payload).toEqual({ refillId: 'refill-abc', tenantId: 'smmplan' });
    expect(options).toBeDefined();
    // Invariant: jobId must be deterministic to prevent duplicate provider charges
    expect(options?.jobId).toBe('refill-refill-abc');
  });
});
