const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.category.findMany({
    where: { network: { slug: 'telegram' } },
    include: { services: { where: { isActive: true }, take: 3 }, network: true }
  });
  console.log('Telegram categories:');
  for (const c of cats) {
    console.log(`  "${c.name}": ${c.services.length} услуг`);
    for (const s of c.services) {
      console.log(`    - ${s.name} rate=${s.rate} minQty=${s.minQty}`);
    }
  }

  const allNetworks = await prisma.network.findMany({
    where: { isActive: true, categories: { some: { services: { some: { isActive: true } } } } },
    include: { categories: { where: { services: { some: { isActive: true } } }, orderBy: { name: 'asc' } } }
  });
  console.log('\nCatalog networks:');
  for (const n of allNetworks) {
    console.log(`  ${n.name} (slug:${n.slug}) - ${n.categories.length} кат`);
    for (const c of n.categories) {
      console.log(`    -> ${c.name} (id:${c.id.slice(-8)})`);
    }
  }

  const total = await prisma.service.count({ where: { isActive: true } });
  console.log(`\nTotal active services: ${total}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
