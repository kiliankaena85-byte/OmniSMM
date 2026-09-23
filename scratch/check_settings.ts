import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const settings = await prisma.systemSettings.findMany();
    console.log('=== SYSTEM SETTINGS ===');
    console.log(JSON.stringify(settings, null, 2));

    const categories = await prisma.category.findMany({
      include: {
        services: {
          select: {
            id: true,
            name: true,
            targetType: true,
            isActive: true,
          }
        }
      }
    });
    console.log('=== CATEGORIES & SERVICES ===');
    console.log(JSON.stringify(categories, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
