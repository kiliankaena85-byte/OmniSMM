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
  console.log("Decrypted Key from DB:", decryptedKey);

  try {
    const pInstance = new UniversalProvider(provider.apiUrl, decryptedKey, provider.metadata as any);
    const balanceInfo = await pInstance.getBalance();
    console.log("Vexboost provider balance info successfully fetched:", balanceInfo);
  } catch (error) {
    console.error("Failed to fetch balance:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
