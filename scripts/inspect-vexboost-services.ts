import { db } from '../src/lib/db';

async function main() {
  const vexProvider = await db.provider.findFirst({
    where: { apiUrl: { contains: 'vexboost' } }
  });

  if (!vexProvider) {
    console.error("Vexboost provider not found in DB");
    return;
  }

  const services = await db.service.findMany({
    where: { providerId: vexProvider.id },
    include: {
      category: {
        include: {
          network: true
        }
      }
    }
  });

  console.log(`Found ${services.length} services in DB linked to Vexboost (${vexProvider.name})`);
  for (const s of services.slice(0, 15)) {
    console.log({
      id: s.id,
      name: s.name,
      network: s.category?.network?.name,
      category: s.category?.name,
      externalId: s.externalId,
      rate: s.rate,
      pricePerUnitRub: s.pricePerUnitRub,
      minQty: s.minQty,
      maxQty: s.maxQty,
      isActive: s.isActive
    });
  }
}

main().finally(() => db.$disconnect());
