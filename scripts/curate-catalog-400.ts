import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

export interface CuratedServiceItem {
  id: string;
  network: string;
  category: string;
  tier: 'Эконом' | 'Стандарт' | 'Премиум';
  name: string;
  providerName: string;
  providerId: string;
  providerServiceId: string;
  costPer1kRub: number;
  recommendedPriceRub: number;
  marginPercent: number;
  minQty: number;
  maxQty: number;
  refill: boolean;
  warrantyDays: number;
  targetType: string;
  serviceType?: string; // Default, Poll, Custom Comments, Subscriptions, Package, Live Stream
  extraParams?: string[];
}

// Определение тарифа
function inferTier(name: string, refill: boolean, warranty: number, rateRub: number): 'Эконом' | 'Стандарт' | 'Премиум' {
  const lower = name.toLowerCase();

  // Если это Telegram Premium подписчики
  if (
    (lower.includes('подписчик') || lower.includes('sub') || lower.includes('member')) &&
    (lower.includes('премиум') || lower.includes('premium'))
  ) {
    if (warranty >= 120 || rateRub >= 2800 || lower.includes('поиск') || lower.includes('180') || lower.includes('онлайн')) {
      return 'Премиум';
    }
    if (warranty >= 60 || rateRub >= 1800 || lower.includes('90') || lower.includes('60')) {
      return 'Стандарт';
    }
    return 'Эконом';
  }

  if (
    lower.includes('премиум') ||
    lower.includes('premium') ||
    lower.includes('hq') ||
    lower.includes('real') ||
    lower.includes('живые') ||
    lower.includes('vip') ||
    lower.includes('русские') ||
    lower.includes('рф') ||
    lower.includes('сша') ||
    lower.includes('буст') ||
    warranty >= 30
  ) {
    return 'Премиум';
  }

  if (
    lower.includes('эконом') ||
    lower.includes('economy') ||
    lower.includes('дешев') ||
    lower.includes('cheap') ||
    lower.includes('без гарантии') ||
    lower.includes('списания') ||
    lower.includes('slow') ||
    lower.includes('медлен') ||
    lower.includes('боты')
  ) {
    return 'Эконом';
  }

  return 'Стандарт';
}

// Расчет розничной цены с маржой 55-85%
function calcRetailPrice(costRub: number, tier: 'Эконом' | 'Стандарт' | 'Премиум'): number {
  let multiplier = 2.5; // Стандарт ~60% маржи
  if (tier === 'Эконом') multiplier = 2.2;
  if (tier === 'Премиум') multiplier = 3.2;

  // Для дорогих услуг (Premium подписчики, бусты серверов > 1000 руб): наценка 1.8x - 2.2x
  if (costRub >= 1000) {
    multiplier = tier === 'Эконом' ? 1.7 : (tier === 'Стандарт' ? 1.9 : 2.2);
  }

  const raw = costRub * multiplier;
  if (raw < 1) return Number(Math.max(0.15, raw).toFixed(2));
  if (raw < 10) return Number(raw.toFixed(1));
  if (raw < 100) return Math.ceil(raw);
  return Math.ceil(raw / 5) * 5;
}

