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
  console.log("Raw Key in DB:", provider.apiKey);
  console.log("Decrypted Key:", decryptedKey);
  console.log("API URL:", provider.apiUrl);

  try {
    // Attempt request using decrypted key
    const pInstance = new UniversalProvider(provider.apiUrl, decryptedKey || provider.apiKey, provider.metadata as any);
    const balanceInfo = await pInstance.getBalance();
    console.log("Vexboost balance response:", balanceInfo);
  } catch (error) {
    console.error("Failed to fetch balance from Vexboost:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
