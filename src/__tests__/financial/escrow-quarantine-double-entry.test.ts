import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { EscrowService } from '@/services/admin/escrow.service';

// Mock fire-and-forget notifications to prevent real Telegram alerts in tests
vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));

// Mock getClientIp
vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn(async () => '127.0.0.1'),
}));

const ownerCtx = {
  id: 'test-owner-id-001',
  email: 'owner@smmplan.pro',
};

describe('EscrowService — resolveQuarantine: Single LedgerEntry Invariant', () => {
  let escrowService: EscrowService;

  beforeEach(() => {
    escrowService = new EscrowService();
    vi.clearAllMocks();
  });

  it('APPROVE creates exactly 1 LedgerEntry (updated in-place, no duplicate rows)', async () => {
    // 1. Create user with balance=0, quarantineBalance=5000
    const user = await db.user.create({
      data: {
        email: `quar-approve-${Date.now()}@smmplan.test`,
        balance: BigInt(0),
        quarantineBalance: BigInt(5000),
        tenantId: 'smmplan',
      },
    });

    // 2. Create the QUARANTINE LedgerEntry (this is what we're "resolving")
    const quarantineEntry = await db.ledgerEntry.create({
      data: {
        userId: user.id,
        tenantId: 'smmplan',
        amount: BigInt(5000),
        reason: 'Пополнение баланса (подозрительный платёж) — quarantine test',
        status: 'QUARANTINE',
        transactionType: 'TOPUP',
        idempotencyKey: `quarantine-test-${Date.now()}`,
      },
    });

    // 3. Resolve: APPROVE
    await escrowService.resolveQuarantine(quarantineEntry.id, 'APPROVE', ownerCtx);

    // 4. Assert: exactly 1 LedgerEntry for this user
    const allEntries = await db.ledgerEntry.findMany({
      where: { userId: user.id },
    });
    expect(allEntries).toHaveLength(1);

    // 5. Assert: that single entry is the original one, now APPROVED
    expect(allEntries[0].id).toBe(quarantineEntry.id);
    expect(allEntries[0].status).toBe('APPROVED');
    expect(allEntries[0].transactionType).toBe('TOPUP'); // type unchanged

    // 6. Assert: user.balance credited correctly
    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.balance).toBe(BigInt(5000));
    expect(updatedUser.quarantineBalance).toBe(BigInt(0));
  });

  it('REJECT creates exactly 1 LedgerEntry, balance stays 0, quarantine cleared', async () => {
    // 1. Create user with balance=1000, quarantineBalance=5000
    const user = await db.user.create({
      data: {
        email: `quar-reject-${Date.now()}@smmplan.test`,
        balance: BigInt(1000),
        quarantineBalance: BigInt(5000),
        tenantId: 'smmplan',
      },
    });

    // 2. Create the QUARANTINE LedgerEntry
    const quarantineEntry = await db.ledgerEntry.create({
      data: {
        userId: user.id,
        tenantId: 'smmplan',
        amount: BigInt(5000),
        reason: 'Подозрительное пополнение — reject test',
        status: 'QUARANTINE',
        transactionType: 'TOPUP',
        idempotencyKey: `quarantine-reject-${Date.now()}`,
      },
    });

    // 3. Resolve: REJECT
    await escrowService.resolveQuarantine(quarantineEntry.id, 'REJECT', ownerCtx);

    // 4. Assert: exactly 1 LedgerEntry, now REJECTED
    const allEntries = await db.ledgerEntry.findMany({
      where: { userId: user.id },
    });
    expect(allEntries).toHaveLength(1);
    expect(allEntries[0].id).toBe(quarantineEntry.id);
    expect(allEntries[0].status).toBe('REJECTED');

    // 5. Assert: balance unchanged, quarantine cleared
    const updatedUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updatedUser.balance).toBe(BigInt(1000));
    expect(updatedUser.quarantineBalance).toBe(BigInt(0));
  });

  it('double-resolve throws — idempotency guard works after fix', async () => {
    // 1. Setup
    const user = await db.user.create({
      data: {
        email: `quar-double-${Date.now()}@smmplan.test`,
        balance: BigInt(0),
        quarantineBalance: BigInt(3000),
        tenantId: 'smmplan',
      },
    });
    const entry = await db.ledgerEntry.create({
      data: {
        userId: user.id,
        tenantId: 'smmplan',
        amount: BigInt(3000),
        reason: 'Double-resolve guard test',
        status: 'QUARANTINE',
        transactionType: 'TOPUP',
        idempotencyKey: `quarantine-double-${Date.now()}`,
      },
    });

    // First resolve: OK
    await escrowService.resolveQuarantine(entry.id, 'APPROVE', ownerCtx);

    // Second resolve: must throw (entry is already APPROVED, not QUARANTINE)
    await expect(
      escrowService.resolveQuarantine(entry.id, 'APPROVE', ownerCtx)
    ).rejects.toThrow('Entry already resolved or not found');

    // Balance should remain at 3000 (not doubled)
    const finalUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(finalUser.balance).toBe(BigInt(3000));

    // Still exactly 1 entry
    const entries = await db.ledgerEntry.findMany({ where: { userId: user.id } });
    expect(entries).toHaveLength(1);
  });
});
