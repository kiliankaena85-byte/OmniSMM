import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Dynamic Pricing Engine...");

    const services = await prisma.service.findMany({
        where: { isActive: true },
        include: { category: true }
    });

    console.log(`Found ${services.length} active services. Recalculating markups...`);

    let updatedCount = 0;

    for (const service of services) {
        // Себестоимость за 1000 единиц (costUsd)
        const costUsd = service.rate;
        // eslint-disable-next-line no-useless-assignment
        let newMarkup = 3.0; // Базовая минимальная наценка 300%
        
        const isTwitch = service.category?.name.toLowerCase().includes('twitch') || service.name.toLowerCase().includes('twitch');

        if (isTwitch) {
            // Twitch: 4000% - 8000%
            if (costUsd < 0.1) {
                newMarkup = 80.0; // 8000%
            } else if (costUsd >= 0.1 && costUsd < 0.5) {
                newMarkup = 60.0; // 6000%
            } else if (costUsd >= 0.5 && costUsd < 2.0) {
                newMarkup = 50.0; // 5000%
            } else {
                newMarkup = 40.0; // 4000% минимум
            }
        } else {
            // Остальные соцсети: 300% - 1500%
            if (costUsd < 0.05) {
                newMarkup = 15.0; // 1500%
            } else if (costUsd >= 0.05 && costUsd < 0.1) {
                newMarkup = 10.0; // 1000%
            } else if (costUsd >= 0.1 && costUsd < 0.5) {
                newMarkup = 8.0;  // 800%
            } else if (costUsd >= 0.5 && costUsd < 2.0) {
                newMarkup = 5.0;  // 500%
            } else if (costUsd >= 2.0 && costUsd < 5.0) {
                newMarkup = 4.0;  // 400%
            } else {
                newMarkup = 3.0;  // 300% минимум
            }
        }

        if (service.markup !== newMarkup) {
            await prisma.service.update({
                where: { id: service.id },
                data: { markup: newMarkup }
            });
            updatedCount++;
        }
    }

    console.log(`✅ Dynamic Pricing applied. Updated ${updatedCount} services.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
