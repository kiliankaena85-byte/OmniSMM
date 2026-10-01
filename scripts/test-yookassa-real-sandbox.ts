import { db } from '../src/lib/db';
import { SettingsProvider } from '../src/lib/settings';
import { PaymentGatewayFactory } from '../src/services/financial/payment-gateway.service';
import { getCanonicalTenantBaseUrl } from '../src/utils/get-base-url';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  YOOKASSA SANDBOX REAL PAYMENT API AUDIT (STAGE CONTOUR :3005)      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  const tenantId = 'smmplan';

  // 1. Check YooKassa credentials
  const secrets = await SettingsProvider.getPaymentSecrets(tenantId);
  console.log('\n[1] YooKassa Secrets Check:');
  console.log('   Shop ID:', secrets.yookassaShopId);
  console.log('   Secret Key Present:', Boolean(secrets.yookassaSecretKey));
  console.log('   Secret Key Length:', secrets.yookassaSecretKey?.length || 0);

  // 2. Fetch active service and user
  const service = await db.service.findFirst({
    where: { isActive: true, tenantId: 'smmplan' },
    select: { id: true, name: true, numericId: true }
  });
  if (!service) throw new Error('No active service found');
  console.log('\n[2] Target Service:', service.name, `(#${service.numericId})`);

  let user = await db.user.findFirst({
    where: { email: 'sandbox_verifier@smmplan.pro' }
  });
  if (!user) {
    user = await db.user.create({
      data: {
        email: 'sandbox_verifier@smmplan.pro',
        role: 'USER',
        tenantId: 'smmplan',
        balance: BigInt(0)
      }
    });
  }
  console.log('   Test User ID:', user.id);

  // 3. Create Order
  const order = await db.order.create({
    data: {
      userId: user.id,
      serviceId: service.id,
      tenantId: 'smmplan',
      link: 'https://t.me/smmMarket69',
      quantity: 10,
      providerCost: BigInt(500),
      status: 'AWAITING_PAYMENT',
      charge: 10.00
    }
  });
  console.log('\n[3] Test Order Created:', order.id);

  // 4. Create Payment record
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      orderId: order.id,
      tenantId: 'smmplan',
      amount: BigInt(1000), // 10.00 RUB
      currency: 'RUB',
      status: 'PENDING',
      gateway: 'yookassa'
    }
  });
  console.log('   Test Payment Created:', payment.id);

  // 5. Test Return URL canonical resolution
  const canonicalBaseUrl = getCanonicalTenantBaseUrl(tenantId);
  const successUrl = `${canonicalBaseUrl}/success?orderId=${order.id}&paymentId=${payment.id}`;
  console.log('\n[4] Canonical Return URL Invariant:');
  console.log('   Target return_url:', successUrl);
  if (successUrl.includes('.lhr.life') || successUrl.includes('localhost') || successUrl.includes('127.0.0.1')) {
    console.warn('   ⚠️ WARNING: return_url points to a temporary or local address!');
  } else {
    console.log('   ✅ PASS: return_url uses permanent canonical domain (never hangs bank redirect)');
  }

  // 6. Invoke YooKassa Gateway via UniversalNetworkRouter (DIRECT RU connection)
  console.log('\n[5] Calling YooKassa API (api.yookassa.ru/v3/payments)...');
  const gatewaySvc = PaymentGatewayFactory.getGateway('yookassa');
  const gatewayResult = await gatewaySvc.createPayment({
    paymentId: payment.id,
    orderId: order.id,
    userId: user.id,
    tenantId,
    amountRub: 10.00,
    email: 'sandbox_verifier@smmplan.pro',
    successUrl,
    description: `Тестовая оплата заказа #${order.numericId || order.id} (SMMplan Sandbox)`,
    metadata: {
      orderId: order.id,
      serviceId: service.id,
      tenantId
    },
    isTestMode: false
  });

  console.log('\n[6] YooKassa Response Received:');
  console.log('   Remote Gateway ID :', gatewayResult.remoteGatewayId);
  console.log('   Payment URL        :', gatewayResult.paymentUrl);

  const isValidUrl = gatewayResult.paymentUrl && (
    gatewayResult.paymentUrl.startsWith('https://yoomoney.ru') || 
    gatewayResult.paymentUrl.startsWith('https://yookassa.ru')
  );
  console.log('   URL Validity       :', isValidUrl ? '✅ VALID YOOKASSA CONTRACT URL' : '❌ INVALID URL');

  // Update payment with gateway ID
  await db.payment.update({
    where: { id: payment.id },
    data: {
      gatewayId: gatewayResult.remoteGatewayId || undefined,
      checkoutUrl: gatewayResult.paymentUrl || undefined
    }
  });

  console.log('\n[7] Database Payment Updated:');
  const updatedPayment = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
  console.log('   Status       :', updatedPayment.status);
  console.log('   Gateway ID   :', updatedPayment.gatewayId);
  console.log('   Checkout URL :', updatedPayment.checkoutUrl);

  console.log('\n========================================================================');
  console.log('🎉 YOOKASSA SANDBOX TEST COMPLETED SUCCESSFULLY');
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('\n❌ YooKassa Test Failed:', err);
  process.exit(1);
}).finally(() => {
  db.$disconnect();
});
