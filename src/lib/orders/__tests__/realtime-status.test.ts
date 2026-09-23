import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishOrderStatusUpdate, autoResolveOrderDisputes, memoryOrderEmitter } from '../realtime-status';
import { db } from '@/lib/db';

describe('PREM-09: Real-time Order Status & Dispute Auto-Resolve', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    memoryOrderEmitter.removeAllListeners();
  });

  it('publishes status update event to memory emitter', async () => {
    const orderId = 'ord_test_sse_101';
    let receivedPayload: any = null;

    memoryOrderEmitter.on(`order:${orderId}:status`, (payload) => {
      receivedPayload = payload;
    });

    await publishOrderStatusUpdate(orderId, 'IN_PROGRESS', { remains: 50 });

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.orderId).toBe(orderId);
    expect(receivedPayload.status).toBe('IN_PROGRESS');
    expect(receivedPayload.metadata?.remains).toBe(50);
  });

  it('auto-resolves dispute tickets when order status transitions to COMPLETED', async () => {
    const orderId = 'ord_test_dispute_999';

    vi.spyOn(db.ticket, 'findMany').mockResolvedValueOnce([
      { id: 'ticket_1', orderId, status: 'OPEN', tags: ['DISPUTE'] } as any,
      { id: 'ticket_2', orderId, status: 'PENDING', tags: ['NOT_DELIVERED'] } as any,
    ]);

    const updateSpy = vi.spyOn(db.ticket, 'update').mockResolvedValue({} as any);

    const count = await autoResolveOrderDisputes(orderId);

    expect(count).toBe(2);
    expect(updateSpy).toHaveBeenCalledTimes(2);
  });
});
