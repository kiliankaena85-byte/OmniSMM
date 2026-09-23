import { db } from '../src/lib/db';

async function main() {
  const provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!provider) {
    console.error("Vexboost provider not found in DB");
    return;
  }

  const services = await db.service.findMany({
    where: { providerId: provider.id }
  });

  console.log(`Found ${services.length} services for Vexboost in DB.`);
  for (const s of services.slice(0, 10)) {
    console.log(`ID: ${s.id}, Name: ${s.name}, ExtID: ${s.externalId}, Price/1k: ${s.pricePer1000Cents / 100} RUB, Active: ${s.isActive}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
