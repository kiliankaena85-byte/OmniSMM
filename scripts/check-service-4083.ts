import { db } from '../src/lib/db';

async function main() {
  const service = await db.service.findFirst({
    where: {
      numericId: 4083
    },
    select: {
      id: true,
      numericId: true,
      name: true,
      rate: true,
      markup: true,
      pricePer1000Cents: true,
      externalId: true,
      categoryId: true,
      category: {
        select: { name: true }
      }
    }
  });
  console.log(JSON.stringify(service, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
