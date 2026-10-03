import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import fs from 'fs';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://:SmmP1anR3dis2026Secure!@localhost:6379');

async function main() {
  console.log('🔄 [RENAME CATEGORIES] Updating category names per user instruction...');

  // 1. Update in PostgreSQL
  const catRegular = await prisma.category.findFirst({
    where: { name: 'Подписчики (Обычные)' }
  });

  if (catRegular) {
    await prisma.category.update({
      where: { id: catRegular.id },
      data: { name: 'Подписчики' }
    });
    console.log(`  ✅ Renamed category [${catRegular.id}]: 'Подписчики (Обычные)' -> 'Подписчики'`);
  } else {
    console.log(`  ℹ️ Category 'Подписчики (Обычные)' not found (might already be renamed).`);
  }

  const catStar = await prisma.category.findFirst({
    where: {
      OR: [
        { name: 'Подписчики (со звездой ⭐)' },
        { name: { contains: 'со звездой' } }
      ]
    }
  });

  if (catStar) {
    await prisma.category.update({
      where: { id: catStar.id },
      data: { name: 'Подписчики премиум' }
    });
    console.log(`  ✅ Renamed category [${catStar.id}]: '${catStar.name}' -> 'Подписчики премиум'`);
  } else {
    console.log(`  ℹ️ Category 'Подписчики (со звездой ⭐)' not found.`);
  }

  // 2. Update master JSON docs/CURATED_SERVICES_400.json
  const jsonPath = 'docs/CURATED_SERVICES_400.json';
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const items = JSON.parse(raw);
    let changed = 0;
    for (const it of items) {
      if (it.category === 'Telegram — Подписчики (Обычные)') {
        it.category = 'Telegram — Подписчики';
        changed++;
      } else if (it.category === 'Telegram Premium — Подписчики (со звездой ⭐)') {
        it.category = 'Telegram — Подписчики премиум';
        changed++;
      }
    }
    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`  ✅ Updated ${changed} items in docs/CURATED_SERVICES_400.json`);
  }

  // 3. Clear Redis cache
  const keys = await redis.keys('*catalog*');
  const servicesKeys = await redis.keys('*service*');
  const allKeys = [...new Set([...keys, ...servicesKeys])];
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
    console.log(`  🧹 Flushed ${allKeys.length} Redis cache keys for storefront.`);
  } else {
    console.log('  ℹ️ No Redis cache keys found.');
  }

  console.log('🎉 Done category renaming.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
