import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const networks = await prisma.network.findMany({ include: { categories: true } });
    console.log(JSON.stringify(networks, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
