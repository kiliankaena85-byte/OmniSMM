import { db } from '../src/lib/db';

async function main() {
  const settings = await db.systemSettings.findMany({
    select: { id: true, isTestMode: true, siteName: true }
  });
  console.log('SystemSettings in DB:', settings);
  await db.$disconnect();
}

main().catch(console.error);
