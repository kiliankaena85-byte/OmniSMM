import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const countCat = await prisma.category.count();
  const countServ = await prisma.service.count();
  console.log(`Categories in DB: ${countCat}`);
  console.log(`Services in DB: ${countServ}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
