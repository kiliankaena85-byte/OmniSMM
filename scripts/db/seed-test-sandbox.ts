import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../src/lib/auth/password';

export async function seedTestSandbox(targetDatabaseUrl?: string) {
  const dbUrl = targetDatabaseUrl || process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL or DATABASE_URL_TEST must be defined.');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  console.log(`🌱 [Test Sandbox Seeder] Connecting to database... (${dbUrl.replace(/:[^:@]+@/, ':****@')})`);

  try {
    // 1. Create Synthetic System Settings
    console.log('⚙️ Initializing Sandbox System Settings...');
    await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: {
        siteName: 'OmniSMM Sandbox Testbed',
        isMaintenanceMode: false,
        paymentGatewayConfig: JSON.stringify({
          mockMode: true,
          yookassa: { enabled: false },
          robokassa: { enabled: false },
          cryptoBot: { enabled: false }
        })
      },
      create: {
        id: 'default',
        siteName: 'OmniSMM Sandbox Testbed',
        isMaintenanceMode: false,
        paymentGatewayConfig: JSON.stringify({
          mockMode: true,
          yookassa: { enabled: false },
          robokassa: { enabled: false },
          cryptoBot: { enabled: false }
        })
      }
    });

    // 2. Synthetic Test Accounts (Pentest/Sandbox)
    console.log('👥 Creating Synthetic Sandbox Accounts...');
    const userPass = await hashPassword('SandboxTest#2026!');
    const opPass = await hashPassword('SandboxOperator#2026!');
    const adminPass = await hashPassword('SandboxAdmin#2026!');

    await prisma.user.upsert({
      where: { email: 'sandbox-user@smmplan.pro' },
      update: { passwordHash: userPass, role: 'USER', tenantId: 'smmplan', balance: BigInt(500000), apiKey: 'sb_test_user_key_994820' },
      create: { email: 'sandbox-user@smmplan.pro', name: 'Sandbox User', passwordHash: userPass, role: 'USER', tenantId: 'smmplan', balance: BigInt(500000), apiKey: 'sb_test_user_key_994820' }
    });

    await prisma.user.upsert({
      where: { email: 'sandbox-operator@smmplan.pro' },
      update: { passwordHash: opPass, role: 'OPERATOR', tenantId: 'smmplan', balance: BigInt(1000000) },
      create: { email: 'sandbox-operator@smmplan.pro', name: 'Sandbox Operator', passwordHash: opPass, role: 'OPERATOR', tenantId: 'smmplan', balance: BigInt(1000000) }
    });

    await prisma.user.upsert({
      where: { email: 'sandbox-admin@smmplan.pro' },
      update: { passwordHash: adminPass, role: 'ADMIN', tenantId: 'smmplan', balance: BigInt(2000000) },
      create: { email: 'sandbox-admin@smmplan.pro', name: 'Sandbox Admin', passwordHash: adminPass, role: 'ADMIN', tenantId: 'smmplan', balance: BigInt(2000000) }
    });

    // 3. Synthetic Providers (Mock-Only, Zero Cost)
    console.log('🔌 Provisioning Mock Provider...');
    const mockProvider = await prisma.provider.upsert({
      where: { id: 'mock_sandbox_provider' },
      update: {
        name: 'Sandbox Mock Provider (Zero Risk)',
        url: 'http://127.0.0.1:3000/api/mock-provider',
        apiKey: 'mock_sandbox_secret_key',
        balance: 100000,
        currency: 'RUB',
        status: 'ACTIVE'
      },
      create: {
        id: 'mock_sandbox_provider',
        name: 'Sandbox Mock Provider (Zero Risk)',
        url: 'http://127.0.0.1:3000/api/mock-provider',
        apiKey: 'mock_sandbox_secret_key',
        balance: 100000,
        currency: 'RUB',
        status: 'ACTIVE'
      }
    });

    // 4. Synthetic Networks & Categories
    console.log('🌐 Provisioning Sandbox Networks & Categories...');
    const tgNetwork = await prisma.network.upsert({
      where: { code: 'telegram' },
      update: { name: 'Telegram', icon: 'send', sortOrder: 1 },
      create: { code: 'telegram', name: 'Telegram', icon: 'send', sortOrder: 1 }
    });

    const tgSubCategory = await prisma.category.upsert({
      where: { id: 'sandbox-tg-subscribers' },
      update: { name: 'Подписчики Telegram', networkId: tgNetwork.id, sortOrder: 1 },
      create: { id: 'sandbox-tg-subscribers', name: 'Подписчики Telegram', networkId: tgNetwork.id, sortOrder: 1 }
    });

    // 5. Synthetic Services
    console.log('📦 Provisioning Sandbox Services...');
    await prisma.service.upsert({
      where: { id: 'sb-tg-sub-001' },
      update: {
        name: 'Подписчики Telegram [Sandbox Fast HQ]',
        categoryId: tgSubCategory.id,
        networkId: tgNetwork.id,
        tenantId: 'all',
        providerId: mockProvider.id,
        providerServiceId: '101',
        minQty: 10,
        maxQty: 50000,
        pricePerUnitRub: 0.25,
        pricePer1kRub: 250,
        status: 'ACTIVE'
      },
      create: {
        id: 'sb-tg-sub-001',
        name: 'Подписчики Telegram [Sandbox Fast HQ]',
        categoryId: tgSubCategory.id,
        networkId: tgNetwork.id,
        tenantId: 'all',
        providerId: mockProvider.id,
        providerServiceId: '101',
        minQty: 10,
        maxQty: 50000,
        pricePerUnitRub: 0.25,
        pricePer1kRub: 250,
        status: 'ACTIVE'
      }
    });

    console.log('✅ [Test Sandbox Seeder] Successfully provisioned isolated sandbox environment!');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedTestSandbox()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeder Error:', err);
      process.exit(1);
    });
}
