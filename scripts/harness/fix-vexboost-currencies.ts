import { db } from '../../src/lib/db';

async function fixVexboostCurrencies() {
  const vexboostProvider = await db.provider.findFirst({
    where: { name: 'Основной Поставщик (API 1)' }
  });

  if (!vexboostProvider) {
    console.error('Vexboost provider not found!');
    return;
  }

  const mismatchedServices = await db.service.findMany({
    where: {
      providerId: vexboostProvider.id,
      providerCurrency: 'USD'
    },
    include: {
      category: true
    }
  });

  console.log(`Found ${mismatchedServices.length} services with providerCurrency = 'USD' under Vexboost (RUB provider).`);

  for (const s of mismatchedServices) {
    console.log(`- [${s.id}] "${s.name}" | Rate: ${s.rate} RUB (was erroneously marked as USD)`);
  }

  const result = await db.service.updateMany({
    where: {
      providerId: vexboostProvider.id,
      providerCurrency: 'USD'
    },
    data: {
      providerCurrency: 'RUB'
    }
  });

  console.log(`\n✅ Successfully updated ${result.count} services to providerCurrency = 'RUB'!`);
}

fixVexboostCurrencies().finally(() => db.$disconnect());
