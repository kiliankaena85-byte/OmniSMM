import { db } from '../src/lib/db';

async function main() {
  console.log('Active Services:');
  const services = await db.service.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      minQty: true,
      maxQty: true,
      externalId: true,
      rate: true,
      category: {
        select: { name: true }
      }
    },
    take: 10
  });
  console.log(JSON.stringify(services, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
