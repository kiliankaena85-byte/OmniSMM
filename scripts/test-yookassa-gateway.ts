import { PaymentGatewayFactory } from '../src/services/financial/payment-gateway.service';
import { db } from '../src/lib/db';

async function testYookassa() {
  console.log('--- YooKassa Sandbox Integration Test ---');
  
  // 1. Find a test user or admin to use for the test
  const user = await db.user.findFirst({
    where: { role: 'OWNER' }
  });
  if (!user) {
    console.error('No OWNER/ADMIN user found in database to link payment test.');
    return;
  }
  console.log(`Using user: ${user.email} (ID: ${user.id})`);

  // 2. Create a temporary Payment record in the DB to satisfy constraints
  // (metadata, relationships, etc.)
  const paymentId = `test_pay_${Date.now()}`;
  const amountRub = 15.0; // 15 RUB (minimum 10 RUB is enforced for YooKassa)
  
  console.log(`Creating test payment record ${paymentId} for amount ${amountRub} RUB...`);
  const paymentRecord = await db.payment.create({
    data: {
      id: paymentId,
      userId: user.id,
      amount: BigInt(Math.round(amountRub * 100)), // in cents
      currency: 'RUB',
      gateway: 'yookassa',
      status: 'PENDING',
    }
  });

  try {
    const gatewaySvc = PaymentGatewayFactory.getGateway('yookassa');
    console.log('Obtained YooKassa gateway service instance. Initiating payment creation...');

    const result = await gatewaySvc.createPayment({
      paymentId: paymentId,
      userId: user.id,
      amountRub: amountRub,
      email: 'test-yookassa@example.com',
      successUrl: 'https://smmplan.pro/success',
      description: `Тестовое пополнение баланса SMMplan на ${amountRub} руб.`,
      isTestMode: true
    });

    console.log('\n🎉 SUCCESS! YooKassa API responded correctly.');
    console.log(`Remote Gateway ID: ${result.remoteGatewayId}`);
    console.log(`Payment Confirmation URL: ${result.paymentUrl}`);

    // Update the payment record with the gatewayId
    await db.payment.update({
      where: { id: paymentId },
      data: { gatewayId: result.remoteGatewayId }
    });
    console.log('Database payment record updated with remote ID.');

  } catch (error: any) {
    console.error('\n❌ ERROR: YooKassa Gateway payment creation failed!');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    // We can clean up the test payment or leave it as pending to inspect it in the admin panel.
    // Let's clean it up to keep the DB pristine.
    console.log(`Cleaning up test payment record ${paymentId}...`);
    await db.payment.delete({
      where: { id: paymentId }
    });
    console.log('Cleanup completed.');
  }
}

testYookassa()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
  });
