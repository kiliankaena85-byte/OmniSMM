import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== Top 15 Most Expensive Services in DB (Sanity Check) ===');
  const services = await prisma.service.findMany({
    where: { isActive: true },
    take: 15,
    orderBy: { pricePer1000Cents: 'desc' },
    select: {
      name: true,
      rate: true,
      costPer1kRub: true,
      pricePer1000Cents: true,
      providerCurrency: true,
      provider: { select: { name: true } },
      category: { select: { name: true, network: { select: { name: true } } } }
    }
  });

  for (const s of services) {
    const retailPer1k = s.pricePer1000Cents / 100;
    const retailPerUnit = retailPer1k / 1000;
    console.log(`  [${s.category?.network?.name || 'N/A'} > ${s.category?.name || 'N/A'}] ${s.name} (${s.provider?.name}): Rate=${s.rate} ${s.providerCurrency}, Cost=${s.costPer1kRub} RUB -> Retail=${retailPer1k.toFixed(2)} ₽/1k (${retailPerUnit.toFixed(4)} ₽ / шт)`);
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
