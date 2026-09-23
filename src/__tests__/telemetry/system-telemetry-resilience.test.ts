import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemTelemetryService } from '@/services/telemetry/system-telemetry.service';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import * as notifications from '@/lib/notifications';
import fs from 'fs';

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
    getWaitingCount: vi.fn().mockResolvedValue(5),
    getActiveCount: vi.fn().mockResolvedValue(1),
    getFailedCount: vi.fn().mockResolvedValue(0),
  },
  syncQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(2),
  },
  paymentSyncQueue: {
    getWaitingCount: vi.fn().mockResolvedValue(0),
  },
}));

describe('NIST SI-4 & ISO 25010 (2026) System Monitoring & Capacity Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[NIST SI-4.1 / ISO 25010 Capacity] Disk Satiation Guard: Triggers CRITICAL alert when disk used >= 95%', async () => {
    vi.spyOn(fs, 'statfsSync').mockReturnValueOnce({
      blocks: 1000000,
      bfree: 30000, // 97% used
      bsize: 4096,
      bavail: 30000,
      files: 10000,
      ffree: 1000,
      type: 1,
    } as unknown as fs.StatsFs);

    const snapshot = await SystemTelemetryService.collectSnapshot();

    expect(snapshot.disk.status).toBe('CRITICAL');
    expect(snapshot.activeAlerts.some((a) => a.code === 'INFRA_DISK_CRITICAL')).toBe(true);
  });

  it('[NIST SI-4.2 / Fault Isolation] Database Connection Drop: Categorizes DB outage as CRITICAL without crashing runtime', async () => {
    vi.mocked(db.$queryRawUnsafe).mockRejectedValueOnce(
      new Error('Connection refused: server closed socket unexpectedly')
    );

    const snapshot = await SystemTelemetryService.collectSnapshot();

    expect(snapshot.database.status).toBe('DOWN');
    expect(snapshot.activeAlerts.some((a) => a.code === 'DB_CONNECTION_FAILED')).toBe(true);
    expect(snapshot.overallStatus).toBe('CRITICAL');
  });

  it('[NIST SI-4.3 / Redis Memory Threshold] Redis Saturation Guard: Warns before 1024MB limit is breached', async () => {
    // 950 MB used in Redis
    vi.mocked(redis.info).mockResolvedValueOnce('used_memory:996147200\nused_memory_peak:1000000000');

    const snapshot = await SystemTelemetryService.collectSnapshot();

    expect(snapshot.redis.usedMemoryMb).toBeGreaterThanOrEqual(900);
    expect(snapshot.redis.status).toBe('CRITICAL');
    expect(snapshot.activeAlerts.some((a) => a.code === 'REDIS_MEMORY_CRITICAL')).toBe(true);
  });

  it('[NIST SC-5 / Anti-Flooding] Alert Fatigue SLA: Suppresses repetitive spam alerts within 5-minute cooldown', async () => {
    const sendAdminAlertSpy = vi.spyOn(notifications, 'sendAdminAlert').mockImplementation(() => {});

    // First run: redis.get returns null -> Alert is sent
    vi.mocked(redis.get).mockResolvedValueOnce(null);
    const run1 = await SystemTelemetryService.evaluateAndAlertAdmins();

    // Second run within cooldown: redis.get returns "1" for all keys -> Alert is suppressed
    vi.mocked(redis.get).mockResolvedValue('1');
    const run2 = await SystemTelemetryService.evaluateAndAlertAdmins();

    expect(run2.alertsSent).toBe(0);
  });
});
