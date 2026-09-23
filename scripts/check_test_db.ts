import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Network Count ---');
  const networks = await prisma.network.findMany();
  console.log(networks);

  console.log('--- Category Count ---');
  const categories = await prisma.category.findMany();
  console.log(categories);

  console.log('--- Service Count ---');
  const services = await prisma.service.findMany();
  console.log(services);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
