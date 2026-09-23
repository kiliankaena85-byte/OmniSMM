import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  const provider = await db.provider.findFirst({
    where: { apiUrl: { contains: 'vexboost' } }
  });

  if (!provider) {
    console.error("Vexboost provider not found");
    return;
  }

  const apiKey = VaultService.decrypt(provider.apiKey);
  const res = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ key: apiKey, action: 'services' })
  });
  const liveServices: any[] = await res.json();

  console.log(`Live Vexboost services count: ${liveServices.length}`);

  // Find cheapest Telegram views & reactions
  const tgViewsAndReactions = liveServices
    .filter(s => 
      (s.name.toLowerCase().includes('просмотр') || 
       s.name.toLowerCase().includes('реакц') || 
       s.name.toLowerCase().includes('сохран') ||
       s.category.toLowerCase().includes('telegram') ||
       s.category.toLowerCase().includes('instagram') ||
       s.category.toLowerCase().includes('vk')) &&
      parseFloat(s.rate) < 20
    )
    .sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));

  console.log("\nTop 15 cheapest active live services from Vexboost:");
  for (const s of tgViewsAndReactions.slice(0, 15)) {
    console.log(`- Service ID: ${s.service} | "${s.name}" | Cat: "${s.category}" | Rate: ${s.rate} RUB/1k | Min: ${s.min} | Max: ${s.max} | Type: ${s.type}`);
  }
}

main().finally(() => db.$disconnect());
