import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';

export {};

async function main() {
  const provider = await db.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!provider) {
    console.error("Vexboost provider not found in DB");
    return;
  }

  const orderId = "265042659";
  console.log(`Checking status of Vexboost order: ${orderId}...`);

  const decryptedKey = VaultService.decrypt(provider.apiKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pInstance = new UniversalProvider(provider.apiUrl, decryptedKey, provider.metadata as any);

  try {
    const statusRes = await pInstance.getOrderStatus(orderId);
    console.log("==================================================");
    console.log("Vexboost Order Status Response:", statusRes);
    console.log("==================================================");
  } catch (err) {
    console.error("Failed to check order status:", err);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
