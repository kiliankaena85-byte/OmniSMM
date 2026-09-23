import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const tests = await prisma.service.findMany({
    where: {
      OR: [
        { name: { contains: 'E2E' } },
        { name: { contains: 'Test' } }
      ]
    }
  });
  
  console.log(`Found ${tests.length} test services.`);
  for (const t of tests) {
    console.log(`- ${t.name} (${t.id})`);
  }
  
  if (tests.length > 0) {
    const deleted = await prisma.service.deleteMany({
      where: {
        id: { in: tests.map(t => t.id) }
      }
    });
    console.log(`Deleted ${deleted.count} test services.`);
  }
  await prisma.$disconnect();
}

run();
