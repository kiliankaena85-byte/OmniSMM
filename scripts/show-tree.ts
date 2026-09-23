import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function showTree() {
  const networks = await prisma.network.findMany({
    include: {
      categories: {
        include: {
          _count: {
            select: { services: true }
          }
        },
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log("=== Smmplan Catalog Tree ===");
  for (const net of networks) {
    const totalServices = net.categories.reduce((acc, cat) => acc + cat._count.services, 0);
    console.log(`\n🟣 ${net.name} [${net.categories.length} категорий, ${totalServices} услуг]`);
    for (const cat of net.categories) {
      console.log(`   ├── ${cat.name} (${cat._count.services} услуг)`);
    }
  }
}

showTree().finally(() => prisma.$disconnect());
