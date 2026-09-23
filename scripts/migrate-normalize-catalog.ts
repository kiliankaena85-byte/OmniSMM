import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  console.log('=== STARTING CATALOG CATEGORY NORMALIZATION ===\n');

  const tgNetwork = await db.network.findFirst({ where: { slug: 'telegram' } });
  if (!tgNetwork) {
    throw new Error('Telegram network not found in DB');
  }

  // 1. Create or ensure canonical Telegram categories
  const canonicalCategories = [
    { name: '📢 Подписчики на канал', slug: 'tg-subscribers', sort: 1 },
    { name: '⭐ Telegram Premium Подписчики', slug: 'tg-premium-subscribers', sort: 2 },
    { name: '👁️ Просмотры и охваты', slug: 'tg-views', sort: 3 },
    { name: '❤️ Реакции и бусты', slug: 'tg-reactions', sort: 4 },
    { name: '🤖 Старты ботов и рефералы', slug: 'tg-bots-referrals', sort: 5 },
    { name: '💬 Комментарии', slug: 'tg-comments', sort: 6 },
  ];

  const categoryMap = new Map<string, string>(); // slug -> categoryId

  for (const cat of canonicalCategories) {
    const existing = await db.category.findFirst({
      where: {
        networkId: tgNetwork.id,
        OR: [
          { slug: cat.slug },
          { name: cat.name }
        ]
      }
    });

    if (existing) {
      const updated = await db.category.update({
        where: { id: existing.id },
        data: { name: cat.name, slug: cat.slug, sort: cat.sort }
      });
      categoryMap.set(cat.slug, updated.id);
      console.log(`✓ Updated canonical category: "${updated.name}" (${updated.id})`);
    } else {
      const created = await db.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          sort: cat.sort,
          networkId: tgNetwork.id,
          tenantId: 'smmplan'
        }
      });
      categoryMap.set(cat.slug, created.id);
      console.log(`+ Created canonical category: "${created.name}" (${created.id})`);
    }
  }

  // 2. Fetch all Telegram services across all categories
  const allTgServices = await db.service.findMany({
    where: {
      category: {
        networkId: tgNetwork.id
      }
    },
    include: {
      category: true
    }
  });

  console.log(`\nFound ${allTgServices.length} Telegram services to classify.`);

  let subscribersCount = 0;
  let premiumCount = 0;
  let viewsCount = 0;
  let reactionsCount = 0;
  let botsCount = 0;
  let commentsCount = 0;

  for (const s of allTgServices) {
    // Delete or archive broken test service
    if (s.id === 'live-vexboost-tg-subs') {
      await db.service.delete({ where: { id: s.id } }).catch(() => null);
      console.log(`- Deleted broken test service: "${s.name}" (${s.id})`);
      continue;
    }

    const lower = s.name.toLowerCase();
    let targetCategorySlug = 'tg-subscribers';

    if (lower.includes('реакци') || lower.includes('звёзд') || lower.includes('звезд') || lower.includes('stars') || lower.includes('буст') || lower.includes('boost') || lower.includes('подарок')) {
      targetCategorySlug = 'tg-reactions';
      reactionsCount++;
    } else if (lower.includes('просмотр') || lower.includes('сторис') || lower.includes('пост') && !lower.includes('подписчик') && !lower.includes('реакци')) {
      targetCategorySlug = 'tg-views';
      viewsCount++;
    } else if (lower.includes('бот') || lower.includes('реферал') || lower.includes('blum') || lower.includes('hamster') || lower.includes('cityholder')) {
      targetCategorySlug = 'tg-bots-referrals';
      botsCount++;
    } else if (lower.includes('комментар') || lower.includes('отзыв')) {
      targetCategorySlug = 'tg-comments';
      commentsCount++;
    } else if (lower.includes('premium') || lower.includes('премиум')) {
      targetCategorySlug = 'tg-premium-subscribers';
      premiumCount++;
    } else {
      targetCategorySlug = 'tg-subscribers';
      subscribersCount++;
    }

    const targetCatId = categoryMap.get(targetCategorySlug);
    if (targetCatId && s.categoryId !== targetCatId) {
      await db.service.update({
        where: { id: s.id },
        data: { categoryId: targetCatId }
      });
    }
  }

  console.log(`\nReclassified distribution:`);
  console.log(`- 📢 Подписчики на канал: ${subscribersCount}`);
  console.log(`- ⭐ Telegram Premium: ${premiumCount}`);
  console.log(`- 👁️ Просмотры и охваты: ${viewsCount}`);
  console.log(`- ❤️ Реакции и бусты: ${reactionsCount}`);
  console.log(`- 🤖 Боты и рефералы: ${botsCount}`);
  console.log(`- 💬 Комментарии: ${commentsCount}`);

  // 3. Remove obsolete empty / duplicate Telegram categories
  const canonicalIds = Array.from(categoryMap.values());
  const obsoleteCategories = await db.category.findMany({
    where: {
      networkId: tgNetwork.id,
      id: { notIn: canonicalIds }
    },
    include: {
      services: true
    }
  });

  console.log(`\nCleaning up ${obsoleteCategories.length} obsolete Telegram categories...`);
  for (const obs of obsoleteCategories) {
    if (obs.services.length === 0) {
      await db.category.delete({ where: { id: obs.id } });
      console.log(`✓ Deleted empty obsolete category: "${obs.name}" (${obs.id})`);
    } else {
      console.log(`⚠️ Category "${obs.name}" has ${obs.services.length} services remaining (skipped delete)`);
    }
  }

  console.log('\n✅ CATALOG CATEGORY NORMALIZATION COMPLETED SUCCESSFULLY!');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
