import { db } from '../src/lib/db';

async function main() {
  const service = await db.service.findFirst({
    where: {
      name: { contains: 'Telegram Подписчики (Эконом)' }
    },
    select: {
      id: true,
      name: true,
      minQty: true,
      maxQty: true,
      rate: true,
      markup: true,
      pricePer1000Cents: true,
      externalId: true,
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
