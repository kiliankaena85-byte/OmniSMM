import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

async function main() {
  const providers = await db.provider.findMany({
    select: {
      id: true,
      name: true,
      apiUrl: true,
      apiKey: true,
      isActive: true,
      providerType: true,
      metadata: true,
      _count: { select: { services: true } }
    }
  });

  console.log('Providers in DB:');
  for (const p of providers) {
    let decryptedKey = '';
    try {
      decryptedKey = VaultService.decrypt(p.apiKey);
    } catch {
      decryptedKey = p.apiKey;
    }
    console.log(`- [${p.id}] ${p.name} | URL: ${p.apiUrl} | Active: ${p.isActive} | Services: ${p._count.services} | Key: ${decryptedKey ? decryptedKey.substring(0, 8) + '...' : 'NONE'}`);
  }

  const serviceCount = await db.service.count();
  const categoryCount = await db.category.count();
  const networkCount = await db.network.count();
  console.log(`\nTotals: ${networkCount} Networks, ${categoryCount} Categories, ${serviceCount} Services`);
}

main().finally(() => db.$disconnect());
