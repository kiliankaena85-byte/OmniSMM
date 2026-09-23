import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';

async function main() {
  const provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!provider) {
    console.error("Vexboost provider not found in DB");
    return;
  }

  const decryptedKey = VaultService.decrypt(provider.apiKey);
  const pInstance = new UniversalProvider(provider.apiUrl, decryptedKey, provider.metadata as any);

  try {
    const services = await pInstance.getServices();
    console.log(`Fetched ${services.length} services from Vexboost API.`);
    // Print first 10 services with price/min/max
    for (const s of services.slice(0, 10)) {
      console.log(`ID: ${s.service}, Name: ${s.name}, Category: ${s.category}, Rate: ${s.rate}, Min: ${s.min}, Max: ${s.max}`);
    }
  } catch (error) {
    console.error("Failed to fetch Vexboost catalog:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
