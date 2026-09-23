import { db } from '../src/lib/db';

async function main() {
  console.log('--- 1. Checking DB Provider & Services ---');
  const vexboostProvider = await db.provider.findFirst({
    where: { name: { contains: 'Vexboost', mode: 'insensitive' } },
    include: {
      services: {
        where: { isActive: true },
        select: {
          id: true,
          numericId: true,
          name: true,
          minQty: true,
          maxQty: true,
          externalId: true,
          targetType: true,
          rate: true,
          markup: true,
          category: { select: { name: true } }
        },
        take: 5
      }
    }
  });

  if (!vexboostProvider) {
    console.log('Vexboost provider not found!');
  } else {
    console.log(`Found Provider: ${vexboostProvider.name} (API URL: ${vexboostProvider.apiUrl})`);
    console.log('Active Services from this provider:');
    console.log(JSON.stringify(vexboostProvider.services, null, 2));
  }

  console.log('--- 2. Checking Local Server http://localhost:3000 ---');
  try {
    const res = await fetch('http://localhost:3000', { signal: AbortSignal.timeout(3000) });
    console.log(`Server responded with status: ${res.status} ${res.statusText}`);
  } catch (err: any) {
    console.log(`Server not reachable at http://localhost:3000: ${err.message}`);
  }
}

main().finally(async () => {
  await db.$disconnect();
});
