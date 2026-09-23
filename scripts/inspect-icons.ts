import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectIcons() {
  const networks = await prisma.network.findMany();
  console.log(`Всего сетей: ${networks.length}`);
  networks.forEach(n => {
    console.log(`[${n.slug}] name: "${n.name}", icon: "${n.icon}"`);
  });
}

inspectIcons().catch(console.error).finally(() => prisma.$disconnect());
