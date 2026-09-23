import { PrismaClient } from '../src/lib/prisma';
const prisma = new PrismaClient();

async function run() {
  const pages = await prisma.page.findMany();
  console.log(pages.map(p => ({ slug: p.slug, title: p.title })));
  await prisma.$disconnect();
}

run().catch(console.error);
