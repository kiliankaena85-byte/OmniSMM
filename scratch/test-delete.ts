import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const serviceCount = await prisma.service.count();
  const categoryCount = await prisma.category.count();
  console.log(`Initial count: Services = ${serviceCount}, Categories = ${categoryCount}`);

  const services = await prisma.service.findMany({
    select: { id: true, name: true, categoryId: true }
  });
  console.log('Services in DB:', services);

  try {
    console.log('Executing service.deleteMany()...');
    const res = await prisma.service.deleteMany({});
    console.log('service.deleteMany res:', res);
  } catch (err: any) {
    console.error('Failed to delete services:', err.message);
  }

  const serviceCountAfter = await prisma.service.count();
  console.log(`Services after deleteMany: ${serviceCountAfter}`);

  try {
    console.log('Executing category.deleteMany()...');
    const res = await prisma.category.deleteMany({});
    console.log('category.deleteMany res:', res);
  } catch (err: any) {
    console.error('Failed to delete categories:', err.message);
    if (err.meta) {
      console.error('Error metadata:', JSON.stringify(err.meta, null, 2));
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
