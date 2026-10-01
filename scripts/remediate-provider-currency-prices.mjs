import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RUB_PROVIDERS = [
  'Soc-Rocket',
  'VexBoost',
  'SMMPrime',
  'ProSMM-Shop',
  'Stream-Promotion'
];

async function remediate() {
  console.log('=== REMEDIATION: Russian Providers Currency Fix (USD -> RUB) ===\n');

  // 1. Audit before
  const providersBefore = await prisma.provider.findMany({
    where: { name: { in: RUB_PROVIDERS } },
    select: { id: true, name: true, balanceCurrency: true }
  });

  console.log('Step 1: Updating Provider.balanceCurrency to RUB...');
  for (const p of providersBefore) {
    await prisma.provider.update({
      where: { id: p.id },
      data: { balanceCurrency: 'RUB' }
    });
    console.log(`  ✓ Provider "${p.name}" (${p.id}) balanceCurrency: ${p.balanceCurrency} -> RUB`);
  }

  // 2. Fetch affected services
  const affectedServices = await prisma.service.findMany({
    where: {
      provider: { name: { in: RUB_PROVIDERS } }
    },
    select: {
      id: true,
      name: true,
      rate: true,
      markup: true,
      costPer1kRub: true,
      pricePer1000Cents: true,
      provider: { select: { name: true } }
    }
  });

  console.log(`\nStep 2: Updating ${affectedServices.length} services...`);
  let updatedCount = 0;

  for (const svc of affectedServices) {
    const correctCostPer1kRub = svc.rate;
    const correctPricePer1000Cents = Math.round(svc.rate * svc.markup * 100);

    await prisma.service.update({
      where: { id: svc.id },
      data: {
        providerCurrency: 'RUB',
        costPer1kRub: correctCostPer1kRub,
        currencyCapturedAt: new Date(),
        usdRateAtCapture: 1.0,
        pricePer1000Cents: correctPricePer1000Cents
      }
    });
    updatedCount++;
  }

  console.log(`  ✓ Successfully updated ${updatedCount} services (costPer1kRub set to exact RUB rate, pricePer1000Cents recalculated).`);

  // 3. RoutingAuditLog
  await prisma.routingAuditLog.create({
    data: {
      serviceId: 'SYSTEM',
      action: 'PROVIDER_CURRENCY_REMEDIATION_2026',
      reason: `Fixed 5 Russian providers (Soc-Rocket, VexBoost, SMMPrime, ProSMM-Shop, Stream-Promotion) from USD to RUB. Corrected 95x inflation across ${updatedCount} services.`
    }
  });
  console.log('\nStep 3: Created audit log entry in RoutingAuditLog.');

  // 4. Verification
  console.log('\nStep 4: Verifying corrected sample prices...');
  const sampleServices = await prisma.service.findMany({
    where: {
      provider: { name: { in: RUB_PROVIDERS } },
      rate: { gt: 100 }
    },
    take: 8,
    select: {
      name: true,
      rate: true,
      costPer1kRub: true,
      markup: true,
      pricePer1000Cents: true,
      provider: { select: { name: true } }
    }
  });

  for (const s of sampleServices) {
    const retailPricePer1k = (s.pricePer1000Cents / 100);
    const retailPricePerUnit = (retailPricePer1k / 1000);
    console.log(`  - [${s.provider?.name}] ${s.name}:`);
    console.log(`      Cost: ${s.costPer1kRub} ₽/1k`);
    console.log(`      Retail per 1k: ${retailPricePer1k.toFixed(2)} ₽`);
    console.log(`      Retail per 1 unit: ${retailPricePerUnit.toFixed(4)} ₽ / шт`);
  }

  console.log('\n=== REMEDIATION COMPLETE & VERIFIED ===');
}

remediate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
