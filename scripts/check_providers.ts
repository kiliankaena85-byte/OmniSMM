import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const providers = await prisma.provider.findMany();
    console.log("Providers:");
    console.table(providers);
}

main().catch(console.error).finally(() => prisma.$disconnect());
