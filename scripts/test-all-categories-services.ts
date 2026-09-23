import { db } from '../src/lib/db';

async function testAllCategories() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔍 AUDITING ALL CATEGORIES & THEIR SERVICES ACROSS TENANTS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const networks = await db.network.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          services: true
        }
      }
    }
  });

  let totalCategories = 0;
  let emptyCategories = 0;
  let mismatchedTargetTypes = 0;

  for (const n of networks) {
    console.log(`\n🌐 [${n.name}] (slug: ${n.slug}) — ${n.categories.length} categories:`);
    for (const c of n.categories) {
      totalCategories++;
      const allServices = c.services;
      const activeServices = allServices.filter(s => s.isActive && !s.isQuarantined);
      const isSubscribers = c.name.toLowerCase().includes('подписчик') || c.name.toLowerCase().includes('участник') || c.name.toLowerCase().includes('фолловер') || c.name.toLowerCase().includes('читател');
      const isViews = c.name.toLowerCase().includes('просмотр') || c.name.toLowerCase().includes('дочитыван') || c.name.toLowerCase().includes('зрител');
      const isLikes = c.name.toLowerCase().includes('лайк') || c.name.toLowerCase().includes('класс') || c.name.toLowerCase().includes('реакц');
      const isComments = c.name.toLowerCase().includes('коммент') || c.name.toLowerCase().includes('отзыв');
      const isBots = c.name.toLowerCase().includes('бот') || c.name.toLowerCase().includes('реферал');
      const isBoosts = c.name.toLowerCase().includes('буст');

      console.log(`  📁 Category: "${c.name}" (id: ${c.id})`);
      console.log(`     Active Services: ${activeServices.length} / ${allServices.length} total`);

      if (activeServices.length === 0) {
        console.log(`     ❌ EMPTY CATEGORY! No active services!`);
        emptyCategories++;
      } else {
        for (const s of activeServices) {
          const expectedTarget = isSubscribers ? (n.slug === 'telegram' ? 'CHANNEL' : 'PROFILE')
            : isViews ? (n.slug === 'telegram' ? 'POST' : 'POST')
            : isLikes ? 'POST'
            : isComments ? 'POST'
            : isBots ? 'BOT'
            : isBoosts ? 'CHANNEL'
            : 'POST';

          if (isSubscribers && s.targetType === 'POST') {
            console.log(`     ⚠️ TargetType MISMATCH: Service "${s.name}" is in Subscriber category but targetType="${s.targetType}" (should be ${expectedTarget})`);
            mismatchedTargetTypes++;
          }
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`SUMMARY:`);
  console.log(`  Total categories: ${totalCategories}`);
  console.log(`  Empty categories (0 services): ${emptyCategories}`);
  console.log(`  Mismatched targetType services: ${mismatchedTargetTypes}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

testAllCategories()
  .catch(console.error)
  .finally(() => db.$disconnect());
