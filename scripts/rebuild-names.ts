import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Rebuilding service names strictly based on category and tier...");
    
    const services = await prisma.service.findMany({
        where: { isActive: true },
        include: { category: true }
    });

    let processed = 0;

    for (const s of services) {
        // We know the tier from our deduplication script logic, it's either in features.tier or we can default to 'Стандарт'
        const features = s.features as any;
        const tier = features?.tier || 'Стандарт';
        
        // Clean, perfect name: "Telegram Подписчики • Эконом"
        const newName = `${s.category.name} • ${tier}`;
        
        if (s.name !== newName) {
            await prisma.service.update({
                where: { id: s.id },
                data: { name: newName }
            });
            processed++;
        }
    }

    console.log(`✅ Renamed ${processed} services to perfect format.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
