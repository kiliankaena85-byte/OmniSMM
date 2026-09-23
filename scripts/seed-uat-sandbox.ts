import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';
import { VaultService } from '../src/lib/vault';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 [UAT Seeder] Initializing UAT Sandbox Environment...');

  // 1. Tenants
  const tenants = [
    { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.pro' },
    { id: 'flux', name: 'SMMflux', slug: 'flux', domain: 'smmflux.ru' },
  ];

  for (const t of tenants) {
    await prisma.tenant.upsert({
      where: { id: t.id },
      update: { name: t.name, slug: t.slug, domain: t.domain, isActive: true },
      create: { id: t.id, name: t.name, slug: t.slug, domain: t.domain, isActive: true },
    });

    await prisma.systemSettings.upsert({
      where: { id: t.id },
      update: { isTestMode: false, maintenanceMode: false },
      create: {
        id: t.id,
        taxRate: 6.0,
        opexMonthly: 0,
        maintenanceMode: false,
        isTestMode: false,
        siteName: t.name,
        siteDescription: `${t.name} Platform`,
      },
    });
  }
  console.log('✅ Tenants and SystemSettings ready');

  // 2. Users (Admin + Rich Client + Empty Client)
  const defaultPasswordHash = await hashPassword('Test12345!');
  const adminPasswordHash = await hashPassword('Admin12345!');

  // Admin / Owner Staff Role
  const staffRole = await prisma.staffRole.upsert({
    where: { name: 'Owner / Super Admin' },
    update: { isSystem: true },
    create: {
      name: 'Owner / Super Admin',
      description: 'Full Super Administrator access',
      isSystem: true,
      tenantId: 'smmplan',
    },
  });

  const sections = ['dashboard', 'catalog', 'orders', 'finance', 'users', 'support', 'analytics', 'settings', 'promos', 'logs'];
  for (const s of sections) {
    await prisma.staffPermission.upsert({
      where: { roleId_section: { roleId: staffRole.id, section: s } },
      update: { canView: true, canEdit: true },
      create: { roleId: staffRole.id, section: s, canView: true, canEdit: true, tenantId: 'smmplan' },
    });
  }

  // Admin / Owner User
  await prisma.user.upsert({
    where: { email_tenantId: { email: 'admin@smmplan.pro', tenantId: 'smmplan' } },
    update: {
      role: 'ADMIN',
      staffRoleId: staffRole.id,
      balance: BigInt(500_000), // 5,000.00 RUB
      passwordHash: adminPasswordHash,
      isEmailVerified: true,
      isActive: true,
    },
    create: {
      email: 'admin@smmplan.pro',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      staffRoleId: staffRole.id,
      balance: BigInt(500_000),
      tenantId: 'smmplan',
      isEmailVerified: true,
      isActive: true,
    },
  });

  // Client with 10,000.00 RUB Balance
  await prisma.user.upsert({
    where: { email_tenantId: { email: 'client_rich@smmplan.pro', tenantId: 'smmplan' } },
    update: {
      role: 'USER',
      balance: BigInt(1_000_000), // 10,000.00 RUB
      passwordHash: defaultPasswordHash,
      isEmailVerified: true,
      isActive: true,
    },
    create: {
      email: 'client_rich@smmplan.pro',
      passwordHash: defaultPasswordHash,
      role: 'USER',
      balance: BigInt(1_000_000),
      tenantId: 'smmplan',
      isEmailVerified: true,
      isActive: true,
    },
  });

  // Client with 0.00 RUB Balance
  await prisma.user.upsert({
    where: { email_tenantId: { email: 'client_empty@smmplan.pro', tenantId: 'smmplan' } },
    update: {
      role: 'USER',
      balance: BigInt(0),
      passwordHash: defaultPasswordHash,
      isEmailVerified: true,
      isActive: true,
    },
    create: {
      email: 'client_empty@smmplan.pro',
      passwordHash: defaultPasswordHash,
      role: 'USER',
      balance: BigInt(0),
      tenantId: 'smmplan',
      isEmailVerified: true,
      isActive: true,
    },
  });

  console.log(`✅ UAT Test Users ready:
  👑 Admin: admin@smmplan.pro (Password: Admin12345!)
  💰 Rich Client: client_rich@smmplan.pro (Password: Test12345! | Balance: 10,000.00 ₽)
  💳 Empty Client: client_empty@smmplan.pro (Password: Test12345! | Balance: 0.00 ₽)`);

  // 3. Mock Providers
  const encKeyAlpha = VaultService.encrypt('mock_key_alpha_123');
  const encKeyBeta = VaultService.encrypt('mock_key_beta_456');

  const providerAlpha = await prisma.provider.upsert({
    where: { name: 'Mock Provider Alpha (Primary)' },
    update: {
      apiUrl: 'https://mock.smmplan.internal/api/v2',
      apiKey: encKeyAlpha,
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
      syncLock: false,
    },
    create: {
      name: 'Mock Provider Alpha (Primary)',
      apiUrl: 'https://mock.smmplan.internal/api/v2',
      apiKey: encKeyAlpha,
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
      syncLock: false,
    },
  });

  const providerBeta = await prisma.provider.upsert({
    where: { name: 'Mock Provider Beta (Failover Backup)' },
    update: {
      apiUrl: 'https://mock.smmplan.internal/api/v2',
      apiKey: encKeyBeta,
      isActive: true,
      balanceCurrency: 'USD',
      errorCount5m: 0,
      syncLock: false,
    },
    create: {
      name: 'Mock Provider Beta (Failover Backup)',
      apiUrl: 'https://mock.smmplan.internal/api/v2',
      apiKey: encKeyBeta,
      isActive: true,
      balanceCurrency: 'USD',
      errorCount5m: 0,
      syncLock: false,
    },
  });

  console.log('✅ Mock Providers (Alpha & Beta) configured');

  // 4. Social Networks & Categories
  const telegramNetwork = await prisma.network.upsert({
    where: { slug: 'telegram' },
    update: { name: 'Telegram', isActive: true, sort: 1 },
    create: { name: 'Telegram', slug: 'telegram', icon: 'telegram', isActive: true, sort: 1 },
  });

  const vkNetwork = await prisma.network.upsert({
    where: { slug: 'vk' },
    update: { name: 'ВКонтакте', isActive: true, sort: 2 },
    create: { name: 'ВКонтакте', slug: 'vk', icon: 'vk', isActive: true, sort: 2 },
  });

  const tgSubscribersCategory = await prisma.category.upsert({
    where: { slug: 'telegram-subscribers' },
    update: { name: 'Подписчики Telegram', networkId: telegramNetwork.id, sort: 1 },
    create: {
      name: 'Подписчики Telegram',
      slug: 'telegram-subscribers',
      networkId: telegramNetwork.id,
      sort: 1,
    },
  });

  const vkViewsCategory = await prisma.category.upsert({
    where: { slug: 'vk-views' },
    update: { name: 'Просмотры ВКонтакте', networkId: vkNetwork.id, sort: 1 },
    create: {
      name: 'Просмотры ВКонтакте',
      slug: 'vk-views',
      networkId: vkNetwork.id,
      sort: 1,
    },
  });

  // 5. Test Services in different Lifecycle states
  // A. PUBLISHED Service with Multi-Routing (Primary Alpha + Backup Beta)
  const publishedService = await prisma.service.upsert({
    where: { id: 'uat-service-tg-published' },
    update: {
      name: 'Telegram Подписчики HQ (Быстрый старт) [UAT Ready]',
      categoryId: tgSubscribersCategory.id,
      providerId: providerAlpha.id,
      externalId: '101',
      rate: 850.0,
      pricePer1000Cents: 85000,
      minQty: 10,
      maxQty: 50000,
      isActive: true,
      isDripFeedEnabled: true,
      description: 'Качественные подписчики Telegram с плавной подачей и гарантией 30 дней.',
    },
    create: {
      id: 'uat-service-tg-published',
      name: 'Telegram Подписчики HQ (Быстрый старт) [UAT Ready]',
      categoryId: tgSubscribersCategory.id,
      providerId: providerAlpha.id,
      externalId: '101',
      rate: 850.0,
      pricePer1000Cents: 85000,
      minQty: 10,
      maxQty: 50000,
      isActive: true,
      isDripFeedEnabled: true,
      description: 'Качественные подписчики Telegram с плавной подачей и гарантией 30 дней.',
    },
  });

  // Configure Routes for Published Service
  await prisma.serviceRoute.deleteMany({ where: { serviceId: publishedService.id } });
  await prisma.serviceRoute.createMany({
    data: [
      {
        serviceId: publishedService.id,
        providerId: providerAlpha.id,
        providerServiceId: '101',
        isPrimary: true,
        priority: 1,
        failoverMode: 'auto',
        isActive: true,
      },
      {
        serviceId: publishedService.id,
        providerId: providerBeta.id,
        providerServiceId: '202',
        isPrimary: false,
        priority: 2,
        failoverMode: 'auto',
        isActive: true,
      },
    ],
  });

  // B. Service in TESTING state (Visible only in Admin/Testing scope)
  await prisma.serviceDraft.upsert({
    where: { id: 'uat-draft-vk-testing' },
    update: {
      name: 'ВКонтакте Просмотры клипов (Умный запуск) [TESTING Phase]',
      categoryId: vkViewsCategory.id,
      providerId: providerAlpha.id,
      externalId: '303',
      procurementRate: 25.0,
      markup: 40.0,
      retailPriceRub: 0.035,
      minQty: 100,
      maxQty: 100000,
      status: 'TESTING',
      description: 'Тестовая услуга для проверки промоушена из TESTING в PUBLISHED.',
    },
    create: {
      id: 'uat-draft-vk-testing',
      name: 'ВКонтакте Просмотры клипов (Умный запуск) [TESTING Phase]',
      categoryId: vkViewsCategory.id,
      providerId: providerAlpha.id,
      externalId: '303',
      procurementRate: 25.0,
      markup: 40.0,
      retailPriceRub: 0.035,
      minQty: 100,
      maxQty: 100000,
      status: 'TESTING',
      description: 'Тестовая услуга для проверки промоушена из TESTING в PUBLISHED.',
    },
  });

  console.log('✅ UAT Lifecycle Services & Multi-Routing Routes seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding UAT sandbox:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
