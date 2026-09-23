import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function audit() {
  console.log('=== IMPORT MODULE INTEGRITY AUDIT ===\n');

  // 1. Basic counts
  const totalServices = await p.service.count();
  const activeServices = await p.service.count({ where: { isActive: true } });
  const totalCategories = await p.category.count();
  console.log(`Total services: ${totalServices} (active: ${activeServices})`);
  console.log(`Total categories: ${totalCategories}`);

  // 2. Services with rate=0
  const zeroRate = await p.service.count({ where: { rate: 0, isActive: true } });
  console.log(`\nActive services with rate=0: ${zeroRate}`);

  // 3. Services with pricePer1000Cents=0 or negative
  const zeroPrice = await p.service.count({ where: { pricePer1000Cents: 0, isActive: true } });
  const negPrice = await p.service.count({ where: { pricePer1000Cents: { lt: 0 } } });
  console.log(`Active with pricePer1000Cents=0: ${zeroPrice}`);
  console.log(`Negative pricePer1000Cents: ${negPrice}`);

  // 4. Missing externalId
  const noExtId = await p.service.count({ where: { externalId: null, isActive: true } });
  console.log(`Active with no externalId: ${noExtId}`);

  // 5. Missing provider
  const noProvider = await p.service.count({ where: { providerId: null, isActive: true } });
  console.log(`Active with no provider: ${noProvider}`);

  // 6. Duplicate tier check
  const allActive = await p.service.findMany({
    where: { isActive: true },
    select: { id: true, categoryId: true, features: true, name: true, pricePer1000Cents: true }
  });

  const tierMap = new Map<string, string>();
  let dupes = 0;
  const dupeExamples: string[] = [];
  for (const s of allActive) {
    const tier = (s.features as any)?.tier || 'Стандарт';
    const key = `${s.categoryId}-${tier}`;
    if (tierMap.has(key)) {
      dupes++;
      if (dupes <= 3) dupeExamples.push(`  "${s.name}" vs "${tierMap.get(key)}" (tier=${tier})`);
    } else {
      tierMap.set(key, s.name);
    }
  }
  console.log(`\nDuplicate tier entries: ${dupes}`);
  dupeExamples.forEach(e => console.log(e));

  // 7. Empty categories  
  const emptyCats = await p.category.count({
    where: { services: { none: {} } }
  });
  console.log(`Empty categories: ${emptyCats}`);

  // 8. Price formula consistency
  const settings = await p.systemSettings.findUnique({ where: { id: 'global' } });
  const usdRate = settings?.exchangeRateUSD || 90;
  const sample = await p.service.findMany({
    where: { isActive: true },
    take: 10,
    select: { name: true, rate: true, markup: true, pricePer1000Cents: true }
  });

  console.log(`\nPrice formula check (USD rate=${usdRate}):`);
  let mismatches = 0;
  for (const s of sample) {
    const rawPrice = s.rate * s.markup * usdRate;
    // Beautiful rounding
    const rounded = rawPrice < 1000 ? Math.ceil(rawPrice / 10) * 10 : Math.ceil(rawPrice / 100) * 100;
    const expected = Math.round(rounded * 100);
    const match = Math.abs(s.pricePer1000Cents - expected) < 2;
    if (!match) {
      mismatches++;
      console.log(`  ❌ ${s.name}: stored=${s.pricePer1000Cents} vs calc=${expected} (rate=${s.rate} markup=${s.markup})`);
    }
  }
  if (mismatches === 0) console.log('  ✅ All 10 samples match');

  console.log('\n=== AUDIT COMPLETE ===');
}

audit().catch(console.error).finally(() => p.$disconnect());
