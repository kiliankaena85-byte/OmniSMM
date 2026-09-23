import { db } from '../src/lib/db';
import { encrypt } from '../src/lib/crypto/encryption';
import { UniversalProvider } from '../src/services/providers/universal.provider';

async function main() {
  const envApiKey = process.env.VEXBOOST_API_KEY;
  if (!envApiKey) {
    console.error("VEXBOOST_API_KEY is not defined in environment variables.");
    return;
  }

  const provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!provider) {
    console.error("Vexboost provider not found in DB");
    return;
  }

  // Encrypt the env API Key
  const encryptedKey = encrypt(envApiKey);

  // Update in DB
  await db.provider.update({
    where: { id: provider.id },
    data: {
      apiKey: encryptedKey,
      apiUrl: 'https://vexboost.ru/api/v2' // Correct URL without trailing slash
    }
  });

  console.log("Successfully updated Vexboost API credentials in DB!");
  console.log("Encrypted key stored:", encryptedKey);

  // Verification: try to fetch balance
  try {
    const pInstance = new UniversalProvider('https://vexboost.ru/api/v2', envApiKey, provider.metadata as any);
    const balanceInfo = await pInstance.getBalance();
    console.log("Vexboost actual production balance:", balanceInfo);
  } catch (error) {
    console.error("Failed to fetch balance from Vexboost after update:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
