import { PrismaClient } from '@prisma/client';
import { applyBeautifulRounding } from '../src/lib/financial-constants';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Telegram subscribers update...');

  // 1. Deactivate the bad service (4083) and the old mock service (4081)
  console.log('Deactivating bad/mock services (4083, 4081)...');
  await prisma.service.updateMany({
    where: {
      numericId: { in: [4083, 4081] }
    },
    data: {
      isActive: false
    }
  });

  // 2. Resolve target Category
  const category = await prisma.category.findFirst({
    where: {
      name: 'Telegram Подписчики / Участники',
      network: { slug: 'telegram' }
    }
  });
  if (!category) {
    throw new Error('Category "Telegram Подписчики / Участники" not found');
  }
  console.log(`Found category: ${category.name} (ID: ${category.id})`);

  // 3. Resolve Providers
  const streamPromotion = await prisma.provider.findFirst({
    where: { name: 'Stream-Promotion' }
  });
  const vexboost = await prisma.provider.findFirst({
    where: { name: 'Vexboost' }
  });

  if (!streamPromotion || !vexboost) {
    throw new Error('Required providers (Stream-Promotion or Vexboost) not found');
  }
  console.log(`Found providers: Stream-Promotion (${streamPromotion.id}), Vexboost (${vexboost.id})`);

  // 4. Resolve exchange rate
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'global' }
  });
  const exchangeRate = settings?.exchangeRateUSD || 90.0;
  console.log(`Using USD/RUB exchange rate: ${exchangeRate}`);

  // 5. Define services to insert
  const servicesToImport = [
    {
      name: 'Telegram Подписчики (Эконом)',
      description: '⚡ **Старт:** 0-1 час\n🚀 **Скорость:** до 4 000 в сутки\n📉 **Списания:** Возможны\n🛡️ **Гарантия:** 90 дней',
      externalId: '26404',
      providerId: streamPromotion.id,
      priceRUBPer1k: 33.31,
      minQty: 10,
      maxQty: 500000,
      refill: false,
      cancel: false,
      drip: false
    },
    {
      name: 'Telegram Подписчики (Стандарт)',
      description: '⚡ **Старт:** 0-1 час\n🇷🇺 **ГЕО:** Россия (Русские ники)\n🚀 **Скорость:** до 20 000 в сутки\n📉 **Списания:** Без списаний\n🛡️ **Гарантия:** 180 дней',
      externalId: '28239',
      providerId: streamPromotion.id,
      priceRUBPer1k: 338.74,
      minQty: 10,
      maxQty: 100000,
      refill: false,
      cancel: false,
      drip: false
    },
    {
      name: 'Telegram Подписчики (Живые / Премиум)',
      description: '⚡ **Старт:** Моментальный\n🔥 **Качество:** Реальные активные пользователи (Живые)\n🚀 **Скорость:** Высокая\n🛡️ **Гарантия:** 360 дней',
      externalId: '1518',
      providerId: vexboost.id,
      priceRUBPer1k: 7051.70,
      minQty: 10,
      maxQty: 10000000,
      refill: true,
      cancel: true,
      drip: false
    }
  ];

  const markup = 3.0; // Standard markup multiplier

  for (const s of servicesToImport) {
    // Convert target RUB cost to rate in USD
    const rateUSD = s.priceRUBPer1k / exchangeRate;
    
    // Calculate final retail price cents per 1000 (with beautiful rounding)
    const pricePer1000Cents = Math.round(
      applyBeautifulRounding(rateUSD * markup * exchangeRate) * 100
    );

    // Upsert the service
    const existing = await prisma.service.findFirst({
      where: {
        externalId: s.externalId,
        providerId: s.providerId
      }
    });

    if (existing) {
      console.log(`Reactivating and updating service: ${s.name} (Ext ID: ${s.externalId})...`);
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          name: s.name,
          description: s.description,
          rate: rateUSD,
          markup: markup,
          pricePer1000Cents: pricePer1000Cents,
          minQty: s.minQty,
          maxQty: s.maxQty,
          isRefillEnabled: s.refill,
          isCancelEnabled: s.cancel,
          isDripFeedEnabled: s.drip,
          targetType: 'CHANNEL',
          isActive: true,
          lastSeenAt: new Date()
        }
      });
    } else {
      console.log(`Creating new service: ${s.name} (Ext ID: ${s.externalId})...`);
      await prisma.service.create({
        data: {
          name: s.name,
          description: s.description,
          externalId: s.externalId,
          categoryId: category.id,
          providerId: s.providerId,
          rate: rateUSD,
          markup: markup,
          pricePer1000Cents: pricePer1000Cents,
          minQty: s.minQty,
          maxQty: s.maxQty,
          isRefillEnabled: s.refill,
          isCancelEnabled: s.cancel,
          isDripFeedEnabled: s.drip,
          targetType: 'CHANNEL',
          isActive: true,
          lastSeenAt: new Date()
        }
      });
    }
  }

  console.log('🎉 Successfully completed subscribers update!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
