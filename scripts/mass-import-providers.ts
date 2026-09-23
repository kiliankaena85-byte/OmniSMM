import { PrismaClient } from '@prisma/client';
import { redis } from '../src/lib/redis';
import { SmartAnalyzerLogic, CATEGORY_LABELS } from '../src/services/providers/smart-analyzer.logic';

const prisma = new PrismaClient();

const PLATFORM_LABELS: Record<string, string> = {
    TELEGRAM: 'Telegram',
    INSTAGRAM: 'Instagram',
    TIKTOK: 'TikTok',
    YOUTUBE: 'YouTube',
    VK: 'ВКонтакте',
    TWITCH: 'Twitch',
    DISCORD: 'Discord',
    TWITTER: 'Twitter (X)',
    FACEBOOK: 'Facebook',
    THREADS: 'Threads',
    REDDIT: 'Reddit',
    RUTUBE: 'Rutube',
    DZEN: 'Дзен',
    MUSIC: 'Музыка (Spotify/Apple)',
    OK: 'Одноклассники',
    KICK: 'Kick',
    LIKEE: 'Likee',
    WHATSAPP: 'WhatsApp',
    SPOTIFY: 'Spotify',
    SOUNDCLOUD: 'SoundCloud',
    LINKEDIN: 'LinkedIn',
    PINTEREST: 'Pinterest',
    SNAPCHAT: 'Snapchat',
    TROVO: 'Trovo',
    KWAI: 'Kwai',
    MAX: 'Max Messenger',
    GOOGLE: 'Google',
    APPLE: 'Apple Music/Podcast',
    YANDEX: 'Яндекс (Дзен/Maps/Music)',
    STEAM: 'Steam',
    RUMBLE: 'Rumble',
    TUMBLR: 'Tumblr',
    VIMEO: 'Vimeo',
    SHAZAM: 'Shazam',
    QUORA: 'Quora',
    MEDIUM: 'Medium',
    WEBSITE: 'Website Traffic',
    PERISCOPE: 'Periscope',
    CLOUDHUB: 'CloudHub',
    AUDIOMACK: 'Audiomack',
    DATPIFF: 'DatPiff',
    OTHER: 'Другое',
};

// Определение уровня (Tier) на основе спарсенных метрик
function determineTier(serviceName: string, metrics: any): string {
    const n = serviceName.toLowerCase();
    if (n.includes('real') || n.includes('organic') || n.includes('task') || n.includes('ads') || n.includes('живые')) {
        return 'Живые';
    }
    if (metrics?.warranty > 15 || n.includes('premium') || n.includes('hq') || n.includes('no drop') || (metrics?.dropRate && metrics.dropRate < 5)) {
        return 'Премиум';
    }
    if (metrics?.warranty > 0 || n.includes('standard') || n.includes('mix') || (metrics?.dropRate && metrics.dropRate <= 15)) {
        return 'Стандарт';
    }
    return 'Эконом';
}

