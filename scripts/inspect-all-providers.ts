import { db } from '../src/lib/db';

async function main() {
  const providers = await db.provider.findMany();
  console.log(`Total providers in DB: ${providers.length}`);
  for (const p of providers) {
    console.log({
      id: p.id,
      name: p.name,
      slug: p.slug,
      apiUrl: p.apiUrl,
      isActive: p.isActive,
      balance: p.balance,
      currency: p.currency,
      hasKey: !!p.apiKey,
    });
  }
}

main().finally(() => db.$disconnect());
