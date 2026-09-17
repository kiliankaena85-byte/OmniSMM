import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { adminOrderService } from '@/services/admin/order.service';

describe('Admin Orders Search Environment Mode Filtering Suite', () => {
  let testUserId: string;
  let testServiceId: string;
  const createdOrderIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    const user = await db.user.create({
      data: {
        email: `env_test_user_${Date.now()}@example.com`,
        balance: BigInt(100000),
      },
    });
    testUserId = user.id;

    // Find or create test category & service
    let service = await db.service.findFirst();
    if (!service) {
      let category = await db.category.findFirst();
      if (!category) {
        let network = await db.network.findFirst();
        if (!network) {
          network = await db.network.create({
            data: { name: 'TestNet', slug: `testnet-${Date.now()}` },
          });
        }
        category = await db.category.create({
          data: { name: 'TestCat', slug: `testcat-${Date.now()}`, networkId: network.id },
        });
      }
      service = await db.service.create({
        data: {
          name: 'Test Environment Service',
          categoryId: category.id,
          rate: 100,
          pricePer1000Cents: 10000,
          minQty: 10,
          maxQty: 1000,
        },
      });
    }
    testServiceId = service.id;

    // 1. Sandbox order (explicit SANDBOX mode with mock payment)
    const p1 = await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(5000),
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `mock_sb_${Date.now()}`,
      },
    });
    createdPaymentIds.push(p1.id);
    const o1 = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/sb1',
        quantity: 100,
        charge: BigInt(5000),
        providerCost: BigInt(2000),
        status: 'COMPLETED',
        environmentMode: 'SANDBOX',
        isTest: true,
        paymentId: p1.id,
      },
    });
    createdOrderIds.push(o1.id);

    // 2. Hybrid order (HYBRID mode with mock payment)
    const p2 = await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(5000),
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `mock_hy_${Date.now()}`,
      },
    });
    createdPaymentIds.push(p2.id);
    const o2 = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/hy1',
        quantity: 100,
        charge: BigInt(5000),
        providerCost: BigInt(2000),
        status: 'IN_PROGRESS',
        environmentMode: 'HYBRID',
        isTest: true,
        paymentId: p2.id,
      },
    });
    createdOrderIds.push(o2.id);

    // 3. Acquiring Test order (PRODUCTION environmentMode, but test acquiring payment)
    const p3 = await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(5000),
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `yoo_test_mock_${Date.now()}`,
      },
    });
    createdPaymentIds.push(p3.id);
    const o3 = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/acq1',
        quantity: 100,
        charge: BigInt(5000),
        providerCost: BigInt(2000),
        status: 'COMPLETED',
        environmentMode: 'PRODUCTION',
        isTest: false,
        paymentId: p3.id,
      },
    });
    createdOrderIds.push(o3.id);

    // 4. Production order (real production order with real payment ID)
    const p4 = await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(5000),
        status: 'SUCCEEDED',
        gateway: 'yookassa',
        gatewayId: `real_live_yoo_${Date.now()}`,
      },
    });
    createdPaymentIds.push(p4.id);
    const o4 = await db.order.create({
      data: {
        userId: testUserId,
        serviceId: testServiceId,
        link: 'https://example.com/prod1',
        quantity: 100,
        charge: BigInt(5000),
        providerCost: BigInt(2000),
        status: 'COMPLETED',
        environmentMode: 'PRODUCTION',
        isTest: false,
        paymentId: p4.id,
      },
    });
    createdOrderIds.push(o4.id);
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await db.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (testUserId) {
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it('filters strictly for SANDBOX orders without leaking hybrid or acquiring test orders', async () => {
    const result = await adminOrderService.searchOrders({
      userId: testUserId,
      environmentMode: 'SANDBOX',
    });

    const ids = result.items.map((o) => o.id);
    expect(ids).toContain(createdOrderIds[0]); // Sandbox order
    expect(ids).not.toContain(createdOrderIds[1]); // Hybrid order
    expect(ids).not.toContain(createdOrderIds[2]); // Acquiring Test order
    expect(ids).not.toContain(createdOrderIds[3]); // Production order
  });

  it('filters strictly for HYBRID orders', async () => {
    const result = await adminOrderService.searchOrders({
      userId: testUserId,
      environmentMode: 'HYBRID',
    });

    const ids = result.items.map((o) => o.id);
    expect(ids).toContain(createdOrderIds[1]); // Hybrid order
    expect(ids).not.toContain(createdOrderIds[0]); // Sandbox order
    expect(ids).not.toContain(createdOrderIds[2]); // Acquiring Test order
    expect(ids).not.toContain(createdOrderIds[3]); // Production order
  });

  it('filters strictly for ACQUIRING_TEST orders without leaking sandbox or hybrid orders', async () => {
    const result = await adminOrderService.searchOrders({
      userId: testUserId,
      environmentMode: 'ACQUIRING_TEST',
    });

    const ids = result.items.map((o) => o.id);
    expect(ids).toContain(createdOrderIds[2]); // Acquiring Test order
    expect(ids).not.toContain(createdOrderIds[0]); // Sandbox order (MUST NOT leak!)
    expect(ids).not.toContain(createdOrderIds[1]); // Hybrid order (MUST NOT leak!)
    expect(ids).not.toContain(createdOrderIds[3]); // Production order
  });

  it('filters strictly for PRODUCTION orders without leaking test acquiring or sandbox orders', async () => {
    const result = await adminOrderService.searchOrders({
      userId: testUserId,
      environmentMode: 'PRODUCTION',
    });

    const ids = result.items.map((o) => o.id);
    expect(ids).toContain(createdOrderIds[3]); // Production order
    expect(ids).not.toContain(createdOrderIds[0]); // Sandbox order
    expect(ids).not.toContain(createdOrderIds[1]); // Hybrid order
    expect(ids).not.toContain(createdOrderIds[2]); // Acquiring Test order
  });
});
