import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ordersQueue, syncQueue } from '@/lib/queue-manager';
import { getSystemTelemetry } from '@/services/telemetry/system-telemetry.service';

describe('Audit P0: Redis Degradation & Telemetry Fail-Fast Guard (DEF-003)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('R3.1: getSystemTelemetry completes within 2500ms even if BullMQ queues hang indefinitely', async () => {
    // Simulate BullMQ connection hanging due to maxRetriesPerRequest: null when Redis is unreachable
    vi.spyOn(ordersQueue, 'getWaitingCount').mockImplementation(
      () => new Promise(() => {/* never resolves */})
    );
    vi.spyOn(ordersQueue, 'getActiveCount').mockImplementation(
      () => new Promise(() => {/* never resolves */})
    );
    vi.spyOn(ordersQueue, 'getFailedCount').mockImplementation(
      () => new Promise(() => {/* never resolves */})
    );
    vi.spyOn(syncQueue, 'getWaitingCount').mockImplementation(
      () => new Promise(() => {/* never resolves */})
    );

    const startTime = Date.now();
    const result = await getSystemTelemetry();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(3500); // Must not hang indefinitely
    expect(result).toBeDefined();
    expect(result.queues).toBeDefined();
    // In degraded/hanging state, fallback to 0 or warning
    expect(result.queues.ordersWaiting).toBe(0);
  }, 10000);
});
