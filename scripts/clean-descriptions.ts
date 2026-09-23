import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning and standardizing service descriptions...");
    
    const services = await prisma.service.findMany({
        where: { isActive: true }
    });

    let processed = 0;

    for (const s of services) {
        if (!s.description) continue;

        let newDesc = s.description;

        // 1. Убираем "Оригинальное описание провайдера" и весь сырой текст после него
        const separatorIndex = newDesc.indexOf('--- Оригинальное описание провайдера ---');
        if (separatorIndex !== -1) {
            newDesc = newDesc.substring(0, separatorIndex).trim();
        }

        // 2. Убираем дублирующуюся фразу "Внимание: Возможны отписки. Без гарантии восстановления." 
        // если в тексте уже есть "Без гарантии" или "Возможны списания"
        if (newDesc.includes('Без гарантии') || newDesc.includes('Возможны списания')) {
            newDesc = newDesc.replace('Внимание: Возможны отписки. Без гарантии восстановления.', '').trim();
        }

        // 3. Убираем лишние точки, пробелы или запятые в самом начале строки
        // eslint-disable-next-line no-useless-escape
        newDesc = newDesc.replace(/^[\s\.\,]+/, '');

        // 4. Очищаем HTML сущности (на всякий случай)
        newDesc = newDesc.replace(/&nbsp;/g, ' ');

        // 5. Убираем двойные пробелы и переносы строк подряд
        newDesc = newDesc.replace(/\s+/g, ' ').trim();
        
        // 6. Добавляем финальную точку, если её нет
        if (newDesc.length > 0 && !newDesc.endsWith('.')) {
            newDesc += '.';
        }

        if (s.description !== newDesc) {
            await prisma.service.update({
                where: { id: s.id },
                data: { description: newDesc }
            });
            processed++;
        }
    }

    console.log(`✅ Cleaned descriptions for ${processed} services.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
