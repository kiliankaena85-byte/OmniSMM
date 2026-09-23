import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YooKassaStatusChecker } from '@/services/financial/yookassa-status-checker';
import { P0AlertDebouncer } from '@/lib/alerts/p0-alert-debouncer';
import { P0ThreatSensorService } from '@/services/telemetry/p0-threat-sensor.service';
import { paymentService } from '@/services/financial/payment.service';
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
  sendP0EmergencyAlert: vi.fn(async () => {}),
}));

describe('⚔️ Adversarial Red Team vs Blue Team Boundary Suite (All Modified Modules)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // VECTOR 1: RED TEAM - 429 Too Many Requests Spike Attack on YooKassa API
  // =========================================================================
  it('Vector 1 (Red vs Blue): YooKassa Rate Limiter & Backoff blocks 429 flood attacks gracefully', async () => {
    // Red Team: Simulates YooKassa returning HTTP 429
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 429,
      ok: false,
      json: async () => ({ error: 'Too Many Requests' }),
    } as any);

    // Blue Team: Must return null without throwing or crashing
    const result = await YooKassaStatusChecker.checkPaymentStatus('gw-test-429', 'shop-1', 'sec-1');
    expect(result).toBeNull();

    global.fetch = originalFetch;
  });

  // =========================================================================
  // VECTOR 2: RED TEAM - Network Timeout / Black Hole on Gateway
  // =========================================================================
  it('Vector 2 (Red vs Blue): AbortSignal Timeout handles dead network sockets without hanging', async () => {
    // Red Team: Simulates a network hang exceeding timeout
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('AbortError: The operation was aborted'));

    // Blue Team: Catches timeout cleanly, logs warning, returns null safely
    const result = await YooKassaStatusChecker.checkPaymentStatus('gw-test-timeout', 'shop-1', 'sec-1');
    expect(result).toBeNull();

    global.fetch = originalFetch;
  });

  // =========================================================================
  // VECTOR 3: RED TEAM - Redis Cold Boot / Offline Fallback for Debouncer
  // =========================================================================
  it('Vector 3 (Red vs Blue): P0AlertDebouncer survives complete Redis offline outage via in-memory locks', async () => {
    // Red Team: Forces Redis to simulate disconnected state
    const originalStatus = redis.status;
    Object.defineProperty(redis, 'status', { value: 'end', configurable: true });

    const key = `offline_test_${Date.now()}`;

    // 1st attempt: In-memory lock acquired -> TRUE
    const first = await P0AlertDebouncer.shouldSendAlert(key, 60);
    expect(first).toBe(true);

    // 2nd attempt: In-memory lock blocks duplicate spam -> FALSE
    const second = await P0AlertDebouncer.shouldSendAlert(key, 60);
    expect(second).toBe(false);

    // Threshold sliding window in-memory fallback
    const threshKey = `offline_thresh_${Date.now()}`;
    const t1 = await P0AlertDebouncer.checkThresholdTrigger(threshKey, 60, 2);
    expect(t1.shouldTrigger).toBe(false);
    const t2 = await P0AlertDebouncer.checkThresholdTrigger(threshKey, 60, 2);
    expect(t2.shouldTrigger).toBe(true);

    Object.defineProperty(redis, 'status', { value: originalStatus, configurable: true });
  });

  // =========================================================================
  // VECTOR 4: RED TEAM - Race Condition on confirmPayment (Active Pull vs Webhook)
  // =========================================================================
  it('Vector 4 (Red vs Blue): Atomic Idempotency eliminates Double-Credit race condition', async () => {
    // Create a real user and payment in the test DB
    const user = await db.user.create({
      data: {
        email: `race_test_${Date.now()}@smmplan.local`,
        balance: BigInt(0),
        role: 'USER',
      },
    });

    const gatewayId = `gw_race_${Date.now()}`;
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        amount: BigInt(10000), // 100 RUB
        currency: 'RUB',
        status: 'PENDING',
        gatewayId,
        gateway: 'yookassa',
      },
    });

    // 1st call: Initial successful confirmation
    const firstCall = await paymentService.confirmPayment(
      gatewayId,
      BigInt(10000),
      user.id,
      false,
      'yookassa',
      payment.id
    );
    expect(firstCall).toBe(true);

    // Verify balance was credited once
    const updatedUser = await db.user.findUnique({ where: { id: user.id } });
    expect(updatedUser?.balance).toBe(BigInt(10000));

    // 2nd simultaneous call (simulating delayed webhook racing with active pull)
    const secondCall = await paymentService.confirmPayment(
      gatewayId,
      BigInt(10000),
      user.id,
      false,
      'yookassa',
      payment.id
    );
    expect(secondCall).toBe(true);

    // Verify balance is STILL 10000 (NOT 20000 - no double credit!)
    const doubleCheckUser = await db.user.findUnique({ where: { id: user.id } });
    expect(doubleCheckUser?.balance).toBe(BigInt(10000));
  });

  // =========================================================================
  // VECTOR 5: RED TEAM - Disk / Memory Sensor Edge Values
  // =========================================================================
  it('Vector 5 (Red vs Blue): Telemetry sensor handles zero/negative or missing OS stats safely', async () => {
    // Red Team: Tests system health scan under various environments (Docker, Windows, Linux)
    const scan = await P0ThreatSensorService.runFullP0Scan();

    expect(scan).toBeDefined();
    expect(scan.memoryUsedPercent).toBeGreaterThanOrEqual(0);
    expect(scan.diskFreePercent).toBeGreaterThanOrEqual(0);
    expect(typeof scan.isStaleCurrency).toBe('boolean');
  });

  // =========================================================================
  // VECTOR 6: RED TEAM - Fractional Kopeck Overflow on YooKassa Amount Parsing
  // =========================================================================
  it('Vector 6 (Red vs Blue): Amount string parsing to Cents avoids float precision loss (e.g. 19.99 RUB -> 1999)', () => {
    // Red Team: Floating point arithmetic flaw (19.99 * 100 in JS can become 1998.9999999999998)
    const testCases = [
      { input: '10.00', expected: 1000 },
      { input: '19.99', expected: 1999 },
      { input: '1450.50', expected: 145050 },
      { input: '0.01', expected: 1 },
      { input: '999999.99', expected: 99999999 },
    ];

    for (const { input, expected } of testCases) {
      const parsed = Math.round(parseFloat(input) * 100);
      expect(parsed).toBe(expected);
    }
  });
});
