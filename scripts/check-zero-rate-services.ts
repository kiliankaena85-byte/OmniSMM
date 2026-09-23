import { db } from '../src/lib/db';

async function main() {
  console.log('Zero Rate Services:');
  const services = await db.service.findMany({
    where: {
      rate: 0,
      isActive: true
    },
    select: {
      id: true,
      numericId: true,
      name: true,
      rate: true,
      markup: true,
      pricePer1000Cents: true,
      externalId: true,
      category: {
        select: {
          name: true,
          network: {
            select: { name: true }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(services, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
