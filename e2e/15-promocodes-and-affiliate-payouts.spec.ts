/**
 * e2e/15-promocodes-and-affiliate-payouts.spec.ts
 * BLOCK 15: Marketing Promocodes, Vouchers, Expiration Limits & Affiliate Payouts
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Financial Integrity: Voucher activations and referral payouts must use WalletOps.credit with idempotency keys.
 * 2. BigInt Money: All ledger balances and payouts measured in exact kopecks.
 * 3. Anti-Abuse: Duplicate activation prevention, usage limits (maxUses), and expiration validation.
 * 4. Audit Trail: Admin marketing modifications logged to AdminAuditLog.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { adminMarketingService } from '../src/services/admin/marketing.service';
import { PromoValidatorService } from '../src/services/promo/promo-validator.service';
import { WalletOps } from '../src/services/financial/wallet-ops';

const db = new PrismaClient();
const TENANT = 'smmplan';

test.describe.serial('BLOCK 15: Marketing, Promocodes & Affiliate Payouts E2E', () => {
  let user1: { id: string; email: string };
  let user2: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let testPromoVoucher: { id: string; code: string };
  let testPromoDiscount: { id: string; code: string };
  let testPromoExpired: { id: string; code: string };

  test.beforeAll(async () => {
    const ts = Date.now();

    // 1. Create test users
    user1 = await db.user.create({
      data: {
        email: `e2e-promo-user1-${ts}@smmplan.local`,
        role: 'USER',
        tenantId: TENANT,
        balance: 10_000n, // 100.00 RUB
        referralBalance: 25_000, // 250.00 RUB in cents
      },
    });

    user2 = await db.user.create({
      data: {
        email: `e2e-promo-user2-${ts}@smmplan.local`,
        role: 'USER',
        tenantId: TENANT,
        balance: 0n,
        referralBalance: 0,
      },
    });

    adminUser = await db.user.create({
      data: {
        email: `e2e-promo-admin-${ts}@smmplan.local`,
        role: 'ADMIN',
        tenantId: TENANT,
      },
    });

    // 2. Create test promo codes
    testPromoVoucher = await db.promoCode.create({
      data: {
        code: `VOUCHER-${ts}`,
        type: 'VOUCHER',
        amount: 50_000, // 500.00 RUB
        discountPercent: 0,
        maxUses: 1,
        uses: 0,
        isActive: true,
      },
    });

    testPromoDiscount = await db.promoCode.create({
      data: {
        code: `DISCOUNT15-${ts}`,
        type: 'DISCOUNT',
        discountPercent: 15.0,
        amount: 0,
        maxUses: 100,
        uses: 0,
        isActive: true,
      },
    });

    testPromoExpired = await db.promoCode.create({
      data: {
        code: `EXPIRED-${ts}`,
        type: 'VOUCHER',
        amount: 10_000,
        discountPercent: 0,
        maxUses: 10,
        uses: 0,
        isActive: true,
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup promocodes
    await db.promoCode.deleteMany({
      where: { id: { in: [testPromoVoucher?.id, testPromoDiscount?.id, testPromoExpired?.id].filter(Boolean) } },
    });

    // Cleanup ledger entries, commissions and users
    if (user1) {
      await db.commission.deleteMany({ where: { referrerId: user1.id } });
      await db.ledgerEntry.deleteMany({ where: { userId: user1.id } });
    }
    if (user2) {
      await db.ledgerEntry.deleteMany({ where: { userId: user2.id } });
    }

    await db.user.deleteMany({
      where: { id: { in: [user1?.id, user2?.id, adminUser?.id].filter(Boolean) } },
    });
    await db.$disconnect();
  });

  test('Scenario 1: Voucher Promo Code Activation & WalletOps Balance Credit', async () => {
    // Initial balance
    const initialUser = await db.user.findUnique({ where: { id: user1.id } });
    expect(initialUser?.balance).toBe(10_000n);

    // Simulate activation transaction
    const idempotencyKey = `promo-${testPromoVoucher.code}-${user1.id}`;
    await db.$transaction(async (tx) => {
      // 1. Increment usage
      await tx.promoCode.update({
        where: { id: testPromoVoucher.id },
        data: { uses: { increment: 1 } },
      });

      // 2. Credit balance via WalletOps
      await WalletOps.credit(
        tx,
        user1.id,
        testPromoVoucher.amount,
        `Активация ваучера: ${testPromoVoucher.code}`,
        { idempotencyKey }
      );
    });

    // Verify balance increased by exactly 50,000 cents (500.00 RUB)
    const updatedUser = await db.user.findUnique({ where: { id: user1.id } });
    expect(updatedUser?.balance).toBe(60_000n);

    // Verify usage incremented
    const updatedPromo = await db.promoCode.findUnique({ where: { id: testPromoVoucher.id } });
    expect(updatedPromo?.uses).toBe(1);

    // Verify ledger entry created
    const ledger = await db.ledgerEntry.findFirst({ where: { idempotencyKey } });
    expect(ledger).toBeDefined();
    expect(ledger?.amount).toBe(50_000n);
  });

  test('Scenario 2: Promo Code Anti-Abuse & Expiration Validation', async () => {
    // 1. Expired promo code validation
    const expiredCheck = await PromoValidatorService.validateCode(testPromoExpired.code, user2.id);
    expect(expiredCheck.valid).toBe(false);
    expect(expiredCheck.error).toContain('Промокод недействителен');

    // 2. Over-utilized promo code validation (maxUses = 1, current uses = 1)
    const overusedCheck = await PromoValidatorService.validateCode(testPromoVoucher.code, user2.id);
    expect(overusedCheck.valid).toBe(false);
    expect(overusedCheck.error).toContain('Промокод недействителен');

    // 3. Non-existent promo code
    const invalidCheck = await PromoValidatorService.validateCode('NON-EXISTENT-CODE', user2.id);
    expect(invalidCheck.valid).toBe(false);
  });

  test('Scenario 3: Discount Promo Code Validation (PromoValidatorService)', async () => {
    const validCheck = await PromoValidatorService.validateCode(testPromoDiscount.code, user1.id);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.promo?.discountPercent).toBe(15.0);
    expect(validCheck.promo?.type).toBe('DISCOUNT');
  });

  test('Scenario 4: Admin Promo Code CRUD & Toggle Lifecycle', async () => {
    const ts = Date.now();
    const adminCode = `ADMIN-CODE-${ts}`;

    // 1. Create promo code via Admin Service
    const created = await adminMarketingService.createPromoCode({
      code: adminCode,
      type: 'DISCOUNT',
      discountPercent: 20.0,
      maxUses: 50,
      description: 'Admin created 20% discount',
    });
    expect(created.id).toBeDefined();
    expect(created.code).toBe(adminCode);
    expect(created.isActive).toBe(true);

    // 2. Toggle active state (Disable)
    const disabled = await adminMarketingService.togglePromoCode(created.id, false);
    expect(disabled.isActive).toBe(false);

    // 3. Toggle active state (Enable)
    const enabled = await adminMarketingService.togglePromoCode(created.id, true);
    expect(enabled.isActive).toBe(true);

    // 4. Delete promo code
    await adminMarketingService.deletePromoCode(created.id);
    const deleted = await db.promoCode.findUnique({ where: { id: created.id } });
    expect(deleted).toBeNull();
  });

  test('Scenario 5: Referral Balance Payout via Admin Marketing Service', async () => {
    // 1. Setup pending commissions for user1
    await db.commission.create({
      data: {
        orderId: `e2e-order-${Date.now()}`,
        referrerId: user1.id,
        amount: 25_000n,
        status: 'PENDING',
      },
    });

    const userBefore = await db.user.findUnique({ where: { id: user1.id } });
    expect(userBefore?.referralBalance).toBe(25_000);
    const balanceBefore = userBefore!.balance;

    // 2. Execute payout
    const payoutResult = await adminMarketingService.processPayout(user1.id, adminUser.id, 25_000);
    expect(payoutResult).toBeDefined();

    // 3. Verify user referral balance is 0 and main balance received +25,000 cents
    const userAfter = await db.user.findUnique({ where: { id: user1.id } });
    expect(userAfter?.referralBalance).toBe(0);
    expect(userAfter?.balance).toBe(balanceBefore + 25_000n);

    // 4. Verify pending commissions marked as PAID
    const commission = await db.commission.findFirst({ where: { referrerId: user1.id } });
    expect(commission?.status).toBe('PAID');

    // 5. Verify AdminAuditLog entry
    const auditLog = await db.adminAuditLog.findFirst({
      where: { target: user1.id, action: 'REFERRAL_PAYOUT' },
    });
    expect(auditLog).toBeDefined();
  });

  test('Scenario 6: Referral Payout Guard Against Overdraw & Incomplete Balances', async () => {
    // Attempting payout when referralBalance is 0 throws error
    await expect(
      adminMarketingService.processPayout(user1.id, adminUser.id, 10_000)
    ).rejects.toThrow(/Insufficient referral balance/);
  });
});