// Очистка и нормализация названия услуги (сохраняя эмодзи для реакций!)
function cleanServiceName(rawName: string, tier: 'Эконом' | 'Стандарт' | 'Премиум', network: string, category: string, isReaction: boolean): string {
  let clean = rawName
    .replace(/^\[.*?\]\s*/g, '')
    .replace(/^\d+\.\s*/g, '')
    .replace(/\|\s*stream-promotion\.ru/gi, '')
    .replace(/vexboost\.ru/gi, '')
    .replace(/smmpanelus\.com/gi, '')
    .replace(/soc-rocket\.ru/gi, '')
    .replace(/prosmm-shop\.com/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Удаляем эмодзи только если это НЕ реакция
  if (!isReaction) {
    clean = clean.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
  }

  // Удаляем дублирующиеся названия соцсетей в начале
  const netPrefix = new RegExp(`^(${network}|tg|vk|yt|ig|tt|вк|ютуб|инста|телеграм)\\s*[-:|]?\\s*`, 'i');
  clean = clean.replace(netPrefix, '').trim();

  if (clean.length < 4) {
    clean = `${category} — ${tier}`;
  }

  if (clean.length > 75) {
    clean = clean.slice(0, 72) + '...';
  }

  return `${clean} [${tier}]`;
}

function resolveCategory(rawCategory: string, name: string, network: string): string {
  const lower = name.toLowerCase();

  if (network === 'Telegram' || network === 'telegram') {
    // 1. Сначала реакции!
    if (lower.includes('реакци') || lower.includes('reaction')) {
      return 'Реакции на посты';
    }
    // 2. Опросы и голосования
    if (lower.includes('опрос') || lower.includes('голосован') || lower.includes('poll') || lower.includes('vote')) {
      return 'Опросы и Голосования';
    }
    // 3. Бусты каналов
    if (lower.includes('буст') || lower.includes('boost')) {
      return 'Бусты каналов';
    }
    // 4. Подписчики (только реальные термины подписчиков, но НЕ subscription!)
    const isSubscriber = lower.includes('подписчик') || lower.includes('участник') || lower.includes('member') || lower.includes('subscriber') || lower.includes('follower');
    if (isSubscriber && (lower.includes('премиум') || lower.includes('premium'))) {
      return 'Подписчики (со звездой ⭐)';
    }
    if (isSubscriber) {
      return 'Подписчики (Обычные)';
    }
    // 5. Автопросмотры и подписки на будущие посты
    if (lower.includes('авто') || lower.includes('auto') || lower.includes('подписка на') || lower.includes('subscription')) {
      return 'Автопросмотры и Автореакции';
    }
    // 6. Просмотры постов
    if (lower.includes('просмотр') || lower.includes('view')) {
      return 'Просмотры постов';
    }
  }

  return rawCategory || 'Услуги';
}

// Определение типа услуги и требуемых полей
function inferServiceType(name: string, category: string, targetType: string): { serviceType: string; extraParams: string[] } {
  const n = name.toLowerCase();
  const c = category.toLowerCase();

  if (n.includes('лайки на комментари') || n.includes('лайки комментариев')) {
    return { serviceType: 'Comment Likes', extraParams: ['username'] };
  }
  if (n.includes('авто') || n.includes('auto') || n.includes('подписка на') || n.includes('будущие посты') || targetType === 'CHANNEL_POSTS') {
    return { serviceType: 'Subscriptions', extraParams: ['posts', 'min', 'max', 'delay'] };
  }
  if (n.includes('опрос') || n.includes('голосован') || n.includes('poll') || n.includes('vote')) {
    return { serviceType: 'Poll', extraParams: ['answer_number'] };
  }
  if (n.includes('коммент') || n.includes('comment')) {
    if (n.includes('свои') || n.includes('настраиваем') || n.includes('custom') || n.includes('собственные')) {
      return { serviceType: 'Custom Comments', extraParams: ['comments'] };
    }
    return { serviceType: 'Default', extraParams: [] };
  }
  if (n.includes('зрител') || n.includes('стрим') || n.includes('stream') || n.includes('live')) {
    return { serviceType: 'Live Stream', extraParams: ['duration_minutes'] };
  }
  if (n.includes('буст') || n.includes('boost')) {
    return { serviceType: 'Package', extraParams: ['duration_days'] };
  }

  return { serviceType: 'Default', extraParams: [] };
}

async function main() {
  console.log('🚀 Формирование сбалансированного каталога 400 лучших услуг (с реакциями и нестандартными услугами)...\n');

  // Квоты по платформам (ровно 400)
  const quotas: Record<string, { quota: number; title: string }> = {
    telegram: { quota: 92, title: 'Telegram' },
    vk: { quota: 68, title: 'ВКонтакте' },
    youtube: { quota: 60, title: 'YouTube' },
    instagram: { quota: 55, title: 'Instagram' },
    tiktok: { quota: 40, title: 'TikTok' },
    twitch: { quota: 30, title: 'Twitch & Стримы' },
    rutube: { quota: 25, title: 'Rutube' },
    twitter: { quota: 15, title: 'Twitter (X)' },
    other: { quota: 15, title: 'Другие (Facebook, Discord, Kick)' }
  };

  const curatedCatalog: CuratedServiceItem[] = [];

  for (const [platformKey, config] of Object.entries(quotas)) {
    const where: Prisma.ShadowServiceWhereInput = {
      rateRub: { gt: 0.05, lt: 10000 },
      provider: { isActive: true }
    };

    if (platformKey === 'other') {
      where.platform = { in: ['facebook', 'kick', 'dzen', 'discord', 'threads', 'other'] };
    } else {
      where.platform = { contains: platformKey, mode: 'insensitive' };
    }

    const allServices = await prisma.shadowService.findMany({
      where,
      include: { provider: true },
      orderBy: [{ rateRub: 'asc' }],
      take: 2500
    });

    console.log(`📡 Найдено в БД для ${config.title}: ${allServices.length} услуг`);

    // 1. Отбираем специализированные группы для платформы
    // а) Одиночные реакции
    const singleReactions = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return (
        (lower.includes('реакци') || lower.includes('reaction')) &&
        (lower.includes('👍') || lower.includes('❤️') || lower.includes('🔥') || lower.includes('👏') ||
         lower.includes('🎉') || lower.includes('🤩') || lower.includes('🚀') || lower.includes('⚡') ||
         lower.includes('👎') || lower.includes('💩') || lower.includes('🤡') || lower.includes('💎') ||
         lower.includes('like') || lower.includes('heart') || lower.includes('fire') || lower.includes('кастомные'))
      );
    });

    // б) Наборы реакций (миксы)
    const bundleReactions = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return (
        (lower.includes('реакци') || lower.includes('reaction')) &&
        (lower.includes('positive') || lower.includes('позитивн') || lower.includes('негативн') ||
         lower.includes('микс') || lower.includes('mix') || lower.includes('премиум реакции') ||
         lower.includes('premium'))
      );
    });

    // в) Опросы и голосования
    const polls = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return lower.includes('опрос') || lower.includes('голосован') || lower.includes('poll') || lower.includes('vote');
    });

    // г) Комментарии (в т.ч. настраиваемые)
    const comments = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return lower.includes('коммент') || lower.includes('comment');
    });

    // д) Стримы / Live
    const streams = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return lower.includes('стрим') || lower.includes('stream') || lower.includes('live') || lower.includes('зрител');
    });

    // е) Бусты (для TG, Discord)
    const boosts = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return lower.includes('буст') || lower.includes('boost');
    });

    // ж) Авто-услуги
    const autoServices = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      return lower.includes('авто') || lower.includes('auto') || lower.includes('подписка на') || s.targetType === 'CHANNEL_POSTS';
    });

    // з) Подписчики Telegram: обычные vs Premium
    const tgPremiumSubs = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      const cat = (s.category || '').toLowerCase();
      return (
        (lower.includes('подписчик') || lower.includes('sub') || lower.includes('member') || cat.includes('подписчик')) &&
        (lower.includes('премиум') || lower.includes('premium') || cat.includes('premium'))
      );
    });

    const tgRegularSubs = allServices.filter(s => {
      const lower = s.name.toLowerCase();
      const cat = (s.category || '').toLowerCase();
      return (
        (lower.includes('подписчик') || lower.includes('sub') || lower.includes('member') || cat.includes('подписчик')) &&
        !(lower.includes('премиум') || lower.includes('premium') || cat.includes('premium'))
      );
    });

    // Приоритетная корзина для гарантированного включения
    const priorityServices: typeof allServices = [];
    if (config.title === 'Telegram') {
      // 1. Обычные подписчики (боты, стандарт, живые)
      priorityServices.push(...tgRegularSubs.slice(0, 8));
      // 2. Telegram Premium подписчики (со звездой ⭐)
      priorityServices.push(...tgPremiumSubs.slice(0, 8));
      // 3. Одиночные реакции
      priorityServices.push(...singleReactions.slice(0, 10));
      // 4. Наборы реакций
      priorityServices.push(...bundleReactions.slice(0, 6));
      // 5. Опросы
      priorityServices.push(...polls.slice(0, 4));
      // 6. Комментарии
      priorityServices.push(...comments.slice(0, 4));
      // 7. Авто-услуги
      priorityServices.push(...autoServices.slice(0, 6));
      // 8. Бусты
      priorityServices.push(...boosts.slice(0, 4));
    } else if (config.title === 'ВКонтакте') {
      priorityServices.push(...singleReactions.slice(0, 4));
      priorityServices.push(...polls.slice(0, 4));
      priorityServices.push(...comments.slice(0, 6));
      priorityServices.push(...autoServices.slice(0, 4));
      priorityServices.push(...streams.slice(0, 3));
    } else if (config.title === 'YouTube') {
      priorityServices.push(...streams.slice(0, 8));
      priorityServices.push(...comments.slice(0, 8));
    } else if (config.title === 'Instagram') {
      priorityServices.push(...singleReactions.slice(0, 4));
      priorityServices.push(...autoServices.slice(0, 6));
      priorityServices.push(...comments.slice(0, 6));
      priorityServices.push(...streams.slice(0, 4));
    } else if (config.title === 'TikTok') {
      priorityServices.push(...streams.slice(0, 6));
      priorityServices.push(...comments.slice(0, 6));
    } else if (config.title === 'Twitch & Стримы') {
      priorityServices.push(...streams.slice(0, 14));
    }

    // Собираем общий пул для платформы: приоритетные + стандартные
    const combinedPool = [...priorityServices, ...allServices];

    // Группируем по тарифам
    const tierBuckets: Record<'Эконом' | 'Стандарт' | 'Премиум', typeof allServices> = {
      'Эконом': [],
      'Стандарт': [],
      'Премиум': []
    };

    for (const s of combinedPool) {
      const tier = inferTier(s.name, s.refill, s.warranty, s.rateRub);
      tierBuckets[tier].push(s);
    }

    const perTierQuota = Math.floor(config.quota / 3);
    const remainder = config.quota % 3;

    const tierQuotas: Record<'Эконом' | 'Стандарт' | 'Премиум', number> = {
      'Эконом': perTierQuota + (remainder > 0 ? 1 : 0),
      'Стандарт': perTierQuota + (remainder > 1 ? 1 : 0),
      'Премиум': perTierQuota
    };

    let platformAdded = 0;
    const seenNames = new Set<string>();

    for (const tier of ['Эконом', 'Стандарт', 'Премиум'] as const) {
      const targetCount = tierQuotas[tier];
      const available = tierBuckets[tier];

      // Сортировка: надежные провайдеры + сбалансированная цена
      available.sort((a, b) => {
        const aLatency = a.provider.avgResponseMs || 1000;
        const bLatency = b.provider.avgResponseMs || 1000;
        return (a.rateRub * 1.5 + aLatency * 0.01) - (b.rateRub * 1.5 + bLatency * 0.01);
      });

      let addedInTier = 0;

      // 1. Сначала гарантированно берем специализированные услуги этого тарифа
      const priorityInTier = priorityServices.filter(s => inferTier(s.name, s.refill, s.warranty, s.rateRub) === tier);
      for (const s of priorityInTier) {
        if (addedInTier >= targetCount || platformAdded >= config.quota) break;

        const simplified = s.name.toLowerCase().replace(/[^a-zа-я0-9]/g, '').slice(0, 28);
        if (seenNames.has(simplified)) continue;
        seenNames.add(simplified);

        const category = resolveCategory(s.category || s.normalizedCategory || 'Услуги', s.name, config.title);
        const isReaction = s.name.toLowerCase().includes('реакци') || s.name.toLowerCase().includes('reaction');
        const cleanName = cleanServiceName(s.name, tier, config.title, category, isReaction);
        const retailPrice = calcRetailPrice(s.rateRub, tier);
        const marginRub = Number((retailPrice - s.rateRub).toFixed(2));
        const marginPercent = Number(((marginRub / retailPrice) * 100).toFixed(1));
        const { serviceType, extraParams } = inferServiceType(s.name, category, s.targetType || 'POST');

        curatedCatalog.push({
          id: `curated-${curatedCatalog.length + 1}`,
          network: config.title,
          category,
          tier,
          name: cleanName,
          providerName: s.provider.name,
          providerId: s.providerId,
          providerServiceId: s.externalId,
          costPer1kRub: Number(s.rateRub.toFixed(2)),
          recommendedPriceRub: retailPrice,
          marginPercent,
          minQty: s.min,
          maxQty: s.max,
          refill: s.refill,
          warrantyDays: s.warranty,
          targetType: s.targetType || 'POST',
          serviceType,
          extraParams
        });

        addedInTier++;
        platformAdded++;
      }

      // 2. Затем добираем оставшуюся квоту из общего пула тарифа
      for (const s of available) {
        if (addedInTier >= targetCount || platformAdded >= config.quota) break;

        const simplified = s.name.toLowerCase().replace(/[^a-zа-я0-9]/g, '').slice(0, 28);
        if (seenNames.has(simplified)) continue;
        seenNames.add(simplified);

        const category = resolveCategory(s.category || s.normalizedCategory || 'Услуги', s.name, config.title);
        const isReaction = s.name.toLowerCase().includes('реакци') || s.name.toLowerCase().includes('reaction');
        const cleanName = cleanServiceName(s.name, tier, config.title, category, isReaction);
        const retailPrice = calcRetailPrice(s.rateRub, tier);
        const marginRub = Number((retailPrice - s.rateRub).toFixed(2));
        const marginPercent = Number(((marginRub / retailPrice) * 100).toFixed(1));
        const { serviceType, extraParams } = inferServiceType(s.name, category, s.targetType || 'POST');

        curatedCatalog.push({
          id: `curated-${curatedCatalog.length + 1}`,
          network: config.title,
          category,
          tier,
          name: cleanName,
          providerName: s.provider.name,
          providerId: s.providerId,
          providerServiceId: s.externalId,
          costPer1kRub: Number(s.rateRub.toFixed(2)),
          recommendedPriceRub: retailPrice,
          marginPercent,
          minQty: s.min,
          maxQty: s.max,
          refill: s.refill,
          warrantyDays: s.warranty,
          targetType: s.targetType || 'POST',
          serviceType,
          extraParams
        });

        addedInTier++;
        platformAdded++;
      }
    }

    // Если не дотянули до квоты, добираем из остатка
    if (platformAdded < config.quota) {
      for (const s of allServices) {
        if (platformAdded >= config.quota) break;
        const simplified = s.name.toLowerCase().replace(/[^a-zа-я0-9]/g, '').slice(0, 28);
        if (seenNames.has(simplified)) continue;
        seenNames.add(simplified);

        const tier = inferTier(s.name, s.refill, s.warranty, s.rateRub);
        const category = resolveCategory(s.category || s.normalizedCategory || 'Услуги', s.name, config.title);
        const isReaction = s.name.toLowerCase().includes('реакци') || s.name.toLowerCase().includes('reaction');
        const cleanName = cleanServiceName(s.name, tier, config.title, category, isReaction);
        const retailPrice = calcRetailPrice(s.rateRub, tier);
        const marginRub = Number((retailPrice - s.rateRub).toFixed(2));
        const marginPercent = Number(((marginRub / retailPrice) * 100).toFixed(1));
        const { serviceType, extraParams } = inferServiceType(s.name, category, s.targetType || 'POST');

        curatedCatalog.push({
          id: `curated-${curatedCatalog.length + 1}`,
          network: config.title,
          category,
          tier,
          name: cleanName,
          providerName: s.provider.name,
          providerId: s.providerId,
          providerServiceId: s.externalId,
          costPer1kRub: Number(s.rateRub.toFixed(2)),
          recommendedPriceRub: retailPrice,
          marginPercent,
          minQty: s.min,
          maxQty: s.max,
          refill: s.refill,
          warrantyDays: s.warranty,
          targetType: s.targetType || 'POST',
          serviceType,
          extraParams
        });

        platformAdded++;
      }
    }

    console.log(`  -> Отобрано для ${config.title}: ${platformAdded} услуг (Эконом: ${curatedCatalog.filter(c => c.network === config.title && c.tier === 'Эконом').length}, Стандарт: ${curatedCatalog.filter(c => c.network === config.title && c.tier === 'Стандарт').length}, Премиум: ${curatedCatalog.filter(c => c.network === config.title && c.tier === 'Премиум').length})`);
  }

  console.log(`\n🎉 ВСЕГО ОТОБРАНО УСЛУГ В КАТАЛОГ: ${curatedCatalog.length}`);

  // Сохраняем в JSON и Markdown
  const outputPathJson = path.resolve(process.cwd(), 'docs/CURATED_SERVICES_400.json');
  const outputPathMd = path.resolve(process.cwd(), 'docs/CURATED_SERVICES_400.md');

  fs.writeFileSync(outputPathJson, JSON.stringify(curatedCatalog, null, 2), 'utf-8');
  console.log(`💾 JSON каталог сохранен: ${outputPathJson}`);

  // Генерация подробного Markdown-каталога с типами услуг и параметрами
  let md = `# 📦 Каталог 400 Лучших Услуг для Бизнеса (SMMplan / SMMflux)
> **Сформирован:** 2026-09-29  
> **Всего услуг:** ${curatedCatalog.length}  
> **Структура тарифов:** Эконом, Стандарт, Премиум  
> **Специализированные категории:** Одиночные реакции (👍, ❤️, 🔥, 🚀, ⚡, 💩, 🤡, 👎, 💎), Наборы реакций (Позитив, Хайп, Негатив, TG Premium), Опросы/Голосования, Кастомные комментарии, Стримы, Бусты каналов  
> **Провайдеры:** Vexboost, Soc Rocket, SMM Panel US, Stream Promotion, SMM Prime, ProSMM Shop

---

## 📊 Сводка по категориям каталога
- **Одиночные реакции и наборы реакций:** ${curatedCatalog.filter(c => c.name.toLowerCase().includes('реакци')).length} услуг
- **Опросы и голосования:** ${curatedCatalog.filter(c => c.serviceType === 'Poll').length} услуг
- **Комментарии (Custom & Emoji):** ${curatedCatalog.filter(c => c.serviceType === 'Custom Comments' || c.name.toLowerCase().includes('коммент')).length} услуг
- **Прямые эфиры / Стримы:** ${curatedCatalog.filter(c => c.serviceType === 'Live Stream' || c.name.toLowerCase().includes('стрим') || c.name.toLowerCase().includes('stream')).length} услуг
- **Telegram & Discord Бусты:** ${curatedCatalog.filter(c => c.name.toLowerCase().includes('буст')).length} услуг
- **Авто-услуги по подписке:** ${curatedCatalog.filter(c => c.serviceType === 'Subscriptions').length} услуг
- **Подписчики, Просмотры, Лайки (Core):** ${curatedCatalog.filter(c => !c.name.toLowerCase().includes('реакци') && c.serviceType === 'Default').length} услуг

---

`;

  const networks = Array.from(new Set(curatedCatalog.map(c => c.network)));

  for (const net of networks) {
    const netItems = curatedCatalog.filter(c => c.network === net);
    md += `## 🌐 ${net} (${netItems.length} услуг)\n\n`;

    for (const tier of ['Эконом', 'Стандарт', 'Премиум'] as const) {
      const tierItems = netItems.filter(c => c.tier === tier);
      if (tierItems.length === 0) continue;

      md += `### Тариф: ${tier} (${tierItems.length} поз.)\n\n`;
      md += `| # | Наименование услуги | Тип | Провайдер (ID) | Закупка (₽/1k) | Розница (₽/1k) | Маржа (%) | Лимиты | Гарантия |\n`;
      md += `| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

      tierItems.forEach((item, idx) => {
        const warrantyStr = item.refill ? `Refill (${item.warrantyDays}д)` : (item.warrantyDays > 0 ? `${item.warrantyDays}д` : 'Нет');
        const typeBadge = item.serviceType !== 'Default' ? `\`${item.serviceType}\`` : 'Обычная';
        md += `| ${idx + 1} | **${item.name}** | ${typeBadge} | ${item.providerName} (\`${item.providerServiceId}\`) | ${item.costPer1kRub} ₽ | ${item.recommendedPriceRub} ₽ | **${item.marginPercent}%** | ${item.minQty} - ${item.maxQty} | ${warrantyStr} |\n`;
      });

      md += '\n';
    }

    md += '---\n\n';
  }

  fs.writeFileSync(outputPathMd, md, 'utf-8');
  console.log(`📄 Markdown каталог сохранен: ${outputPathMd}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
