import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';
import { checkoutAction } from '@/actions/order/checkout';

async function main() {
  console.log('=== FIND SERVICE AND RUN CHECKOUT ===');
  const services = await db.service.findMany({
    where: {
      name: { contains: 'Telegram' }
    },
    include: {
      category: {
        include: {
          network: true
        }
      }
    },
    take: 10
  });

  console.log(`Found ${services.length} Telegram services:`);
  for (const s of services) {
    console.log(`- [${s.id}] ${s.name} (min: ${s.minQty}, max: ${s.maxQty}, price: ${s.pricePerUnitRub} RUB, providerId: ${s.providerId})`);
  }

  const targetService = services.find(s => s.name.includes('Подписчики') || s.name.includes('Быстрые')) || services[0];
  if (!targetService) {
    console.error('No service found!');
    return;
  }

  console.log('\nTesting checkoutAction on target service:', targetService.name, targetService.id);
  const checkoutRes = await checkoutAction({
    serviceId: targetService.id,
    link: 'https://t.me/durov',
    quantity: targetService.minQty || 100,
    email: 'client_test@smmplan.pro',
    gateway: 'yookassa',
    idempotencyKey: 'test_chk_' + Date.now(),
  });

  console.log('\nCheckout Result:');
  console.log(JSON.stringify(checkoutRes, null, 2));
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
