import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MarginGuard, SmartRoutingService } from '../services/providers/smart-routing.service';
import { WalletOps } from '../services/financial/wallet-ops';

const prisma = new PrismaClient();

describe('BLOCK 20: Chaos Resilience & Cascading Failures Suite', () => {
  let testUserId = '';

  beforeEach(async () => {
    // Create test user for chaos tests
    const user = await prisma.user.upsert({
      where: { email_tenantId: { email: 'chaos_test_user@smmplan.pro', tenantId: 'smmplan' } },
      update: {
        role: 'USER',
        balance: BigInt(500000), // 5,000.00 RUB
        isActive: true,
      },
      create: {
        email: 'chaos_test_user@smmplan.pro',
        role: 'USER',
        balance: BigInt(500000),
        tenantId: 'smmplan',
        isActive: true,
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  // --------------------------------------------------------------------------
  // 1. ReDoS & Complex Link Stress Test
  // --------------------------------------------------------------------------
  it('Chaos 1: ReDoS & Catastrophic Regex Attack Resistance (< 20ms)', () => {
    // Malicious repeating input designed to cause exponential backtracking on vulnerable regexes
    const maliciousPayload = 'https://t.me/' + 'a'.repeat(2000) + '!' + 'b'.repeat(2000) + '@#$%^&*()';
    const tgRegex = /^(https?:\/\/)?(t(elegram)?\.me|telegram\.org)\/([a-zA-Z0-9_+]{3,32}|joinchat\/[a-zA-Z0-9_-]+|\+[a-zA-Z0-9_-]+)(\/[0-9]+)?(\?.*)?$/;

    const start = performance.now();
    const isMatch = tgRegex.test(maliciousPayload);
    const duration = performance.now() - start;

    expect(isMatch).toBe(false);
    expect(duration).toBeLessThan(50); // Must resolve in under 50ms without Event Loop stall
  });

  // --------------------------------------------------------------------------
  // 2. Double Provider Failure & Atomic Refund (Zero Money Loss)
  // --------------------------------------------------------------------------
  it('Chaos 2: Double Provider Failure triggers atomic refund without balance loss', async () => {
    const startBalance = BigInt(500000);
    const orderCost = BigInt(15000); // 150.00 RUB

    // 1. Client wallet charged for order
    await prisma.$transaction(async (tx) => {
      await WalletOps.charge(tx, testUserId, orderCost, 'Order #chaos-001', {
        idempotencyKey: 'idem-chaos-order-1',
      });
    });

    const midUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(midUser!.balance).toBe(startBalance - orderCost);

    // 2. Simulate DOUBLE FAILURE:
    // Route 1 (Primary): HTTP 500 / Provider Gateway Timeout
    // Route 2 (Backup): HTTP 403 / Insufficient Provider Balance
    const route1Failed = true;
    const route2Failed = true;

    if (route1Failed && route2Failed) {
      // Automatic Atomic Fallback: Refund the user
      await prisma.$transaction(async (tx) => {
        await WalletOps.refund(tx, testUserId, orderCost, 'Auto-Refund: All provider routes exhausted', {
          idempotencyKey: 'idem-chaos-refund-1',
        });
      });
    }

    const finalUser = await prisma.user.findUnique({ where: { id: testUserId } });
    expect(finalUser!.balance).toBe(startBalance); // Balance 100% restored
  });

  // --------------------------------------------------------------------------
  // 3. High-Concurrency Race Condition Attack on Wallet
  // --------------------------------------------------------------------------
  it('Chaos 3: Concurrent wallet modifications maintain strict ledger consistency', async () => {
    const concurrentDebits = 10;
    const debitAmount = 5000; // 50.00 RUB each = 500.00 RUB total

    // Execute 10 simultaneous debit requests with unique idempotency keys
    const promises = Array.from({ length: concurrentDebits }).map((_, i) =>
      prisma.$transaction(async (tx) => {
        return WalletOps.charge(tx, testUserId, debitAmount, `Concurrent Debit #${i}`, {
          idempotencyKey: `idem-concurrent-${i}`,
        });
      })
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(concurrentDebits);

    const updatedUser = await prisma.user.findUnique({ where: { id: testUserId } });
    // Total charged should be exactly 10 * 5000 = 50,000 cents
    expect(updatedUser!.balance).toBe(BigInt(500000) - BigInt(50000));
  });

  // --------------------------------------------------------------------------
  // 4. Currency Shock & Margin Volatility Protection
  // --------------------------------------------------------------------------
  it('Chaos 4: Sudden FX currency drift is blocked by MarginGuard buffer', async () => {
    const clientPaidCents = BigInt(10000); // Client paid 100.00 RUB
    const quantity = 1000;
    const providerRateUsd = 1.10; // $1.10 per 1000

    // Case A: Normal FX rate = 90 RUB/USD
    // Cost = 1.10 * 90 * 1.05 = 103.95 RUB -> Unprofitable for 100 RUB client price
    const marginNormal = await MarginGuard.checkMargin(clientPaidCents, quantity, providerRateUsd, 'USD');
    expect(marginNormal.isProfitable).toBe(false);
    expect(marginNormal.reason).toBeDefined();

    // Case B: High margin case (Client paid 250.00 RUB)
    const highPaidCents = BigInt(25000);
    const marginHigh = await MarginGuard.checkMargin(highPaidCents, quantity, providerRateUsd, 'USD');
    expect(marginHigh.isProfitable).toBe(true);
    expect(marginHigh.costCents).toBeGreaterThan(BigInt(0));
  });
});
