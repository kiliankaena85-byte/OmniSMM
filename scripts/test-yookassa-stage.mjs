import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

async function run() {
  console.log('=== STAGE YOOKASSA SANDBOX TEST ===');

  // 1. Check settings
  const settings = await db.systemSettings.findUnique({ where: { id: 'smmplan' } });
  if (!settings) {
    throw new Error('Settings not found for tenant smmplan');
  }

  console.log('1. Settings Verified:');
  console.log('   Shop ID:', settings.yookassaShopId);
  console.log('   Is Test Mode:', settings.isTestMode);
  console.log('   Environment Mode:', settings.environmentMode);

  // 2. Fetch a service for the test order
  const service = await db.service.findFirst({
    where: { isActive: true, tenantId: 'smmplan' }
  });
  if (!service) {
    throw new Error('No active service found for smmplan');
  }
  console.log('2. Test Service:', service.id, service.name, 'Price/1k:', service.pricePer1000Cents?.toString());

  // 3. Create or find test user
  let user = await db.user.findFirst({
    where: { email: 'sandbox_tester@smmplan.pro' }
  });
  if (!user) {
    user = await db.user.create({
      data: {
        email: 'sandbox_tester@smmplan.pro',
        role: 'USER',
        tenantId: 'smmplan',
        balance: BigInt(0)
      }
    });
  }
  console.log('3. Test User:', user.id, user.email);

  // 4. Create a test Order
  const order = await db.order.create({
    data: {
      userId: user.id,
      serviceId: service.id,
      tenantId: 'smmplan',
      link: 'https://t.me/smmMarket69',
      quantity: 10,
      price: BigInt(500), // 5.00 RUB
      status: 'PENDING',
      charge: 5.00
    }
  });
  console.log('4. Test Order Created:', order.id);

  // 5. Create Payment record
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      orderId: order.id,
      tenantId: 'smmplan',
      amount: BigInt(500), // 5.00 RUB
      currency: 'RUB',
      status: 'PENDING',
      gateway: 'yookassa'
    }
  });
  console.log('5. Payment Record Created:', payment.id);

  // 6. Test YooKassa Payment Gateway API Call
  // Decrypt secret if needed or use PaymentGatewayFactory
  console.log('\n--- YooKassa Gateway Call ---');
  // Return URL invariant check:
  const canonicalBaseUrl = 'https://smmplan.pro';
  const returnUrl = `${canonicalBaseUrl}/success?orderId=${order.id}&paymentId=${payment.id}`;
  console.log('   Generated return_url:', returnUrl);

  await db.$disconnect();
}

run().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
