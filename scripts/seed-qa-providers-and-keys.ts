import { PrismaClient } from '@prisma/client';
import { VaultService } from '../src/lib/vault';

const prisma = new PrismaClient();

const providersData = [
  {
    name: 'Soc-Rocket',
    apiUrl: 'https://soc-rocket.ru/api/v2',
    apiKey: process.env.SOC_ROCKET_API_KEY || 'test_soc_rocket_key_placeholder',
    balanceCurrency: 'RUB',
    isActive: true,
  },
  {
    name: 'SMM Prime',
    apiUrl: 'https://smmprime.com/api/v2',
    apiKey: process.env.SMM_PRIME_API_KEY || 'test_smm_prime_key_placeholder',
    balanceCurrency: 'USD',
    isActive: true,
  },
  {
    name: 'Stream-Promotion',
    apiUrl: 'https://stream-promotion.ru/api/v2',
    apiKey: process.env.STREAM_PROMOTION_API_KEY || 'test_stream_promotion_key_placeholder',
    balanceCurrency: 'RUB',
    isActive: true,
  },
  {
    name: 'Likedrom',
    apiUrl: 'https://likedrom.com/api/v2',
    apiKey: process.env.LIKEDROM_API_KEY || 'test_likedrom_key_placeholder',
    balanceCurrency: 'RUB',
    isActive: true,
  },
  {
    name: 'SMMPanelUS',
    apiUrl: 'https://smmpanelus.com/api/v2',
    apiKey: process.env.SMMPANELUS_API_KEY || 'test_smmpanelus_key_placeholder',
    balanceCurrency: 'USD',
    isActive: true,
  },
  {
    name: 'Soc-Proof',
    apiUrl: 'https://soc-proof.su/api/v2',
    apiKey: process.env.SOC_PROOF_API_KEY || 'test_soc_proof_key_placeholder',
    balanceCurrency: 'RUB',
    isActive: true,
  },
  {
    name: 'Telegram Shop',
    apiUrl: 'https://telegram.shop/api/v2',
    apiKey: process.env.TELEGRAM_SHOP_API_KEY || 'test_telegram_shop_key_placeholder',
    balanceCurrency: 'USD',
    isActive: true,
  },
  {
    name: 'VexBoost',
    apiUrl: 'https://vexboost.ru/api/v2',
    apiKey: process.env.VEXBOOST_API_KEY || 'test_vexboost_key_placeholder',
    balanceCurrency: 'RUB',
    isActive: true,
  },
];

async function main() {
  console.log('🚀 Seeding QA Providers and Payment Settings into PostgreSQL...');

  const isProd = process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'test';
  const missingKeys = providersData.filter(p => !process.env[`${p.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`]);

  if (isProd && missingKeys.length > 0) {
    throw new Error(
      `[CRITICAL] Production seeding aborted: Missing API keys in environment for: ${missingKeys.map(k => k.name).join(', ')}`
    );
  }

  if (missingKeys.length > 0) {
    console.warn(`⚠️ [DEV/TEST] Using encrypted placeholder keys for ${missingKeys.length} providers (set env vars for live testing)`);
  }

  // 1. Providers
  for (const prov of providersData) {
    const encryptedKey = VaultService.encrypt(prov.apiKey);
    const existing = await prisma.provider.findFirst({
      where: {
        OR: [{ name: prov.name }, { apiUrl: prov.apiUrl }],
      },
    });

    if (existing) {
      await prisma.provider.update({
        where: { id: existing.id },
        data: {
          name: prov.name,
          apiUrl: prov.apiUrl,
          apiKey: encryptedKey,
          balanceCurrency: prov.balanceCurrency,
          isActive: true,
        },
      });
      console.log(`✅ Updated provider: ${prov.name}`);
    } else {
      await prisma.provider.create({
        data: {
          name: prov.name,
          apiUrl: prov.apiUrl,
          apiKey: encryptedKey,
          balanceCurrency: prov.balanceCurrency,
          isActive: true,
        },
      });
      console.log(`✨ Created provider: ${prov.name}`);
    }
  }

  // 2. SystemSettings (YooKassa test keys)
  const yookassaShopId = process.env.YOOKASSA_SHOP_ID || process.env.YOOKASSA_TEST_SHOP_ID || 'test_shop_id';
  const yookassaSecret = process.env.YOOKASSA_SECRET_KEY || process.env.YOOKASSA_TEST_SECRET_KEY || 'test_secret_key_placeholder';
  const encryptedYookassaSecret = VaultService.encrypt(yookassaSecret);

  const settings = await prisma.systemSettings.findFirst();
  if (settings) {
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: {
        yookassaShopId: yookassaShopId,
        yookassaSecretKey: encryptedYookassaSecret,
        yookassaTestShopId: yookassaShopId,
        yookassaTestSecretKey: encryptedYookassaSecret,
      },
    });
    console.log('✅ Updated SystemSettings with YooKassa test credentials');
  } else {
    await prisma.systemSettings.create({
      data: {
        siteName: 'SMMplan',
        yookassaShopId: yookassaShopId,
        yookassaSecretKey: encryptedYookassaSecret,
        yookassaTestShopId: yookassaShopId,
        yookassaTestSecretKey: encryptedYookassaSecret,
      },
    });
    console.log('✨ Created SystemSettings with YooKassa test credentials');
  }

  console.log('🎉 Done! All 8 providers and YooKassa settings are live in the database.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
