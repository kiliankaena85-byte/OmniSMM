import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Searching for duplicate services...");
    const services = await prisma.service.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' } // to keep the first one
    });

    const seen = new Set<string>();
    const duplicates = [];

    for (const s of services) {
        // Group by category, name, and price
        const key = `${s.categoryId}-${s.name}-${s.pricePer1000Cents}`;
        if (seen.has(key)) {
            duplicates.push(s.id);
        } else {
            seen.add(key);
        }
    }

    console.log(`Found ${duplicates.length} duplicate services.`);
    
    if (duplicates.length > 0) {
        console.log("Deleting duplicates...");
        const result = await prisma.service.deleteMany({
            where: { id: { in: duplicates } }
        });
        console.log(`Deleted ${result.count} duplicates!`);
    } else {
        console.log("No duplicates found.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
