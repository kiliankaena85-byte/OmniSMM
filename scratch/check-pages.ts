import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.contentItem.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      isPublished: true
    }
  });
  console.log("=== Content Items ===");
  console.log(JSON.stringify(items, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
