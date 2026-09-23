import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0AlertDebouncer } from '@/lib/alerts/p0-alert-debouncer';
import { P0ThreatSensorService } from '@/services/telemetry/p0-threat-sensor.service';
import { NightlyLedgerAuditService } from '@/services/financial/nightly-ledger-audit.service';
import { sendP0EmergencyAlert } from '@/lib/notifications';
import { db } from '@/lib/db';

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
  sendP0EmergencyAlert: vi.fn(async () => {}),
}));

describe('P0 Threat Matrix, Anti-Spam Debounce & Sensor Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Vector 1: P0AlertDebouncer allows first alert and debounces duplicates during cooldown', async () => {
    const testKey = `test_key_${Date.now()}`;

    // 1st attempt: Must succeed
    const firstAttempt = await P0AlertDebouncer.shouldSendAlert(testKey, 60);
    expect(firstAttempt).toBe(true);

    // 2nd attempt immediately: Must be debounced (prevent spam)
    const secondAttempt = await P0AlertDebouncer.shouldSendAlert(testKey, 60);
    expect(secondAttempt).toBe(false);

    // Reset lock
    await P0AlertDebouncer.resetLock(testKey);

    // 3rd attempt after reset: Must succeed again
    const thirdAttempt = await P0AlertDebouncer.shouldSendAlert(testKey, 60);
    expect(thirdAttempt).toBe(true);
  });

  it('Vector 2: P0AlertDebouncer threshold counter requires N events before triggering', async () => {
    const thresholdKey = `thresh_${Date.now()}`;

    const res1 = await P0AlertDebouncer.checkThresholdTrigger(thresholdKey, 60, 3);
    expect(res1.count).toBe(1);
    expect(res1.shouldTrigger).toBe(false);

    const res2 = await P0AlertDebouncer.checkThresholdTrigger(thresholdKey, 60, 3);
    expect(res2.count).toBe(2);
    expect(res2.shouldTrigger).toBe(false);

    const res3 = await P0AlertDebouncer.checkThresholdTrigger(thresholdKey, 60, 3);
    expect(res3.count).toBe(3);
    expect(res3.shouldTrigger).toBe(true);
  });

  it('Vector 3: P0ThreatSensorService reports real OS memory and disk telemetry without throwing', async () => {
    const fullScan = await P0ThreatSensorService.runFullP0Scan();

    expect(typeof fullScan.memoryUsedPercent).toBe('number');
    expect(fullScan.memoryUsedPercent).toBeGreaterThanOrEqual(0);
    expect(fullScan.memoryUsedPercent).toBeLessThanOrEqual(100);

    expect(typeof fullScan.diskFreePercent).toBe('number');
    expect(fullScan.diskFreePercent).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(fullScan.lowBalanceProviders)).toBe(true);
  });

  it('Vector 4: NightlyLedgerAuditService flags balance and ledger discrepancies', async () => {
    // Mock db queries
    vi.spyOn(db.ledgerEntry, 'groupBy').mockResolvedValueOnce([
      { userId: 'user-1', _sum: { amount: BigInt(5000) } } as any,
    ]);

    vi.spyOn(db.user, 'findMany').mockResolvedValueOnce([
      { id: 'user-1', email: 'audit@test.com', balance: BigInt(6000) } as any, // 1000 drift
    ]);

    const auditResult = await NightlyLedgerAuditService.runIntegrityAudit();

    expect(auditResult.isHealthy).toBe(false);
    expect(auditResult.discrepancies.length).toBe(1);
    expect(auditResult.discrepancies[0].diffCents).toBe(1000);
    expect(sendP0EmergencyAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'P0_LEDGER_INVARIANT_BREACH',
      })
    );
  });

  it('Vector 5: NightlyLedgerAuditService passes cleanly when balance matches sum of ledgers', async () => {
    vi.spyOn(db.ledgerEntry, 'groupBy').mockResolvedValueOnce([
      { userId: 'user-2', _sum: { amount: BigInt(3500) } } as any,
    ]);

    vi.spyOn(db.user, 'findMany').mockResolvedValueOnce([
      { id: 'user-2', email: 'clean@test.com', balance: BigInt(3500) } as any, // 0 drift
    ]);

    const auditResult = await NightlyLedgerAuditService.runIntegrityAudit();

    expect(auditResult.isHealthy).toBe(true);
    expect(auditResult.discrepancies.length).toBe(0);
  });
});
