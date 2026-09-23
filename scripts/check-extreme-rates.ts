import { db } from '../src/lib/db';

async function checkAnomalousServices() {
  console.log('=== SERVICES WITH EXTREME RATES (rate > 5000) ===');
  const extremeServices = await db.service.findMany({
    where: { rate: { gte: 5000 } },
    include: {
      category: {
        include: { network: true }
      },
      provider: true
    }
  });

  console.log(`Found ${extremeServices.length} services with rate >= 5000:`);
  for (const s of extremeServices) {
    console.log(`[${s.id}] [${s.category?.network?.name} -> ${s.category?.name}] "${s.name}"`);
    console.log(`   rate: ${s.rate}, currency: ${s.providerCurrency}, markup: ${s.markup}, provider: ${s.provider?.name || s.providerId}, externalId: ${s.externalId}`);
  }
}

checkAnomalousServices()
  .catch(console.error)
  .finally(() => db.$disconnect());
