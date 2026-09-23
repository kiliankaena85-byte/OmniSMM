import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVk() {
  const net = await prisma.network.findFirst({
    where: { slug: 'vk' },
    include: {
      categories: {
        include: {
          _count: { select: { services: true } }
        }
      }
    }
  });

  console.log(`Network: ${net?.name} (slug: ${net?.slug})`);
  console.log('Categories:');
  net?.categories.forEach(c => {
    console.log(`- [${c.slug}] "${c.name}": ${c._count.services} services`);
  });
}

checkVk().catch(console.error).finally(() => prisma.$disconnect());
