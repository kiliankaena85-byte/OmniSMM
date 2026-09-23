import { PrismaClient } from '@prisma/client';
import { redis } from './src/lib/redis';

const prisma = new PrismaClient();

async function run() {
    try {
        console.log("=== Проверка Провайдеров и Теневых Каталогов ===\n");
        
        const providers = await prisma.provider.findMany();
        console.log(`Найдено провайдеров в базе: ${providers.length}\n`);

        for (const provider of providers) {
            console.log(`[Провайдер]: ${provider.name} (ID: ${provider.id})`);
            const cacheKey = `provider:${provider.id}:shadow_catalog`;
            const cachedData = await redis.get(cacheKey);

            if (!cachedData) {
                console.log(` ❌ Ошибка: Теневой каталог пуст (необходим Sync API).`);
                console.log(`--------------------------------------------------\n`);
                continue;
            }

            const services = JSON.parse(cachedData);
            console.log(` ✅ Услуг в теневом каталоге: ${services.length}`);

            let withOriginalDescription = 0;
            let withoutOriginalDescription = 0;

            for (const s of services) {
                const originalDesc = s.desc || s.description || '';
                if (originalDesc.trim().length > 0) {
                    withOriginalDescription++;
                } else {
                    withoutOriginalDescription++;
                }
            }

            console.log(` 📊 Статистика по описаниям от API провайдера:`);
            console.log(`    - Услуг С ОРИГИНАЛЬНЫМ описанием от провайдера: ${withOriginalDescription}`);
            console.log(`    - Услуг БЕЗ оригинального описания: ${withoutOriginalDescription}`);

            if (withoutOriginalDescription > 0) {
                console.log(` ⚠️ Внимание: ${withoutOriginalDescription} услуг у этого провайдера не имеют описания в его API.`);
                console.log(`    Наш скрипт сгенерирует безопасное описание по названию (Например: "Боты. Весь мир"), но мы не "придумываем" факты.`);
            } else {
                console.log(` 🛡️ Идеально: Все услуги имеют оригинальное описание от провайдера.`);
            }
            console.log(`--------------------------------------------------\n`);
        }
    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
