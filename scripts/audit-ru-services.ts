import { db } from '../src/lib/db';
import * as fs from 'fs';

interface AuditIssue {
  serviceId: string;
  numericId: number;
  serviceName: string;
  socialNetwork: string;
  category: string;
  categorySlug: string;
  categoryActivityType: string | null;
  serviceTargetType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  issueType: string;
  description: string;
  currentValues: any;
  recommendation: string;
}

function applyBeautifulRounding(val: number): number {
  if (val <= 0) return 0;
  if (val < 1) return Number(val.toFixed(2));
  if (val < 10) return Number(val.toFixed(1));
  if (val < 100) return Math.round(val);
  return Math.round(val);
}

async function auditRuServices() {
  const targetNetworks = ['telegram', 'vk', 'rutube', 'dzen', 'ok'];

  const systemSettings = await db.systemSettings.findFirst({
    where: { id: 'smmplan' }
  });
  const usdToRub = systemSettings?.exchangeRateUSD || 90.0;

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

  const allServices: any[] = [];
  const issues: AuditIssue[] = [];

  for (const net of networks) {
    for (const cat of net.categories) {
      for (const s of cat.services) {
        const rate = Number(s.rate);
        const markup = Number(s.markup);
        const providerCurrency = s.providerCurrency || 'USD';
        const mult = providerCurrency === 'RUB' ? 1.0 : usdToRub;
        const pricePer1kRub = applyBeautifulRounding(rate * markup * mult);
        const pricePerUnitRub = Number((pricePer1kRub / 1000).toFixed(6));

        allServices.push({
          network: net.slug,
          networkName: net.name,
          category: cat.name,
          categorySlug: cat.slug,
          categoryActivityType: cat.activityType,
          service: s,
          calculated: {
            usdToRub,
            pricePer1kRub,
            pricePerUnitRub
          }
        });

        // 1. Service Name checks
        const name = s.name || '';
        if (s.isActive && (name.includes('[DEPRECATED]') || name.includes('[АРХИВ]') || name.includes('DEPRECATED') || name.includes('АРХИВ') || name.includes('ТЕСТ') || name.includes('[TEST]'))) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'DEPRECATED_NAME_ACTIVE',
            description: `Активная услуга содержит маркер архива/депрекации в названии: "${name}"`,
            currentValues: { name: s.name, isActive: s.isActive },
            recommendation: `Деактивировать услугу (isActive: false) или переименовать в понятное для B2C/API клиентов имя.`
          });
        }

        // Check for raw vendor names in title/description
        const rawVendorMatches = name.match(/vexboost|primelike|justanotherpanel|smmkings|jap|smmpanel|hqlikes|smmprime/i);
        if (rawVendorMatches) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'VENDOR_LEAK_IN_NAME',
            description: `Услуга содержит утечку имени внешнего поставщика: "${rawVendorMatches[0]}"`,
            currentValues: { name: s.name },
            recommendation: `Удалить упоминание вендора из названия услуги.`
          });
        }

        // Check for unclear name or placeholder like "Тариф #..."
        if (/^Тариф\s*#?\d+$/i.test(name.trim())) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'MEDIUM',
            issueType: 'GENERIC_TARIFF_NAME',
            description: `Неинформативное техническое имя тарифа: "${name}"`,
            currentValues: { name: s.name },
            recommendation: `Задать понятное коммерческое имя с указанием качества (напр. [Быстрый старт], [Офферный РФ]).`
          });
        }

        // 2. Pricing & Currency checks
        if (pricePerUnitRub <= 0 || pricePer1kRub <= 0) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'CRITICAL',
            issueType: 'ZERO_PRICE',
            description: `Итоговая цена услуги равна 0 руб (pricePerUnitRub: ${pricePerUnitRub}, pricePer1kRub: ${pricePer1kRub})`,
            currentValues: { rate, markup, pricePer1kRub, pricePerUnitRub, providerCurrency },
            recommendation: `Задать корректную цену rate и markup, пересчитать цены.`
          });
        }

        if (pricePerUnitRub > 1000) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'ANOMALOUS_HIGH_PRICE',
            description: `Подозрительно высокая розничная цена за 1 единицу: ${pricePerUnitRub} ₽ / шт`,
            currentValues: { rate, markup, pricePer1kRub, pricePerUnitRub, providerCurrency },
            recommendation: `Проверить, не перепутана ли цена за 1000 шт с ценой за 1 шт.`
          });
        }

        // Check if rate is ridiculously small or huge
        if (rate <= 0) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'CRITICAL',
            issueType: 'ZERO_OR_NEGATIVE_RATE',
            description: `Себестоимость провайдера rate <= 0 (${rate})`,
            currentValues: { rate, providerCurrency },
            recommendation: `Указать реальный rate от провайдера.`
          });
        }

        if (markup < 1.0) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'MARKUP_BELOW_COST',
            description: `Коэффициент наценки markup (${markup}) меньше 1.0 (продажа в убыток)`,
            currentValues: { markup, rate },
            recommendation: `Установить наценку markup >= 1.2 (рекомендуется >= 2.0 - 3.0).`
          });
        }

        // Check stored pricePer1000Cents consistency
        const expectedCents = Math.round(pricePer1kRub * 100);
        if (s.pricePer1000Cents > 0 && Math.abs(s.pricePer1000Cents - expectedCents) > 100) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'LOW',
            issueType: 'PRICE_CENTS_DESYNC',
            description: `Кэшированная цена pricePer1000Cents (${s.pricePer1000Cents}) отличается от расчетной (${expectedCents})`,
            currentValues: { storedCents: s.pricePer1000Cents, expectedCents },
            recommendation: `Обновить pricePer1000Cents в базе до ${expectedCents}.`
          });
        }

        // 3. Min/Max Limits checks
        if (s.minQty > s.maxQty) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'CRITICAL',
            issueType: 'MIN_GREATER_THAN_MAX',
            description: `minQty (${s.minQty}) больше maxQty (${s.maxQty})`,
            currentValues: { minQty: s.minQty, maxQty: s.maxQty },
            recommendation: `Скорректировать лимиты: minQty <= maxQty.`
          });
        }

        if (s.minQty <= 0) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'INVALID_MIN_QTY',
            description: `minQty <= 0 (${s.minQty})`,
            currentValues: { minQty: s.minQty },
            recommendation: `Установить минимальное количество >= 1 (или 10/100 в зависимости от типа).`
          });
        }

        // 4. TargetType & Category matching
        const actType = (cat.activityType || '').toUpperCase();
        const catNameLower = cat.name.toLowerCase();
        const sTarget = (s.targetType || '').toUpperCase();

        // Telegram semantic check
        if (net.slug === 'telegram') {
          if (actType === 'FOLLOWERS' || catNameLower.includes('подписчик') || catNameLower.includes('буст') || catNameLower.includes('участник')) {
            if (sTarget !== 'CHANNEL' && sTarget !== 'GROUP' && sTarget !== 'PROFILE') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'TG_TARGET_MISMATCH',
                description: `Для подписчиков/бустов Telegram targetType = "${sTarget}", ожидается "CHANNEL" или "GROUP"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "CHANNEL"`
              });
            }
          }
          if (actType === 'VIEWS' || actType === 'LIKES' || actType === 'REACTIONS' || actType === 'COMMENTS' || catNameLower.includes('просмотр') || catNameLower.includes('реакци') || catNameLower.includes('коммент')) {
            if (sTarget !== 'POST' && sTarget !== 'COMMENT') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'TG_TARGET_MISMATCH',
                description: `Для просмотров/реакций/комментариев Telegram targetType = "${sTarget}", ожидается "POST"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "POST"`
              });
            }
          }
          if (actType === 'BOTS' || catNameLower.includes('бот')) {
            if (sTarget !== 'BOT' && sTarget !== 'PROFILE' && sTarget !== 'CHANNEL') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'TG_TARGET_MISMATCH',
                description: `Для ботов Telegram targetType = "${sTarget}", ожидается "BOT"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "BOT"`
              });
            }
          }
        }

        // VK semantic check
        if (net.slug === 'vk') {
          if (actType === 'FOLLOWERS' || catNameLower.includes('подписчик') || catNameLower.includes('групп') || catNameLower.includes('друг')) {
            if (sTarget !== 'GROUP' && sTarget !== 'PROFILE') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'VK_TARGET_MISMATCH',
                description: `Для подписчиков/друзей ВК targetType = "${sTarget}", ожидается "GROUP" или "PROFILE"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "GROUP" (для групп) или "PROFILE" (для друзей)`
              });
            }
          }
          if (actType === 'LIKES' || actType === 'VIEWS' || actType === 'REPOSTS' || actType === 'COMMENTS' || catNameLower.includes('лайк') || catNameLower.includes('просмотр') || catNameLower.includes('репост') || catNameLower.includes('коммент')) {
            if (sTarget !== 'POST' && sTarget !== 'VK_WALL' && sTarget !== 'VIDEO' && sTarget !== 'COMMENT') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'VK_TARGET_MISMATCH',
                description: `Для лайков/просмотров/репостов/комментов ВК targetType = "${sTarget}", ожидается "POST"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "POST"`
              });
            }
          }
        }

        // Rutube semantic check
        if (net.slug === 'rutube') {
          if (actType === 'VIEWS' || catNameLower.includes('просмотр')) {
            if (sTarget !== 'POST' && sTarget !== 'VIDEO') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'RUTUBE_TARGET_MISMATCH',
                description: `Для просмотров Rutube targetType = "${sTarget}", ожидается "POST" или "VIDEO"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "POST"`
              });
            }
          }
        }

        // Dzen semantic check
        if (net.slug === 'dzen') {
          if (actType === 'FOLLOWERS' || catNameLower.includes('подписчик')) {
            if (sTarget !== 'CHANNEL' && sTarget !== 'PROFILE') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'DZEN_TARGET_MISMATCH',
                description: `Для подписчиков Дзен targetType = "${sTarget}", ожидается "CHANNEL" или "PROFILE"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "CHANNEL"`
              });
            }
          }
          if (actType === 'VIEWS' || catNameLower.includes('просмотр') || catNameLower.includes('дочитыван')) {
            if (sTarget !== 'POST' && sTarget !== 'ARTICLE') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'DZEN_TARGET_MISMATCH',
                description: `Для дочитываний/просмотров Дзен targetType = "${sTarget}", ожидается "POST"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "POST"`
              });
            }
          }
        }

        // OK semantic check
        if (net.slug === 'ok') {
          if (actType === 'FOLLOWERS' || catNameLower.includes('участник') || catNameLower.includes('подписчик') || catNameLower.includes('групп')) {
            if (sTarget !== 'GROUP' && sTarget !== 'PROFILE') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'OK_TARGET_MISMATCH',
                description: `Для участников группы ОК targetType = "${sTarget}", ожидается "GROUP"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "GROUP"`
              });
            }
          }
          if (actType === 'LIKES' || actType === 'VIEWS' || actType === 'REPOSTS' || catNameLower.includes('класс') || catNameLower.includes('просмотр') || catNameLower.includes('репост') || catNameLower.includes('поделит')) {
            if (sTarget !== 'POST' && sTarget !== 'TOPIC') {
              issues.push({
                serviceId: s.id,
                numericId: s.numericId,
                serviceName: s.name,
                socialNetwork: net.slug,
                category: cat.name,
                categorySlug: cat.slug,
                categoryActivityType: cat.activityType,
                serviceTargetType: s.targetType,
                severity: 'HIGH',
                issueType: 'OK_TARGET_MISMATCH',
                description: `Для классов/просмотров/репостов ОК targetType = "${sTarget}", ожидается "POST"`,
                currentValues: { targetType: s.targetType, category: cat.name },
                recommendation: `Установить targetType = "POST"`
              });
            }
          }
        }

        // 5. Provider & External ID
        if (s.isActive && (!s.providerId || !s.provider)) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'MISSING_PROVIDER',
            description: `Активная услуга не привязана к провайдеру (providerId: null)`,
            currentValues: { providerId: s.providerId },
            recommendation: `Привязать услугу к активному поставщику или деактивировать.`
          });
        }

        if (s.isActive && (!s.externalId || s.externalId.trim() === '')) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'HIGH',
            issueType: 'MISSING_EXTERNAL_ID',
            description: `Активная услуга не имеет externalId у провайдера`,
            currentValues: { externalId: s.externalId, providerName: s.provider?.name },
            recommendation: `Указать ID услуги в системе провайдера (${s.provider?.name || 'Unknown'}).`
          });
        }

        // 6. Refill & Warranty coherence
        const features: any = s.features || {};
        const warrantyDays = features.warrantyDays ?? (features.warranty ? 30 : 0);
        if (s.isRefillEnabled && warrantyDays <= 0) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'LOW',
            issueType: 'REFILL_WITHOUT_WARRANTY_DAYS',
            description: `Включен isRefillEnabled (true), но warrantyDays = ${warrantyDays}`,
            currentValues: { isRefillEnabled: s.isRefillEnabled, warrantyDays, features },
            recommendation: `Указать гарантийный срок в features.warrantyDays (например, 30).`
          });
        }
        if (!s.isRefillEnabled && warrantyDays > 0) {
          issues.push({
            serviceId: s.id,
            numericId: s.numericId,
            serviceName: s.name,
            socialNetwork: net.slug,
            category: cat.name,
            categorySlug: cat.slug,
            categoryActivityType: cat.activityType,
            serviceTargetType: s.targetType,
            severity: 'LOW',
            issueType: 'WARRANTY_DAYS_WITHOUT_REFILL',
            description: `Указаны warrantyDays (${warrantyDays}), но isRefillEnabled = false`,
            currentValues: { isRefillEnabled: s.isRefillEnabled, warrantyDays, features },
            recommendation: `Включить isRefillEnabled: true или обнулить warrantyDays.`
          });
        }
      }
    }
  }

  const output = {
    summary: {
      networksAudited: targetNetworks,
      totalServices: allServices.length,
      totalIssues: issues.length,
      bySeverity: {
        CRITICAL: issues.filter(i => i.severity === 'CRITICAL').length,
        HIGH: issues.filter(i => i.severity === 'HIGH').length,
        MEDIUM: issues.filter(i => i.severity === 'MEDIUM').length,
        LOW: issues.filter(i => i.severity === 'LOW').length,
        INFO: issues.filter(i => i.severity === 'INFO').length,
      },
      byNetwork: targetNetworks.reduce((acc: any, net) => {
        acc[net] = {
          categoriesCount: networks.find(n => n.slug === net)?.categories.length || 0,
          servicesCount: allServices.filter(s => s.network === net).length,
          issuesCount: issues.filter(i => i.socialNetwork === net).length
        };
        return acc;
      }, {})
    },
    issues,
    servicesList: allServices.map(item => ({
      id: item.service.id,
      numericId: item.service.numericId,
      network: item.network,
      category: item.category,
      categorySlug: item.categorySlug,
      categoryActivityType: item.categoryActivityType,
      name: item.service.name,
      isActive: item.service.isActive,
      rate: Number(item.service.rate),
      markup: Number(item.service.markup),
      providerCurrency: item.service.providerCurrency,
      pricePer1kRub: item.calculated.pricePer1kRub,
      pricePerUnitRub: item.calculated.pricePerUnitRub,
      minQty: item.service.minQty,
      maxQty: item.service.maxQty,
      targetType: item.service.targetType,
      providerId: item.service.providerId,
      providerName: item.service.provider?.name,
      externalId: item.service.externalId,
      isDripFeedEnabled: item.service.isDripFeedEnabled,
      isRefillEnabled: item.service.isRefillEnabled,
      features: item.service.features
    }))
  };

  fs.writeFileSync('./scripts/audit-ru-services-result.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log(`AUDIT COMPLETE. Processed ${allServices.length} services across ${networks.length} networks.`);
  console.log(`Total issues found: ${issues.length}`);
  console.log(JSON.stringify(output.summary, null, 2));
}

auditRuServices().catch(console.error).finally(() => db.$disconnect());
