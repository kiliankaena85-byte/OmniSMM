import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';
import { checkoutAction } from '@/actions/order/checkout';

async function main() {
  console.log('=== FIND ACTIVE TELEGRAM SERVICES ===');
  const activeServices = await db.service.findMany({
    where: {
      isActive: true,
      category: {
        network: {
          slug: 'telegram'
        }
      }
    },
    include: {
      category: {
        include: {
          network: true
        }
      },
      provider: true
    },
    take: 10
  });

  console.log(`Found ${activeServices.length} active Telegram services:`);
  for (const s of activeServices) {
    console.log(`- [${s.id}] ${s.name} (min: ${s.minQty}, max: ${s.maxQty}, price: ${s.pricePerUnitRub} RUB, provider: ${s.provider?.name})`);
  }

  if (activeServices.length === 0) {
    console.log('No active Telegram services found! Checking any active services:');
    const anyActive = await db.service.findMany({
      where: { isActive: true },
      take: 5
    });
    console.log(anyActive);
    return;
  }

  const target = activeServices[0];
  console.log('\n--- TESTING CHECKOUT ON ACTIVE SERVICE:', target.name, target.id, '---');
  const res = await checkoutAction({
    serviceId: target.id,
    link: 'https://t.me/durov',
    quantity: target.minQty || 100,
    email: 'client_real_test@smmplan.pro',
    gateway: 'yookassa',
    idempotencyKey: 'live_test_' + Date.now(),
  });

  console.log('Checkout Result:');
  console.log(JSON.stringify(res, null, 2));
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
