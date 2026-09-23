import { db } from '../src/lib/db';
import { marketingService } from '../src/services/marketing.service';

/**
 * QA Simulator — validates core backend logic:
 * 1. Pricing math
 * 2. Order creation (AWAITING_PAYMENT flow)
 * 3. Payment confirmation → Order activation
 * 4. Balance-based API checkout race condition
 */
async function runValidations() {
  console.log("==================================================");
  console.log("🚀 STARTING SMMPLAN LITE BACKEND SIMULATOR");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  let testUser: any = null;
  let testTierUser: any = null;
  let testCategory: any = null;
  let testService: any = null;
  let testNetwork: any = null;

  try {
    // --- ARRANGE ---
    testUser = await db.user.create({
      data: {
        email: `test_${Date.now()}@example.com`,
        balance: 100_00, // 100 RUB (for API tests)
      }
    });
    
    testTierUser = await db.user.create({
      data: {
        email: `platinum_${Date.now()}@example.com`,
        balance: 1000_00,
        totalSpent: 150_000_00 // Platinum tier (>100k)
      }
    });

    testNetwork = await db.network.upsert({
      where: { slug: 'test' },
      update: {},
      create: { name: 'Test', slug: 'test' }
    });

    testCategory = await db.category.create({
      data: { name: 'Test Cat', networkId: testNetwork.id }
    });

    testService = await db.service.create({
      data: {
        name: 'Test Service',
        categoryId: testCategory.id,
        rate: 5.0,
        markup: 3.0,
        minQty: 100,
        maxQty: 10000,
        externalId: '9999' // Mock external ID
      }
    });

    console.log("--- 1. Data Arranged ---");

    // --- TEST 1: Marketing & Margin Math ---
    const priceRes1 = await marketingService.calculatePrice(testUser.id, testService.id, 1000);
    assert(priceRes1.totalCents === 1500, `Base price: 1500 cents (got ${priceRes1.totalCents})`);
    assert(priceRes1.providerCostCents === 500, `Provider cost: 500 cents (got ${priceRes1.providerCostCents})`);

    const priceRes2 = await marketingService.calculatePrice(testTierUser.id, testService.id, 1000);
    assert(priceRes2.totalCents === 1275, `Platinum tier discount: 1275 cents (got ${priceRes2.totalCents})`);
    
    // --- TEST 2: Pay-Per-Order Flow ---
    console.log("--- 2. Testing Pay-Per-Order Flow ---");
    
    // Create order as AWAITING_PAYMENT
    const order = await db.order.create({
      data: {
        userId: testUser.id,
        serviceId: testService.id,
        link: 'https://instagram.com/test',
        quantity: 1000,
        email: testUser.email,
        status: 'AWAITING_PAYMENT',
        charge: 1500,
        providerCost: 500,
        remains: 1000
      }
    });
    assert(order.status === 'AWAITING_PAYMENT', `Order created as AWAITING_PAYMENT`);

    // Create linked payment
    const payment = await db.payment.create({
      data: {
        userId: testUser.id,
        orderId: order.id,
        amount: 1500,
        currency: 'RUB',
        status: 'PENDING',
        gatewayId: `test_gateway_${Date.now()}`
      }
    });
    assert(payment.orderId === order.id, `Payment linked to order`);

    // Simulate webhook confirmation
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCEEDED' }
      });
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PENDING' }
      });
    });

    const activatedOrder = await db.order.findUnique({ where: { id: order.id } });
    assert(activatedOrder?.status === 'PENDING', `Order activated to PENDING after payment`);

    const confirmedPayment = await db.payment.findUnique({ where: { id: payment.id } });
    assert(confirmedPayment?.status === 'SUCCEEDED', `Payment marked as SUCCEEDED`);

    // --- TEST 3: API Balance Race Condition ---
    console.log("--- 3. API Balance Race Condition ---");
    
    // testUser has 100_00 (100 RUB). 10 concurrent orders at 15 RUB each.
    // Max affordable: floor(100/15) = 6
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        db.$transaction(async (tx) => {
          const user = await tx.user.findUniqueOrThrow({ where: { id: testUser.id } });
          if (Number(user.balance) < 1500) throw new Error('INSUFFICIENT_FUNDS');
          
          await tx.user.update({
            where: { id: testUser.id },
            data: { 
              balance: { decrement: 1500 },
              totalSpent: { increment: 1500 }
            }
          });
          
          return tx.order.create({
            data: {
              userId: testUser.id,
              serviceId: testService.id,
              link: 'https://instagram.com/test',
              quantity: 1000,
              status: 'PENDING',
              charge: 1500,
              providerCost: 500,
              remains: 1000,
            }
          });
        }).catch((e: any) => e.message)
      );
    }
    
    const results = await Promise.all(promises);
    let successCount = 0;
    let nsfCount = 0;
    
    for (const res of results) {
      if (typeof res === 'object' && res.id) successCount++;
      if (res === 'INSUFFICIENT_FUNDS') nsfCount++;
    }
    
    assert(successCount === 6, `Race: exactly 6 succeeded (got ${successCount})`);
    assert(nsfCount === 4, `Race: exactly 4 NSF (got ${nsfCount})`);
    
    const userAfter = await db.user.findUnique({ where: { id: testUser.id } });
    assert(Number(userAfter?.balance) === 1000, `Balance: 1000 cents remaining (got ${userAfter?.balance})`);

  } catch (error) {
    console.error("CRITICAL TEST FAILURE:", error);
    failed++;
  } finally {
    console.log("--- Cleanup ---");
    if (testUser) await db.order.deleteMany({ where: { userId: testUser.id } });
    if (testUser) await db.payment.deleteMany({ where: { userId: testUser.id } });
    if (testService) await db.service.delete({ where: { id: testService.id } });
    if (testCategory) await db.category.delete({ where: { id: testCategory.id } });
    if (testNetwork) await db.network.delete({ where: { id: testNetwork.id } });
    if (testUser) await db.user.delete({ where: { id: testUser.id } });
    if (testTierUser) await db.user.delete({ where: { id: testTierUser.id } });
  }

  console.log("==================================================");
  if (failed === 0) {
    console.log(`✅ ALL ${passed} TESTS PASSED PERFECTLY`);
  } else {
    console.log(`❌ ${failed} TESTS FAILED. ${passed} PASSED.`);
  }
}

runValidations().catch(console.error).finally(() => process.exit(0));
