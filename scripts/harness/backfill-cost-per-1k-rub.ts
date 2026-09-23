import { db } from '../../src/lib/db';
import { buildCurrencySnapshot } from '../../src/lib/pricing/currency-invariant';

async function backfillAllServices() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  💰 BACKFILLING IMMUTABLE BASE COST (costPer1kRub) FOR SERVICES');
  console.log('════════════════════════════════════════════════════════════════\n');

  const services = await db.service.findMany({
    select: {
      id: true,
      name: true,
      rate: true,
      providerCurrency: true,
      costPer1kRub: true,
      markup: true,
      provider: {
        select: {
          name: true,
          balanceCurrency: true
        }
      }
    }
  });

  console.log(`Found ${services.length} total services to check & backfill.`);
  let updatedCount = 0;

  for (const s of services) {
    const currency = s.providerCurrency || s.provider?.balanceCurrency || 'USD';
    const snapshot = await buildCurrencySnapshot(s.rate, currency);

    await db.service.update({
      where: { id: s.id },
      data: {
        providerCurrency: snapshot.currency,
        costPer1kRub: snapshot.costPer1kRub,
        currencyCapturedAt: snapshot.capturedAt,
        usdRateAtCapture: snapshot.usdRateAtCapture,
        pricePer1000Cents: Math.round(snapshot.costPer1kRub * s.markup * 100)
      }
    });

    updatedCount++;
  }

  console.log(`\n✅ Successfully backfilled ${updatedCount} / ${services.length} services.`);
  
  // Verification check: any service with null costPer1kRub?
  const nullCount = await db.service.count({
    where: {
      isActive: true,
      costPer1kRub: null
    }
  });

  console.log(`🔎 Verification: Active services with null costPer1kRub = ${nullCount}`);
  if (nullCount === 0) {
    console.log('🎉 ZERO GAPS: All active services have immutable base cost!');
  } else {
    console.warn(`⚠️ Warning: ${nullCount} services still lack costPer1kRub!`);
  }
}

backfillAllServices()
  .catch(console.error)
  .finally(() => db.$disconnect());
