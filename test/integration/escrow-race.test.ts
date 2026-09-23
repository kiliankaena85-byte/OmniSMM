import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { escrowService } from '@/services/admin/escrow.service';

describe('Admin Escrow Service (Security)', () => {
  let targetUser: any;
  let adminUser: any;

  beforeEach(async () => {
    targetUser = await db.user.create({
      data: {
        email: 'target.escrow_' + Date.now() + '@test.com',
        balance: 0,
      }
    });

    adminUser = await db.user.create({
      data: {
        email: 'admin.escrow_' + Date.now() + '@test.com',
        role: 'MANAGER',
        supportLimitCents: 1000 // Only 10 RUB max per day
      }
    });
  });

  it('Blocks double-crediting race conditions (Serializable Isolation)', async () => {
    // Generate 5 simultaneous requests of 900 cents each.
    // Individually, 900 <= 1000, so it passes.
    // But together they equal 4500 cents, exceeding the 1000 limit.
    const promises = Array.from({ length: 5 }).map(() =>
      escrowService.evaluateBalanceAdjustment(
        targetUser.id,
        900,
        'Test race condition bypass',
        adminUser
      )
    );

    const outcomes = await Promise.allSettled(promises);

    let approvedCount = 0;
    let quarantineCount = 0;
    let failCount = 0;

    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        const val = outcome.value;
        if (val.status === 'APPROVED') {
          approvedCount++;
        } else if (val.status === 'QUARANTINE') {
          quarantineCount++;
        }
      } else {
        failCount++;
      }
    }

    // With retry-capable serializable transactions, none of the executions fail due to DB conflicts.
    // Instead, they are gracefully serialized: the first one uses the limit and gets APPROVED,
    // and the subsequent 4 are evaluated sequentially, exceed the budget, and go to QUARANTINE.
    expect(approvedCount).toBe(1);
    expect(quarantineCount).toBe(4);
    expect(failCount).toBe(0);

    // Verify DB State
    const checkDbUser = await db.user.findUnique({ where: { id: targetUser.id } });
    
    // Admin was authorized to send 900. Only 1 request succeeded, so target balance must be 900.
    expect(Number(checkDbUser!.balance)).toBe(900);
    
    // Furthermore, checking daily approved volume should confirm it is 900.
    const ledgers = await db.ledgerEntry.findMany({
      where: { adminId: adminUser.id, amount: { gt: 0 }, status: 'APPROVED' }
    });
    
    const sum = ledgers.reduce((acc, l) => acc + Number(l.amount), 0);
    expect(sum).toBe(900);
  });
});
