import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { EscrowService } from '@/services/admin/escrow.service';

// Mock notifications (fire-and-forget, no real Telegram in tests)
vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));



import { sendAdminAlert } from '@/lib/notifications';

describe('EscrowService — Integration Tests (Real DB)', () => {
  let service: EscrowService;
  let clientId: string;

  const ownerAdmin = { id: 'owner-1', email: 'owner@smmplan.pro', role: 'OWNER', supportLimitCents: 999999 };
  const adminAdmin = { id: 'admin-1', email: 'admin@smmplan.pro', role: 'ADMIN', supportLimitCents: 999999 };
  const supportAgent = { id: 'support-1', email: 'support@smmplan.pro', role: 'SUPPORT', supportLimitCents: 50000 }; // 500 RUB

  beforeEach(async () => {
    service = new EscrowService();
    vi.clearAllMocks();

    // Create test client
    const client = await db.user.create({
      data: { email: 'client@test.com', balance: 100000, quarantineBalance: 0 },
    });
    clientId = client.id;

    // Create support user (needed for supportLimitCents lookup, but we pass it via AdminContext)
    await db.user.create({
      data: { id: 'support-1', email: 'support@smmplan.pro', role: 'SUPPORT', supportLimitCents: 50000 },
    });
  });

  // ─── RBAC Bypass Tests ───

  describe('Role-based access (Trust Budget bypass)', () => {
    it('OWNER always bypasses limits — large amount goes APPROVED', async () => {
      await service.evaluateBalanceAdjustment(clientId, 9999999, 'VIP bonus', ownerAdmin);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 9999999);
      expect(Number(user.quarantineBalance)).toBe(0);

      const ledger = await db.ledgerEntry.findFirst({ where: { userId: clientId } });
      expect(ledger?.status).toBe('APPROVED');
    });

    it('ADMIN always bypasses limits', async () => {
      await service.evaluateBalanceAdjustment(clientId, 9999999, 'Admin credit', adminAdmin);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 9999999);
    });

    it('SUPPORT within daily limit → APPROVED', async () => {
      await service.evaluateBalanceAdjustment(clientId, 30000, 'Compensation', supportAgent);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 30000);
      expect(Number(user.quarantineBalance)).toBe(0);

      const ledger = await db.ledgerEntry.findFirst({ where: { userId: clientId } });
      expect(ledger?.status).toBe('APPROVED');
    });

    it('SUPPORT exceeds daily limit → QUARANTINE', async () => {
      await service.evaluateBalanceAdjustment(clientId, 60000, 'Big compensation', supportAgent);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000); // Unchanged!
      expect(Number(user.quarantineBalance)).toBe(60000);

      const ledger = await db.ledgerEntry.findFirst({ where: { userId: clientId } });
      expect(ledger?.status).toBe('QUARANTINE');
    });
  });

  // ─── Cumulative Daily Limit ───

  describe('Cumulative daily trust budget', () => {
    it('Third transaction triggers QUARANTINE when cumulative > limit', async () => {
      // 200 + 200 = 400 (ok, limit=500)
      await service.evaluateBalanceAdjustment(clientId, 20000, 'Part 1', supportAgent);
      await service.evaluateBalanceAdjustment(clientId, 20000, 'Part 2', supportAgent);
      // 400 + 200 = 600 > 500 → QUARANTINE
      await service.evaluateBalanceAdjustment(clientId, 20000, 'Part 3', supportAgent);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 20000 + 20000); // Only first two
      expect(Number(user.quarantineBalance)).toBe(20000);

      const entries = await db.ledgerEntry.findMany({ where: { userId: clientId }, orderBy: { createdAt: 'asc' } });
      expect(entries[0].status).toBe('APPROVED');
      expect(entries[1].status).toBe('APPROVED');
      expect(entries[2].status).toBe('QUARANTINE');
    });

    it('Exact boundary: amount === remaining budget → APPROVED (not strict >)', async () => {
      // Limit = 500 RUB = 50000. Spend exactly 500.
      await service.evaluateBalanceAdjustment(clientId, 50000, 'Exact boundary', supportAgent);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 50000);
      expect(Number(user.quarantineBalance)).toBe(0);
    });
  });

  // ─── Refund (Negative Amount) Bypass ───

  describe('Negative amounts (refunds) bypass Trust Budget', () => {
    it('Refund does NOT consume trust budget — SUPPORT can refund freely', async () => {
      // First: exhaust the budget
      await service.evaluateBalanceAdjustment(clientId, 50000, 'Max credit', supportAgent);

      // Now issue a refund of -30000 (should NOT go to quarantine)
      await service.evaluateBalanceAdjustment(clientId, -30000, 'Refund order #123', supportAgent);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 50000 - 30000);
      expect(Number(user.quarantineBalance)).toBe(0); // No quarantine

      const entries = await db.ledgerEntry.findMany({ where: { userId: clientId }, orderBy: { createdAt: 'asc' } });
      expect(entries).toHaveLength(2);
      expect(entries[0].status).toBe('APPROVED'); // Credit
      expect(entries[1].status).toBe('APPROVED'); // Refund
      expect(Number(entries[1].amount)).toBe(-30000);
    });

    it('Refund does NOT count toward next day budget calculation', async () => {
      // Refund first
      await service.evaluateBalanceAdjustment(clientId, -10000, 'Refund', supportAgent);
      // Then credit up to the full limit — should still be within budget
      await service.evaluateBalanceAdjustment(clientId, 50000, 'Full budget credit', supportAgent);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 - 10000 + 50000);
      expect(Number(user.quarantineBalance)).toBe(0);
    });
  });

  // ─── Negative Balance Warning ───

  describe('Negative balance warning', () => {
    it('Sends WARNING alert when balance goes negative', async () => {
      // Client has 1000 RUB. Refund 1500 → balance = -500
      const poorClient = await db.user.create({
        data: { email: 'poor@test.com', balance: 100000 }, // 1000 RUB
      });

      await service.evaluateBalanceAdjustment(poorClient.id, -150000, 'Full refund', ownerAdmin);

      expect(sendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('уйдёт в минус'),
        'WARNING'
      );

      const user = await db.user.findUniqueOrThrow({ where: { id: poorClient.id } });
      expect(Number(user.balance)).toBe(100000 - 150000); // -50000 (allowed but warned)
    });
  });

  // ─── Quarantine Resolution ───

  describe('resolveQuarantine', () => {
    let quarantinedEntryId: string;

    beforeEach(async () => {
      // Create a quarantined entry
      await service.evaluateBalanceAdjustment(clientId, 60000, 'Needs approval', supportAgent);
      const entry = await db.ledgerEntry.findFirst({ where: { userId: clientId, status: 'QUARANTINE' } });
      quarantinedEntryId = entry!.id;
    });

    it('APPROVE transfers funds from quarantine to balance', async () => {
      await service.resolveQuarantine(quarantinedEntryId, 'APPROVE', ownerAdmin);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000 + 60000);
      expect(Number(user.quarantineBalance)).toBe(0);

      const entry = await db.ledgerEntry.findUniqueOrThrow({ where: { id: quarantinedEntryId } });
      expect(entry.status).toBe('APPROVED');
    });

    it('REJECT removes funds from quarantine WITHOUT crediting balance', async () => {
      await service.resolveQuarantine(quarantinedEntryId, 'REJECT', ownerAdmin);

      const user = await db.user.findUniqueOrThrow({ where: { id: clientId } });
      expect(Number(user.balance)).toBe(100000); // Unchanged
      expect(Number(user.quarantineBalance)).toBe(0);

      const entry = await db.ledgerEntry.findUniqueOrThrow({ where: { id: quarantinedEntryId } });
      expect(entry.status).toBe('REJECTED');
    });

    it('Double-resolve throws error (race condition prevented)', async () => {
      await service.resolveQuarantine(quarantinedEntryId, 'APPROVE', ownerAdmin);

      // Second attempt should fail
      await expect(
        service.resolveQuarantine(quarantinedEntryId, 'APPROVE', ownerAdmin)
      ).rejects.toThrow('Entry already resolved or not found');
    });

    it('Resolve non-existent entry throws', async () => {
      await expect(
        service.resolveQuarantine('non-existent-id', 'APPROVE', ownerAdmin)
      ).rejects.toThrow();
    });
  });

  // ─── Telegram Notifications ───

  describe('Notifications', () => {
    it('QUARANTINE triggers CRITICAL Telegram alert', async () => {
      await service.evaluateBalanceAdjustment(clientId, 60000, 'Over limit', supportAgent);

      expect(sendAdminAlert).toHaveBeenCalledWith(
        expect.stringContaining('Сработал лимит Escrow Guard'),
        'CRITICAL'
      );
    });

    it('APPROVED within limit does NOT trigger alert', async () => {
      await service.evaluateBalanceAdjustment(clientId, 10000, 'Small credit', supportAgent);

      expect(sendAdminAlert).not.toHaveBeenCalled();
    });
  });

  // ─── getQuarantineEntries ───

  describe('getQuarantineEntries', () => {
    it('Returns only QUARANTINE entries with user emails', async () => {
      // Create one approved, one quarantined
      await service.evaluateBalanceAdjustment(clientId, 10000, 'Small', supportAgent);
      await service.evaluateBalanceAdjustment(clientId, 60000, 'Big', supportAgent);

      const entries = await service.getQuarantineEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].status).toBe('QUARANTINE');
      expect(entries[0].userEmail).toBe('client@test.com');
    });
  });
});
