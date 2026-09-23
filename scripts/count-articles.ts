import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.article.count();
  console.log(`Current Article count in DB: ${count}`);
  
  if (count > 0) {
    const samples = await prisma.article.findMany({
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        status: true,
      }
    });
    console.log('Sample Articles:');
    console.log(samples);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
