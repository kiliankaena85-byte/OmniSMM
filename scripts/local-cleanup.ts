import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const qualityMap: Record<string, string> = {
    'Premium': 'Премиум',
    'Standard': 'Стандарт',
    'Economy': 'Эконом',
    'Real': 'Живые',
    'Эконом': 'Эконом',
    'Стандарт': 'Стандарт',
    'Премиум': 'Премиум',
    'Живые': 'Живые'
};

// Функция для очистки текста от визуального мусора
function cleanDescription(text: string): string {
    if (!text) return '';
    
    let cleaned = text;
    // 1. Полностью вырезаем все эмодзи и суррогатные пары (избавляемся от lone surrogate errors)
    cleaned = cleaned.replace(/[\uD800-\uDFFF]/g, '');
    
    // 2. Убираем истеричную пунктуацию (!!! -> !)
    cleaned = cleaned.replace(/!{2,}/g, '!');
    cleaned = cleaned.replace(/\?{2,}/g, '?');
    
    // 3. Смягчаем капслок "ЗАПРЕЩЕНО", "ВНИМАНИЕ"
    cleaned = cleaned.replace(/ВНИМАНИЕ:?/g, 'Обратите внимание:');
    cleaned = cleaned.replace(/ВАЖНО:?/g, 'Важно:');
    cleaned = cleaned.replace(/ЗАПРЕЩЕНО/g, 'Не рекомендуется');
    cleaned = cleaned.replace(/НЕ ЗАКАЗЫВАТЬ/g, 'Избегайте заказа');
    
    // 4. Убираем лишние пробелы и пустые строки, возникшие после удаления
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n').trim();
    
    // 5. Убираем ведущие точки типа ". Гео: Весь мир."
    cleaned = cleaned.replace(/^\.\s*/, '');
    
    return cleaned;
}

async function main() {
    console.log("Starting Local Marketing Cleanup (Regex/Rules)...");
    
    const services = await prisma.service.findMany({
        include: { category: true }
    });
    
    if (services.length === 0) {
        console.log("All services are already formatted!");
        return;
    }

    console.log(`Found ${services.length} services to clean up.`);
    let processed = 0;

    for (const s of services) {
        // === 1. FORMAT NAME ===
        let newName = s.name;
        
        // Извлекаем качество из скобок, например "(Premium)"
        const match = newName.match(/\((.*?)\)/);
        let quality = 'Стандарт';
        
        if (match) {
            quality = qualityMap[match[1]] || match[1];
            // Удаляем качество из оригинальной строки
            newName = newName.replace(/\(.*?\)/, '').trim();
        }
        
        // Убираем слэши (оставляем только первое слово до слэша) 
        // "Подписчики / Участники" -> "Подписчики"
        newName = newName.split('/')[0].trim();
        
        // Добавляем соцсеть в начало, если её там нет
        const networkName = s.category?.name.split(' ')[0] || '';
        if (networkName && !newName.toLowerCase().includes(networkName.toLowerCase())) {
            newName = `${networkName} ${newName}`;
        }
        
        // Формируем премиальное название
        newName = `${newName} • ${quality}`;
        
        // === 2. CLEANUP DESCRIPTION ===
        const newDesc = cleanDescription(s.description || '');
        
        await prisma.service.update({
            where: { id: s.id },
            data: {
                name: newName,
                description: newDesc
            }
        });
        
        processed++;
        if (processed % 100 === 0) {
            console.log(`Processed ${processed} / ${services.length}...`);
        }
    }
    
    console.log(`✅ Cleanup finished! Transformed ${processed} services.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
