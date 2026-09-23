import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';
import { checkoutAction } from '@/actions/order/checkout';

async function main() {
  console.log('=== TEST CHECKOUT ON live-vexboost-tg-subs ===');
  const service = await db.service.findUnique({
    where: { id: 'live-vexboost-tg-subs' },
    include: { category: true }
  });
  console.log('Service:', service);

  const res = await checkoutAction({
    serviceId: 'live-vexboost-tg-subs',
    link: 'https://t.me/durov',
    quantity: 10,
    email: 'client_real_test@smmplan.pro',
    gateway: 'yookassa',
    idempotencyKey: 'live_vex_test_' + Date.now(),
  });

  console.log('Result:', JSON.stringify(res, null, 2));
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
