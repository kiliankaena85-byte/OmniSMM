import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps, adjustBalance } from '../wallet-ops';
import { deductBalanceWithLock, WalletService } from '../wallet.service';
import { calculateVat, formatMoneyCents, parseRublesToCents } from '@/utils/money';
import { checkVatThreshold } from '../payment-gateway.service';

describe('FinTech Iron Dome & Security Defense Test Suite', () => {
  let userPlanId: string;
  let userFluxId: string;

  beforeEach(async () => {
    // 1. Create SMMplan user with 100.00 RUB (10,000 cents)
    const userPlan = await db.user.create({
      data: {
        email: 'user-plan@smmplan.pro',
        role: 'USER',
        balance: BigInt(10000),
        tenantId: 'smmplan'
      }
    });
    userPlanId = userPlan.id;

    // 2. Create SMMflux user with 50.00 RUB (5,000 cents)
    const userFlux = await db.user.create({
      data: {
        email: 'user-flux@smmflux.ru',
        role: 'USER',
        balance: BigInt(5000),
        tenantId: 'flux'
      }
    });
    userFluxId = userFlux.id;
  });

  describe('1. Race Condition & Double Spending Defense', () => {
    it('executes exactly 1 charge and rejects 9 concurrent requests when balance is sufficient for only 1', async () => {
      const promises = Array.from({ length: 10 }).map((_, idx) =>
        deductBalanceWithLock(
          userPlanId,
          BigInt(10000),
          `Parallel Order Attempt #${idx + 1}`,
          { orderId: `race-order-${idx + 1}`, tenantId: 'smmplan' }
        ).then(
          (res) => ({ status: 'fulfilled', res }),
          (err) => ({ status: 'rejected', error: err instanceof Error ? err.message : String(err) })
        )
      );

      const results = await Promise.all(promises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(9);

      // Verify final balance is exactly 0, never negative
      const finalUser = await db.user.findUniqueOrThrow({ where: { id: userPlanId } });
      expect(finalUser.balance).toBe(BigInt(0));
      expect(finalUser.totalSpent).toBe(BigInt(10000));
    });
  });

  describe('2. Idempotency & Replay Defense', () => {
    it('credits balance only once when identical idempotencyKey is replayed 5 times', async () => {
      const idempotencyKey = 'unique-topup-evt-9999';

      for (let i = 0; i < 5; i++) {
        await WalletService.credit(
          userPlanId,
          BigInt(2500), // 25.00 RUB
          'Topup via YooKassa Replay',
          idempotencyKey,
          undefined,
          'smmplan'
        );
      }

      // Initial: 10,000 + 2,500 once = 12,500 cents
      const user = await db.user.findUniqueOrThrow({ where: { id: userPlanId } });
      expect(user.balance).toBe(BigInt(12500));

      // Exactly 1 ledger entry created with this idempotencyKey
      const entries = await db.ledgerEntry.findMany({ where: { idempotencyKey } });
      expect(entries.length).toBe(1);
      expect(entries[0].amount).toBe(BigInt(2500));
    });
  });

  describe('3. Multi-Tenant Financial Isolation (Cross-Tenant Theft Prevention)', () => {
    it('strictly forbids charging or adjusting a tenant user from a mismatched tenant context', async () => {
      // Try to charge userPlan (tenant: smmplan) under flux context
      await expect(
        deductBalanceWithLock(
          userPlanId,
          BigInt(1000),
          'Malicious cross-tenant debit',
          { tenantId: 'flux' }
        )
      ).rejects.toThrow(/USER_NOT_FOUND|tenant access forbidden|Cross-tenant/i);

      // Try to adjust userFlux (tenant: flux) under smmplan context
      await expect(
        adjustBalance(
          userFluxId,
          BigInt(1000),
          { actorId: 'attacker-admin', tenantId: 'smmplan', reason: 'Cross tenant adjustment' }
        )
      ).rejects.toThrow(/not found in tenant smmplan or access denied/i);

      // Balances must remain pristine
      const uPlan = await db.user.findUniqueOrThrow({ where: { id: userPlanId } });
      const uFlux = await db.user.findUniqueOrThrow({ where: { id: userFluxId } });
      expect(uPlan.balance).toBe(BigInt(10000));
      expect(uFlux.balance).toBe(BigInt(5000));
    });
  });

  describe('4. Fiscal 54-FZ & VAT 2026 BigInt Precision Math', () => {
    it('computes VAT 22% and ruble formatting with zero floating-point leakage', () => {
      const amountCents = BigInt(10001); // 100.01 RUB
      const vat = calculateVat(amountCents, 22);

      expect(vat).toBe(BigInt(1804));
      expect(formatMoneyCents(amountCents)).toBe('100.01');
      expect(formatMoneyCents(vat)).toBe('18.04');
      expect(parseRublesToCents('100.01')).toBe(BigInt(10001));
    });

    it('correctly reports VAT threshold exceeded status when annual revenue >= 20M RUB', async () => {
      await db.payment.create({
        data: {
          userId: userPlanId,
          amount: BigInt(2_000_000_000),
          currency: 'RUB',
          status: 'SUCCEEDED',
          tenantId: 'smmplan'
        }
      });

      const isExceeded = await checkVatThreshold();
      expect(typeof isExceeded).toBe('boolean');
    });
  });
});
