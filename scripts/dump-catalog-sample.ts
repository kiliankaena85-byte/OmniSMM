import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const services = await prisma.service.findMany({
        where: { isActive: true },
        include: { category: { include: { network: true } } },
        take: 50 // get a sample of 50 services across different categories
    });

    const sample = services.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        pricePer1000: s.pricePer1000Cents / 100,
        minQty: s.minQty
    }));

    fs.writeFileSync('catalog-sample.json', JSON.stringify(sample, null, 2));
    console.log("Dumped 50 services to catalog-sample.json");
}

main().catch(console.error).finally(() => prisma.$disconnect());
