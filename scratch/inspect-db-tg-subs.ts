import { db } from '../src/lib/db';

async function main() {
  const services = await db.service.findMany({
    where: {
      category: {
        name: {
          contains: 'Подписчики'
        },
        network: {
          slug: 'telegram'
        }
      }
    },
    select: {
      id: true,
      numericId: true,
      name: true,
      isActive: true,
      rate: true,
      externalId: true,
      providerId: true,
      provider: {
        select: { name: true }
      },
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
