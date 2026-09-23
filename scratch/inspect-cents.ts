import { db } from '../src/lib/db';

async function main() {
  const services = await db.service.findMany({
    where: {
      numericId: { in: [4084, 4085, 4086] }
    },
    select: {
      numericId: true,
      name: true,
      rate: true,
      markup: true,
      pricePer1000Cents: true
    }
  });
  console.log(JSON.stringify(services, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
