import { db } from "../src/lib/db";

async function main() {
  console.log("Inspecting all providers in DB...");
  const providers = await db.provider.findMany();
  console.log(`Found ${providers.length} providers total:`);
  for (const p of providers) {
    console.log(`- ID: ${p.id} | Name: ${p.name} | Active: ${p.isActive} | URL: ${p.apiUrl} | Currency: ${p.balanceCurrency}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
