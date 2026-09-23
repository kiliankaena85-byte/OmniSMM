import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Enforcing 'One service per tier' rule...");
    
    // Get all active services
    const services = await prisma.service.findMany({
        where: { isActive: true },
        include: { category: true }
    });

    // We will group by CategoryId + Tier
    const bestServicePerGroup = new Map<string, any>();
    const toDelete: string[] = [];

    for (const s of services) {
        // Extract tier from features JSON
        let tier = "Стандарт";
        try {
            if (s.features && typeof s.features === 'object') {
                const feats = s.features as any;
                if (feats.tier) {
                    tier = feats.tier;
                }
            }
        // eslint-disable-next-line no-empty
        } catch(e) {}
        
        const groupKey = `${s.categoryId}-${tier}`;

        const existing = bestServicePerGroup.get(groupKey);

        if (!existing) {
            bestServicePerGroup.set(groupKey, s);
        } else {
            // Compare prices. Keep the cheaper one.
            if (s.pricePer1000Cents < existing.pricePer1000Cents) {
                // New one is cheaper! Mark the old one for deletion and replace it
                toDelete.push(existing.id);
                bestServicePerGroup.set(groupKey, s);
            } else if (s.pricePer1000Cents === existing.pricePer1000Cents) {
                // If same price, keep the one with lower ID (older/more established)
                if (s.id < existing.id) {
                    toDelete.push(existing.id);
                    bestServicePerGroup.set(groupKey, s);
                } else {
                    toDelete.push(s.id);
                }
            } else {
                // Existing one is cheaper, mark new one for deletion
                toDelete.push(s.id);
            }
        }
    }

    console.log(`Found ${bestServicePerGroup.size} unique (Category + Tier) combinations.`);
    console.log(`Identified ${toDelete.length} redundant services to delete.`);

    if (toDelete.length > 0) {
        const result = await prisma.service.deleteMany({
            where: { id: { in: toDelete } }
        });
        console.log(`Deleted ${result.count} redundant services!`);
    } else {
        console.log("No redundant services found. Catalog is perfectly optimized.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
