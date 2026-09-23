import { db } from '../src/lib/db';
import { getPublicCatalogAction, getServicesByCategoryAction } from '../src/actions/order/catalog';

async function auditServices() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🔍 DEEP DATABASE & SERVICES AUDIT');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Count totals in DB
  const networksCount = await db.network.count();
  const activeNetworksCount = await db.network.count({ where: { isActive: true } });
  const categoriesCount = await db.category.count();
  const servicesTotal = await db.service.count();
  const activeServices = await db.service.count({ where: { isActive: true } });
  const providersCount = await db.provider.count();

  console.log('📊 DATABASE TOTALS:');
  console.log(`  Networks:   ${activeNetworksCount} active / ${networksCount} total`);
  console.log(`  Categories: ${categoriesCount} total`);
  console.log(`  Services:   ${activeServices} active / ${servicesTotal} total`);
  console.log(`  Providers:  ${providersCount} total\n`);

  // 2. Inspect Networks and their categories and services count
  console.log('🌐 NETWORKS & SERVICES DISTRIBUTION:');
  const networks = await db.network.findMany({
    orderBy: { sort: 'asc' },
    include: {
      categories: {
        orderBy: { sort: 'asc' },
        include: {
          _count: {
            select: { services: true }
          },
          services: {
            where: { isActive: true },
            select: { id: true, name: true, rate: true, markup: true, minQty: true, maxQty: true, providerId: true }
          }
        }
      }
    }
  });

  for (const net of networks) {
    const totalNetServices = net.categories.reduce((acc, cat) => acc + cat.services.length, 0);
    console.log(`\n🔹 Network: [${net.name}] (slug: ${net.slug}, active: ${net.isActive}) - ${net.categories.length} categories, ${totalNetServices} active services`);
    
    for (const cat of net.categories) {
      console.log(`   ├─ Category: [${cat.name}] (slug: ${cat.slug}, id: ${cat.id}) -> ${cat.services.length} active services (DB total: ${cat._count.services})`);
      if (cat.services.length === 0) {
        console.log(`   │  ⚠️  NO ACTIVE SERVICES IN THIS CATEGORY!`);
      } else {
        cat.services.slice(0, 3).forEach(s => {
          console.log(`   │  • [${s.id}] ${s.name.substring(0, 45)}... (Price/1k: ${s.pricePer1kRub} коп, Min: ${s.minQty})`);
        });
        if (cat.services.length > 3) {
          console.log(`   │  • ... and ${cat.services.length - 3} more services`);
        }
      }
    }
  }

  // 3. Test Server Actions for 'smmplan' and 'flux'
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  🧪 TESTING SERVER ACTIONS (API LEVEL)');
  console.log('═══════════════════════════════════════════════════════════════════');

  for (const tenant of ['smmplan', 'flux']) {
    console.log(`\n--- Tenant: [${tenant}] ---`);
    const catalogRes = await getPublicCatalogAction(tenant);
    console.log(`  getPublicCatalogAction status: ${catalogRes.success}`);
    if (catalogRes.success && catalogRes.data) {
      console.log(`  Networks returned: ${catalogRes.data.length}`);
      for (const n of catalogRes.data.slice(0, 3)) {
        console.log(`    - ${n.name}: ${n.categories.length} categories`);
        if (n.categories.length > 0) {
          const firstCat = n.categories[0];
          const servicesRes = await getServicesByCategoryAction(firstCat.id, tenant);
          console.log(`      -> getServicesByCategoryAction for "${firstCat.name}" (${firstCat.id}): ${servicesRes.success ? `${servicesRes.data?.length} services` : `ERROR: ${servicesRes.error}`}`);
        }
      }
    } else {
      console.log(`  ERROR: ${catalogRes.error}`);
    }
  }
}

auditServices()
  .catch(console.error)
  .finally(() => db.$disconnect());
