import { db } from '../../src/lib/db';

async function inspectProviders() {
  const providers = await db.provider.findMany({
    include: {
      services: {
        where: { isActive: true },
        select: { id: true, name: true, rate: true, providerCurrency: true }
      }
    }
  });

  for (const p of providers) {
    if (p.services.length === 0) continue;
    console.log(`\n========================================================================`);
    console.log(`Provider: ${p.name} | API: ${p.apiUrl} | Provider.balanceCurrency: ${p.balanceCurrency}`);
    console.log(`Active services count: ${p.services.length}`);
    const currencyCounts = p.services.reduce((acc, s) => {
      acc[s.providerCurrency] = (acc[s.providerCurrency] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`Service providerCurrencies:`, JSON.stringify(currencyCounts));

    const sample = p.services.slice(0, 5);
    for (const s of sample) {
      console.log(`  - [${s.id}] "${s.name.slice(0, 45)}" | rate: ${s.rate} | s.providerCurrency: ${s.providerCurrency}`);
    }
  }
}

inspectProviders().finally(() => db.$disconnect());
