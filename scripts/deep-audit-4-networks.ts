import { db } from '../src/lib/db';
import { SettingsProvider } from '../src/lib/settings';
import { applyBeautifulRounding } from '../src/lib/financial-constants';
import * as fs from 'fs';
import * as path from 'path';

interface AuditItem {
  id: string;
  numericId: number;
  network: string;
  networkSlug: string;
  category: string;
  categorySlug: string;
  name: string;
  providerId: string | null;
  providerName: string;
  externalId: string | null;
  rate: number;
  providerCurrency: string;
  markup: number;
  pricePer1kRub: number;
  pricePerUnitRub: number;
  minQty: number;
  maxQty: number;
  targetType: string;
  recommendedTargetType: string;
  targetTypeIssue: string | null;
  qualityTier: string;
  isActive: boolean;
  isQuarantined: boolean;
  rateAnalysis: {
    isExtreme: boolean;
    probableOrigin: string;
    marketBenchmarkPer1kRub: number; // typical market retail price for 1000 pcs in RUB
    suggestedRateRubPer1k: number;   // typical provider wholesale rate in RUB
    suggestedMarkup: number;
    suggestedRetail1kRub: number;
    suggestedRetailUnitRub: number;
  };
  limitsAnalysis: {
    isSane: boolean;
    issues: string[];
    recommendedMin: number;
    recommendedMax: number;
  };
  providerAnalysis: {
    status: string;
    isExternalIdPresent: boolean;
  };
}

