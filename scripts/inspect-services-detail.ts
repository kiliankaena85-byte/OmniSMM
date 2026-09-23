import { db } from '../src/lib/db';

async function main() {
  const services = await db.service.findMany({
    select: {
      id: true,
      name: true,
      externalId: true,
      rate: true,
      minQty: true,
      maxQty: true,
      isActive: true,
      tenantId: true,
      category: {
        select: {
          name: true,
          slug: true,
          network: { select: { name: true, slug: true } }
        }
      }
    }
  });

  console.log(`Found ${services.length} services:`);
  for (const s of services) {
    console.log(`- [${s.category?.network?.name || 'NO_NET'} > ${s.category?.name || 'NO_CAT'}] ${s.name} (ext: ${s.externalId}, rate: ${s.rate} RUB, active: ${s.isActive}, tenant: ${s.tenantId})`);
  }
}

main().finally(() => db.$disconnect());
