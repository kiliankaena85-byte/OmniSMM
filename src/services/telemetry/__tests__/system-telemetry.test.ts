import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemTelemetryService } from '../system-telemetry.service';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import * as notifications from '@/lib/notifications';

vi.mock('@/lib/db', () => ({
  db: {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    info: vi.fn().mockResolvedValue('used_memory:104857600\nused_memory_peak:209715200'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  ordersQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(12),
    getActiveCount: vi.fn().mockResolvedValue(2),
    getFailedCount: vi.fn().mockResolvedValue(0),
  },
  syncQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(5),
  },
  paymentSyncQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(0),
  },
}));

describe('SystemTelemetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should collect comprehensive hardware, db, redis and queue snapshot', async () => {
    const snapshot = await SystemTelemetryService.collectSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot.timestamp).toBeTypeOf('string');
    expect(['HEALTHY', 'DEGRADED', 'CRITICAL']).toContain(snapshot.overallStatus);

    // Disk
    expect(snapshot.disk.totalGb).toBeGreaterThanOrEqual(0);
    expect(snapshot.disk.usedPct).toBeGreaterThanOrEqual(0);

    // Memory
    expect(snapshot.memory.osTotalMb).toBeGreaterThan(0);
    expect(snapshot.memory.processRssMb).toBeGreaterThan(0);

    // Database
    expect(snapshot.database.status).toBe('HEALTHY');
    expect(snapshot.database.pingLatencyMs).toBeGreaterThanOrEqual(0);

    // Redis
    expect(snapshot.redis.usedMemoryMb).toBe(100);
    expect(snapshot.redis.peakMemoryMb).toBe(200);

    // Queues
    expect(snapshot.queues.ordersWaiting).toBe(12);
    expect(snapshot.queues.ordersActive).toBe(2);
  });

  it('should handle and report database latency degradation gracefully', async () => {
    vi.mocked(db.$queryRawUnsafe).mockImplementationOnce((async () => {
      await new Promise((r) => setTimeout(r, 850));
      return [{ 1: 1 }];
    }) as unknown as typeof db.$queryRawUnsafe);

    const snapshot = await SystemTelemetryService.collectSnapshot();
    expect(snapshot.database.status).toBe('DEGRADED');
    expect(snapshot.activeAlerts.some((a) => a.code === 'DB_SLOW_QUERY_SPIKE')).toBe(true);
  });

  it('should evaluate thresholds and dispatch debounced admin alerts to Telegram', async () => {
    const sendAdminAlertSpy = vi.spyOn(notifications, 'sendAdminAlert').mockImplementation(() => {});

    // Force high waiting queues
    const queueManager = await import('@/lib/queue-manager');
    vi.mocked(queueManager.ordersQueue.getWaitingCount).mockResolvedValueOnce(350);

    const result = await SystemTelemetryService.evaluateAndAlertAdmins();
    expect(result.snapshot.queues.ordersWaiting).toBe(350);
    expect(sendAdminAlertSpy).toHaveBeenCalled();
  });
});