async function main() {
  const usdToRub = await SettingsProvider.getExchangeRateUSD();
  console.log(`[DEEP AUDIT] USD/RUB rate: ${usdToRub}`);

  const targetNetworkSlugs = ['twitch', 'twitter', 'facebook', 'max'];

  const services = await db.service.findMany({
    where: {
      category: {
        network: {
          slug: { in: targetNetworkSlugs }
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
      { numericId: 'asc' }
    ]
  });

  console.log(`[DEEP AUDIT] Found ${services.length} services`);

  const auditItems: AuditItem[] = services.map(s => {
    const netSlug = s.category.network?.slug || '';
    const catSlug = s.category.slug;
    const sName = s.name.toLowerCase();

    // 1. TargetType verification
    let recommendedTargetType = 'POST';
    let targetTypeIssue: string | null = null;

    if (netSlug === 'twitch') {
      if (catSlug === 'twitch-followers') {
        recommendedTargetType = 'PROFILE'; // twitch.tv/channel_name
      } else if (catSlug === 'twitch-viewers') {
        recommendedTargetType = 'CHANNEL'; // or LIVE_STREAM
      }
    } else if (netSlug === 'twitter') {
      if (catSlug === 'twitter-followers') {
        recommendedTargetType = 'PROFILE'; // x.com/username
      }
    } else if (netSlug === 'facebook') {
      if (catSlug === 'fb-followers') {
        recommendedTargetType = 'PROFILE'; // facebook.com/page or profile
      } else if (catSlug === 'fb-likes') {
        recommendedTargetType = 'POST'; // facebook.com/post_id
      }
    } else if (netSlug === 'max') {
      if (catSlug === 'max-subscribers') {
        recommendedTargetType = 'CHANNEL'; // max.ru/channel
      } else if (catSlug === 'max-views') {
        recommendedTargetType = 'POST'; // max.ru/post
      } else if (catSlug === 'max-reactions') {
        recommendedTargetType = 'POST'; // max.ru/post
      }
    }

    if (s.targetType !== recommendedTargetType) {
      targetTypeIssue = `Current targetType is '${s.targetType}', but category '${catSlug}' requires '${recommendedTargetType}'`;
    }

    // 2. Price & Rate Analysis
    const isRub = s.providerCurrency === 'RUB';
    const effectiveMultiplier = isRub ? 1.0 : usdToRub;
    const rawCost1kRub = s.rate * s.markup * effectiveMultiplier;
    const pricePer1kRub = applyBeautifulRounding(rawCost1kRub);
    const pricePerUnitRub = pricePer1kRub / 1000;

    // Market benchmarks for 2026:
    // Twitch followers: Wholesale ~15-45 RUB / 1k (0.15-0.50 USD), Retail ~45-150 RUB / 1k (0.045 - 0.15 ₽/шт)
    // Twitch viewers: Wholesale ~100-350 RUB / 1k hours/viewers, Retail ~250-700 RUB / 1k
    // Twitter followers: Wholesale ~60-180 RUB / 1k, Retail ~150-450 RUB / 1k (0.15 - 0.45 ₽/шт)
    // FB followers: Wholesale ~80-250 RUB / 1k, Retail ~200-600 RUB / 1k (0.20 - 0.60 ₽/шт)
    // FB likes: Wholesale ~40-120 RUB / 1k, Retail ~90-300 RUB / 1k (0.09 - 0.30 ₽/шт)
    // MAX subscribers: Wholesale ~80-250 RUB / 1k, Retail ~200-600 RUB / 1k (0.20 - 0.60 ₽/шт)
    // MAX views: Wholesale ~10-40 RUB / 1k, Retail ~25-90 RUB / 1k (0.025 - 0.09 ₽/шт)
    // MAX reactions: Wholesale ~30-90 RUB / 1k, Retail ~70-200 RUB / 1k (0.07 - 0.20 ₽/шт)

    let benchmark1k = 150;
    let suggestedRate = 50;
    let suggestedMarkup = 2.5;

    if (netSlug === 'twitch') {
      if (catSlug === 'twitch-followers') {
        benchmark1k = 95;
        suggestedRate = 35;
        suggestedMarkup = 2.7;
      } else {
        benchmark1k = 390;
        suggestedRate = 150;
        suggestedMarkup = 2.6;
      }
    } else if (netSlug === 'twitter') {
      benchmark1k = 290;
      suggestedRate = 110;
      suggestedMarkup = 2.6;
    } else if (netSlug === 'facebook') {
      if (catSlug === 'fb-followers') {
        benchmark1k = 350;
        suggestedRate = 130;
        suggestedMarkup = 2.7;
      } else {
        benchmark1k = 180;
        suggestedRate = 70;
        suggestedMarkup = 2.5;
      }
    } else if (netSlug === 'max') {
      if (catSlug === 'max-subscribers') {
        benchmark1k = 320;
        suggestedRate = 120;
        suggestedMarkup = 2.7;
      } else if (catSlug === 'max-views') {
        benchmark1k = 45;
        suggestedRate = 15;
        suggestedMarkup = 3.0;
      } else {
        benchmark1k = 120;
        suggestedRate = 45;
        suggestedMarkup = 2.7;
      }
    }

    let probableOrigin = 'Standard rate';
    let isExtreme = false;

    if (s.rate > 1000) {
      isExtreme = true;
      if (s.rate >= 10000) {
        probableOrigin = `CRITICAL ERROR: Rate is in kopecks or micro-units from provider API dump (e.g. ${s.rate} = ${(s.rate/100).toFixed(2)} RUB or ${(s.rate/1000).toFixed(2)} USD), combined with markup ${s.markup}x giving insane price ${pricePer1kRub} ₽/1k!`;
      } else {
        probableOrigin = `HIGH ANOMALY: Rate is ${s.rate} RUB (either 100x kopeck scale or provider overpricing) with 10x markup resulting in ${pricePer1kRub} ₽/1k (${pricePerUnitRub} ₽/unit)`;
      }
    } else if (s.rate > 300 && catSlug.includes('views')) {
      isExtreme = true;
      probableOrigin = `VIEWS OVERPRICING: Rate ${s.rate} RUB for views is 10-30x above market wholesale`;
    }

    // 3. Limits analysis
    const limitIssues: string[] = [];
    let recMin = s.minQty;
    let recMax = s.maxQty;

    if (s.minQty < 10) {
      limitIssues.push(`minQty (${s.minQty}) is too low (standard floor is 10)`);
      recMin = 10;
    }
    if (s.maxQty > 1000000) {
      limitIssues.push(`maxQty (${s.maxQty}) is unrealistically high (> 1M)`);
      recMax = 500000;
    }
    if (catSlug === 'twitch-viewers' && s.minQty < 10) {
      recMin = 10;
    }
    if (s.minQty >= s.maxQty) {
      limitIssues.push(`minQty (${s.minQty}) >= maxQty (${s.maxQty})`);
    }

    return {
      id: s.id,
      numericId: s.numericId,
      network: s.category.network?.name || '',
      networkSlug: netSlug,
      category: s.category.name,
      categorySlug: catSlug,
      name: s.name,
      providerId: s.providerId,
      providerName: s.provider?.name || 'NONE',
      externalId: s.externalId,
      rate: s.rate,
      providerCurrency: s.providerCurrency,
      markup: s.markup,
      pricePer1kRub,
      pricePerUnitRub,
      minQty: s.minQty,
      maxQty: s.maxQty,
      targetType: s.targetType,
      recommendedTargetType,
      targetTypeIssue,
      qualityTier: s.qualityTier,
      isActive: s.isActive,
      isQuarantined: s.isQuarantined,
      rateAnalysis: {
        isExtreme,
        probableOrigin,
        marketBenchmarkPer1kRub: benchmark1k,
        suggestedRateRubPer1k: suggestedRate,
        suggestedMarkup,
        suggestedRetail1kRub: applyBeautifulRounding(suggestedRate * suggestedMarkup),
        suggestedRetailUnitRub: applyBeautifulRounding(suggestedRate * suggestedMarkup) / 1000
      },
      limitsAnalysis: {
        isSane: limitIssues.length === 0,
        issues: limitIssues,
        recommendedMin: recMin,
        recommendedMax: recMax
      },
      providerAnalysis: {
        status: s.provider ? (s.provider.isActive ? 'ACTIVE' : 'INACTIVE') : 'NO_PROVIDER',
        isExternalIdPresent: Boolean(s.externalId)
      }
    };
  });

  const outputPath = path.resolve(process.cwd(), 'deep_audit_4_networks.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    usdToRub,
    totalCount: auditItems.length,
    extremePriceCount: auditItems.filter(i => i.rateAnalysis.isExtreme).length,
    targetTypeIssueCount: auditItems.filter(i => i.targetTypeIssue !== null).length,
    items: auditItems
  }, null, 2));

  console.log(`[DEEP AUDIT] Written deep audit results to ${outputPath}`);
  console.log(`Total services: ${auditItems.length}`);
  console.log(`Extreme price anomalies: ${auditItems.filter(i => i.rateAnalysis.isExtreme).length}`);
  console.log(`Target type discrepancies: ${auditItems.filter(i => i.targetTypeIssue !== null).length}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
