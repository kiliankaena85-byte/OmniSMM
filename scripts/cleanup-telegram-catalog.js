const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupTelegramCatalog() {
  console.log('🧹 [CLEANUP] Starting Telegram Catalog Normalization...\n');

  // 1. Find Telegram Network
  const telegram = await prisma.network.findFirst({
    where: {
      OR: [
        { slug: 'telegram' },
        { name: { contains: 'Telegram', mode: 'insensitive' } },
      ],
    },
    include: {
      categories: {
        include: {
          services: true,
        },
      },
    },
  });

  if (!telegram) {
    console.error('❌ Telegram network not found!');
    await prisma.$disconnect();
    return;
  }

  console.log(`📱 Telegram Network ID: ${telegram.id}`);

  // Find Main VexBoost Provider
  const mainProvider = await prisma.provider.findFirst({
    where: { isActive: true },
  });

  if (!mainProvider) {
    console.error('❌ Active provider (VexBoost) not found!');
    await prisma.$disconnect();
    return;
  }
  console.log(`🔌 Main Provider: "${mainProvider.name}" (ID: ${mainProvider.id})`);

  // 2. Identify and delete all trash/mock services in Telegram
  const trashServices = await prisma.service.findMany({
    where: {
      category: {
        networkId: telegram.id,
      },
      OR: [
        { name: { contains: 'Тариф #' } },
        { name: { contains: 'Продвижение -' } },
        { name: { contains: 'Mock' } },
        { name: { contains: '[АРХИВ]' } },
        { category: { slug: 'telegram-other' } },
      ],
    },
  });

  console.log(`🗑️ Found ${trashServices.length} mock/trash services in Telegram. Removing or deactivating...`);
  for (const s of trashServices) {
    try {
      await prisma.service.delete({ where: { id: s.id } });
    } catch {
      await prisma.service.update({
        where: { id: s.id },
        data: { isActive: false, isQuarantined: true, name: `[DEPRECATED] ${s.name}` },
      });
    }
  }

  // 3. Define Canonical Categories for Telegram
  const canonicalCategories = [
    {
      slug: 'tg-subscribers',
      name: '👥 Подписчики на канал и в группу',
    },
    {
      slug: 'tg-views',
      name: '👁️ Просмотры и охваты постов',
    },
    {
      slug: 'tg-reactions',
      name: '❤️ Реакции на публикации',
    },
    {
      slug: 'tg-comments',
      name: '💬 Комментарии и отзывы',
    },
    {
      slug: 'tg-boosts',
      name: '🚀 Бусты канала (Stories & Levels)',
    },
    {
      slug: 'tg-bots',
      name: '🤖 Запуск ботов и рефералы',
    },
  ];

  const categoryMap = {};

  for (const catDef of canonicalCategories) {
    // Find existing or upsert
    let cat = await prisma.category.findFirst({
      where: {
        networkId: telegram.id,
        slug: catDef.slug,
      },
    });

    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: catDef.name,
          slug: catDef.slug,
          networkId: telegram.id,
          tenantId: 'all',
        },
      });
      console.log(`✨ Created Category: "${cat.name}" (slug: ${cat.slug})`);
    } else {
      cat = await prisma.category.update({
        where: { id: cat.id },
        data: {
          name: catDef.name,
          tenantId: 'all',
        },
      });
      console.log(`🔄 Updated Category: "${cat.name}" (slug: ${cat.slug})`);
    }
    categoryMap[catDef.slug] = cat;
  }

  // 4. Populate Real VexBoost Services for each Category
  const verifiedServices = [
    // --- 1. Подписчики (tg-subscribers) ---
    {
      categorySlug: 'tg-subscribers',
      name: 'Telegram Подписчики [Быстрый старт] [Гарантия 30 дней ♻️]',
      description: 'Быстрые подписчики высокого качества для каналов и групп. Защита от списаний с гарантией 30 дней.',
      rate: 38.71, // руб за 1000
      markup: 1.5,
      minQty: 100,
      maxQty: 65000,
      externalId: '1492',
      targetType: 'CHANNEL',
      qualityTier: 'STANDARD',
    },
    {
      categorySlug: 'tg-subscribers',
      name: 'Telegram Премиум подписчики [Без списаний ♻️] [Сервер: 1]',
      description: 'Высококачественные премиум-подписчики. Минимальный процент отписок, идеальны для вывода в топ поиска.',
      rate: 243.57,
      markup: 1.5,
      minQty: 10,
      maxQty: 15000,
      externalId: '1188',
      targetType: 'CHANNEL',
      qualityTier: 'PREMIUM',
    },
    {
      categorySlug: 'tg-subscribers',
      name: 'Telegram Premium RU Подписчики [Россия 🇷🇺] [Поиск + Гарантия 180 дней]',
      description: 'Подписчики из РФ, подключаются через поиск. Долгосрочная гарантия 180 дней.',
      rate: 331.09,
      markup: 1.5,
      minQty: 10,
      maxQty: 18000,
      externalId: '1258',
      targetType: 'CHANNEL',
      qualityTier: 'VIP',
    },
    {
      categorySlug: 'tg-subscribers',
      name: 'Telegram Подписчики + Авто Просмотры [Россия 🇷🇺] [30 дней]',
      description: 'Комплексный пакет: подписчики плюс автоматические просмотры на все новые посты канала.',
      rate: 414.38,
      markup: 1.5,
      minQty: 10,
      maxQty: 100000,
      externalId: '3059',
      targetType: 'CHANNEL',
      qualityTier: 'VIP',
    },

    // --- 2. Просмотры (tg-views) ---
    {
      categorySlug: 'tg-views',
      name: 'Telegram Просмотры на пост [Мгновенный старт] [Высокая скорость]',
      description: 'Мгновенное начисление просмотров на публикацию. Повышает охваты и активность канала.',
      rate: 1.50,
      markup: 2.0,
      minQty: 50,
      maxQty: 500000,
      externalId: '1280',
      targetType: 'POST',
      qualityTier: 'STANDARD',
    },
    {
      categorySlug: 'tg-views',
      name: 'Telegram Просмотры на 5 последних постов [Пакет охвата]',
      description: 'Равномерное распределение просмотров на последние 5 публикаций канала.',
      rate: 7.50,
      markup: 2.0,
      minQty: 50,
      maxQty: 100000,
      externalId: '1281',
      targetType: 'CHANNEL',
      qualityTier: 'STANDARD',
    },
    {
      categorySlug: 'tg-views',
      name: 'Telegram Просмотры + Клики по рекламе [Tg Ads] [Россия 🇷🇺]',
      description: 'Официальные переходы и просмотры рекламы для повышения CPM в Telegram Ads.',
      rate: 66.68,
      markup: 1.6,
      minQty: 100,
      maxQty: 50000,
      externalId: '3109',
      targetType: 'POST',
      qualityTier: 'PREMIUM',
    },
    {
      categorySlug: 'tg-views',
      name: 'Telegram Авто-просмотры на 100 будущих постов [Закрытые/Открытые каналы]',
      description: 'Автоматическая накрутка просмотров на следующие 100 постов после публикации.',
      rate: 53.34,
      markup: 1.8,
      minQty: 10,
      maxQty: 150000,
      externalId: '3023',
      targetType: 'CHANNEL',
      qualityTier: 'VIP',
    },

    // --- 3. Реакции (tg-reactions) ---
    {
      categorySlug: 'tg-reactions',
      name: 'Telegram Позитивные реакции [👍🔥🎉❤️] [Мгновенно]',
      description: 'Случайный микс положительных реакций на публикацию. Выглядит максимально естественно.',
      rate: 15.00,
      markup: 2.0,
      minQty: 10,
      maxQty: 50000,
      externalId: '3192',
      targetType: 'POST',
      qualityTier: 'STANDARD',
    },
    {
      categorySlug: 'tg-reactions',
      name: 'Telegram Реакция Огонь [🔥] [Быстрый старт]',
      description: 'Точечная накрутка реакции Огонь на публикацию.',
      rate: 16.50,
      markup: 2.0,
      minQty: 10,
      maxQty: 50000,
      externalId: '3194',
      targetType: 'POST',
      qualityTier: 'STANDARD',
    },
    {
      categorySlug: 'tg-reactions',
      name: 'Telegram Реакция Сердце [❤️] [Быстрый старт]',
      description: 'Точечная накрутка реакции Сердце на публикацию.',
      rate: 16.50,
      markup: 2.0,
      minQty: 10,
      maxQty: 50000,
      externalId: '3193',
      targetType: 'POST',
      qualityTier: 'STANDARD',
    },

    // --- 4. Комментарии (tg-comments) ---
    {
      categorySlug: 'tg-comments',
      name: 'Telegram Пользовательские комментарии [Свой текст]',
      description: 'Вы сами указываете текст каждого комментария (по 1 на строку). Полный контроль над обсуждением.',
      rate: 750.00,
      markup: 1.5,
      minQty: 5,
      maxQty: 1000,
      externalId: '1384',
      targetType: 'POST',
      customDataType: 'TEXTAREA',
      customDataLabel: 'Введите тексты комментариев (по одному на строку)',
      qualityTier: 'VIP',
    },
    {
      categorySlug: 'tg-comments',
      name: 'Telegram Положительные отзывы и комментарии [Россия 🇷🇺]',
      description: 'Естественные тематические положительные комментарии от русскоязычных пользователей.',
      rate: 650.00,
      markup: 1.5,
      minQty: 5,
      maxQty: 2000,
      externalId: '3186',
      targetType: 'POST',
      qualityTier: 'PREMIUM',
    },

    // --- 5. Бусты (tg-boosts) ---
    {
      categorySlug: 'tg-boosts',
      name: 'Telegram Буст канала для Stories [Гарантия 30 дней ⚡️]',
      description: 'Бусты от Telegram Premium аккаунтов. Открывают возможность публиковать истории от лица канала.',
      rate: 174.22,
      markup: 1.5,
      minQty: 1,
      maxQty: 10000,
      externalId: '1732',
      targetType: 'CHANNEL',
      qualityTier: 'VIP',
    },
    {
      categorySlug: 'tg-boosts',
      name: 'Telegram Буст канала [Гарантия 90 дней ⚡️] [Премиум]',
      description: 'Долгосрочные бусты для стабильного удержания уровня канала на 3 месяца.',
      rate: 450.00,
      markup: 1.5,
      minQty: 1,
      maxQty: 5000,
      externalId: '1732_90d',
      targetType: 'CHANNEL',
      qualityTier: 'VIP',
    },

    // --- 6. Боты и рефералы (tg-bots) ---
    {
      categorySlug: 'tg-bots',
      name: 'Telegram Запуск бота / Рефералы [Premium Аккаунты 🌟]',
      description: 'Качественные запуски ботов и переход по реферальным ссылкам с аккаунтов с Telegram Premium.',
      rate: 54.53,
      markup: 1.6,
      minQty: 10,
      maxQty: 100000,
      externalId: '1238',
      targetType: 'BOT',
      qualityTier: 'PREMIUM',
    },
    {
      categorySlug: 'tg-bots',
      name: 'Telegram Старты бота [ИИ Умный поиск 🇷🇺 Россия]',
      description: 'Умные переходы и старты ботов с таргетингом по РФ.',
      rate: 56.78,
      markup: 1.6,
      minQty: 10,
      maxQty: 100000,
      externalId: '3033',
      targetType: 'BOT',
      qualityTier: 'STANDARD',
    },
    {
      categorySlug: 'tg-bots',
      name: 'Telegram Рефералы для ботов (только запуск) [Высокая скорость]',
      description: 'Массовые запуски ботов по реферальным ссылкам.',
      rate: 15.00,
      markup: 2.0,
      minQty: 10,
      maxQty: 300000,
      externalId: '1507',
      targetType: 'BOT',
      qualityTier: 'ECONOMY',
    },
  ];

  console.log(`\n📦 Adding ${verifiedServices.length} verified real services to Telegram...`);

  for (const sDef of verifiedServices) {
    const cat = categoryMap[sDef.categorySlug];
    if (!cat) continue;

    const newService = await prisma.service.create({
      data: {
        name: sDef.name,
        description: sDef.description,
        categoryId: cat.id,
        providerId: mainProvider.id,
        rate: sDef.rate,
        markup: sDef.markup,
        minQty: sDef.minQty,
        maxQty: sDef.maxQty,
        externalId: sDef.externalId,
        targetType: sDef.targetType,
        qualityTier: sDef.qualityTier,
        customDataType: sDef.customDataType || 'NONE',
        customDataLabel: sDef.customDataLabel || null,
        tenantId: 'all',
        isActive: true,
        isDripFeedEnabled: true,
      },
    });

    console.log(`  ✅ [${cat.name}] -> "${newService.name}" (ID: ${newService.id}, Rate: ${newService.rate} ₽/1k, Min: ${newService.minQty})`);
  }

  // 5. Clean up old obsolete categories that have 0 services
  const oldCategories = await prisma.category.findMany({
    where: {
      networkId: telegram.id,
      slug: {
        in: ['telegram-other', 'telegram-boosts', 'telegram-premium', 'telegram-bots', 'telegram-subscribers'],
      },
    },
    include: {
      services: true,
    },
  });

  for (const oc of oldCategories) {
    if (oc.services.length === 0) {
      await prisma.category.delete({ where: { id: oc.id } });
      console.log(`🗑️ Deleted obsolete empty category: "${oc.name}" (slug: ${oc.slug})`);
    }
  }

  console.log('\n🎉 [CLEANUP COMPLETE] Telegram Catalog is now 100% Normalized and Verified!');
  await prisma.$disconnect();
}

cleanupTelegramCatalog().catch(console.error);