async function main() {
    console.log("Fetching providers from DB...");
    const providers = await prisma.provider.findMany({ where: { isActive: true } });
    
    const allServices: any[] = [];

    console.log("Wiping existing imported services to resolve duplication...");
    await prisma.service.deleteMany({
        where: {
            orders: { none: {} },
            routes: { none: {} }
        }
    });
    
    // 1. Сбор всех услуг со всех теневых каталогов
    for (const provider of providers) {
        const cacheKey = `provider:${provider.id}:shadow_catalog`;
        const cachedStr = await redis.get(cacheKey);
        if (!cachedStr) {
            console.log(`No shadow catalog for provider ${provider.name}. Skipping...`);
            continue;
        }
        
        try {
            const services = JSON.parse(cachedStr);
            console.log(`Loaded ${services.length} services from ${provider.name}`);
            
            for (const s of services) {
                allServices.push({
                    ...s,
                    _providerId: provider.id,
                    _providerName: provider.name
                });
            }
        } catch (e) {
            console.error(`Failed to parse catalog for ${provider.name}`);
        }
    }

    console.log(`\nTotal pooled services: ${allServices.length}`);

    // 2. Анализ и группировка
    const categorized = new Map<string, any[]>();

    for (const raw of allServices) {
        const rawRate = parseFloat(raw.rate);
        if (isNaN(rawRate) || rawRate <= 0) {
            continue;
        }

        const desc = raw.desc || raw.description || '';
        const analyzed = SmartAnalyzerLogic.detectSync(raw.name, desc, raw.category || '');
        if (analyzed.platform === 'OTHER' || analyzed.category === 'OTHER') continue;

        const tier = determineTier(raw.name, analyzed.metrics);
        // Группируем по платформе и категории
        const groupKey = `${analyzed.platform}:::${analyzed.category}`;
        
        if (!categorized.has(groupKey)) {
            categorized.set(groupKey, []);
        }
        
        categorized.get(groupKey)!.push({
            raw,
            analyzed,
            tier
        });
    }

    // 3. Выбор лучших услуг и создание Networks/Categories
    const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
    const exchangeRate = settings?.exchangeRateUSD || 90.0;
    const globalMarkup = settings?.globalMarkup || 3.0;

    let addedCount = 0;

    for (const [groupKey, list] of categorized.entries()) {
        const [platformEnum, categoryEnum] = groupKey.split(':::');
        
        // В каждой категории (например, Telegram -> Подписчики) 
        // нам нужно выбрать лучшие (самые дешевые) услуги по каждому тиру, 
        // плюс несколько специфических, но не более 10 услуг.
        
        const tiers = ['Эконом', 'Стандарт', 'Премиум', 'Живые'];
        const selectedServices: any[] = [];
        const seenCombinations = new Set<string>();

        for (const tier of tiers) {
            const tierList = list.filter(item => item.tier === tier);
            if (tierList.length === 0) continue;

            tierList.sort((a, b) => parseFloat(a.raw.rate) - parseFloat(b.raw.rate));
            
            // Берем только САМЫЕ дешевые уникальные ГЕО
            for (const cand of tierList) {
                const comboKey = `${tier}-${cand.analyzed.geo}`;
                if (!seenCombinations.has(comboKey) && selectedServices.length < 10) {
                    seenCombinations.add(comboKey);
                    selectedServices.push(cand);
                }
            }
        }

        // Если все еще меньше 10, можем добавить еще интересных услуг (например с особым geo)
        let idx = 0;
        while (selectedServices.length < 10 && idx < list.length) {
            list.sort((a, b) => parseFloat(a.raw.rate) - parseFloat(b.raw.rate));
            const cand = list[idx];
            if (!selectedServices.includes(cand)) {
                selectedServices.push(cand);
            }
            idx++;
        }

        if (selectedServices.length === 0) continue;

        // Создаем или находим Network
        const networkName = PLATFORM_LABELS[platformEnum] || platformEnum;
        let network = await prisma.network.findUnique({ where: { name: networkName } });
        if (!network) {
            network = await prisma.network.create({
                data: {
                    name: networkName,
                    slug: platformEnum.toLowerCase()
                }
            });
            console.log(`Created Network: ${networkName}`);
        }

        // Создаем или находим Category
        const categoryLabel = CATEGORY_LABELS[categoryEnum] || categoryEnum;
        const catName = `${networkName} ${categoryLabel}`;
        let categoryRecord = await prisma.category.findFirst({
            where: { networkId: network.id, name: catName }
        });

        if (!categoryRecord) {
            categoryRecord = await prisma.category.create({
                data: {
                    name: catName,
                    slug: `${network.slug}-${categoryEnum.toLowerCase()}`,
                    networkId: network.id
                }
            });
            console.log(`Created Category: ${catName}`);
        }

        // Вставляем услуги в базу
        for (const item of selectedServices) {
            const rawRate = parseFloat(item.raw.rate);
            const priceInCents = Math.round(rawRate * globalMarkup * exchangeRate * 100); // rate is per 1000
            
            if (priceInCents > 2000000000 || isNaN(priceInCents)) {
                console.log(`Anomaly skipped: ${item.raw.name} (${priceInCents} cents)`);
                continue;
            }

            // Проверяем, нет ли уже такой услуги (по externalId и providerId)
            const existing = await prisma.service.findFirst({
                where: {
                    providerId: item.raw._providerId,
                    externalId: String(item.raw.service || item.raw.id)
                }
            });

            if (!existing) {
                await prisma.service.create({
                    data: {
                        name: item.analyzed.suggestedName || item.raw.name,
                        description: item.analyzed.description_ru,
                        features: JSON.parse(JSON.stringify({ 
                            tier: item.tier, 
                            geo: item.analyzed.geo, 
                            warranty: item.analyzed.warranty,
                            originalName: item.raw.name
                        })),
                        categoryId: categoryRecord.id,
                        providerId: item.raw._providerId,
                        rate: rawRate,
                        providerCurrency: 'USD',
                        markup: globalMarkup,
                        minQty: parseInt(item.raw.min) || 10,
                        maxQty: parseInt(item.raw.max) || 10000,
                        externalId: String(item.raw.service || item.raw.id),
                        targetType: item.analyzed.targetType,
                        customDataType: item.analyzed.customDataType,
                        isMediaGroupAware: item.analyzed.isMediaGroupAware,
                        pricePer1000Cents: priceInCents,
                        isActive: true
                    }
                });
                addedCount++;
            }
        }
    }

    console.log(`\nImport complete! Added ${addedCount} new highly curated services to the catalog.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
