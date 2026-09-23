import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('--- STEP 1: Current counts ---');
  console.log('Services:', await prisma.service.count());
  console.log('Categories:', await prisma.category.count());

  console.log('--- STEP 2: Deleting Services ---');
  const delServices = await prisma.service.deleteMany({});
  console.log('Deleted services count:', delServices.count);

  console.log('--- STEP 3: Checking counts immediately ---');
  const countAfterDel = await prisma.service.count();
  console.log('Services count immediately after delete:', countAfterDel);
  if (countAfterDel > 0) {
    const remaining = await prisma.service.findMany({ select: { id: true, name: true } });
    console.log('Remaining services:', remaining);
  }

  console.log('--- STEP 4: Deleting Categories ---');
  try {
    const delCategories = await prisma.category.deleteMany({});
    console.log('Deleted categories count:', delCategories.count);
  } catch (err: any) {
    console.error('Failed to delete categories:', err.message);
    // Let's check services again to see if they were recreated
    const countAfterFail = await prisma.service.count();
    console.log('Services count after failure:', countAfterFail);
    if (countAfterFail > 0) {
      const remaining = await prisma.service.findMany({ select: { id: true, name: true, categoryId: true } });
      console.log('Remaining services after failure:', remaining);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
