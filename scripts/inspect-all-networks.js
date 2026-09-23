const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAllNetworks() {
  const networks = await prisma.network.findMany({
    include: {
      categories: {
        include: {
          services: {
            where: { isActive: true },
            orderBy: { name: 'asc' }
          }
        },
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`=== FULL CATALOG AUDIT: ${networks.length} NETWORKS ===\n`);

  for (const net of networks) {
    const totalServices = net.categories.reduce((acc, c) => acc + c.services.length, 0);
    console.log(`🌐 [${net.name}] (slug: ${net.slug}) — ${net.categories.length} категорий, ${totalServices} активных услуг:`);
    for (const cat of net.categories) {
      console.log(`   📂 "${cat.name}" (slug: ${cat.slug}) — ${cat.services.length} услуг:`);
      for (const s of cat.services) {
        console.log(`      * [${s.externalId}] "${s.name}" | ${s.rate} ₽/1k (min: ${s.minQty})`);
      }
    }
    console.log('');
  }

  await prisma.$disconnect();
}

inspectAllNetworks().catch(console.error);
