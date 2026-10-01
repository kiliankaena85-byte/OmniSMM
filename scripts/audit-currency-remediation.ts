import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RUB_PROVIDERS = [
  'Soc-Rocket',
  'VexBoost',
  'SMMPrime',
  'ProSMM-Shop',
  'Stream-Promotion'
];

async function main() {
  console.log('=== DRY RUN: Provider Currency & Price Audit ===');
  
  const providers = await prisma.provider.findMany({
    where: { name: { in: RUB_PROVIDERS } },
    select: { id: true, name: true, balanceCurrency: true }
  });

  console.log(`Found ${providers.length} RUB providers to audit:`);
  for (const p of providers) {
    const serviceCount = await prisma.service.count({
      where: { providerId: p.id }
    });
    console.log(`  - ${p.name} (id: ${p.id}): current balanceCurrency = '${p.balanceCurrency}', services: ${serviceCount}`);
  }

  // Sample high rate services
  const sampleServices = await prisma.service.findMany({
    where: {
      provider: { name: { in: RUB_PROVIDERS } },
      rate: { gt: 100 }
    },
    take: 5,
    select: {
      id: true,
      name: true,
      rate: true,
      providerCurrency: true,
      costPer1kRub: true,
      markup: true,
      pricePer1000Cents: true,
      provider: { select: { name: true } }
    }
  });

  console.log('\nSample inflated services:');
  for (const s of sampleServices) {
    const currentPricePerUnit = ((s.costPer1kRub || (s.rate * 95)) * s.markup) / 1000;
    const correctedCostPer1k = s.rate;
    const correctedPricePerUnit = (correctedCostPer1k * s.markup) / 1000;
    console.log(`  - [${s.provider?.name}] ${s.name}:`);
    console.log(`      Raw rate: ${s.rate}`);
    console.log(`      Current cost in DB: ${s.costPer1kRub} RUB (Price per 1: ~${currentPricePerUnit.toFixed(2)} ₽)`);
    console.log(`      Correct cost: ${correctedCostPer1k} RUB (Price per 1: ~${correctedPricePerUnit.toFixed(2)} ₽)`);
    console.log(`      Inflation: ${(currentPricePerUnit / correctedPricePerUnit).toFixed(1)}x`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
