const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function normalizeFullCatalog() {
  console.log('🚀 [ROUND-TABLE] Starting Full Catalog Normalization across all Social Networks...\n');

  // 1. Delete all mock / legacy / "Тариф #" services across the entire database
  const trashServices = await prisma.service.findMany({
    where: {
      OR: [
        { name: { contains: 'Тариф #' } },
        { name: { contains: 'Mock' } },
        { name: { contains: '[АРХИВ]' } },
        { externalId: { startsWith: 'mock_' } },
        { externalId: { startsWith: 'uat-' } },
      ],
    },
  });

  console.log(`🗑️ Found ${trashServices.length} mock/legacy services across all networks.`);
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

  // 2. Get active provider
  const mainProvider = await prisma.provider.findFirst({ where: { isActive: true } });
  if (!mainProvider) {
    console.error('❌ Active provider not found!');
    await prisma.$disconnect();
    return;
  }

  // 3. Normalization Rules per Social Network
  const catalogBlueprint = {
    // --- 1. VKONTAKTE ---
    vk: {
      categories: [
        {
          slug: 'vk-subscribers',
          name: '👥 Подписчики в группу и паблик',
          services: [
            {
              name: 'VK Подписчики в группу [Быстрый старт] [Россия 🇷🇺]',
              description: 'Живые русскоязычные подписчики в сообщество или паблик ВКонтакте.',
              rate: 161.70,
              markup: 1.5,
              minQty: 10,
              maxQty: 50000,
              externalId: '5457',
              targetType: 'PROFILE',
              qualityTier: 'STANDARD',
            },
            {
              name: 'VK Подписчики [Премиум] [Гарантия 30 дней ♻️]',
              description: 'Качественные подписчики с минимальным процентом собачек и защитой от списаний.',
              rate: 270.20,
              markup: 1.5,
              minQty: 10,
              maxQty: 30000,
              externalId: '40186',
              targetType: 'PROFILE',
              qualityTier: 'PREMIUM',
            },
            {
              name: 'VK Подписчики [Живые активные] [Гарантия 90 дней ♻️]',
              description: 'Максимальное качество участников сообщества с гарантией удержания 3 месяца.',
              rate: 653.40,
              markup: 1.5,
              minQty: 10,
              maxQty: 20000,
              externalId: '26575',
              targetType: 'PROFILE',
              qualityTier: 'VIP',
            },
          ],
        },
        {
          slug: 'vk-likes',
          name: '❤️ Лайки на публикации и фото [👍 ❤️ 🔥]',
          services: [
            {
              name: 'VK Лайки на пост / фото [👍 ❤️] [Быстрый старт]',
              description: 'Мгновенные лайки на любые публикации, фото или клипы ВКонтакте.',
              rate: 55.00,
              markup: 1.8,
              minQty: 10,
              maxQty: 100000,
              externalId: '31481',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
            {
              name: 'VK Лайки [Премиум] [Россия 🇷🇺] [👍 ❤️ 🔥 👏]',
              description: 'Лайки от активных русскоязычных пользователей с заполненными профилями.',
              rate: 120.00,
              markup: 1.6,
              minQty: 10,
              maxQty: 50000,
              externalId: '25878',
              targetType: 'POST',
              qualityTier: 'PREMIUM',
            },
          ],
        },
        {
          slug: 'vk-views',
          name: '👁️ Просмотры постов и клипов',
          services: [
            {
              name: 'VK Просмотры на пост [Мгновенный старт] [Охват]',
              description: 'Быстрые просмотры записей на стене ВКонтакте для повышения виральности.',
              rate: 2.19,
              markup: 2.0,
              minQty: 50,
              maxQty: 500000,
              externalId: '2090',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
            {
              name: 'VK Просмотры на Клипы (Reels) [Высокая скорость]',
              description: 'Просмотры для вывода клипов ВК в рекомендации ленты.',
              rate: 2.91,
              markup: 2.0,
              minQty: 50,
              maxQty: 1000000,
              externalId: '31952',
              targetType: 'POST',
              qualityTier: 'PREMIUM',
            },
          ],
        },
        {
          slug: 'vk-comments',
          name: '💬 Комментарии [Кастомные / РФ]',
          services: [
            {
              name: 'VK Кастомные комментарии [Свой текст] [Россия 🇷🇺]',
              description: 'Текст каждого комментария задаётся пользователем (по 1 строке).',
              rate: 750.00,
              markup: 1.5,
              minQty: 5,
              maxQty: 500,
              externalId: '3185',
              targetType: 'POST',
              customDataType: 'TEXTAREA',
              customDataLabel: 'Введите тексты комментариев (по одному на строку)',
              qualityTier: 'VIP',
            },
            {
              name: 'VK Положительные отзывы [Россия 🇷🇺]',
              description: 'Живые положительные комментарии под постом или товаром.',
              rate: 750.00,
              markup: 1.5,
              minQty: 5,
              maxQty: 1000,
              externalId: '3186',
              targetType: 'POST',
              qualityTier: 'PREMIUM',
            },
          ],
        },
      ],
    },

    // --- 2. YOUTUBE ---
    youtube: {
      categories: [
        {
          slug: 'yt-subscribers',
          name: '👥 Подписчики на канал',
          services: [
            {
              name: 'YouTube Подписчики [Быстрый старт] [Гарантия 30 дней ♻️]',
              description: 'Надежные подписчики для каналов с защитой от отписок.',
              rate: 836.00,
              markup: 1.5,
              minQty: 10,
              maxQty: 50000,
              externalId: '1682',
              targetType: 'CHANNEL',
              qualityTier: 'STANDARD',
            },
            {
              name: 'YouTube Подписчики [Премиум] [Гарантия 90 дней ♻️]',
              description: 'Премиальные подписчики с долгосрочной гарантией 3 месяца.',
              rate: 2044.00,
              markup: 1.5,
              minQty: 10,
              maxQty: 25000,
              externalId: '1795',
              targetType: 'CHANNEL',
              qualityTier: 'VIP',
            },
          ],
        },
        {
          slug: 'yt-views',
          name: '👁️ Просмотры видео и Shorts',
          services: [
            {
              name: 'YouTube Просмотры [Мгновенный старт] [С удержанием]',
              description: 'Качественные просмотры видеороликов с хорошим удержанием аудитории.',
              rate: 98.56,
              markup: 1.8,
              minQty: 100,
              maxQty: 1000000,
              externalId: '5475',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
            {
              name: 'YouTube Просмотры Shorts [Быстрый вывод в ТОП]',
              description: 'Просмотры коротких видео YouTube Shorts для попадания в рекомендации.',
              rate: 197.12,
              markup: 1.8,
              minQty: 100,
              maxQty: 500000,
              externalId: '5476',
              targetType: 'POST',
              qualityTier: 'PREMIUM',
            },
          ],
        },
        {
          slug: 'yt-likes',
          name: '❤️ Лайки на видео и Shorts [👍]',
          services: [
            {
              name: 'YouTube Лайки на видео [👍] [Быстрый старт]',
              description: 'Мгновенные лайки для видео и прямых трансляций.',
              rate: 78.85,
              markup: 1.8,
              minQty: 10,
              maxQty: 100000,
              externalId: '5478',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
            {
              name: 'YouTube Лайки [Премиум] [👍 🔥] [Без списаний ♻️]',
              description: 'Высококачественные лайки с пожизненной гарантией от списаний.',
              rate: 265.00,
              markup: 1.6,
              minQty: 10,
              maxQty: 50000,
              externalId: '686',
              targetType: 'POST',
              qualityTier: 'PREMIUM',
            },
          ],
        },
      ],
    },

    // --- 3. TIKTOK ---
    tiktok: {
      categories: [
        {
          slug: 'tt-subscribers',
          name: '👥 Подписчики в профиль',
          services: [
            {
              name: 'TikTok Подписчики [Быстрый старт] [Гарантия 30 дней ♻️]',
              description: 'Быстрый прирост фолловеров для открытия прямых трансляций.',
              rate: 158.32,
              markup: 1.5,
              minQty: 10,
              maxQty: 50000,
              externalId: '1647',
              targetType: 'PROFILE',
              qualityTier: 'STANDARD',
            },
            {
              name: 'TikTok Подписчики [Премиум] [Гарантия 90 дней ♻️]',
              description: 'Фолловеры высокого качества с гарантией от отписок на 3 месяца.',
              rate: 254.82,
              markup: 1.5,
              minQty: 10,
              maxQty: 30000,
              externalId: '24177',
              targetType: 'PROFILE',
              qualityTier: 'VIP',
            },
          ],
        },
        {
          slug: 'tt-views',
          name: '👁️ Просмотры видео',
          services: [
            {
              name: 'TikTok Просмотры видео [Мгновенный старт] [Рекомендации]',
              description: 'Мгновенный разгон просмотров для попадания в ленту рекомендаций For You.',
              rate: 6.71,
              markup: 2.0,
              minQty: 100,
              maxQty: 5000000,
              externalId: '40181',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
          ],
        },
        {
          slug: 'tt-likes',
          name: '❤️ Лайки на видео [❤️]',
          services: [
            {
              name: 'TikTok Лайки на видео [❤️] [Быстрый старт]',
              description: 'Лайки от живых аккаунтов на любые видеоролики TikTok.',
              rate: 121.77,
              markup: 1.6,
              minQty: 10,
              maxQty: 100000,
              externalId: '15023',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
          ],
        },
      ],
    },

    // --- 4. INSTAGRAM ---
    instagram: {
      categories: [
        {
          slug: 'ig-subscribers',
          name: '👥 Подписчики в профиль',
          services: [
            {
              name: 'Instagram Подписчики [Быстрый старт] [Гарантия 30 дней ♻️]',
              description: 'Фолловеры в профиль Instagram с автоматической докруткой при отписках.',
              rate: 145.00,
              markup: 1.5,
              minQty: 10,
              maxQty: 50000,
              externalId: 'ig_sub_30d',
              targetType: 'PROFILE',
              qualityTier: 'STANDARD',
            },
            {
              name: 'Instagram Подписчики [Премиум RU 🇷🇺] [Без списаний ♻️]',
              description: 'Русскоязычные качественные профили с аватарками и публикациями.',
              rate: 290.00,
              markup: 1.5,
              minQty: 10,
              maxQty: 25000,
              externalId: 'ig_sub_ru',
              targetType: 'PROFILE',
              qualityTier: 'VIP',
            },
          ],
        },
        {
          slug: 'ig-likes',
          name: '❤️ Лайки на фото и Reels [❤️ 🔥]',
          services: [
            {
              name: 'Instagram Лайки на публикации / Reels [❤️] [Мгновенно]',
              description: 'Быстрые лайки для вывода постов и Reels в ТОП хэштегов.',
              rate: 45.00,
              markup: 1.8,
              minQty: 10,
              maxQty: 100000,
              externalId: 'ig_likes_fast',
              targetType: 'POST',
              qualityTier: 'STANDARD',
            },
          ],
        },
      ],
    },
  };

  // 4. Apply Blueprint to all configured networks
  for (const [netSlug, netData] of Object.entries(catalogBlueprint)) {
    const network = await prisma.network.findFirst({
      where: {
        OR: [
          { slug: netSlug },
          { name: { contains: netSlug, mode: 'insensitive' } },
        ],
      },
      include: {
        categories: true,
      },
    });

    if (!network) continue;

    console.log(`\n=============================================`);
    console.log(`🛠️ Normalizing Network: [${network.name}] (slug: ${network.slug})`);
    console.log(`=============================================`);

    for (const catDef of netData.categories) {
      let cat = await prisma.category.findFirst({
        where: { networkId: network.id, slug: catDef.slug },
      });

      if (!cat) {
        cat = await prisma.category.create({
          data: {
            name: catDef.name,
            slug: catDef.slug,
            networkId: network.id,
            tenantId: 'all',
          },
        });
        console.log(`  ✨ Created Category: "${cat.name}" (slug: ${cat.slug})`);
      } else {
        cat = await prisma.category.update({
          where: { id: cat.id },
          data: {
            name: catDef.name,
            tenantId: 'all',
          },
        });
        console.log(`  🔄 Updated Category: "${cat.name}" (slug: ${cat.slug})`);
      }

      // Add services to category
      for (const sDef of catDef.services) {
        // Check if service already exists with this externalId or name
        const existing = await prisma.service.findFirst({
          where: {
            categoryId: cat.id,
            name: sDef.name,
          },
        });

        if (!existing) {
          const newS = await prisma.service.create({
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
          console.log(`    ✅ [${cat.name}] -> "${newS.name}" (${newS.rate} ₽/1k)`);
        } else {
          await prisma.service.update({
            where: { id: existing.id },
            data: {
              name: sDef.name,
              description: sDef.description,
              rate: sDef.rate,
              markup: sDef.markup,
              minQty: sDef.minQty,
              maxQty: sDef.maxQty,
              targetType: sDef.targetType,
              qualityTier: sDef.qualityTier,
              tenantId: 'all',
              isActive: true,
            },
          });
          console.log(`    🔄 Updated Service: "${existing.name}"`);
        }
      }
    }
  }

  // 5. Purge and synchronize Redis catalog cache
  try {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    const keys = await redis.keys('catalog*');
    const netKeys = await redis.keys('network*');
    const allKeys = [...keys, ...netKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
      console.log(`\n⚡ Cleared ${allKeys.length} Redis cache keys`);
    }
    await redis.quit();
  } catch (err) {
    console.warn('Redis purge warning:', err.message);
  }

  console.log('\n🎉 [COMPLETE] All Social Networks & Services are now 100% Normalized with Emojis and Quality Tiers!');
  await prisma.$disconnect();
}

normalizeFullCatalog().catch(console.error);
