import { db } from '../src/lib/db';

async function smokeTestCatalog() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🧪 SMOKE TEST & DEEP AUDIT: SERVICES & CATEGORIES VISIBILITY');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Check all active networks
  const networks = await db.network.findMany({
    where: { isActive: true },
    orderBy: { sort: 'asc' },
    include: {
      categories: {
        orderBy: { sort: 'asc' },
        include: {
          services: {
            where: { isActive: true, isQuarantined: false }
          }
        }
      }
    }
  });

  console.log(`✅ Total active networks: ${networks.length}`);
  let totalCats = 0;
  let totalServices = 0;
  let passedChecks = 0;
  let failedChecks = 0;

  for (const n of networks) {
    const netServices = n.categories.reduce((acc, c) => acc + c.services.length, 0);
    console.log(`\n🔹 Network [${n.name}] (slug: ${n.slug}): ${n.categories.length} categories, ${netServices} active services`);
    
    if (n.categories.length === 0) {
      console.log(`   ❌ ERROR: Active network "${n.name}" has 0 categories!`);
      failedChecks++;
    } else {
      passedChecks++;
    }

    for (const c of n.categories) {
      totalCats++;
      totalServices += c.services.length;

      const isSubscribers = c.name.toLowerCase().includes('подписчик') || c.name.toLowerCase().includes('участник') || c.name.toLowerCase().includes('фолловер') || c.name.toLowerCase().includes('читател');
      const isViews = c.name.toLowerCase().includes('просмотр') || c.name.toLowerCase().includes('дочитыван') || c.name.toLowerCase().includes('зрител');
      const isLikes = c.name.toLowerCase().includes('лайк') || c.name.toLowerCase().includes('класс') || c.name.toLowerCase().includes('реакц');
      const isComments = c.name.toLowerCase().includes('коммент') || c.name.toLowerCase().includes('отзыв');
      const isBots = c.name.toLowerCase().includes('бот') || c.name.toLowerCase().includes('реферал');
      const isBoosts = c.name.toLowerCase().includes('буст');

      console.log(`   ├─ Category: "${c.name}" (id: ${c.id}) -> ${c.services.length} active services`);

      if (c.services.length === 0) {
        console.log(`   │  ❌ FAIL: Category "${c.name}" has 0 active services!`);
        failedChecks++;
      } else {
        passedChecks++;
        // Check pricing and targetTypes of services
        for (const s of c.services) {
          if (s.rate <= 0) {
            console.log(`   │  ⚠️ WARNING: Service "${s.name}" has rate <= 0 (${s.rate})`);
            failedChecks++;
          }
          if (s.markup <= 0) {
            console.log(`   │  ⚠️ WARNING: Service "${s.name}" has markup <= 0 (${s.markup})`);
            failedChecks++;
          }
          if (isSubscribers && (s.targetType !== 'CHANNEL' && s.targetType !== 'PROFILE' && s.targetType !== 'GROUP')) {
            console.log(`   │  ⚠️ WARNING: Subscriber service "${s.name}" has invalid targetType: ${s.targetType}`);
            failedChecks++;
          }
        }
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  📊 AUDIT METRICS:`);
  console.log(`  Active Networks:   ${networks.length}`);
  console.log(`  Active Categories: ${totalCats}`);
  console.log(`  Active Services:   ${totalServices}`);
  console.log(`  Passed Checks:     ${passedChecks}`);
  console.log(`  Failed Checks:     ${failedChecks}`);
  console.log(`  Overall Health:    ${failedChecks === 0 ? '🟢 100% HEALTHY & OPERATIONAL' : '🔴 ISSUES FOUND'}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

smokeTestCatalog()
  .catch(console.error)
  .finally(() => db.$disconnect());
