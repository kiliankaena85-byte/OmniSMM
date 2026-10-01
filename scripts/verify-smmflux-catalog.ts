import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

async function main() {
  console.log('=== VERIFY SMMFLUX CATALOG & FLUSH REDIS ===');

  const count = await prisma.service.count({ where: { tenantId: 'flux', isActive: true } });
  const catCount = await prisma.category.count({ where: { tenantId: 'flux' } });
  console.log(`✅ Активных услуг для SMMflux в PostgreSQL: ${count}`);
  console.log(`✅ Категорий для SMMflux в PostgreSQL: ${catCount}`);

  // Flush Redis catalog keys to guarantee fresh read
  const keys = await redis.keys('*catalog*');
  console.log(`🧹 Найдено ключей кэша каталога в Redis: ${keys.length}`);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log('✅ Кэш каталога в Redis успешно инвалидирован.');
  }

  // Sample regular vs premium telegram subscribers in SMMflux
  const regularSub = await prisma.service.findFirst({
    where: {
      tenantId: 'flux',
      category: { name: { contains: 'Обычные' } }
    },
    include: { category: true }
  });
  console.log('\n🔍 Пример обычной услуги подписчиков в SMMflux:');
  console.log(`   - Название: ${regularSub?.name}`);
  console.log(`   - Категория: ${regularSub?.category.name}`);
  console.log(`   - Цена (копейки): ${regularSub?.pricePer1000Cents} (${Number(regularSub?.pricePer1000Cents || 0) / 100} ₽/1k)`);

  const premiumSub = await prisma.service.findFirst({
    where: {
      tenantId: 'flux',
      category: { name: { contains: 'со звездой' } }
    },
    include: { category: true }
  });
  console.log('\n🔍 Пример Telegram Premium подписчиков в SMMflux:');
  console.log(`   - Название: ${premiumSub?.name}`);
  console.log(`   - Категория: ${premiumSub?.category.name}`);
  console.log(`   - Цена (копейки): ${premiumSub?.pricePer1000Cents} (${Number(premiumSub?.pricePer1000Cents || 0) / 100} ₽/1k)`);

  // Sample reactions
  const reaction = await prisma.service.findFirst({
    where: {
      tenantId: 'flux',
      name: { contains: 'Реакции' }
    },
    include: { category: true }
  });
  console.log('\n🔍 Пример реакции в SMMflux:');
  console.log(`   - Название: ${reaction?.name}`);
  console.log(`   - Категория: ${reaction?.category.name}`);
  console.log(`   - Цена (копейки): ${reaction?.pricePer1000Cents} (${Number(reaction?.pricePer1000Cents || 0) / 100} ₽/1k)`);

  // Breakdown by category
  const categories = await prisma.service.findMany({
    where: { tenantId: 'flux' },
    include: { category: true }
  });
  const catCountMap: Record<string, number> = {};
  categories.forEach(s => {
    catCountMap[s.category.name] = (catCountMap[s.category.name] || 0) + 1;
  });
  console.log('\n📁 Распределение по категориям в SMMflux (Топ-20):');
  Object.entries(catCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([cName, cnt]) => {
      console.log(`   - ${cName}: ${cnt} услуг`);
    });
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  redis.disconnect();
});
