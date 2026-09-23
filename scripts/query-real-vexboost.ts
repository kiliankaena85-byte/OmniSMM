import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  const provider = await db.provider.findFirst({
    where: { apiUrl: { contains: 'vexboost' } }
  });

  if (!provider) {
    console.error("Vexboost provider not found by apiUrl!");
    return;
  }

  console.log("Found Vexboost Provider in DB:", {
    id: provider.id,
    name: provider.name,
    apiUrl: provider.apiUrl,
    isActive: provider.isActive,
  });

  let apiKey = '';
  try {
    apiKey = VaultService.decrypt(provider.apiKey);
  } catch (err) {
    console.log("Decryption failed, using raw key", err);
    apiKey = provider.apiKey;
  }

  console.log("Querying balance from Vexboost API...");
  const balanceRes = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: apiKey, action: 'balance' })
  });

  const balanceData = await balanceRes.json();
  console.log("Vexboost Balance Response:", balanceData);

  console.log("\nQuerying active services from Vexboost API...");
  const servicesRes = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: apiKey, action: 'services' })
  });

  const servicesData = await servicesRes.json();
  if (Array.isArray(servicesData)) {
    console.log(`Fetched ${servicesData.length} live services from Vexboost!`);
    console.log("\nFirst 10 live services sample:");
    for (const s of servicesData.slice(0, 10)) {
      console.log(`Service ID: ${s.service}, Name: "${s.name}", Category: "${s.category}", Rate: ${s.rate} ${s.currency || 'RUB'}, Min: ${s.min}, Max: ${s.max}`);
    }
  } else {
    console.log("Services response error:", servicesData);
  }
}

main().finally(() => db.$disconnect());
