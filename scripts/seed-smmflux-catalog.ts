import { PrismaClient } from '@prisma/client';
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

interface CuratedItem {
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
  serviceType?: string;
  extraParams?: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 45)
    .replace(/^-|-$/g, '');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n🚀 [SMMFLUX CATALOG SEEDER] Режим: ${isDryRun ? '🔍 DRY RUN (без записи)' : '💾 PRODUCTION INSERT (боевая запись)'}\n`);

  // 1. Проверяем наличие тенанта flux
  let fluxTenant = await prisma.tenant.findUnique({
    where: { slug: 'flux' }
  });

  if (!fluxTenant) {
    fluxTenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: 'flux' }, { id: 'flux' }] }
    });
  }

  if (!fluxTenant) {
    console.error('❌ Ошибка: Тенант flux не найден в таблице Tenant!');
    process.exit(1);
  }
  console.log(`✅ Тенант подтвержден: ${fluxTenant.name} (id: ${fluxTenant.id}, slug: ${fluxTenant.slug}, domain: ${fluxTenant.domain})`);

  // 2. Читаем curated 400
  const catalogPath = path.resolve(process.cwd(), 'docs/CURATED_SERVICES_400.json');
  if (!fs.existsSync(catalogPath)) {
    console.error(`❌ Файл ${catalogPath} не найден!`);
    process.exit(1);
  }
  const items: CuratedItem[] = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  console.log(`📋 Загружено ${items.length} услуг из ${catalogPath}`);

  // 3. Получаем доступных провайдеров
  const providers = await prisma.provider.findMany();
  const providerByName = new Map<string, typeof providers[0]>();
  const providerById = new Map<string, typeof providers[0]>();
  providers.forEach(p => {
    providerByName.set(p.name.toLowerCase().trim(), p);
    providerById.set(p.id, p);
  });
  console.log(`📡 Найдено провайдеров в БД: ${providers.length} (${providers.map(p => p.name).join(', ')})`);

  // 4. Получаем доступные соцсети
  const networks = await prisma.network.findMany();
  const networkByName = new Map<string, typeof networks[0]>();
  const networkBySlug = new Map<string, typeof networks[0]>();
  networks.forEach(n => {
    networkByName.set(n.name.toLowerCase().trim(), n);
    networkBySlug.set(n.slug.toLowerCase().trim(), n);
  });

  // Маппинг названия сети в сущность Network
  function findNetwork(networkName: string) {
    const lower = networkName.toLowerCase().trim();
    if (networkByName.has(lower)) return networkByName.get(lower)!;
    if (lower.includes('telegram')) return networkBySlug.get('telegram')!;
    if (lower.includes('вконтакте') || lower.includes('vk')) return networkBySlug.get('vk')!;
    if (lower.includes('youtube')) return networkBySlug.get('youtube')!;
    if (lower.includes('instagram')) return networkBySlug.get('instagram')!;
    if (lower.includes('tiktok')) return networkBySlug.get('tiktok')!;
    if (lower.includes('twitch') || lower.includes('стрим')) return networkBySlug.get('twitch')!;
    if (lower.includes('rutube')) return networkBySlug.get('rutube')!;
    if (lower.includes('twitter')) return networkBySlug.get('twitter')!;
    return networkBySlug.get('facebook') || networks[0];
  }

  // 5. Обработка и создание категорий для SMMflux
  // Собираем уникальные пары: (network, category)
  const categoryPairs = new Map<string, { network: string; categoryName: string }>();
  for (const item of items) {
    const key = `${item.network}:::${item.category}`;
    if (!categoryPairs.has(key)) {
      categoryPairs.set(key, { network: item.network, categoryName: item.category });
    }
  }
  console.log(`📁 Уникальных категорий для SMMflux: ${categoryPairs.size}`);

  const categoryDbMap = new Map<string, string>(); // key -> categoryId

  for (const [key, { network, categoryName }] of categoryPairs) {
    const netObj = findNetwork(network);
    const categorySlug = `flux-${slugify(netObj.slug)}-${slugify(categoryName)}`.slice(0, 50);

    // Ищем существующую категорию для flux
    let catId: string | null = null;
    const existingCat = await prisma.category.findFirst({
      where: {
        tenantId: 'flux',
        name: categoryName,
        networkId: netObj.id
      }
    });

    if (existingCat) {
      catId = existingCat.id;
    } else {
      // Проверяем, не занят ли slug кем-то другим
      const slugExists = await prisma.category.findUnique({
        where: { slug: categorySlug }
      });
      const finalSlug = slugExists ? `${categorySlug}-${Date.now().toString(36)}`.slice(0, 60) : categorySlug;

      if (!isDryRun) {
        const createdCat = await prisma.category.create({
          data: {
            name: categoryName,
            slug: finalSlug,
            networkId: netObj.id,
            tenantId: 'flux',
            sort: 10,
            requireWarning: false
          }
        });
        catId = createdCat.id;
      } else {
        catId = `mock-cat-${categorySlug}`;
      }
    }

    if (catId) {
      categoryDbMap.set(key, catId);
    }
  }

  console.log(`✅ Создано / проверено категорий: ${categoryDbMap.size}`);

  // 6. Добавление или обновление 400 услуг в SMMflux
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const catKey = `${item.network}:::${item.category}`;
    const categoryId = categoryDbMap.get(catKey);

    if (!categoryId) {
      console.warn(`⚠️ Категория не найдена для ${catKey}, пропускаем услугу: ${item.name}`);
      skippedCount++;
      continue;
    }

    // Ищем провайдера
    let provider = providerById.get(item.providerId) || providerByName.get(item.providerName.toLowerCase().trim());
    if (!provider) {
      // Фоллбек на совпадение по подстроке
      provider = providers.find(p => p.name.toLowerCase().includes(item.providerName.toLowerCase().slice(0, 5)));
    }
    const providerId = provider ? provider.id : null;

    // Маппинг тарифа в qualityTier
    const qualityTierMap: Record<string, string> = {
      'Эконом': 'ECONOMY',
      'Стандарт': 'STANDARD',
      'Премиум': 'PREMIUM'
    };
    const qualityTier = qualityTierMap[item.tier] || 'STANDARD';

    // Формируем customDataType
    let customDataType = 'NONE';
    let customDataLabel: string | null = null;
    if (item.serviceType === 'Custom Comments') {
      customDataType = 'TEXTAREA';
      customDataLabel = 'Введите комментарии (каждый с новой строки)';
    } else if (item.serviceType === 'Poll') {
      customDataType = 'NUMBER';
      customDataLabel = 'Номер варианта ответа в опросе (например: 1)';
    }

    const priceCents = Math.round(item.recommendedPriceRub * 100);
    const markupMultiplier = item.costPer1kRub > 0 ? Number((item.recommendedPriceRub / item.costPer1kRub).toFixed(2)) : 2.5;
    const serviceSlug = `flux-${item.id}-${slugify(item.name)}`.slice(0, 60);

    if (!isDryRun) {
      // Ищем по externalId + providerId + tenantId или по slug
      const existing = await prisma.service.findFirst({
        where: {
          tenantId: 'flux',
          OR: [
            { slug: serviceSlug },
            {
              providerId: providerId,
              externalId: item.providerServiceId
            }
          ]
        }
      });

      if (existing) {
        await prisma.service.update({
          where: { id: existing.id },
          data: {
            name: item.name,
            categoryId,
            rate: item.costPer1kRub,
            costPer1kRub: item.costPer1kRub,
            pricePer1000Cents: priceCents,
            markup: markupMultiplier,
            minQty: item.minQty,
            maxQty: item.maxQty,
            qualityTier,
            targetType: item.targetType || 'POST',
            customDataType,
            customDataLabel,
            isRefillEnabled: item.refill,
            isActive: true,
            isQuarantined: false,
            sortOrder: i + 1,
            features: {
              warrantyDays: item.warrantyDays,
              hasRefill: item.refill,
              serviceType: item.serviceType || 'Default',
              tier: item.tier
            }
          }
        });
        updatedCount++;
      } else {
        await prisma.service.create({
          data: {
            name: item.name,
            slug: serviceSlug,
            categoryId,
            tenantId: 'flux',
            providerId,
            externalId: item.providerServiceId,
            rate: item.costPer1kRub,
            costPer1kRub: item.costPer1kRub,
            pricePer1000Cents: priceCents,
            markup: markupMultiplier,
            minQty: item.minQty,
            maxQty: item.maxQty,
            qualityTier,
            targetType: item.targetType || 'POST',
            customDataType,
            customDataLabel,
            isRefillEnabled: item.refill,
            isDripFeedEnabled: true,
            isActive: true,
            isQuarantined: false,
            sortOrder: i + 1,
            features: {
              warrantyDays: item.warrantyDays,
              hasRefill: item.refill,
              serviceType: item.serviceType || 'Default',
              tier: item.tier
            }
          }
        });
        insertedCount++;
      }
    } else {
      insertedCount++;
    }
  }

  console.log(`\n🎉 [РЕЗУЛЬТАТ СИНХРОНИЗАЦИИ SMMFLUX]:`);
  console.log(`   - Создано новых услуг: ${insertedCount}`);
  console.log(`   - Обновлено существующих услуг: ${updatedCount}`);
  console.log(`   - Пропущено: ${skippedCount}`);
  console.log(`   - Всего обработано: ${insertedCount + updatedCount}`);

  // 7. Проверка итогового количества услуг у SMMflux в БД
  if (!isDryRun) {
    const finalFluxCount = await prisma.service.count({
      where: { tenantId: 'flux' }
    });
    const finalCategoriesCount = await prisma.category.count({
      where: { tenantId: 'flux' }
    });
    console.log(`\n📊 ИТОГО В БАЗЕ ДАННЫХ ДЛЯ ТЕНАНТА SMMflux (flux):`);
    console.log(`   - Услуг: ${finalFluxCount}`);
    console.log(`   - Категорий: ${finalCategoriesCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
