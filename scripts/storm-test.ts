import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function runFinancialStorm() {
  console.log('--- 🌪 STARTING FINANCIAL STORM (MIXED RACE CONDITIONS) 🌪 ---');
  
  // 1. Setup a test victim user with 10,000 RUB balance
  const email = `storm-victim-${randomUUID()}@test.com`;
  const stormVictim = await prisma.user.create({
    data: {
      email,
      balance: BigInt(1000000) // 10,000 RUB
    }
  });

  const provider = await prisma.provider.create({
    data: {
      name: `storm-provider-${randomUUID()}`,
      apiUrl: 'http://localhost',
      apiKey: 'test',
    }
  });

  const category = await prisma.category.create({
    data: { name: `storm-cat-${randomUUID()}` }
  });

  const service = await prisma.service.create({
    data: {
      name: 'Storm Service',
      numericId: Math.floor(Math.random() * 1000000),
      providerId: provider.id,
      categoryId: category.id,
      rate: 1.0,
      markup: 2.0,
      minQty: 10,
      maxQty: 1000,
      isActive: true,
    }
  });

  console.log(`[Storm] Victim ${email} created with 10,000 RUB balance.`);
  console.log('[Storm] Unleashing 300 concurrent mixed transactions: 100 Checkouts, 100 Deposits, 100 Cancel Refunds...');

  let checkoutSuccess = 0;
  let checkoutFail = 0;
  let depositSuccess = 0;
  let refundSuccess = 0;

  // We create some pre-existing orders to "refund" concurrently
  const ordersToRefund = [];
  for(let i=0; i<100; i++) {
    const order = await prisma.order.create({
      data: {
        userId: stormVictim.id,
        serviceId: service.id,
        link: 'https://storm.test',
        quantity: 100,
        charge: BigInt(5000), // 50 RUB
        providerCost: BigInt(2500),
        status: 'PENDING',
        externalId: `storm-ext-${i}`
      }
    });
    ordersToRefund.push(order);
  }

  // 1. Array of 100 Checkout Promises
  const checkoutPromises = Array.from({ length: 100 }).map(async (_, i) => {
    try {
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id: stormVictim.id } });
            if (!user || user.balance < BigInt(5000)) throw new Error('Insufficient balance');

            await tx.user.update({
                where: { id: stormVictim.id },
                data: { balance: { decrement: BigInt(5000) } }
            });

            const newOrder = await tx.order.create({
                data: {
                    userId: stormVictim.id,
                    serviceId: service.id,
                    link: 'https://storm.checkout',
                    quantity: 100,
                    charge: BigInt(5000),
                    providerCost: BigInt(2500),
                    status: 'PENDING',
                    externalId: `checkout-${i}`
                }
            });

            await tx.ledgerEntry.create({
                data: {
                    userId: stormVictim.id,
                    amount: BigInt(-5000), // Negative for debit
                    reason: `Checkout debit ${i}`
                }
            });
        }, { isolationLevel: 'Serializable' });
        checkoutSuccess++;
    } catch (e) {
       checkoutFail++;
    }
  });

  // 2. Array of 100 Deposit Promises
  const depositPromises = Array.from({ length: 100 }).map(async (_, i) => {
    try {
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: stormVictim.id },
                data: { balance: { increment: BigInt(1000) } }
            });
            await tx.ledgerEntry.create({
                data: {
                    userId: stormVictim.id,
                    amount: BigInt(1000),
                    reason: `Storm Deposit ${i}`
                }
            });
        }, { isolationLevel: 'Serializable' });
        depositSuccess++;
    } catch (e) {
        // Might fail due to locking
    }
  });

  // 3. Array of 100 Refund Promises (Simulating Provider Webhook Cancellations)
  const refundPromises = ordersToRefund.map(async (order) => {
    try {
        // Simulating the cancellation logic inside a transaction
        await prisma.$transaction(async (tx) => {
            const currentOrder = await tx.order.findUnique({ where: { id: order.id }});
            if (currentOrder?.status === 'CANCELED') return; // Idempotency
            
            await tx.order.update({
                where: { id: order.id },
                data: { status: 'CANCELED' }
            });

            await tx.user.update({
                where: { id: stormVictim.id },
                data: { balance: { increment: currentOrder!.charge } }
            });

            await tx.ledgerEntry.create({
                data: {
                    userId: stormVictim.id,
                    amount: currentOrder!.charge,
                    reason: `Refund for storm order`
                }
            });
        }, { isolationLevel: 'Serializable' });
        refundSuccess++;
    } catch (e) {
        // Lock failure or retry
    }
  });

  // FIRE THEM ALL AT THE EXACT SAME MILLISECOND
  const allPromises = [...checkoutPromises, ...depositPromises, ...refundPromises];
  // Shuffle array to ensure mixed race conditions
  allPromises.sort(() => Math.random() - 0.5);

  const startTime = Date.now();
  await Promise.allSettled(allPromises);
  const endTime = Date.now();

  console.log(`[Storm] Execution finished in ${endTime - startTime}ms`);
  console.log(`- Checkouts Success: ${checkoutSuccess}, Failed/Rejected: ${checkoutFail}`);
  console.log(`- Deposits Success: ${depositSuccess}`);
  console.log(`- Refunds Success: ${refundSuccess}`);

  // THE GOLDEN RULE VERIFICATION
  const postVictim = await prisma.user.findUnique({ where: { id: stormVictim.id } });
  const allLedger = await prisma.ledgerEntry.aggregate({
    where: { userId: stormVictim.id },
    _sum: { amount: true }
  });

  const expectedBalance = BigInt(1000000) + BigInt(allLedger._sum.amount || 0);
  const actualBalance = BigInt(postVictim?.balance || 0);

  console.log('--- ⚖️ LEDGER INTEGRITY AUDIT ⚖️ ---');
  console.log(`Expected Balance (Math): ${expectedBalance} CENTS`);
  console.log(`Actual DB Balance:       ${actualBalance} CENTS`);
  console.log(`Drift / Discrepancy:     ${expectedBalance - actualBalance} CENTS`);

  if (expectedBalance !== actualBalance) {
      console.error('❌ CRITICAL FAILURE: Ledger Drift Detected! Database locks failed.');
      process.exit(1);
  } else if (actualBalance < BigInt(0)) {
      console.error('❌ CRITICAL FAILURE: Balance dropped below zero!');
      process.exit(1);
  } else {
      console.log('✅ PASS: Mathematical integrity is absolute. Zero drift under severe mixed concurrency.');
  }

  // Cleanup
  await prisma.ledgerEntry.deleteMany({ where: { userId: stormVictim.id } });
  await prisma.order.deleteMany({ where: { userId: stormVictim.id } });
  await prisma.user.delete({ where: { id: stormVictim.id } });
  await prisma.service.delete({ where: { id: service.id } });
  await prisma.category.delete({ where: { id: category.id } });
  await prisma.provider.delete({ where: { id: provider.id } });
}

runFinancialStorm()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
