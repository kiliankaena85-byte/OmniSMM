import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const networksCount = await prisma.network.count();
  const categoriesCount = await prisma.category.count();
  const servicesCount = await prisma.service.count();
  const activeServicesCount = await prisma.service.count({ where: { isActive: true } });
  
  console.log({
    networksCount,
    categoriesCount,
    servicesCount,
    activeServicesCount
  });

  const networks = await prisma.network.findMany({
    include: {
      categories: {
        include: {
          services: true
        }
      }
    }
  });

  console.log("Networks:", JSON.stringify(networks, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
