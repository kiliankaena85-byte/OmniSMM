/**
 * IMPORT CURATED CATALOG
 * ======================
 * Удаляет ВСЕ старые услуги и категории.
 * Импортирует только курированные 1,049 услуг.
 * Создаёт недостающие Networks и Categories автоматически.
 */

import * as fs from 'fs';
import { db } from '../src/lib/db';

interface CuratedService {
  rank: number;
  platform: string;
  category: string;
  tier: string;
  providerName: string;
  extId: string;
  name: string;
  priceRUB_per1000: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  qualityScore: number;
  reason: string;
}

// Platform → slug mapping
const PLATFORM_SLUGS: Record<string, string> = {
  'TELEGRAM': 'telegram', 'VK': 'vk', 'INSTAGRAM': 'instagram',
  'YOUTUBE': 'youtube', 'TIKTOK': 'tiktok', 'TWITTER': 'twitter',
  'TWITCH': 'twitch', 'KICK': 'kick', 'FACEBOOK': 'facebook',
  'OK': 'ok', 'RUTUBE': 'rutube', 'DISCORD': 'discord',
  'SPOTIFY': 'spotify', 'YANDEX': 'yandex', 'MAX': 'max',
  'STEAM': 'steam', 'WEBSITE': 'website', 'WHATSAPP': 'whatsapp',
  'LIKEE': 'likee', 'TROVO': 'trovo', 'OTHER': 'other',
  'DZEN': 'dzen', 'THREADS': 'threads', 'PINTEREST': 'pinterest',
  'LINKEDIN': 'linkedin', 'REDDIT': 'reddit', 'TUMBLR': 'tumblr',
  'MEDIUM': 'medium', 'QUORA': 'quora', 'RUMBLE': 'rumble',
  'GOOGLE': 'google', 'SOUNDCLOUD': 'soundcloud', 'SHAZAM': 'shazam',
  'MUSIC': 'music', 'AUDIOMACK': 'audiomack',
};

// Sort order for platforms
const PLATFORM_SORT: Record<string, number> = {
  'TELEGRAM': 1, 'VK': 2, 'INSTAGRAM': 3, 'YOUTUBE': 4, 'TIKTOK': 5,
  'TWITCH': 6, 'KICK': 7, 'TWITTER': 8, 'FACEBOOK': 9, 'OK': 10,
  'RUTUBE': 11, 'MAX': 12, 'DISCORD': 13, 'SPOTIFY': 14, 'DZEN': 15,
  'YANDEX': 16, 'STEAM': 17, 'WEBSITE': 18, 'WHATSAPP': 19, 'LIKEE': 20,
  'TROVO': 21, 'LINKEDIN': 22, 'PINTEREST': 23, 'THREADS': 24,
  'REDDIT': 25, 'TUMBLR': 26, 'SOUNDCLOUD': 27, 'MEDIUM': 28,
  'QUORA': 29, 'RUMBLE': 30, 'GOOGLE': 31, 'MUSIC': 32,
  'SHAZAM': 33, 'AUDIOMACK': 34, 'OTHER': 99,
};

