import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing SystemSettings table...');
  try {
    await prisma.systemSettings.deleteMany();
    console.log('Cleared successfully.');
  } catch (err) {
    console.error('Failed to clear:', err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
