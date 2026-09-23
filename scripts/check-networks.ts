import { db } from '../src/lib/db';

async function main() {
  const networks = await db.network.findMany({
    select: { id: true, name: true, slug: true, icon: true, isActive: true }
  });
  console.log('Networks in DB:', JSON.stringify(networks, null, 2));
}

main().finally(() => db.$disconnect());
