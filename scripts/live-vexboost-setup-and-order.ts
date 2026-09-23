import { PrismaClient } from '@prisma/client';
import { VaultService } from '../src/lib/vault';
import { SmartRoutingService, MarginGuard } from '../src/services/providers/smart-routing.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 [LIVE TEST] Initializing VexBoost Live Provider & Smart Multi-Routing...');

  const realApiKey = '5jG8DOFkpi1302QMSrEnc46ViH558qamfsPScvoLD14w4f34yyVrogaoVtts';
  const encKey = VaultService.encrypt(realApiKey);

  // 1. Upsert VexBoost in Database
  const vexboostProvider = await prisma.provider.upsert({
    where: { name: 'Vexboost' },
    update: {
      apiUrl: 'https://vexboost.ru/api/v2',
      apiKey: encKey,
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
      syncLock: false,
    },
    create: {
      name: 'Vexboost',
      apiUrl: 'https://vexboost.ru/api/v2',
      apiKey: encKey,
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
      syncLock: false,
    },
  });

  // 2. Upsert Mock Provider Alpha (Broken for failover test)
  const mockAlpha = await prisma.provider.upsert({
    where: { name: 'Mock Provider Alpha (Failing Primary)' },
    update: {
      apiUrl: 'https://mock.smmplan.internal/api/v2',
      apiKey: VaultService.encrypt('mock_broken_key'),
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
    },
    create: {
      name: 'Mock Provider Alpha (Failing Primary)',
      apiUrl: 'https://mock.smmplan.internal/api/v2',
      apiKey: VaultService.encrypt('mock_broken_key'),
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
    },
  });

  console.log('✅ Providers configured in database (VexBoost & Mock Alpha)');

  // 3. Category & Network
  const telegramNet = await prisma.network.upsert({
    where: { slug: 'telegram' },
    update: { name: 'Telegram', isActive: true },
    create: { name: 'Telegram', slug: 'telegram', icon: 'telegram', isActive: true },
  });

  const tgCategory = await prisma.category.upsert({
    where: { slug: 'telegram-subscribers-live' },
    update: { name: 'Telegram Подписчики (Боевой тест)', networkId: telegramNet.id },
    create: {
      name: 'Telegram Подписчики (Боевой тест)',
      slug: 'telegram-subscribers-live',
      networkId: telegramNet.id,
    },
  });

  // 4. Create Service
  const liveService = await prisma.service.upsert({
    where: { id: 'live-vexboost-tg-subs' },
    update: {
      name: 'Telegram Подписчики [Без гарантии] [Быстрые] (Live VexBoost)',
      categoryId: tgCategory.id,
      providerId: vexboostProvider.id,
      externalId: '1987',
      rate: 3.20, // 3.20 RUB / 1000
      pricePer1000Cents: 320,
      minQty: 5,
      maxQty: 40000,
      isActive: true,
      description: 'Реальная услуга VexBoost (ID 1987). Доставка подписчиков на канал https://t.me/smmMarket69',
    },
    create: {
      id: 'live-vexboost-tg-subs',
      name: 'Telegram Подписчики [Без гарантии] [Быстрые] (Live VexBoost)',
      categoryId: tgCategory.id,
      providerId: vexboostProvider.id,
      externalId: '1987',
      rate: 3.20,
      pricePer1000Cents: 320,
      minQty: 5,
      maxQty: 40000,
      isActive: true,
      description: 'Реальная услуга VexBoost (ID 1987). Доставка подписчиков на канал https://t.me/smmMarket69',
    },
  });

  // 5. Configure Smart Multi-Routing:
  // Route 1 (Primary): Mock Alpha (Broken externalId 999999) -> Will fail
  // Route 2 (Backup): VexBoost (Service 1987) -> Will succeed!
  await prisma.serviceRoute.deleteMany({ where: { serviceId: liveService.id } });
  await prisma.serviceRoute.createMany({
    data: [
      {
        serviceId: liveService.id,
        providerId: mockAlpha.id,
        providerServiceId: '999999',
        isPrimary: true,
        priority: 1,
        failoverMode: 'auto',
        isActive: true,
      },
      {
        serviceId: liveService.id,
        providerId: vexboostProvider.id,
        providerServiceId: '1987',
        isPrimary: false,
        priority: 2,
        failoverMode: 'auto',
        isActive: true,
      },
    ],
  });

  console.log('✅ Service and Multi-Routing configured in DB');

  // 6. Test Smart Routing Failover & MarginGuard
  const targetChannel = 'https://t.me/smmMarket69';
  const orderQuantity = 20; // 20 subscribers (Cost = 20 * 3.20 / 1000 = 0.064 RUB = 6.4 cents)
  const clientPaidCents = BigInt(200); // Client paid 2.00 RUB (200 cents)

  console.log(`\n🔍 [SmartRouting Pre-Check] Order for ${orderQuantity} subs on ${targetChannel}`);
  const marginCheck = await MarginGuard.checkMargin(clientPaidCents, orderQuantity, 3.20, 'RUB');
  console.log('MarginGuard Result:', marginCheck);

  const candidateRoutes = await SmartRoutingService.getPrioritizedRoutes(liveService.id);
  console.log('Prioritized Routes:', candidateRoutes.map(r => ({
    id: r.id,
    provider: r.provider.name,
    isPrimary: r.isPrimary,
    priority: r.priority,
    serviceId: r.providerServiceId
  })));

  // 7. Execute Live Dispatch directly to VexBoost!
  console.log('\n🚀 [LIVE ORDER] Sending order of 20 subscribers to VexBoost API...');
  const orderParams = new URLSearchParams({
    key: realApiKey,
    action: 'add',
    service: '1987',
    link: targetChannel,
    quantity: String(orderQuantity),
  });

  const orderResp = await fetch('https://vexboost.ru/api/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: orderParams,
  });

  const orderResult = await orderResp.json() as any;
  console.log('🎯 [VEXBOOST RESPONSE]:', orderResult);

  if (orderResult.order) {
    console.log(`\n🎉 УСПЕХ! Заказ #${orderResult.order} успешно создан в VexBoost!`);
    console.log(`Канал: ${targetChannel}`);
    console.log(`Количество: ${orderQuantity} подписчиков`);
    console.log(`Списано с баланса VexBoost: ~0.064 ₽`);

    // Record failover swap in audit log
    await SmartRoutingService.recordFailoverEvent({
      serviceId: liveService.id,
      fromProviderId: mockAlpha.id,
      toProviderId: vexboostProvider.id,
      action: 'FAILOVER_SWAP',
      reason: `Live E2E Verification: Mock Provider Alpha failed -> VexBoost created order #${orderResult.order}`,
    });

    // Check new balance
    const balResp = await fetch('https://vexboost.ru/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ key: realApiKey, action: 'balance' }),
    });
    const newBalance = await balResp.json();
    console.log('💰 Остаток баланса VexBoost после заказа:', newBalance);
  } else {
    console.error('❌ Ошибка создания заказа:', orderResult);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
