import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.contentItem.findMany();
  console.log('Legal Pages:', items.map(i => ({ slug: i.slug, published: i.isPublished })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
