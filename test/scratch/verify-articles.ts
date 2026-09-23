import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await prisma.article.count();
    console.log(`Article count is: ${count}`);
    const latest = await prisma.article.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    console.log(`Latest imported article slug: ${latest?.slug}`);
  } catch (error) {
    console.error('Error counting articles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
