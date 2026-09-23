import { db } from '../src/lib/db';

async function main() {
  const entries = await db.ledgerEntry.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(entries, null, 2));
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
