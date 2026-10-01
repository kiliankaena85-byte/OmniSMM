import 'dotenv/config';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public';
}
import { db } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🔍 [CATALOG AUDIT] Querying categories, services, tariffs and markups...');

  // 1. Categories
  const categories = await db.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      tenantId: true,
      activityType: true,
      network: {
        select: {
          id: true,
          name: true,
          slug: true,
        }
      },
      services: {
        where: { isActive: true },
        select: { id: true, isQuarantined: true }
      }
    },
    orderBy: [{ name: 'asc' }]
  });

  // 2. All Active Services
  const services = await db.service.findMany({
    where: { isActive: true },
    select: {
      id: true,
      numericId: true,
      name: true,
      qualityTier: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          activityType: true,
          network: {
            select: {
              id: true,
              name: true,
              slug: true,
            }
          }
        }
      },
      rate: true,
      costPer1kRub: true,
      pricePer1000Cents: true,
      markup: true,
      minQty: true,
      maxQty: true,
      providerCurrency: true,
      tenantId: true,
      isQuarantined: true,
      provider: {
        select: {
          id: true,
          name: true,
          balanceCurrency: true,
        }
      }
    },
    orderBy: [{ numericId: 'asc' }]
  });

  console.log(`Found ${categories.length} categories in DB, ${services.length} active services in database.`);

  // Grouping by Network -> Category
  type CatStats = {
    network: string;
    category: string;
    activityType: string;
    totalServices: number;
    quarantinedCount: number;
    qualityTiers: {
      ECONOMY: number;
      STANDARD: number;
      PREMIUM: number;
      VIP: number;
      OTHER: number;
    };
    minCostPer1k: number;
    maxCostPer1k: number;
    minPricePer1k: number;
    maxPricePer1k: number;
    minPricePer1Pc: number;
    maxPricePer1Pc: number;
    minMarkup: number;
    maxMarkup: number;
    avgMarkup: number;
    avgMarginPercent: number;
    providers: Set<string>;
  };

  const networkStats: Record<string, Record<string, CatStats>> = {};

  for (const s of services) {
    const net = s.category?.network?.name || 'Другое';
    const cat = s.category?.name || 'Без категории';
    const actType = s.category?.activityType || 'OTHER';

    if (!networkStats[net]) networkStats[net] = {};
    if (!networkStats[net][cat]) {
      networkStats[net][cat] = {
        network: net,
        category: cat,
        activityType: actType,
        totalServices: 0,
        quarantinedCount: 0,
        qualityTiers: { ECONOMY: 0, STANDARD: 0, PREMIUM: 0, VIP: 0, OTHER: 0 },
        minCostPer1k: Infinity,
        maxCostPer1k: -Infinity,
        minPricePer1k: Infinity,
        maxPricePer1k: -Infinity,
        minPricePer1Pc: Infinity,
        maxPricePer1Pc: -Infinity,
        minMarkup: Infinity,
        maxMarkup: -Infinity,
        avgMarkup: 0,
        avgMarginPercent: 0,
        providers: new Set<string>(),
      };
    }

    const st = networkStats[net][cat];
    st.totalServices++;
    if (s.isQuarantined) st.quarantinedCount++;

    // Quality Tiers
    const tier = (s.qualityTier || 'STANDARD').toUpperCase();
    if (tier in st.qualityTiers) {
      (st.qualityTiers as any)[tier]++;
    } else {
      st.qualityTiers.OTHER++;
    }

    // Cost & Price
    const cost = s.costPer1kRub ?? s.rate ?? 0;
    const price = s.pricePer1000Cents ? (s.pricePer1000Cents / 100) : (cost * (s.markup || 1));
    const pricePer1Pc = price / 1000;

    const markup = cost > 0 ? Number((price / cost).toFixed(2)) : (s.markup || 1);

    if (cost < st.minCostPer1k) st.minCostPer1k = cost;
    if (cost > st.maxCostPer1k) st.maxCostPer1k = cost;
    if (price < st.minPricePer1k) st.minPricePer1k = price;
    if (price > st.maxPricePer1k) st.maxPricePer1k = price;
    if (pricePer1Pc < st.minPricePer1Pc) st.minPricePer1Pc = pricePer1Pc;
    if (pricePer1Pc > st.maxPricePer1Pc) st.maxPricePer1Pc = pricePer1Pc;

    if (markup < st.minMarkup) st.minMarkup = markup;
    if (markup > st.maxMarkup) st.maxMarkup = markup;

    if (s.provider?.name) {
      st.providers.add(s.provider.name);
    }
  }

  // Calculate averages and prepare table
  const tableRows: any[] = [];

  for (const net of Object.keys(networkStats).sort()) {
    for (const cat of Object.keys(networkStats[net]).sort()) {
      const st = networkStats[net][cat];

      const catServices = services.filter(
        (s) => (s.category?.network?.name || 'Другое') === net && (s.category?.name || 'Без категории') === cat
      );

      const sumMarkup = catServices.reduce((acc, s) => {
        const cost = s.costPer1kRub ?? s.rate ?? 0;
        const price = s.pricePer1000Cents ? (s.pricePer1000Cents / 100) : (cost * (s.markup || 1));
        const m = cost > 0 ? price / cost : s.markup || 1;
        return acc + m;
      }, 0);

      st.avgMarkup = Number((sumMarkup / (catServices.length || 1)).toFixed(2));

      // Margin % = ((Price - Cost) / Price) * 100
      const sumMargin = catServices.reduce((acc, s) => {
        const cost = s.costPer1kRub ?? s.rate ?? 0;
        const price = s.pricePer1000Cents ? (s.pricePer1000Cents / 100) : (cost * (s.markup || 1));
        const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
        return acc + margin;
      }, 0);
      st.avgMarginPercent = Number((sumMargin / (catServices.length || 1)).toFixed(1));

      tableRows.push({
        network: net,
        category: cat,
        activityType: st.activityType,
        servicesCount: st.totalServices,
        qualityTiersSummary: `Эконом: ${st.qualityTiers.ECONOMY}, Стандарт: ${st.qualityTiers.STANDARD}, Премиум: ${st.qualityTiers.PREMIUM}, VIP: ${st.qualityTiers.VIP}`,
        costRangeRub: `${st.minCostPer1k.toFixed(2)} — ${st.maxCostPer1k.toFixed(2)} ₽`,
        pricePer1kRangeRub: `${st.minPricePer1k.toFixed(2)} — ${st.maxPricePer1k.toFixed(2)} ₽`,
        pricePer1PcRangeRub: `${st.minPricePer1Pc.toFixed(4)} — ${st.maxPricePer1Pc.toFixed(4)} ₽`,
        markupRange: `${st.minMarkup}x — ${st.maxMarkup}x (ср. ${st.avgMarkup}x)`,
        avgMargin: `${st.avgMarginPercent}%`,
        providers: Array.from(st.providers).join(', ') || 'Direct',
      });
    }
  }

  // Summary by Network
  const networkSummary: Record<string, { categories: number; services: number; minPrice1k: number; maxPrice1k: number; avgMarkup: number; sumMarkup: number }> = {};
  for (const row of tableRows) {
    if (!networkSummary[row.network]) {
      networkSummary[row.network] = { categories: 0, services: 0, minPrice1k: Infinity, maxPrice1k: -Infinity, avgMarkup: 0, sumMarkup: 0 };
    }
    const ns = networkSummary[row.network];
    ns.categories++;
    ns.services += row.servicesCount;
    const catAvgMarkup = parseFloat(row.markupRange.split('ср. ')[1]) || 1;
    ns.sumMarkup += catAvgMarkup * row.servicesCount;
  }
  for (const net in networkSummary) {
    const ns = networkSummary[net];
    ns.avgMarkup = Number((ns.sumMarkup / (ns.services || 1)).toFixed(2));
  }

  // Global provider stats
  const providerStats: Record<string, { count: number; currencies: Set<string> }> = {};
  for (const s of services) {
    const prov = s.provider?.name || 'Direct';
    if (!providerStats[prov]) {
      providerStats[prov] = { count: 0, currencies: new Set() };
    }
    providerStats[prov].count++;
    if (s.providerCurrency) providerStats[prov].currencies.add(s.providerCurrency);
    if (s.provider?.balanceCurrency) providerStats[prov].currencies.add(s.provider.balanceCurrency);
  }

  // Global Quality Tier Breakdown
  const globalTiers: Record<string, number> = { ECONOMY: 0, STANDARD: 0, PREMIUM: 0, VIP: 0, OTHER: 0 };
  for (const s of services) {
    const t = (s.qualityTier || 'STANDARD').toUpperCase();
    if (t in globalTiers) globalTiers[t]++;
    else globalTiers.OTHER++;
  }

  const outputResult = {
    timestamp: new Date().toISOString(),
    totalCategoriesInDb: categories.length,
    activeCategoriesWithServices: tableRows.length,
    totalActiveServicesInDb: services.length,
    globalTiers,
    networkSummary,
    tableRows,
    providerStats: Object.entries(providerStats).map(([k, v]) => ({
      provider: k,
      servicesCount: v.count,
      currencies: Array.from(v.currencies),
    }))
  };

  const outputPath = path.resolve('artifacts/catalog-tariffs-breakdown.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(outputResult, null, 2), 'utf-8');

  console.log(`\n✅ Audit complete! Saved report data to: ${outputPath}`);
  console.log(`Networks: ${Object.keys(networkSummary).length}`);
  console.log(`Active Categories: ${tableRows.length}`);
  console.log(`Active Services: ${services.length}`);
  console.log(`Quality Tiers:`, globalTiers);
  console.log(`Network Summary:`, networkSummary);
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
