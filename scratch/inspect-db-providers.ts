import { db } from '../src/lib/db';

async function main() {
  const providers = await db.provider.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      apiUrl: true,
      balanceCurrency: true
    }
  });
  console.log(JSON.stringify(providers, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