async function main() {
  console.log('=== Импорт курированного каталога ===\n');
  
  // 1. Load curated data
  const curated: CuratedService[] = JSON.parse(
    fs.readFileSync('scripts/curated-catalog.json', 'utf-8')
  );
  console.log(`Загружено ${curated.length} курированных услуг\n`);
  
  // 2. Check for existing orders
  const orderCount = await db.order.count();
  if (orderCount > 0) {
    console.log(`⚠️  В базе ${orderCount} заказов. Услуги с заказами будут деактивированы, не удалены.`);
  }
  
  // 3. Load or create providers
  const providers = await db.provider.findMany();
  const providerMap = new Map<string, string>();
  for (const p of providers) {
    providerMap.set(p.name, p.id);
  }
  
  const uniqueProviders = new Set(curated.map(s => s.providerName));
  for (const provName of uniqueProviders) {
    if (!providerMap.has(provName)) {
      const created = await db.provider.create({
        data: {
          name: provName,
          apiUrl: `https://api.${provName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/v2`,
          apiKey: 'test-api-key',
          balanceCurrency: 'USD',
          isActive: true
        }
      });
      providerMap.set(provName, created.id);
      console.log(`  ✅ Создан провайдер: ${provName}`);
    }
  }
  console.log(`Провайдеров готово: ${providerMap.size}`);
  
  // 4. Deactivate ALL existing services
  console.log('\n--- Шаг 1: Деактивация старых услуг ---');
  const deactivated = await db.service.updateMany({
    where: {},
    data: { isActive: false }
  });
  console.log(`  Деактивировано: ${deactivated.count} услуг`);
  
  // 5. Ensure all Networks exist
  console.log('\n--- Шаг 2: Создание недостающих сетей ---');
  const existingNetworks = await db.network.findMany();
  const networkMap = new Map<string, string>();
  for (const n of existingNetworks) {
    networkMap.set(n.name.toUpperCase(), n.id);
    networkMap.set(n.slug.toLowerCase(), n.id);
  }
  
  const neededPlatforms = new Set(curated.map(s => s.platform));
  for (const platform of neededPlatforms) {
    const slug = PLATFORM_SLUGS[platform] || platform.toLowerCase();
    const platformKey = platform.toUpperCase();
    let networkId = networkMap.get(platformKey) || networkMap.get(slug);
    
    if (!networkId) {
      const sort = PLATFORM_SORT[platform] || 50;
      const network = await db.network.create({
        data: { name: platform, slug, sort, isActive: true }
      });
      // eslint-disable-next-line no-useless-assignment
      networkId = network.id;
      networkMap.set(platformKey, network.id);
      networkMap.set(slug, network.id);
      console.log(`  ✅ Создана сеть: ${platform} (${slug})`);
    }
  }
  console.log(`  Всего сетей: ${networkMap.size}`);
  
  // 6. Create Categories (platform + category combo)
  console.log('\n--- Шаг 3: Создание категорий ---');
  
  // First, get existing categories
  const existingCategories = await db.category.findMany({
    include: { network: true }
  });
  const categoryMap = new Map<string, string>(); // "NETWORK_ID::CATEGORY" -> id
  for (const c of existingCategories) {
    const key = `${c.networkId}::${c.name}`;
    categoryMap.set(key, c.id);
  }
  
  // Determine needed categories
  const neededCategories = new Set(curated.map(s => `${s.platform}::${s.category}`));
  let catCreated = 0;
  
  // Sort categories within each platform
  const CATEGORY_SORT: Record<string, number> = {
    '👨‍👩‍👧‍👦 Подписчики / Участники': 1,
    '❤️ Лайки / Нравится': 2,
    '👁 Просмотры / Охват': 3,
    '💬 Комментарии / Отзывы': 4,
    '📢 Репосты / Поделиться': 5,
    '🎭 Реакции / Эмодзи': 6,
    '📌 Сохранения / Saves': 7,
    '📱 Сториз / Истории': 8,
    '🔴 Стримы': 9,
    '🚀 Бусты (Telegram Levels)': 10,
    '💎 Premium Подписчики': 11,
    '🤖 Роботы / Боты': 12,
    '🎵 Прослушивания (Music)': 13,
    '👥 Вступление в группы / чаты': 14,
    '🤝 Заявки в друзья': 15,
    '📊 Голоса / Опросы': 16,
    '👎 Дизлайки': 17,
    '⭐ Звезды (Telegram Stars)': 18,
    '🔗 Рефералы (Apps/Bots)': 19,
    '🚫 Жалобы / Reports': 20,
    '🌐 Трафик / Посещения': 21,
    '📦 Другое / Разное': 99,
  };
  
  for (const key of neededCategories) {
    const [platform, categoryName] = key.split('::');
    const slug = PLATFORM_SLUGS[platform] || platform.toLowerCase();
    const networkId = networkMap.get(platform.toUpperCase()) || networkMap.get(slug);
    
    if (!networkId) {
      console.error(`  ❌ Сеть не найдена: ${platform}`);
      continue;
    }
    
    const mapKey = `${networkId}::${categoryName}`;
    if (!categoryMap.has(mapKey)) {
      const sort = CATEGORY_SORT[categoryName] || 50;
      const cat = await db.category.create({
        data: { name: categoryName, networkId, sort }
      });
      categoryMap.set(mapKey, cat.id);
      catCreated++;
    }
  }
  console.log(`  Создано ${catCreated} новых категорий (всего в базе: ${categoryMap.size})`);
  
  // 7. Import curated services
  console.log('\n--- Шаг 4: Импорт услуг ---');
  
  let imported = 0;
  let reactivated = 0;
  let errors = 0;
  
  // Rate in curated is RUB/1000, Service.rate is provider rate USD/1000
  // We store the original provider rate, not our sell price
  
  for (const cs of curated) {
    try {
      const slug = PLATFORM_SLUGS[cs.platform] || cs.platform.toLowerCase();
      const networkId = networkMap.get(cs.platform.toUpperCase()) || networkMap.get(slug);
      
      if (!networkId) {
        console.error(`  ❌ Сеть не найдена для услуги: ${cs.platform}`);
        errors++;
        continue;
      }
      
      const categoryKey = `${networkId}::${cs.category}`;
      const categoryId = categoryMap.get(categoryKey);
      const providerId = providerMap.get(cs.providerName);
      
      if (!categoryId) {
        console.error(`  ❌ Категория не найдена: ${cs.category} для сети ${cs.platform}`);
        errors++;
        continue;
      }
      if (!providerId) {
        console.error(`  ❌ Провайдер не найден: ${cs.providerName}`);
        errors++;
        continue;
      }
      
      // Check if service already exists (same provider + externalId)
      const existing = await db.service.findFirst({
        where: { externalId: cs.extId, providerId }
      });
      
      // Provider rate in USD/1000 (convert from RUB if needed)
      const rateUSD = cs.priceRUB_per1000 / 83; // approximate
      
      if (existing) {
        // Reactivate with updated data
        await db.service.update({
          where: { id: existing.id },
          data: {
            name: cs.name,
            categoryId,
            rate: rateUSD,
            minQty: cs.min,
            maxQty: Math.min(cs.max, 10000000),
            isRefillEnabled: cs.refill,
            isCancelEnabled: cs.cancel,
            isDripFeedEnabled: cs.drip,
            isActive: true,
            isQuarantined: false,
            lastSeenAt: new Date(),
          }
        });
        reactivated++;
      } else {
        // Create new service
        await db.service.create({
          data: {
            name: cs.name,
            categoryId,
            providerId,
            externalId: cs.extId,
            rate: rateUSD,
            markup: 3.0, // Default 300% markup
            minQty: cs.min,
            maxQty: Math.min(cs.max, 10000000),
            isRefillEnabled: cs.refill,
            isCancelEnabled: cs.cancel,
            isDripFeedEnabled: cs.drip,
            isActive: true,
            lastSeenAt: new Date(),
          }
        });
        imported++;
      }
    } catch (err: any) {
      console.error(`  ❌ Ошибка: ${cs.name.substring(0, 50)} — ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n✅ Импорт завершён!`);
  console.log(`  Новых: ${imported}`);
  console.log(`  Реактивировано: ${reactivated}`);
  console.log(`  Ошибок: ${errors}`);
  
  // 8. Stats
  const totalActive = await db.service.count({ where: { isActive: true } });
  const totalInactive = await db.service.count({ where: { isActive: false } });
  const totalCategories = await db.category.count();
  const totalNetworks = await db.network.count();
  
  console.log(`\n📊 Итого в базе:`);
  console.log(`  Сетей: ${totalNetworks}`);
  console.log(`  Категорий: ${totalCategories}`);
  console.log(`  Активных услуг: ${totalActive}`);
  console.log(`  Деактивированных: ${totalInactive}`);
}

main().catch(console.error).finally(() => process.exit(0));
