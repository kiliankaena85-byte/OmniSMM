import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const service = await prisma.service.findFirst({
    orderBy: { numericId: 'desc' },
    select: { numericId: true, name: true }
  });
  console.log(JSON.stringify(service, null, 2));
}
run().finally(() => prisma.$disconnect());
