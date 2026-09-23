import { db } from '../src/lib/db';
import { SettingsProvider } from '../src/lib/settings';
import { applyBeautifulRounding } from '../src/lib/financial-constants';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const usdToRub = await SettingsProvider.getExchangeRateUSD();
  console.log(`[AUDIT] USD to RUB rate: ${usdToRub}`);

  const providers = await db.provider.findMany();
  console.log(`[AUDIT] Found ${providers.length} providers:`);
  for (const p of providers) {
    console.log(`  - Provider [${p.id}]: name="${p.name}", url="${p.apiUrl}", type="${p.type}", balance="${p.balance}"`);
  }

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

  console.log(`\n[AUDIT] Total services found in 4 networks: ${services.length}`);

  const enrichedServices = services.map(s => {
    // Standard catalog calculation logic:
    const isRub = s.providerCurrency === 'RUB';
    const effectiveMultiplier = isRub ? 1.0 : usdToRub;
    const rawCost1kRub = s.rate * s.markup * effectiveMultiplier;
    const pricePer1kRub = applyBeautifulRounding(rawCost1kRub);
    const pricePerUnitRub = pricePer1kRub / 1000;

    let rateUnitAnomaly: string | null = null;
    if (s.rate > 1000) {
      rateUnitAnomaly = `Suspicious high rate: ${s.rate}. Possible kopecks (${(s.rate / 100).toFixed(2)} RUB) or raw provider API unit error`;
    } else if (s.rate <= 0) {
      rateUnitAnomaly = `Zero or negative rate: ${s.rate}`;
    }

    return {
      id: s.id,
      numericId: s.numericId,
      network: s.category.network?.name,
      networkSlug: s.category.network?.slug,
      category: s.category.name,
      categorySlug: s.category.slug,
      name: s.name,
      description: s.description,
      providerId: s.providerId,
      providerName: s.provider?.name ?? 'NONE',
      externalId: s.externalId,
      rate: s.rate,
      providerCurrency: s.providerCurrency,
      markup: s.markup,
      rawCost1kRub: Number(rawCost1kRub.toFixed(4)),
      pricePer1kRub,
      pricePerUnitRub,
      minQty: s.minQty,
      maxQty: s.maxQty,
      targetType: s.targetType,
      customDataType: s.customDataType,
      customDataLabel: s.customDataLabel,
      isActive: s.isActive,
      isQuarantined: s.isQuarantined,
      qualityTier: s.qualityTier,
      features: s.features,
      rateUnitAnomaly
    };
  });

  const outputPath = path.resolve(process.cwd(), 'audit_4_networks.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    usdToRub,
    totalServices: enrichedServices.length,
    byNetwork: {
      twitch: enrichedServices.filter(s => s.networkSlug === 'twitch'),
      twitter: enrichedServices.filter(s => s.networkSlug === 'twitter'),
      facebook: enrichedServices.filter(s => s.networkSlug === 'facebook'),
      max: enrichedServices.filter(s => s.networkSlug === 'max')
    }
  }, null, 2));

  console.log(`[AUDIT] Detailed report saved to: ${outputPath}`);

  for (const slug of targetNetworkSlugs) {
    const subset = enrichedServices.filter(s => s.networkSlug === slug);
    console.log(`\n=== NETWORK: ${slug.toUpperCase()} (${subset.length} services) ===`);
    for (const s of subset) {
      console.log(`  [ID: ${s.numericId} | ${s.id}] [${s.category}] "${s.name}"`);
      console.log(`    Provider: ${s.providerName} (extId: ${s.externalId}), Currency: ${s.providerCurrency}`);
      console.log(`    DB Rate: ${s.rate}, Markup: ${s.markup} => 1000 шт: ${s.pricePer1kRub} ₽, 1 шт: ${s.pricePerUnitRub} ₽`);
      console.log(`    Limits: [${s.minQty} .. ${s.maxQty}], TargetType: ${s.targetType}, Quality: ${s.qualityTier}, Active: ${s.isActive}, Quarantined: ${s.isQuarantined}`);
      if (s.rateUnitAnomaly) {
        console.log(`    ⚠️ ANOMALY: ${s.rateUnitAnomaly}`);
      }
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
