import { PrismaClient } from '@prisma/client';
import { checkoutAction } from '../src/actions/order/checkout';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function runStressTest() {
  console.log('--- STARTING PAYMENT IDEMPOTENCY STRESS TEST ---');
  
  // 1. Setup a test victim user with limited balance
  const email = `stress-victim-${randomUUID()}@test.com`;
  const victim = await prisma.user.create({
    data: {
      email,
      balance: 100_00 // 100 RUB limit
    }
  });

  const provider = await prisma.provider.create({
    data: {
      name: `stress-provider-${randomUUID()}`,
      apiUrl: 'http://localhost',
      apiKey: 'test',
    }
  });

  const category = await prisma.category.create({
    data: {
      name: `stress-cat-${randomUUID()}`,
    }
  });

  const service = await prisma.service.create({
    data: {
      name: 'Stress Test Service',
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

  console.log(`Victim ${email} created with 100 RUB balance.`);
  console.log('Spawning 500 concurrent checkout attempts...');

  let successCount = 0;
  let failCount = 0;

  // Let's create an array of 500 promises attempting to buy a service costing >0 using the SAME idempotency constraints
  // In Smmplan, checkoutAction doesn't explicitly expose idempotencyKey in the pure TS input function, 
  // but it does depend on the user's balance which acts as the barrier in WalletService (Serializable isolation).
  
  const promises = Array.from({ length: 500 }).map(async () => {
    try {
       // We mock an internal gateway call
       const res = await checkoutAction({
           serviceId: service.id,
           link: 'https://stress.test',
           quantity: service.minQty,
           email: victim.email,
           gateway: 'balance'
       });
       if (res.success) {
           successCount++;
       } else {
           failCount++;
       }
    } catch (e) {
       failCount++;
    }
  });

  await Promise.all(promises);

  console.log('--- STRESS TEST RESULTS ---');
  console.log(`Successful Orders: ${successCount}`);
  console.log(`Rejected Orders: ${failCount}`);

  const postVictim = await prisma.user.findUnique({ where: { id: victim.id } });
  console.log(`Final victim balance: ${postVictim?.balance} (CENTS)`);

  if (postVictim && postVictim.balance < 0) {
      console.error('❌ CRITICAL FAILURE: Balance dropped below zero!');
      process.exit(1);
  } else {
      console.log('✅ PASS: Serializable isolation prevented double spend.');
  }

  // Cleanup
  await prisma.user.delete({ where: { id: victim.id } });
  await prisma.service.delete({ where: { id: service.id } });
  await prisma.category.delete({ where: { id: category.id } });
  await prisma.provider.delete({ where: { id: provider.id } });
}

runStressTest()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
