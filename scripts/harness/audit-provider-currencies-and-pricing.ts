import { db } from '../../src/lib/db';

function applyBeautifulRounding(rawPrice: number): number {
  if (rawPrice <= 0) return 0;
  if (rawPrice < 10) return Math.round(rawPrice * 100) / 100;
  if (rawPrice < 100) return Math.round(rawPrice * 10) / 10;
  return Math.round(rawPrice);
}

async function auditProviderCurrenciesAndPricing() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  💰 PROVIDER CURRENCIES & CATALOG PRICING AUDIT');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const settings = await db.systemSettings.findUnique({
    where: { id: 'global' },
    select: { exchangeRateUSD: true }
  });
  const usdToRub = settings?.exchangeRateUSD || 95.0;
  console.log(`💵 Database SystemSettings USD/RUB Exchange Rate: ${usdToRub.toFixed(2)} RUB\n`);

  // 1. Audit Providers
  const providers = await db.provider.findMany({
    select: {
      id: true,
      name: true,
      providerType: true,
      balanceCurrency: true,
      apiUrl: true,
      metadata: true,
      _count: {
        select: { services: true }
      }
    }
  });

  console.log('📦 PROVIDERS IN DATABASE:');
  console.table(providers.map(p => ({
    id: p.id,
    name: p.name,
    type: p.providerType,
    apiUrl: p.apiUrl,
    balanceCurrency: p.balanceCurrency,
    servicesCount: p._count.services
  })));

  // 2. Audit All Active Services
  const services = await db.service.findMany({
    where: { isActive: true },
    include: {
      provider: {
        select: { id: true, name: true, balanceCurrency: true }
      },
      category: {
        select: { id: true, name: true, network: true }
      }
    },
    orderBy: { rate: 'desc' }
  });

  console.log(`\n🔍 AUDITING ${services.length} ACTIVE SERVICES FOR CURRENCY & RATE ANOMALIES...\n`);

  const anomalies: Array<{
    serviceId: string;
    name: string;
    network: string;
    category: string;
    providerName: string;
    providerCurrencyInDB: string;
    serviceProviderCurrency: string;
    rate: number;
    markup: number;
    pricePer1kRub: number;
    pricePerUnitRub: number;
    reason: string;
  }> = [];

  for (const s of services) {
    const pCurrency = s.provider?.balanceCurrency || 'USD';
    const sCurrency = s.providerCurrency || pCurrency;

    const isCurrencyMismatch = s.provider?.balanceCurrency && s.providerCurrency && s.provider.balanceCurrency !== s.providerCurrency;

    const pricePer1kRub = applyBeautifulRounding(s.rate * s.markup * (sCurrency === 'RUB' ? 1.0 : usdToRub));
    const pricePerUnitRub = pricePer1kRub / 1000;

    let reason = '';

    if (isCurrencyMismatch) {
      reason += `[CURRENCY MISMATCH: Provider=${s.provider?.balanceCurrency}, Service=${s.providerCurrency}] `;
    }

    // High rate anomaly (e.g. rate in RUB stored as USD, giving 95x multiplier)
    if (sCurrency === 'USD' && s.rate > 50) {
      reason += `[HIGH USD RATE: $${s.rate}/1k -> ${(s.rate * usdToRub).toFixed(0)} RUB/1k. Is this actually in RUB?] `;
    }

    if (pricePer1kRub > 15000) {
      reason += `[EXTREME HIGH RETAIL: ${pricePer1kRub.toFixed(2)} ₽ / 1k] `;
    }

    if (pricePer1kRub <= 0) {
      reason += `[ZERO OR NEGATIVE PRICE: ${pricePer1kRub} ₽] `;
    }

    if (reason) {
      anomalies.push({
        serviceId: s.id,
        name: s.name.slice(0, 35),
        network: s.category.network,
        category: s.category.name,
        providerName: s.provider?.name || 'NO_PROVIDER',
        providerCurrencyInDB: s.provider?.balanceCurrency || 'UNKNOWN',
        serviceProviderCurrency: sCurrency,
        rate: s.rate,
        markup: s.markup,
        pricePer1kRub,
        pricePerUnitRub,
        reason: reason.trim()
      });
    }
  }

  console.log(`🚨 FOUND ${anomalies.length} PRICING/CURRENCY ANOMALIES:\n`);
  if (anomalies.length > 0) {
    console.table(anomalies.map(a => ({
      id: a.serviceId,
      name: a.name,
      network: a.network,
      category: a.category,
      provider: a.providerName,
      pCurr: a.providerCurrencyInDB,
      sCurr: a.serviceProviderCurrency,
      rate: a.rate,
      markup: a.markup,
      price1k: a.pricePer1kRub.toFixed(2) + ' ₽',
      priceUnit: a.pricePerUnitRub.toFixed(4) + ' ₽',
      reason: a.reason
    })));
  } else {
    console.log('✅ ALL ACTIVE SERVICES HAVE CONSISTENT CURRENCIES AND SOUND PRICING!');
  }

  // 3. Print 10 Highest and 10 Lowest Priced Services for Quality Check
  console.log('\n📊 TOP 10 HIGHEST PRICED SERVICES:');
  console.table(services.slice(0, 10).map(s => {
    const sCurr = s.providerCurrency || s.provider?.currency || 'USD';
    const p1k = applyBeautifulRounding(s.rate * s.markup * (sCurr === 'RUB' ? 1.0 : usdToRub));
    return {
      id: s.id,
      name: s.name.slice(0, 35),
      network: s.category.network,
      category: s.category.name,
      rate: s.rate,
      currency: sCurr,
      markup: s.markup,
      price1k: p1k + ' ₽',
      priceUnit: (p1k / 1000).toFixed(4) + ' ₽'
    };
  }));
}

auditProviderCurrenciesAndPricing()
  .catch(console.error)
  .finally(() => db.$disconnect());
