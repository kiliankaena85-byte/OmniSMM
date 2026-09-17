import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps, MAX_ADJUSTMENT_CAP_KOPECKS, ELEVATED_ADJUSTMENT_CAP_KOPECKS } from '@/services/financial/wallet-ops';

describe('WalletOps AdminAdjust Safety Cap Invariants (P2-14)', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `wallet-cap-test-${Date.now()}@example.com`,
        role: 'USER',
        tenantId: 'smmplan',
        balance: BigInt(200_000_000), // 2,000,000 RUB for debit testing
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    if (testUserId) {
      await db.$executeRawUnsafe(`DELETE FROM "LedgerEntry" WHERE "userId" = $1`, testUserId).catch(() => {});
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it('rejects negative adjustment exceeding MAX_ADJUSTMENT_CAP_KOPECKS without elevated cap', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.adminAdjust(
          tx,
          testUserId,
          -(MAX_ADJUSTMENT_CAP_KOPECKS + BigInt(1)),
          'Attempt excessive negative adjustment'
        );
      })
    ).rejects.toThrow('Negative adjustment exceeds safety cap limit');
  });

  it('rejects positive adjustment exceeding MAX_ADJUSTMENT_CAP_KOPECKS without elevated cap', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.adminAdjust(
          tx,
          testUserId,
          MAX_ADJUSTMENT_CAP_KOPECKS + BigInt(100),
          'Attempt excessive positive adjustment'
        );
      })
    ).rejects.toThrow('Positive adjustment exceeds safety cap limit');
  });

  it('allows large adjustments up to ELEVATED_ADJUSTMENT_CAP_KOPECKS when allowElevatedCap is true', async () => {
    const largeAmount = BigInt(100_000_000); // 1,000,000.00 RUB
    await db.$transaction(async (tx) => {
      const res = await WalletOps.adminAdjust(
        tx,
        testUserId,
        -largeAmount,
        'Authorized large debit for Owner',
        { allowElevatedCap: true }
      );
      expect(res.success).toBe(true);
    });
  });

  it('rejects adjustment exceeding ELEVATED_ADJUSTMENT_CAP_KOPECKS even with allowElevatedCap', async () => {
    await expect(
      db.$transaction(async (tx) => {
        await WalletOps.adminAdjust(
          tx,
          testUserId,
          -(ELEVATED_ADJUSTMENT_CAP_KOPECKS + BigInt(1)),
          'Excessive beyond elevated cap',
          { allowElevatedCap: true }
        );
      })
    ).rejects.toThrow('Negative adjustment exceeds safety cap limit');
  });
});
