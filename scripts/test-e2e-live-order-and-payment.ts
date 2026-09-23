import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { checkoutAction } from '@/actions/order/checkout';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== FULL E2E CATALOG & YOOKASSA PAYMENT VERIFICATION ===\n');

  // Reset rate limits in Redis for testing
  try {
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Cleared ${keys.length} rate limit keys in Redis.`);
    }
  } catch (e) {
    console.warn('Redis clear skipped:', e);
  }

  // 1. Fetch Telegram categories from DB
  const tgNetwork = await db.network.findFirst({
    where: { slug: 'telegram', isActive: true },
    include: {
      categories: {
        where: {
          services: { some: { isActive: true } }
        },
        include: {
          services: {
            where: { isActive: true },
            take: 1
          }
        },
        orderBy: { sort: 'asc' }
      }
    }
  });

  if (!tgNetwork) {
    throw new Error('Telegram network not found');
  }

  console.log(`Telegram Categories returned (${tgNetwork.categories.length}):`);
  for (const cat of tgNetwork.categories) {
    console.log(`- "${cat.name}" (id: ${cat.id}, slug: ${cat.slug}, services: ${cat.services.length})`);
  }

  // Verify that there are no duplicate "Подписчики" categories
  const catNames = tgNetwork.categories.map(c => c.name);
  console.log('\nChecking for duplicates in names...');
  const uniqueNames = new Set(catNames);
  if (uniqueNames.size !== catNames.length) {
    throw new Error('Duplicate category names found in Telegram catalog!');
  }
  console.log('✓ All category names are unique, clean and well-structured.');

  // 2. For each Telegram category, test checkout with real YooKassa gateway
  for (const cat of tgNetwork.categories) {
    const testService = cat.services[0];
    if (!testService) {
      console.log(`⚠️ Category "${cat.name}" has no services available (skipped)`);
      continue;
    }

    let testLink = 'https://t.me/durov';
    const lowerName = testService.name.toLowerCase();
    if (lowerName.includes('комментар') || lowerName.includes('реакция') || lowerName.includes('звёзд') || lowerName.includes('stars')) {
      testLink = 'https://t.me/durov/123';
    } else if (lowerName.includes('бот') || lowerName.includes('реферал')) {
      testLink = 'https://t.me/example_bot?start=ref123';
    }

    console.log(`\nTesting checkout on [${cat.name}] -> Service: "${testService.name}" (${testService.id})`);
    console.log(`Link: ${testLink}, Min Qty: ${testService.minQty}`);

    // Clear rate limit before each test step
    try {
      const rlKeys = await redis.keys('rl:*');
      if (rlKeys.length > 0) await redis.del(...rlKeys);
    } catch {}

    const checkoutRes = await checkoutAction({
      serviceId: testService.id,
      link: testLink,
      quantity: testService.minQty || 100,
      email: `live_verifier_${cat.slug}@smmplan.pro`,
      gateway: 'yookassa',
      idempotencyKey: `e2e_${cat.slug}_${Date.now()}`
    });

    if (!checkoutRes.success) {
      throw new Error(`Checkout FAILED for category "${cat.name}": ${checkoutRes.error}`);
    }

    console.log(`✓ Checkout SUCCEEDED!`);
    console.log(`  OrderId: ${checkoutRes.data?.orderId}`);
    console.log(`  PaymentId: ${checkoutRes.data?.paymentId}`);
    console.log(`  PaymentUrl: ${checkoutRes.data?.paymentUrl}`);

    if (!checkoutRes.data?.paymentUrl?.includes('yoomoney.ru') && !checkoutRes.data?.paymentUrl?.includes('yookassa.ru')) {
      throw new Error(`Invalid payment URL generated: ${checkoutRes.data?.paymentUrl}`);
    }

    await sleep(500);
  }

  console.log('\n=============================================================');
  console.log('🎉 100% SUCCESS: All categories clean, all checkouts generated valid YooKassa payment URLs!');
  console.log('=============================================================');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
