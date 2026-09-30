import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

async function main() {
  console.log('====================================================');
  console.log('  MIGRATE SMMFLUX CATALOG TO SHARED (tenantId = all) ');
  console.log('====================================================\n');

  // 1. Initial State
  const initialServices = await prisma.service.groupBy({
    by: ['tenantId', 'isActive'],
    _count: { id: true }
  });
  console.log('Before migration - Services:');
  console.table(initialServices);

  const initialCategories = await prisma.category.groupBy({
    by: ['tenantId'],
    _count: { id: true }
  });
  console.log('\nBefore migration - Categories:');
  console.table(initialCategories);

  // 2. Perform Transactional Migration
  console.log('\n🚀 Starting database update: tenantId "flux" -> "all"...');

  const result = await prisma.$transaction(async (tx) => {
    // A. Update categories
    const catUpdate = await tx.category.updateMany({
      where: { tenantId: 'flux' },
      data: { tenantId: 'all' }
    });

    // B. Update services
    const srvUpdate = await tx.service.updateMany({
      where: { tenantId: 'flux' },
      data: { tenantId: 'all' }
    });

    return {
      categoriesUpdated: catUpdate.count,
      servicesUpdated: srvUpdate.count
    };
  });

  console.log(`✅ Успешно переведено категорий: ${result.categoriesUpdated}`);
  console.log(`✅ Успешно переведено услуг: ${result.servicesUpdated}`);

  // 3. Flush Redis Cache
  console.log('\n🧹 Инвалидация Redis-кэша каталога, категорий и сетей...');
  const cachePatterns = ['*catalog*', '*services*', '*categories*', '*network*', '*storefront*'];
  let deletedKeysCount = 0;

  for (const pattern of cachePatterns) {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      deletedKeysCount += keys.length;
    }
  }
  console.log(`✅ Очищено ключей кэша в Redis: ${deletedKeysCount}`);

  // 4. Verification
  console.log('\n====================================================');
  console.log('  VERIFICATION: VISIBILITY FOR SMMPLAN AND SMMFLUX   ');
  console.log('====================================================');

  const smmplanActiveServices = await prisma.service.count({
    where: {
      tenantId: { in: ['smmplan', 'all'] },
      isActive: true
    }
  });

  const fluxActiveServices = await prisma.service.count({
    where: {
      tenantId: { in: ['flux', 'all'] },
      isActive: true
    }
  });

  const smmplanCategories = await prisma.category.count({
    where: {
      tenantId: { in: ['smmplan', 'all'] }
    }
  });

  const fluxCategories = await prisma.category.count({
    where: {
      tenantId: { in: ['flux', 'all'] }
    }
  });

  console.log(`\n📊 SMMplan:`);
  console.log(`   - Активных услуг доступно: ${smmplanActiveServices}`);
  console.log(`   - Категорий доступно: ${smmplanCategories}`);

  console.log(`\n📊 SMMflux:`);
  console.log(`   - Активных услуг доступно: ${fluxActiveServices}`);
  console.log(`   - Категорий доступно: ${fluxCategories}`);

  // Sample check: Telegram Regular vs Premium
  const regularSample = await prisma.service.findFirst({
    where: {
      tenantId: { in: ['smmplan', 'all'] },
      isActive: true,
      category: { name: { contains: 'Обычные' } }
    },
    include: { category: true }
  });

  const premiumSample = await prisma.service.findFirst({
    where: {
      tenantId: { in: ['smmplan', 'all'] },
      isActive: true,
      category: { name: { contains: 'со звездой' } }
    },
    include: { category: true }
  });

  console.log(`\n🔍 Контрольная проверка доступности на SMMplan:`);
  console.log(`   - Telegram Обычные: "${regularSample?.name}" (категория: "${regularSample?.category.name}", цена: ${Number(regularSample?.pricePer1000Cents || 0) / 100} ₽/1k)`);
  console.log(`   - Telegram Premium: "${premiumSample?.name}" (категория: "${premiumSample?.category.name}", цена: ${Number(premiumSample?.pricePer1000Cents || 0) / 100} ₽/1k)`);

  console.log('\n🎉 Каталог успешно стал ОБЩИМ для обоих брендов (SMMplan и SMMflux)!');
}

main()
  .catch((err) => {
    console.error('❌ Ошибка миграции каталога:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
