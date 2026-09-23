import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';

const PROVIDERS = [
  {
    name: 'Vexboost',
    slug: 'vexboost',
    apiUrl: 'https://vexboost.ru/api/v2/',
    apiKey: process.env.PROVIDER_KEY_VEXBOOST || '',
  },
  {
    name: 'Soc-Proof',
    slug: 'soc-proof',
    apiUrl: 'https://soc-proof.su/api/v2/',
    apiKey: process.env.PROVIDER_KEY_SOC_PROOF || '',
  },
  {
    name: 'Stream-Promotion',
    slug: 'stream-promotion',
    apiUrl: 'https://stream-promotion.ru/api/v2/',
    apiKey: process.env.PROVIDER_KEY_STREAM_PROMOTION || '',
  },
  {
    name: 'SMMPrime',
    slug: 'smmprime',
    apiUrl: 'https://smmprime.com/api/v2/',
    apiKey: process.env.PROVIDER_KEY_SMMPRIME || '',
  },
  {
    name: 'SMMPanelUS',
    slug: 'smmpanelus',
    apiUrl: 'https://smmpanelus.com/api/v2/',
    apiKey: process.env.PROVIDER_KEY_SMMPANELUS || '',
  },
  {
    name: 'Telegram.Shop',
    slug: 'telegram-shop',
    apiUrl: 'https://telegram.shop/api/v2/',
    apiKey: process.env.PROVIDER_KEY_TELEGRAM_SHOP || '',
  },
];

async function main() {
  console.log('=== FORCED SMM PROVIDERS REGISTRATION ===\n');

  for (const cfg of PROVIDERS) {
    if (!cfg.apiKey) {
      console.log(`⚠️ Processing ${cfg.name} SKIPPED (Missing environment API key)`);
      continue;
    }
    console.log(`Processing ${cfg.name}...`);
    
    // Encrypt the API key securely
    const encryptedKey = VaultService.encrypt(cfg.apiKey);
    
    // Upsert the provider in the database
    const existing = await db.provider.findFirst({
      where: { name: cfg.name },
    });
    
    if (existing) {
      const updated = await db.provider.update({
        where: { id: existing.id },
        data: {
          apiUrl: cfg.apiUrl,
          apiKey: encryptedKey,
          isActive: true,
          providerType: 'SMM_PANEL',
          balanceCurrency: 'USD',
          metadata: { slug: cfg.slug },
        },
      });
      console.log(`  🔄 Updated provider: ${cfg.name} (id: ${updated.id})`);
    } else {
      const created = await db.provider.create({
        data: {
          name: cfg.name,
          apiUrl: cfg.apiUrl,
          apiKey: encryptedKey,
          isActive: true,
          providerType: 'SMM_PANEL',
          balanceCurrency: 'USD',
          metadata: { slug: cfg.slug },
        },
      });
      console.log(`  ✅ Registered new provider: ${cfg.name} (id: ${created.id})`);
    }
  }

  // Deactivate other providers that are not in the curated catalog to avoid confusion
  const registeredNames = PROVIDERS.map(p => p.name);
  const deactivated = await db.provider.updateMany({
    where: {
      name: { notIn: registeredNames },
    },
    data: {
      isActive: false,
    },
  });
  console.log(`\n💤 Deactivated ${deactivated.count} unused providers.`);

  console.log('\n=== All Registered Active Providers ===');
  const allProviders = await db.provider.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  for (const p of allProviders) {
    console.log(`  🟢 ${p.name} — ${p.apiUrl}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
