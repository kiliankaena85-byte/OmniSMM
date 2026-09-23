const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const providers = await prisma.provider.findMany();
  console.log('=== ALL PROVIDERS ===');
  for (const p of providers) {
    const sCount = await prisma.service.count({ where: { providerId: p.id } });
    console.log(`- Provider [${p.id}]: "${p.name}" | Active: ${p.isActive} | URL: ${p.apiUrl} | Services: ${sCount}`);
  }
  const noProvCount = await prisma.service.count({ where: { providerId: null } });
  console.log(`- Services with NO provider (null): ${noProvCount}`);

  console.log('\n=== NETWORKS AND CATEGORIES BREAKDOWN ===');
  const networks = await prisma.network.findMany({
    include: {
      categories: {
        include: {
          services: {
            include: {
              provider: true
            }
          }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  for (const net of networks) {
    console.log(`\n🌐 NETWORK: "${net.name}" (slug: "${net.slug}")`);
    for (const cat of net.categories) {
      console.log(`   📁 Category: "${cat.name}" (slug: "${cat.slug}", services: ${cat.services.length})`);
      const sample = cat.services.slice(0, 3);
      for (const s of sample) {
        console.log(`      * "${s.name}" (prov: ${s.provider?.name || 'NONE'}, rate: ${s.rate}, extId: ${s.externalId})`);
      }
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
