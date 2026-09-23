import { db } from '../src/lib/db';
import { SettingsProvider } from '../src/lib/settings';
import { applyBeautifulRounding } from '../src/lib/financial-constants';
import * as fs from 'fs';
import * as path from 'path';

async function auditServices() {
  const targetNetworks = ['youtube', 'instagram', 'tiktok', 'likee'];
  const usdToRub = await SettingsProvider.getExchangeRateUSD();
  console.log(`Auditing catalog with USD/RUB rate: ${usdToRub}`);

  const networks = await db.network.findMany({
    where: {
      slug: { in: targetNetworks }
    },
    include: {
      categories: {
        include: {
          services: {
            include: {
              provider: true
            },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { sort: 'asc' }
      }
    },
    orderBy: { sort: 'asc' }
  });

  const allServices = await db.service.findMany({
    where: {
      category: {
        network: {
          slug: { in: targetNetworks }
        }
      }
    },
    include: {
      category: {
        include: {
          network: true
        }
      },
      provider: true
    },
    orderBy: [
      { category: { network: { sort: 'asc' } } },
      { category: { sort: 'asc' } },
      { sortOrder: 'asc' },
      { numericId: 'asc' }
    ]
  });

  console.log(`Found ${allServices.length} total services across ${networks.length} networks.`);

  const auditResults: any[] = [];
  const networkSummaries: Record<string, any> = {};

  for (const net of networks) {
    const netServices = allServices.filter(s => s.category?.network?.slug === net.slug);
    networkSummaries[net.slug] = {
      networkName: net.name,
      categoriesCount: net.categories.length,
      servicesCount: netServices.length,
      activeServicesCount: netServices.filter(s => s.isActive).length,
      categories: net.categories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        activityType: c.activityType,
        servicesCount: c.services.length
      }))
    };
  }

  for (const s of allServices) {
    const issues: string[] = [];
    const warnings: string[] = [];

    const netSlug = s.category?.network?.slug || 'unknown';
    const catName = s.category?.name || 'unknown';
    const catSlug = s.category?.slug || 'unknown';
    const feat = (s.features && typeof s.features === 'object' ? s.features : {}) as Record<string, any>;

    // 1. Service Name & Garbage Check
    const lowerName = s.name.toLowerCase();
    if (!s.name || s.name.trim().length < 3) {
      issues.push('Название услуги слишком короткое или пустое');
    }
    if (s.name.includes('Тариф #') || s.name.includes('ID:') || s.name.includes('Mock') || s.name.includes('mock') || s.name.includes('VexBoost') || s.name.includes('PrimeLike') || s.name.includes('test')) {
      issues.push(`Название содержит служебный/мусорный паттерн или бренд поставщика: "${s.name}"`);
    }

    // 2. Pricing & Currency Check
    const mult = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
    const pricePer1kRub = applyBeautifulRounding(s.rate * s.markup * mult);
    const pricePerUnitRub = pricePer1kRub / 1000;

    // Check if currency seems inverted (e.g. rate is 150 but currency is USD, leading to 150 * 3 * 90 = 40500 RUB per 1k)
    // Or rate is 0.05 but currency is RUB, leading to 0.05 * 3 * 1 = 0.15 RUB per 1k
    if (pricePer1kRub <= 0) {
      issues.push(`Цена за 1000 шт <= 0 (pricePer1kRub=${pricePer1kRub})`);
    }

    if (s.providerCurrency === 'RUB' && s.rate < 0.2) {
      warnings.push(`Подозрительно низкая ставка поставщика для RUB: rate=${s.rate} RUB (возможно, реальная ставка в USD?)`);
    }
    if (s.providerCurrency === 'USD' && s.rate > 50) {
      warnings.push(`Подозрительно высокая ставка поставщика для USD: rate=$${s.rate} (возможно, ставка в RUB с ошибочной пометкой USD?)`);
    }

    // Category-specific price sanity checks
    if (catSlug.includes('sub') || catSlug.includes('follower') || catName.toLowerCase().includes('подписчик') || catName.toLowerCase().includes('фолловер')) {
      if (pricePer1kRub < 15) {
        warnings.push(`Аномально дешевые подписчики: ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/шт)`);
      }
      if (pricePer1kRub > 6000) {
        warnings.push(`Аномально дорогие подписчики: ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/шт)`);
      }
    }
    if (catSlug.includes('like') || catName.toLowerCase().includes('лайк')) {
      if (pricePer1kRub < 1.0) {
        warnings.push(`Аномально дешевые лайки: ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/шт)`);
      }
      if (pricePer1kRub > 3000) {
        warnings.push(`Аномально дорогие лайки: ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/шт)`);
      }
    }
    if (catSlug.includes('view') || catName.toLowerCase().includes('просмотр')) {
      if (pricePer1kRub < 0.3) {
        warnings.push(`Аномально дешевые просмотры: ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/шт)`);
      }
      if (pricePer1kRub > 2500) {
        warnings.push(`Аномально дорогие просмотры: ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/шт)`);
      }
    }

    // 3. Limits Check
    if (s.minQty <= 0) {
      issues.push(`minQty <= 0 (${s.minQty})`);
    }
    if (s.maxQty < s.minQty) {
      issues.push(`maxQty (${s.maxQty}) < minQty (${s.minQty})`);
    }

    // 4. TargetType Check
    const effectiveTargetType = s.targetType || 'POST';
    const isSubscriber = catSlug.includes('sub') || catSlug.includes('follower') || catName.toLowerCase().includes('подписчик') || catName.toLowerCase().includes('фолловер') || catName.toLowerCase().includes('участник') || catName.toLowerCase().includes('канал') || lowerName.includes('подписчик') || lowerName.includes('фолловер');
    const isPostOrVideo = catSlug.includes('like') || catSlug.includes('view') || catSlug.includes('repost') || catSlug.includes('comment') || catName.toLowerCase().includes('лайк') || catName.toLowerCase().includes('просмотр') || catName.toLowerCase().includes('репост') || catName.toLowerCase().includes('коммент') || lowerName.includes('лайк') || lowerName.includes('просмотр') || lowerName.includes('видео') || lowerName.includes('shorts') || lowerName.includes('reels');

    if (isSubscriber && !['PROFILE', 'CHANNEL', 'GROUP', 'CUSTOM'].includes(effectiveTargetType)) {
      issues.push(`Несоответствие targetType для подписчиков: targetType="${effectiveTargetType}" (ожидается PROFILE или CHANNEL/GROUP)`);
    }
    if (isPostOrVideo && !isSubscriber && !['POST', 'VIDEO', 'REEL', 'STORY', 'SHORT', 'CUSTOM'].includes(effectiveTargetType)) {
      issues.push(`Несоответствие targetType для постов/видео: targetType="${effectiveTargetType}" (ожидается POST или VIDEO)`);
    }

    // 5. Provider Binding
    if (s.isActive && !s.providerId) {
      issues.push('Активная услуга не привязана к providerId');
    }
    if (s.isActive && !s.externalId) {
      issues.push('Активная услуга не имеет externalId у провайдера');
    }

    // 6. Quality, Badges, Warranty
    const isExplicitNoRefill =
      lowerName.includes('без гарантии') ||
      lowerName.includes('без гарантий') ||
      lowerName.includes('no refill') ||
      lowerName.includes('no-refill') ||
      lowerName.includes('norefill');
    
    if (isExplicitNoRefill && s.isRefillEnabled) {
      issues.push('Противоречие: в названии "без гарантии", но флаг isRefillEnabled=true');
    }
    if (feat.badge && String(feat.badge).toUpperCase() === 'ГАРАНТИЯ' && isExplicitNoRefill) {
      issues.push('Противоречие: бейдж "ГАРАНТИЯ", но услуга без гарантии');
    }

    auditResults.push({
      id: s.id,
      numericId: s.numericId,
      network: netSlug,
      category: catName,
      categorySlug: catSlug,
      name: s.name,
      slug: s.slug,
      description: s.description,
      rate: s.rate,
      markup: s.markup,
      providerCurrency: s.providerCurrency,
      pricePer1kRub,
      pricePerUnitRub,
      minQty: s.minQty,
      maxQty: s.maxQty,
      targetType: s.targetType,
      effectiveTargetType,
      providerId: s.providerId,
      providerName: s.provider?.name || 'NONE',
      externalId: s.externalId,
      qualityTier: s.qualityTier,
      isRefillEnabled: s.isRefillEnabled,
      isCancelEnabled: s.isCancelEnabled,
      isDripFeedEnabled: s.isDripFeedEnabled,
      badge: feat.badge || null,
      warrantyDays: feat.warrantyDays || null,
      isActive: s.isActive,
      issues,
      warnings
    });
  }

  const outReport = {
    generatedAt: new Date().toISOString(),
    usdToRub,
    networkSummaries,
    totalServices: allServices.length,
    servicesWithIssuesCount: auditResults.filter(r => r.issues.length > 0).length,
    servicesWithWarningsCount: auditResults.filter(r => r.warnings.length > 0).length,
    services: auditResults
  };

  const jsonPath = path.join(process.cwd(), 'audit_video_services_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(outReport, null, 2), 'utf-8');

  console.log(`\n=== AUDIT SUMMARY ===`);
  console.log(`Total Services: ${allServices.length}`);
  console.log(`Services with Critical Issues: ${outReport.servicesWithIssuesCount}`);
  console.log(`Services with Warnings: ${outReport.servicesWithWarningsCount}`);
  for (const [net, data] of Object.entries(networkSummaries)) {
    console.log(`Network [${net}]: ${data.servicesCount} services (${data.activeServicesCount} active) in ${data.categoriesCount} categories`);
  }
}

auditServices().catch(console.error).finally(() => process.exit(0));
