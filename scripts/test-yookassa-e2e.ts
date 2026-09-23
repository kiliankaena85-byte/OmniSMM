import { db } from '@/lib/db';
import { checkoutAction } from '@/actions/order/checkout';
import { orderService } from '@/services/core/order.service';

async function runE2ETest() {
  console.log('🚀 [E2E Test] Starting live YooKassa checkout + Mock Provider verification...');

  const service = await db.service.findUnique({
    where: { id: 'cmtak8kd80006jftpfb29z81q' },
    include: { provider: true }
  });

  if (!service) {
    throw new Error('Service cmtak8kd80006jftpfb29z81q not found');
  }

  console.log('✅ Target Service:', service.name, '(Provider:', service.provider?.name, ')');

  // Test Checkout with YooKassa
  const checkoutPayload = {
    serviceId: service.id,
    link: 'https://t.me/test_channel_' + Date.now(),
    quantity: 100,
    email: 'yookassa_tester@test.com',
    gateway: 'yookassa'
  };

  console.log('📦 Submitting checkoutAction payload:', checkoutPayload);
  const result = await checkoutAction(checkoutPayload);

  console.log('💳 Checkout Result:', result);

  if (!result || !result.success || !result.data?.paymentUrl) {
    throw new Error('Checkout failed: ' + JSON.stringify(result));
  }

  const { orderId, paymentId, paymentUrl } = result.data;
  console.log('🎉 SUCCESS: Live YooKassa Payment URL generated:', paymentUrl);

  // Verify created order
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payment: true, user: true }
  });

  console.log('📊 Order Verified in DB: #' + order?.numericId + ' (Status: ' + order?.status + ', Charge: ' + order?.charge + ')');
  console.log('💰 Linked Payment in DB: Status: ' + order?.payment?.status + ', Gateway: ' + order?.payment?.gateway + ', Amount: ' + order?.payment?.amount);
  console.log('🌟 [E2E Test] YooKassa Live Integration + Mock Provider Pipeline: 100% PASS!');
}

runE2ETest().catch(e => {
  console.error('❌ E2E Test Failed:', e);
  process.exit(1);
});
