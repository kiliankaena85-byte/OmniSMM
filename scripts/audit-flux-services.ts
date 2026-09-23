import { db } from '../src/lib/db';
import { getPublicCatalogAction, getServicesByCategoryAction } from '../src/actions/order/catalog';

async function auditFlux() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  ⚡ SMMFLUX (tenantId: "flux") DEEP CATALOG AUDIT');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const networks = await db.network.findMany({
    where: {
      isActive: true,
      tenantId: { in: ['flux', 'all'] },
      categories: {
        some: {
          tenantId: { in: ['flux', 'all'] },
          services: {
            some: {
              isActive: true,
              isQuarantined: false,
              tenantId: { in: ['flux', 'all'] }
            }
          }
        }
      }
    },
    include: {
      categories: {
        where: {
          tenantId: { in: ['flux', 'all'] },
          services: {
            some: {
              isActive: true,
              isQuarantined: false,
              tenantId: { in: ['flux', 'all'] }
            }
          }
        },
        include: {
          services: {
            where: {
              isActive: true,
              isQuarantined: false,
              tenantId: { in: ['flux', 'all'] }
            }
          }
        }
      }
    }
  });

  console.log(`Found ${networks.length} networks visible for SMMflux:`);
  for (const n of networks) {
    const totalServices = n.categories.reduce((acc, c) => acc + c.services.length, 0);
    console.log(`\n🔹 Network [${n.name}] (${n.slug}): ${n.categories.length} categories, ${totalServices} services`);
    for (const c of n.categories) {
      console.log(`   ├─ [${c.name}] (${c.id}) -> ${c.services.length} services`);
      for (const s of c.services.slice(0, 2)) {
        const feat = (s.features && typeof s.features === 'object' ? s.features : {}) as Record<string, unknown>;
        console.log(`   │   • [${s.id}] "${s.name}" (rate: ${s.rate}, markup: ${s.markup}, targetType: ${s.targetType})`);
      }
    }
  }
}

auditFlux()
  .catch(console.error)
  .finally(() => db.$disconnect());
