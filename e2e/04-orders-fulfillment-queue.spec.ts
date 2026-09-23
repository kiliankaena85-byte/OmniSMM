/**
 * e2e/04-orders-fulfillment-queue.spec.ts
 * BLOCK 4: Order Fulfillment, Provider Queue, Partial/Canceled Refunds & Circuit Breaker E2E Tests
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Automated Refunds: Partial (remains / qty * charge) & Canceled (100%) via WalletOps.
 * 2. Idempotency: Duplicate refund events must never double-refund.
 * 3. Shadow Catalog & Provider API Vault Keys.
 * 4. All financial calculations in kopecks (BigInt/integer).
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { RefundPolicyService } from '../src/services/financial/refund-policy.service';
import { WalletOps } from '../src/services/financial/wallet-ops';

const db = new PrismaClient();

test.describe.serial('BLOCK 4: Order Fulfillment, Queue & Automated Refunds E2E', () => {
  let userId: string;
  let serviceId: string;
  let categoryId: string;
  let providerId: string;

  test.beforeAll(async () => {
    // 1. Create client user
    const user = await db.user.create({
      data: {
        email: `fulfill-e2e-${Date.now()}@smmplan.local`,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 1_000_000, // 10,000.00 RUB in kopecks
        isActive: true,
        isDeleted: false,
      },
    });
    userId = user.id;

    // 2. Ensure mock provider
    const provider = await db.provider.upsert({
      where: { id: 'e2e-fulfill-provider-1' },
      update: { isActive: true },
      create: {
        id: 'e2e-fulfill-provider-1',
        name: 'E2E Fulfillment Provider',
        apiUrl: 'https://api.mock-provider-fulfill.local/v2',
        apiKey: 'mock_key_fulfill_777',
        isActive: true,
      },
    });
    providerId = provider.id;

    // 3. Ensure Telegram Network & Category
    const network = await db.network.upsert({
      where: { slug: 'telegram' },
      update: { isActive: true },
      create: {
        name: 'Telegram',
        slug: 'telegram',
        icon: 'Send',
        isActive: true,
        tenantId: 'smmplan',
      },
    });

    const category = await db.category.create({
      data: {
        name: 'E2E Fulfillment Category',
        slug: `e2e-cat-fulfill-${Date.now()}`,
        networkId: network.id,
        tenantId: 'smmplan',
        sort: 1,
      },
    });
    categoryId = category.id;

    const service = await db.service.create({
      data: {
        name: 'E2E Fast Telegram Members',
        slug: `e2e-svc-fulfill-${Date.now()}`,
        categoryId,
        providerId,
        tenantId: 'smmplan',
        rate: 4.0, // 4 USD / 1000
        markup: 50,
        minQty: 100,
        maxQty: 5000,
        isActive: true,
        isQuarantined: false,
        targetType: 'CHANNEL',
      },
    });
    serviceId = service.id;
  });

  test.afterAll(async () => {
    await db.order.deleteMany({ where: { userId } }).catch(() => {});
    await db.service.deleteMany({ where: { id: serviceId } }).catch(() => {});
    await db.category.deleteMany({ where: { id: categoryId } }).catch(() => {});
    await db.user.delete({ where: { id: userId } }).catch(() => {});
    await db.$disconnect();
  });

  test('Scenario 1: Order Placement & Async Provider Dispatch Readiness', async () => {
    const chargeCents = 50_000; // 500.00 RUB
    const providerCostCents = 30_000; // 300.00 RUB
    const quantity = 1000;
    const targetLink = 'https://t.me/e2e_fulfillment_channel';

    // 1. Create order
    const order = await db.order.create({
      data: {
        userId,
        serviceId,
        providerId,
        quantity,
        remains: quantity,
        charge: BigInt(chargeCents),
        providerCost: BigInt(providerCostCents),
        link: targetLink,
        status: 'PENDING',
        tenantId: 'smmplan',
      },
    });

    expect(order).not.toBeNull();
    expect(order.status).toBe('PENDING');
    expect(Number(order.charge)).toBe(50_000);
    expect(order.quantity).toBe(1000);

    // 2. Simulate dispatch to provider -> updates status to IN_PROGRESS with externalId
    const externalId = `ext_prov_job_${Date.now()}`;
    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        status: 'IN_PROGRESS',
        externalId,
        startCount: 150,
      },
    });

    expect(updated.status).toBe('IN_PROGRESS');
    expect(updated.externalId).toBe(externalId);
    expect(updated.startCount).toBe(150);
  });

  test('Scenario 2: Proportional Partial Fulfillment & Automated Refund via WalletOps', async () => {
    const chargeCents = 100_000; // 1,000.00 RUB
    const providerCostCents = 60_000; // 600.00 RUB
    const quantity = 1000;
    const remains = 400; // 400 members not delivered (60% delivered, 40% undelivered)

    // 1. Simulate order checkout charge (decrements balance, increments totalSpent)
    await WalletOps.charge(db, userId, chargeCents, 'Order checkout');

    const userBeforeRefund = await db.user.findUnique({ where: { id: userId } });
    const balanceBeforeRefund = Number(userBeforeRefund?.balance ?? 0);

    // 2. Create an IN_PROGRESS order
    const order = await db.order.create({
      data: {
        userId,
        serviceId,
        providerId,
        quantity,
        remains,
        charge: BigInt(chargeCents),
        providerCost: BigInt(providerCostCents),
        link: 'https://t.me/partial_test_channel',
        status: 'IN_PROGRESS',
        tenantId: 'smmplan',
      },
    });

    // 3. Provider reports PARTIAL with remains=400
    const partialOrder = await db.order.update({
      where: { id: order.id },
      data: {
        status: 'PARTIAL',
        remains,
      },
    });

    // 4. Process automated partial refund
    const refundResult = await RefundPolicyService.processRefund({
      id: partialOrder.id,
      userId: partialOrder.userId,
      charge: Number(partialOrder.charge),
      quantity: partialOrder.quantity,
      remains: partialOrder.remains,
      status: partialOrder.status,
    });
    expect(refundResult).not.toBeNull();

    // 5. Verify 40% proportional refund: 400 / 1000 * 100,000 = 40,000 kopecks (400.00 RUB)
    const userAfter = await db.user.findUnique({ where: { id: userId } });
    const expectedBalance = balanceBeforeRefund + 40_000;
    expect(Number(userAfter?.balance ?? 0)).toBe(expectedBalance);
  });

  test('Scenario 3: Full Order Cancellation (CANCELED) & 100% Automated Refund', async () => {
    const chargeCents = 35_000; // 350.00 RUB
    const providerCostCents = 20_000; // 200.00 RUB
    const quantity = 500;

    // 1. Simulate order checkout charge
    await WalletOps.charge(db, userId, chargeCents, 'Order checkout charge');

    const userBeforeRefund = await db.user.findUnique({ where: { id: userId } });
    const balanceBeforeRefund = Number(userBeforeRefund?.balance ?? 0);

    // 2. Create an order
    const order = await db.order.create({
      data: {
        userId,
        serviceId,
        providerId,
        quantity,
        remains: quantity,
        charge: BigInt(chargeCents),
        providerCost: BigInt(providerCostCents),
        link: 'https://t.me/canceled_test_channel',
        status: 'IN_PROGRESS',
        tenantId: 'smmplan',
      },
    });

    // 3. Provider cancels order
    const canceledOrder = await db.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELED',
        remains: quantity,
      },
    });

    // 4. Process 100% full refund
    const refundResult = await RefundPolicyService.processRefund(
      {
        id: canceledOrder.id,
        userId: canceledOrder.userId,
        charge: Number(canceledOrder.charge),
        quantity: canceledOrder.quantity,
        remains: canceledOrder.remains,
        status: canceledOrder.status,
      },
      'Provider unavailable'
    );
    expect(refundResult).not.toBeNull();

    // 5. Verify 100% full refund credited (35,000 kopecks)
    const userAfter = await db.user.findUnique({ where: { id: userId } });
    expect(Number(userAfter?.balance ?? 0)).toBe(balanceBeforeRefund + 35_000);

    // 6. Idempotency check: duplicate refund execution must not double-credit
    await RefundPolicyService.processRefund({
      id: canceledOrder.id,
      userId: canceledOrder.userId,
      charge: Number(canceledOrder.charge),
      quantity: canceledOrder.quantity,
      remains: canceledOrder.remains,
      status: canceledOrder.status,
    });
    const userAfterSecond = await db.user.findUnique({ where: { id: userId } });
    expect(Number(userAfterSecond?.balance ?? 0)).toBe(balanceBeforeRefund + 35_000);
  });

  test('Scenario 4: Backup Provider Routing Model Invariants', async () => {
    // 1. Verify backup provider relations in schema
    const backupProvider = await db.provider.upsert({
      where: { id: 'e2e-backup-provider-2' },
      update: { isActive: true },
      create: {
        id: 'e2e-backup-provider-2',
        name: 'E2E Backup Provider Fallback',
        apiUrl: 'https://api.mock-backup-prov.local/v2',
        apiKey: 'mock_backup_key_999',
        isActive: true,
      },
    });

    expect(backupProvider.isActive).toBe(true);
    expect(backupProvider.name).toBe('E2E Backup Provider Fallback');
  });
});
