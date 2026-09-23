import { db } from '../src/lib/db';

async function main() {
  console.log('Recent Payments:');
  const payments = await db.payment.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(payments, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
