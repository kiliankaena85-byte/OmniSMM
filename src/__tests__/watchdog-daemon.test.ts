import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWatchdogCheck, resetWatchdogState } from '@/lib/daemons/watchdog-daemon';
import { redis } from '@/lib/redis';
import { ordersQueue } from '@/lib/queue-manager';
import { db } from '@/lib/db';
import { DirectEmergencyAlertService } from '@/lib/notifications/direct-emergency-alert.service';

vi.mock('@/lib/redis', () => ({
  redis: {
    ping: vi.fn(),
    get: vi.fn()
  }
}));

vi.mock('@/lib/queue-manager', () => ({
  ordersQueue: {
    getWaitingCount: vi.fn()
  }
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/notifications/direct-emergency-alert.service', () => ({
  DirectEmergencyAlertService: {
    sendRedisFailureAlert: vi.fn().mockResolvedValue({ success: true }),
    sendWorkerDownAlert: vi.fn().mockResolvedValue({ success: true }),
    sendStuckOrdersAlert: vi.fn().mockResolvedValue({ success: true }),
    sendStuckOrdersResolvedAlert: vi.fn().mockResolvedValue({ success: true })
  }
}));

describe('WatchdogDaemon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWatchdogState();
  });

  it('should report healthy when Redis, Worker heartbeat, and DB queues are normal', async () => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
    vi.mocked(ordersQueue.getWaitingCount).mockResolvedValue(0);
    vi.mocked(redis.get).mockResolvedValue((Date.now() - 10_000).toString()); // 10s ago
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    const result = await runWatchdogCheck();

    expect(result.redisOk).toBe(true);
    expect(result.workerOk).toBe(true);
    expect(result.stuckOrdersCount).toBe(0);
    expect(DirectEmergencyAlertService.sendWorkerDownAlert).not.toHaveBeenCalled();
    expect(DirectEmergencyAlertService.sendStuckOrdersAlert).not.toHaveBeenCalled();
  });

  it('should alert and return workerOk=false when heartbeat is stale', async () => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
    vi.mocked(ordersQueue.getWaitingCount).mockResolvedValue(5);
    vi.mocked(redis.get).mockResolvedValue((Date.now() - 300_000).toString()); // 5m ago (> 120s)
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    const result = await runWatchdogCheck();

    expect(result.redisOk).toBe(true);
    expect(result.workerOk).toBe(false);
    expect(DirectEmergencyAlertService.sendWorkerDownAlert).toHaveBeenCalledWith(
      expect.any(Number),
      5
    );
  });

  it('should detect and alert when orders are stuck in PENDING > 10m', async () => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
    vi.mocked(ordersQueue.getWaitingCount).mockResolvedValue(0);
    vi.mocked(redis.get).mockResolvedValue(Date.now().toString());
    vi.mocked(db.order.findMany).mockResolvedValue([
      { id: 'ord_1', numericId: 370, createdAt: new Date(Date.now() - 15 * 60 * 1000) }
    ] as any);

    const result = await runWatchdogCheck();

    expect(result.stuckOrdersCount).toBe(1);
    expect(DirectEmergencyAlertService.sendStuckOrdersAlert).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      [370]
    );
  });

  it('should suppress duplicate alerts on subsequent checks when stuck count is unchanged', async () => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
    vi.mocked(ordersQueue.getWaitingCount).mockResolvedValue(0);
    vi.mocked(redis.get).mockResolvedValue(Date.now().toString());
    vi.mocked(db.order.findMany).mockResolvedValue([
      { id: 'ord_1', numericId: 370, createdAt: new Date(Date.now() - 15 * 60 * 1000) }
    ] as any);

    // First check triggers alert
    await runWatchdogCheck();
    expect(DirectEmergencyAlertService.sendStuckOrdersAlert).toHaveBeenCalledTimes(1);

    // Second check immediately with same 1 stuck order should NOT trigger alert (suppressed)
    await runWatchdogCheck();
    expect(DirectEmergencyAlertService.sendStuckOrdersAlert).toHaveBeenCalledTimes(1);
  });

  it('should trigger escalation alert when stuck orders increase by delta >= 2', async () => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
    vi.mocked(ordersQueue.getWaitingCount).mockResolvedValue(0);
    vi.mocked(redis.get).mockResolvedValue(Date.now().toString());

    // 1. Initial state with 1 stuck order
    vi.mocked(db.order.findMany).mockResolvedValueOnce([
      { id: 'ord_1', numericId: 370, createdAt: new Date(Date.now() - 15 * 60 * 1000) }
    ] as any);
    await runWatchdogCheck();
    expect(DirectEmergencyAlertService.sendStuckOrdersAlert).toHaveBeenCalledTimes(1);

    // 2. Escalation: count jumps from 1 to 3 (delta = +2)
    vi.mocked(db.order.findMany).mockResolvedValueOnce([
      { id: 'ord_1', numericId: 370, createdAt: new Date(Date.now() - 15 * 60 * 1000) },
      { id: 'ord_2', numericId: 371, createdAt: new Date(Date.now() - 12 * 60 * 1000) },
      { id: 'ord_3', numericId: 372, createdAt: new Date(Date.now() - 11 * 60 * 1000) }
    ] as any);

    await runWatchdogCheck();

    expect(DirectEmergencyAlertService.sendStuckOrdersAlert).toHaveBeenCalledWith(
      3,
      expect.any(Number),
      [370, 371, 372],
      expect.objectContaining({ delta: 2, isEscalation: true })
    );
  });

  it('should dispatch resolved alert when stuck orders drop back to 0', async () => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
    vi.mocked(ordersQueue.getWaitingCount).mockResolvedValue(0);
    vi.mocked(redis.get).mockResolvedValue(Date.now().toString());

    // 1. Start incident with 2 stuck orders
    vi.mocked(db.order.findMany).mockResolvedValueOnce([
      { id: 'ord_1', numericId: 370, createdAt: new Date(Date.now() - 15 * 60 * 1000) },
      { id: 'ord_2', numericId: 371, createdAt: new Date(Date.now() - 12 * 60 * 1000) }
    ] as any);
    await runWatchdogCheck();

    // 2. Orders resolved/cleared to 0
    vi.mocked(db.order.findMany).mockResolvedValueOnce([]);
    await runWatchdogCheck();

    expect(DirectEmergencyAlertService.sendStuckOrdersResolvedAlert).toHaveBeenCalledWith(2);
  });
});
