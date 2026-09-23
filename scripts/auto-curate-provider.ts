import { PrismaClient } from '@prisma/client';
import { redis } from '../src/lib/redis';
import { SmartAnalyzerLogic } from '../src/services/providers/smart-analyzer.logic';

const prisma = new PrismaClient();

// Определение уровня (Tier) на основе спарсенных метрик
function determineTier(serviceName: string, metrics: any): string {
    const n = serviceName.toLowerCase();
    
    // Живые
    if (n.includes('real') || n.includes('organic') || n.includes('task') || n.includes('ads') || n.includes('живые')) {
        return 'Живые';
    }
    
    // Премиум
    if (metrics?.warranty > 15 || n.includes('premium') || n.includes('hq') || n.includes('no drop') || (metrics?.dropRate && metrics.dropRate < 5)) {
        return 'Премиум';
    }
    
    // Стандарт
    if (metrics?.warranty > 0 || n.includes('standard') || n.includes('mix') || (metrics?.dropRate && metrics.dropRate <= 15)) {
        return 'Стандарт';
    }
    
    // Эконом (default)
    return 'Эконом';
}

// Генерация честного описания на русском
function buildDescription(tier: string, metrics: any): string {
    const lines = [];
    
    if (tier === 'Эконом') lines.push('🤖 Аудитория: Боты со всего мира. Низкое качество.');
    else if (tier === 'Стандарт') lines.push('👥 Аудитория: Смешанная (офферы/боты). Среднее качество.');
    else if (tier === 'Премиум') lines.push('💎 Аудитория: Качественные аккаунты. Высокое качество.');
    else if (tier === 'Живые') lines.push('👤 Аудитория: Живые люди. Безопасно для канала.');

    if (metrics?.geo && metrics.geo !== 'ALL') {
        lines.push(`🌍 Гео: ${metrics.geo}`);
    }

    if (metrics?.warranty > 0) {
        lines.push(`🛡 Гарантия: ${metrics.warranty} дней (Refill)`);
    } else {
        lines.push(`🛡 Гарантия: Нет (возможны отписки)`);
    }

    if (metrics?.velocity > 0) {
        lines.push(`⚡ Скорость: до ${metrics.velocity} в сутки`);
    }

    return lines.join('\n');
}

async function main() {
    const providerId = process.argv[2];
    if (!providerId) {
        console.error('Usage: tsx scripts/auto-curate-provider.ts <PROVIDER_ID>');
        process.exit(1);
    }

    const provider = await prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new Error('Provider not found');

    const cacheKey = `provider:${providerId}:shadow_catalog`;
    const cachedStr = await redis.get(cacheKey);
    
    if (!cachedStr) {
        console.error('No shadow catalog found in Redis. Run sync first.');
        process.exit(1);
    }

    const services = JSON.parse(cachedStr);
    console.log(`Found ${services.length} services in shadow catalog.`);


    const categorized = new Map<string, any[]>();

    for (const raw of services) {
        const desc = raw.desc || raw.description || '';
        // Мы используем SmartAnalyzerLogic для парсинга названия
        const analyzed = SmartAnalyzerLogic.detectSync(raw.name, desc, raw.category || '');
        
        if (analyzed.platform === 'OTHER' || analyzed.category === 'OTHER') continue;

        const tier = determineTier(raw.name, analyzed.metrics);
        const key = `${analyzed.platform}_${analyzed.category}_${tier}`;
        
        if (!categorized.has(key)) {
            categorized.set(key, []);
        }
        
        categorized.get(key)!.push({
            ...raw,
            analyzed,
            tier
        });
    }

    // 2. Select the best (cheapest) for each tier and prepare to import
    const candidates = [];
    for (const [key, list] of categorized.entries()) {
        // Sort by rate (cheapest first)
        list.sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
        
        const best = list[0]; // Берем самую дешевую из данной категории и тира
        
        const categoryLabels: Record<string, string> = {
            SUBSCRIBERS: 'Подписчики',
            VIEWS: 'Просмотры',
            LIKES: 'Лайки',
            REACTIONS: 'Реакции',
            COMMENTS: 'Комментарии',
            REPOSTS: 'Репосты'
        };

        const categoryName = categoryLabels[best.analyzed.category] || best.analyzed.category;
        const finalName = `${categoryName} (${best.tier})`;
        const finalDescription = buildDescription(best.tier, best.analyzed.metrics);

        candidates.push({
            name: finalName,
            description: finalDescription,
            platform: best.analyzed.platform,
            category: best.analyzed.category,
            externalId: String(best.service),
            providerRate: parseFloat(best.rate),
            minQuantity: parseInt(best.min) || 10,
            maxQuantity: parseInt(best.max) || 1000,
        });
    }

    console.log(`Curated ${candidates.length} best candidate services.`);
    
    // Optional: Print a few for preview
    for (let i = 0; i < Math.min(5, candidates.length); i++) {
        console.log(`\n--- ${candidates[i].name} ---`);
        console.log(`External ID: ${candidates[i].externalId} | Price: ${candidates[i].providerRate}`);
        console.log(candidates[i].description);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
