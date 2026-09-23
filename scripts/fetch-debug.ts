import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    where: {
      numericId: {
        in: [2920, 2922, 2924, 4883]
      }
    },
    include: {
      category: true
    }
  });

  for (const s of services) {
    console.log(`ID: ${s.numericId}`);
    console.log(`Name: ${s.name}`);
    console.log(`Description: ${s.description}`);
    console.log(`Category: ${s.category?.name}`);
    console.log(`ProviderID: ${s.providerId}`);
    console.log('---');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
