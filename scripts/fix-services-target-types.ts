import { db } from '../src/lib/db';

async function fixTargetTypes() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🛠️ FIXING SERVICES TARGET TYPES & NETWORK TAXONOMY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Find all categories and update their services targetType
  const categories = await db.category.findMany({
    include: {
      network: true,
      services: true
    }
  });

  let updatedCount = 0;

  for (const cat of categories) {
    const netSlug = cat.network?.slug || '';
    const catNameLower = cat.name.toLowerCase();

    const isSubscribers = catNameLower.includes('подписчик') || catNameLower.includes('участник') || catNameLower.includes('фолловер') || catNameLower.includes('читател');
    const isViews = catNameLower.includes('просмотр') || catNameLower.includes('дочитыван') || catNameLower.includes('зрител');
    const isLikes = catNameLower.includes('лайк') || catNameLower.includes('класс') || catNameLower.includes('реакц');
    const isComments = catNameLower.includes('коммент') || catNameLower.includes('отзыв');
    const isBots = catNameLower.includes('бот') || catNameLower.includes('реферал');
    const isBoosts = catNameLower.includes('буст');

    for (const srv of cat.services) {
      let targetType = 'POST';

      if (isBots || srv.name.toLowerCase().includes('бот') || srv.name.toLowerCase().includes('реферал')) {
        targetType = 'BOT';
      } else if (isBoosts) {
        targetType = 'CHANNEL';
      } else if (isSubscribers) {
        if (netSlug === 'telegram') {
          targetType = 'CHANNEL';
        } else if (netSlug === 'vk') {
          targetType = srv.name.toLowerCase().includes('групп') || srv.name.toLowerCase().includes('паблик') ? 'GROUP' : 'PROFILE';
        } else {
          targetType = 'PROFILE';
        }
      } else if (isViews || isLikes || isComments) {
        targetType = 'POST';
      }

      if (srv.targetType !== targetType) {
        await db.service.update({
          where: { id: srv.id },
          data: { targetType }
        });
        console.log(`  ✅ [${netSlug} -> ${cat.name}] "${srv.name}" targetType: ${srv.targetType} -> ${targetType}`);
        updatedCount++;
      }
    }
  }

  console.log(`\nUpdated ${updatedCount} services with correct targetType.`);

  // 2. Set isActive: false on empty networks with 0 categories
  const emptyNetworks = await db.network.findMany({
    where: {
      categories: {
        none: {}
      }
    }
  });

  console.log(`\nFound ${emptyNetworks.length} empty networks with 0 categories.`);
  for (const n of emptyNetworks) {
    await db.network.update({
      where: { id: n.id },
      data: { isActive: false }
    });
    console.log(`  Deactivated empty network: [${n.name}] (${n.slug})`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  🎉 TARGET TYPES AND TAXONOMY REPAIR COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

fixTargetTypes()
  .catch(console.error)
  .finally(() => db.$disconnect());
