import { db } from '../src/lib/db';

async function main() {
  const order = await db.order.findFirst({
    where: {
      OR: [
        { numericId: 95 },
        { id: { contains: '95' } }
      ]
    },
    include: {
      service: {
        include: {
          provider: true
        }
      },
      user: true
    }
  });

  console.log('ORDER DETAILS:', JSON.stringify(order, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2));

  const providers = await db.provider.findMany({
    select: {
      id: true,
      name: true,
      apiUrl: true,
      apiKey: true,
      status: true,
      balance: true,
      balanceCurrency: true,
      type: true
    }
  });

  console.log('ALL PROVIDERS IN DB:', JSON.stringify(providers, null, 2));

  await db.$disconnect();
}

main().catch(console.error);
