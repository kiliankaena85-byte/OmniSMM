import { db } from '../src/lib/db';

async function main() {
  const services = await db.service.findMany({
    where: {
      category: {
        network: {
          slug: 'telegram'
        }
      },
      isActive: true
    },
    select: {
      id: true,
      name: true,
      minQty: true,
      externalId: true,
      rate: true,
      category: {
        select: { name: true }
      }
    }
  });
  console.log(JSON.stringify(services, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
