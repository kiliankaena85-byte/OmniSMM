import { db } from '../src/lib/db';

async function main() {
  const provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!provider) {
    console.error("Vexboost provider not found in DB");
    return;
  }

  console.log("Vexboost Provider Metadata:");
  console.log(JSON.stringify(provider.metadata, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
