const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalize() {
  const telegram = await prisma.network.findFirst({ where: { slug: 'telegram' } });
  const tgSubsCat = await prisma.category.findFirst({ where: { slug: 'tg-subscribers', networkId: telegram.id } });
  const oldSubsCat = await prisma.category.findFirst({ where: { slug: 'telegram-subscribers', networkId: telegram.id } });

  if (oldSubsCat && tgSubsCat) {
    await prisma.service.updateMany({
      where: { categoryId: oldSubsCat.id },
      data: { categoryId: tgSubsCat.id, isActive: false, isQuarantined: true }
    });
    await prisma.category.delete({ where: { id: oldSubsCat.id } });
    console.log('✅ Reassigned and deleted telegram-subscribers');
  }

  // Purge Redis catalog cache so frontend displays new categories immediately
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6380');
  const keys = await redis.keys('catalog*');
  const netKeys = await redis.keys('network*');
  const allKeys = [...keys, ...netKeys];
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
    console.log(`✅ Cleared ${allKeys.length} Redis cache keys`);
  }
  await redis.quit();

  // Print final Telegram state
  const finalTg = await prisma.network.findFirst({
    where: { slug: 'telegram' },
    include: {
      categories: {
        include: {
          services: {
            where: { isActive: true }
          }
        },
        orderBy: { name: 'asc' }
      }
    }
  });

  console.log('\n=============================================');
  console.log(`🏆 TELEGRAM FINAL NORMALIZED CATEGORIES (${finalTg.categories.length})`);
  console.log('=============================================');
  for (const cat of finalTg.categories) {
    console.log(`\n📂 ${cat.name} (slug: ${cat.slug}) — ${cat.services.length} активных услуг:`);
    for (const s of cat.services) {
      console.log(`   • [ID: ${s.externalId}] ${s.name} | ${s.rate} ₽/1k (Мин: ${s.minQty})`);
    }
  }
  console.log('\n=============================================');

  await prisma.$disconnect();
}

finalize().catch(console.error);
