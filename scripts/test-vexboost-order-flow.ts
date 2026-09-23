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

  // Find the Instagram Saves service (ext ID 991) or update existing
  let service = await db.service.findFirst({
    where: { 
      providerId: provider.id,
      externalId: '991'
    }
  });

  if (!service) {
    // If not found, let's update service to become 991
    const oldService = await db.service.findFirst({
      where: { providerId: provider.id }
    });
    if (oldService) {
      service = await db.service.update({
        where: { id: oldService.id },
        data: {
          externalId: '991',
          name: 'Instagram Сохранения [Быстрый старт]',
          rate: 5.9614,
          pricePer1000Cents: 600, // ~6 RUB
          isActive: true
        }
      });
    }
  }

  if (!service || !service.externalId) {
    console.error("No active service with external ID found for Vexboost!");
    return;
  }

  console.log(`Using service ${service.name} (ExtID: ${service.externalId}) with rate 5.9614 RUB.`);

  const decryptedKey = VaultService.decrypt(provider.apiKey);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pInstance = new UniversalProvider(provider.apiUrl, decryptedKey, provider.metadata as any);

  // Place a real test order on Instagram saves
  const testLink = "https://www.instagram.com/p/C123456789/";
  const qty = 10;

  console.log(`Placing order on Vexboost for service ${service.externalId} with link ${testLink} and qty ${qty}...`);

  try {
    const orderRes = await pInstance.createOrder({
      service: String(service.externalId),
      link: testLink,
      quantity: qty
    });

    console.log("Order placed successfully! Vexboost Order ID:", orderRes.order);

    // Wait 3 seconds and check order status
    console.log("Waiting 3 seconds to check order status...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (!orderRes.order) {
      throw new Error("No order ID returned by Vexboost");
    }

    const statusRes = await pInstance.getOrderStatus(orderRes.order);
    console.log("Vexboost Order Status Response:", statusRes);

  } catch (error) {
    console.error("Failed to place/check order on Vexboost:", error);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
