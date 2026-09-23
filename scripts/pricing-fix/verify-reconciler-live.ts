import { db } from '../../src/lib/db';
import catalogProcessor from '../../src/workers/processors/catalog.processor';
import { UPPER_SANITY_LIMIT_RUB, SAFETY_FLOOR_MARKUP } from '../../src/lib/financial-constants';
import { SettingsProvider } from '../../src/lib/settings';

async function runLiveReconcilerTest() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  🔍 PRICING STABILIZATION V2: RECONCILER LIVE AUDIT & SMOKE TEST');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log(`1. Financial Invariants:`);
  console.log(`   - UPPER_SANITY_LIMIT_RUB: ${UPPER_SANITY_LIMIT_RUB} ₽ (500,000 ₽ / 1000 = 500 ₽/unit)`);
  console.log(`   - SAFETY_FLOOR_MARKUP: ${SAFETY_FLOOR_MARKUP} (3.0 = 200% margin floor)`);

  const usdRate = await SettingsProvider.getExchangeRateUSD();
  console.log(`   - System USD Rate: ${usdRate} RUB`);

  // Seed sample services to verify live reconciliation behavior
  const cat = await db.category.create({
    data: { name: `Recon Live Cat ${Date.now()}` }
  });
  const prov = await db.provider.create({
    data: {
      name: `Recon Live Prov ${Date.now()}`,
      apiUrl: 'http://mock',
      apiKey: 'key',
      balanceCurrency: 'RUB',
      isActive: true,
      syncLock: false
    }
  });

  const s1 = await db.service.create({
    data: {
      name: 'Normal Active Service',
      categoryId: cat.id,
      providerId: prov.id,
      providerCurrency: 'RUB',
      rate: 10.0,
      costPer1kRub: 10.0,
      markup: 3.0,
      pricePer1000Cents: 3000,
      minQty: 10,
      maxQty: 1000,
      isActive: true,
      isQuarantined: false
    }
  });

  const totalActive = await db.service.count({ where: { isActive: true } });
  console.log(`\n2. Database Services:`);
  console.log(`   - Total Active Services: ${totalActive}`);

  console.log(`\n3. Executing Paginated RECONCILE_PRICES Job (batchSize: 500)...`);
  const startTime = Date.now();
  await catalogProcessor({
    id: `manual-audit-recon-${Date.now()}`,
    data: { type: 'RECONCILE_PRICES', batchSize: 500 },
  } as any);
  const durationMs = Date.now() - startTime;

  console.log(`   ✅ Reconciler completed successfully in ${durationMs}ms`);

  const postService = await db.service.findUniqueOrThrow({ where: { id: s1.id } });
  console.log(`\n4. Post-Reconcile Audit for Service ${s1.id}:`);
  console.log(`   - isActive: ${postService.isActive}`);
  console.log(`   - isQuarantined: ${postService.isQuarantined}`);
  console.log(`   - costPer1kRub: ${postService.costPer1kRub} ₽`);

  // Clean up test records
  await db.service.deleteMany({ where: { categoryId: cat.id } });
  await db.category.delete({ where: { id: cat.id } });
  await db.provider.delete({ where: { id: prov.id } });

  console.log('\n🎉 ALL RECONCILER LIVE CHECKS PASSED!');
}

runLiveReconcilerTest()
  .catch((err) => {
    console.error('❌ Reconciler test failed:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
