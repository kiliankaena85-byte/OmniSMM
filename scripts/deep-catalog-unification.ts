import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  console.log('=== STARTING DEEP CATALOG TAXONOMY UNIFICATION ===\n');

  // =========================================================================
  // 1. ОДНОКЛАССНИКИ (OK)
  // =========================================================================
  const okNet = await db.network.findFirst({ where: { slug: 'ok' } });
  if (okNet) {
    console.log('Refining Одноклассники (OK)...');
    const okCategories = [
      { name: '👥 Участники в группу', slug: 'ok-members', sort: 1 },
      { name: '❤️ Классы и лайки', slug: 'ok-likes', sort: 2 },
      { name: '👁️ Просмотры записей и видео', slug: 'ok-views', sort: 3 },
      { name: '🔄 Поделиться / Репосты', slug: 'ok-shares', sort: 4 },
    ];

    const okCatMap = new Map<string, string>();
    for (const c of okCategories) {
      const existing = await db.category.findFirst({
        where: { networkId: okNet.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        okCatMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: okNet.id, tenantId: 'smmplan' }
        });
        okCatMap.set(c.slug, created.id);
      }
    }

    const okServices = await db.service.findMany({ where: { category: { networkId: okNet.id } } });
    for (const s of okServices) {
      let catSlug = 'ok-members';
      let cleanName = s.name;
      let cleanDesc = 'Быстрое и безопасное продвижение в Одноклассниках с гарантией качества.';

      const ext = s.externalId || '';
      const r = s.rate || 0;

      if (ext === '6589' || r < 500) {
        catSlug = 'ok-likes';
        cleanName = '[Быстрые] Классы на посты и фото (Эконом)';
        cleanDesc = 'Моментальный старт и высокая скорость накрутки классов для вывода публикаций в топ ленты.';
      } else if (ext === '34856' || (r >= 1000 && r < 1800)) {
        catSlug = 'ok-views';
        cleanName = '[Охват] Просмотры публикаций и тем';
        cleanDesc = 'Естественные просмотры записей и видео от реальных пользователей ОК для повышения вирального охвата.';
      } else if (ext === '34859' || (r >= 2000 && r < 3000)) {
        catSlug = 'ok-shares';
        cleanName = '[В ленту] Репосты записей (Поделиться)';
        cleanDesc = 'Репосты ваших публикаций на личные страницы пользователей для взрывного распространения контента.';
      } else if (ext === '18486' || (r >= 4000 && r < 6000)) {
        catSlug = 'ok-members';
        cleanName = '[Активные] Участники в группу (Стандарт)';
        cleanDesc = 'Качественные участники с аватарками и заполненными профилями для роста группы.';
      } else if (ext === '18488' || r >= 8000) {
        catSlug = 'ok-members';
        cleanName = '[Премиум РФ] Участники в группу (Живые)';
        cleanDesc = 'Живая русскоязычная аудитория с максимальной активностью и гарантией от списаний.';
      } else {
        catSlug = 'ok-members';
        cleanName = '[Базовый рост] Участники в группу (Эконом)';
        cleanDesc = 'Экономичный тариф для быстрого набора первичной массы участников в группу.';
      }

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: okCatMap.get(catSlug)!,
          isActive: true
        }
      });
    }
  }

  // =========================================================================
  // 2. LIKEE
  // =========================================================================
  const likeeNet = await db.network.findFirst({ where: { slug: 'likee' } });
  if (likeeNet) {
    console.log('Refining Likee...');
    const likeeCategories = [
      { name: '👥 Подписчики', slug: 'likee-subscribers', sort: 1 },
      { name: '❤️ Лайки', slug: 'likee-likes', sort: 2 },
      { name: '👁️ Просмотры видео', slug: 'likee-views', sort: 3 },
      { name: '🔄 Репосты', slug: 'likee-shares', sort: 4 },
    ];

    const likeeCatMap = new Map<string, string>();
    for (const c of likeeCategories) {
      const existing = await db.category.findFirst({
        where: { networkId: likeeNet.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        likeeCatMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: likeeNet.id, tenantId: 'smmplan' }
        });
        likeeCatMap.set(c.slug, created.id);
      }
    }

    const likeeServices = await db.service.findMany({ where: { category: { networkId: likeeNet.id } } });
    for (const s of likeeServices) {
      let catSlug = 'likee-subscribers';
      let cleanName = s.name;
      let cleanDesc = 'Эффективное продвижение профилей и видео Likee с безопасным алгоритмом накрутки.';

      const ext = s.externalId || '';
      const r = s.rate || 0;

      if (ext === '18652' || r < 300) {
        catSlug = 'likee-views';
        cleanName = '[Быстрый старт] Просмотры видео Likee (Эконом)';
        cleanDesc = 'Мгновенные просмотры на опубликованные видеоролики Likee для быстрого вывода в ленту рекомендаций.';
      } else if (ext === '2048' || ext === '28605' || ext === '28604' || (r >= 600 && r < 1600)) {
        catSlug = 'likee-likes';
        cleanName = ext === '28604' ? '[HQ Качество] Лайки Likee (Стандарт)' : '[Моментальные] Лайки на видео Likee (Эконом)';
        cleanDesc = 'Быстрые лайки от активных пользователей для повышения позиций видео в трендах Likee.';
      } else if (ext === '28609' || (r >= 2000 && r < 3000)) {
        catSlug = 'likee-shares';
        cleanName = '[Виральность] Репосты видео Likee (Поделиться)';
        cleanDesc = 'Репосты видео среди пользователей Likee для органического охвата и вирусного роста.';
      } else if (ext === '28602' || ext === '26026' || (r >= 3500 && r < 6000)) {
        catSlug = 'likee-subscribers';
        cleanName = '[Базовый рост] Подписчики Likee (Эконом)';
        cleanDesc = 'Надежный тариф для быстрого старта и набора первых подписчиков в профиль.';
      } else if (ext === '2046' || ext === '26023' || (r >= 10000 && r < 20000)) {
        catSlug = 'likee-subscribers';
        cleanName = '[Живые аккаунты] Подписчики Likee (Стандарт)';
        cleanDesc = 'Качественные подписчики с заполненными аккаунтами и гарантией стабильности.';
      } else if (ext === '2047' || ext === '25362' || ext === '26024' || r >= 25000) {
        catSlug = 'likee-subscribers';
        cleanName = '[Премиум РФ] Подписчики Likee (Живые)';
        cleanDesc = 'Премиальная живая аудитория с высоким уровнем удержания для блогеров и инфлюенсеров.';
      }

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: likeeCatMap.get(catSlug)!,
          isActive: true
        }
      });
    }
  }

  // =========================================================================
  // 3. ВКОНТАКТЕ (VK)
  // =========================================================================
  const vkNet = await db.network.findFirst({ where: { slug: 'vk' } });
  if (vkNet) {
    console.log('Refining ВКонтакте (VK)...');
    const vkCategories = [
      { name: '👥 Подписчики в группу', slug: 'vk-subscribers', sort: 1 },
      { name: '👤 Друзья на страницу', slug: 'vk-friends', sort: 2 },
      { name: '❤️ Лайки на публикации', slug: 'vk-likes', sort: 3 },
      { name: '👁️ Просмотры постов и клипов', slug: 'vk-views', sort: 4 },
      { name: '🔄 Репосты записей', slug: 'vk-reposts', sort: 5 },
      { name: '💬 Комментарии', slug: 'vk-comments', sort: 6 },
    ];

    const vkCatMap = new Map<string, string>();
    for (const c of vkCategories) {
      const existing = await db.category.findFirst({
        where: { networkId: vkNet.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        vkCatMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: vkNet.id, tenantId: 'smmplan' }
        });
        vkCatMap.set(c.slug, created.id);
      }
    }

    const vkServices = await db.service.findMany({ where: { category: { networkId: vkNet.id } } });
    for (const s of vkServices) {
      let catSlug = 'vk-subscribers';
      let cleanName = s.name;
      let cleanDesc = 'Безопасное продвижение ВКонтакте с умным интервалом запуска и защитой от фильтров.';

      const lower = s.name.toLowerCase();
      const ext = s.externalId || '';
      const r = s.rate || 0;

      if (lower.includes('лайк') || ext === '31481') {
        catSlug = 'vk-likes';
        cleanName = lower.includes('комментар') ? '[Быстрые] Лайки на комментарии' : '[Моментальные] Лайки на посты и фото';
        cleanDesc = 'Быстрые лайки от пользователей ВК для вывода поста в умную ленту.';
      } else if (lower.includes('просмотр') || lower.includes('клип') || lower.includes('посещен')) {
        catSlug = 'vk-views';
        cleanName = lower.includes('клип') ? '[VK Клипы] Просмотры видеоклипов' : '[Охват] Просмотры записей и историй';
        cleanDesc = 'Просмотры записей и клипов реальными пользователями с фиксацией в статистике сообщества.';
      } else if (lower.includes('репост')) {
        catSlug = 'vk-reposts';
        cleanName = '[Виральный охват] Репосты записей на стены пользователей';
        cleanDesc = 'Репосты ваших публикаций на стены активных пользователей ВК.';
      } else if (lower.includes('комментар')) {
        catSlug = 'vk-comments';
        cleanName = '[Осмысленные] Положительные комментарии к посту';
        cleanDesc = 'Качественные русскоязычные комментарии для создания оживленной дискуссии.';
      } else if (lower.includes('друг') || lower.includes('профил')) {
        catSlug = 'vk-friends';
        cleanName = '[Живые заявки] Друзья и подписчики на профиль';
        cleanDesc = 'Входящие заявки в друзья на личную страницу от пользователей РФ/СНГ.';
      } else {
        catSlug = 'vk-subscribers';
        if (r < 600) {
          cleanName = '[Базовый рост] Подписчики в группу (Эконом)';
        } else if (r >= 600 && r < 2000) {
          cleanName = '[Офферные РФ] Подписчики в сообщество (Стандарт)';
        } else if (r >= 2000 && r < 5000) {
          cleanName = '[Живые пользователи] Подписчики в паблик (Премиум)';
        } else {
          cleanName = '[С гарантией 30 дней] Подписчики в группу (Без списаний)';
        }
        cleanDesc = 'Подписчики в группу или публичную страницу ВКонтакте с плавным набором.';
      }

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: vkCatMap.get(catSlug)!,
          isActive: true
        }
      });
    }
  }

  // =========================================================================
  // 4. YOUTUBE
  // =========================================================================
  const ytNet = await db.network.findFirst({ where: { slug: 'youtube' } });
  if (ytNet) {
    console.log('Refining YouTube...');
    const ytCategories = [
      { name: '👁️ Просмотры видео', slug: 'yt-views', sort: 1 },
      { name: '👥 Подписчики на канал', slug: 'yt-subscribers', sort: 2 },
      { name: '❤️ Лайки на видео', slug: 'yt-likes', sort: 3 },
      { name: '💬 Комментарии', slug: 'yt-comments', sort: 4 },
      { name: '⏱️ Часы просмотров (Монетизация)', slug: 'yt-watchtime', sort: 5 },
    ];

    const ytCatMap = new Map<string, string>();
    for (const c of ytCategories) {
      const existing = await db.category.findFirst({
        where: { networkId: ytNet.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        ytCatMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: ytNet.id, tenantId: 'smmplan' }
        });
        ytCatMap.set(c.slug, created.id);
      }
    }

    const ytServices = await db.service.findMany({ where: { category: { networkId: ytNet.id } } });
    for (const s of ytServices) {
      let catSlug = 'yt-views';
      let cleanName = s.name;
      let cleanDesc = 'Продвижение видео и каналов YouTube с высоким удержанием и безопасной скоростью.';

      const lower = s.name.toLowerCase();
      const r = s.rate || 0;

      if (lower.includes('подписчик') || r >= 5000) {
        catSlug = 'yt-subscribers';
        cleanName = r >= 15000 ? '[Без списаний] Подписчики на канал YouTube (Гарантия)' : '[Стабильные] Подписчики на канал YouTube';
        cleanDesc = 'Реальные подписчики на канал YouTube для выполнения условий партнерской программы.';
      } else if (lower.includes('лайк') || (r >= 650 && r < 1000)) {
        catSlug = 'yt-likes';
        cleanName = '[Быстрые] Лайки на видео YouTube (HQ)';
        cleanDesc = 'Быстрые лайки от активных пользователей для улучшения поведенческих факторов видео.';
      } else if (lower.includes('час') || lower.includes('монетизац')) {
        catSlug = 'yt-watchtime';
        cleanName = '[4000 часов] Часы просмотров для монетизации YouTube';
        cleanDesc = 'Просмотры длинных видео для быстрого набора 4000 часов и подключения монетизации.';
      } else {
        catSlug = 'yt-views';
        if (r < 600) {
          cleanName = '[Быстрый старт] Просмотры видео YouTube (Эконом)';
        } else if (r >= 600 && r < 1200) {
          cleanName = '[Высокое удержание] Просмотры видео YouTube (Стандарт)';
        } else {
          cleanName = '[Вывод в ТОП] Просмотры видео YouTube (Премиум)';
        }
        cleanDesc = 'Просмотры видео с высоким удержанием для продвижения ролика в алгоритмах YouTube.';
      }

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: ytCatMap.get(catSlug)!,
          isActive: true
        }
      });
    }
  }

  // =========================================================================
  // 5. INSTAGRAM
  // =========================================================================
  const igNet = await db.network.findFirst({ where: { slug: 'instagram' } });
  if (igNet) {
    console.log('Refining Instagram...');
    const igCategories = [
      { name: '👥 Подписчики в профиль', slug: 'ig-subscribers', sort: 1 },
      { name: '❤️ Лайки на публикации', slug: 'ig-likes', sort: 2 },
      { name: '🎬 Просмотры Reels и Stories', slug: 'ig-views', sort: 3 },
      { name: '💾 Сохранения и охваты', slug: 'ig-saves', sort: 4 },
    ];

    const igCatMap = new Map<string, string>();
    for (const c of igCategories) {
      const existing = await db.category.findFirst({
        where: { networkId: igNet.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        igCatMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: igNet.id, tenantId: 'smmplan' }
        });
        igCatMap.set(c.slug, created.id);
      }
    }

    const igServices = await db.service.findMany({ where: { category: { networkId: igNet.id } } });
    for (const s of igServices) {
      let catSlug = 'ig-subscribers';
      let cleanName = s.name;
      let cleanDesc = 'Безопасная раскрутка Instagram-аккаунтов с имитацией действий живых пользователей.';

      const lower = s.name.toLowerCase();
      const r = s.rate || 0;

      if (lower.includes('лайк') || r < 300) {
        catSlug = 'ig-likes';
        cleanName = '[Моментальные] Лайки на посты и фото Instagram';
        cleanDesc = 'Быстрые лайки для вывода публикации в ленту исследуемого контента Instagram.';
      } else if (lower.includes('просмотр') || lower.includes('reels') || lower.includes('stories')) {
        catSlug = 'ig-views';
        cleanName = '[Тренды] Просмотры Instagram Reels и Stories';
        cleanDesc = 'Просмотры коротких видео Reels для попадания в рекомендации широкой аудитории.';
      } else if (lower.includes('сохранен') || lower.includes('охват')) {
        catSlug = 'ig-saves';
        cleanName = '[Алгоритмы] Сохранения и показы публикаций';
        cleanDesc = 'Сохранения постов в закладки для резкого поднятия авторитета аккаунта в глазах алгоритмов.';
      } else {
        catSlug = 'ig-subscribers';
        if (r < 800) {
          cleanName = '[Быстрый старт] Подписчики в профиль Instagram (Эконом)';
        } else if (r >= 800 && r < 2500) {
          cleanName = '[С аватарками] Подписчики в профиль Instagram (Стандарт)';
        } else if (r >= 2500 && r < 6000) {
          cleanName = '[Живая аудитория] Подписчики в профиль Instagram (Премиум)';
        } else {
          cleanName = '[Без списаний] Подписчики Instagram (Гарантия 30 дней)';
        }
        cleanDesc = 'Качественные подписчики с аватарками и заполненными профилями.';
      }

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: igCatMap.get(catSlug)!,
          isActive: true
        }
      });
    }
  }

  // =========================================================================
  // 6. TIKTOK
  // =========================================================================
  const ttNet = await db.network.findFirst({ where: { slug: 'tiktok' } });
  if (ttNet) {
    console.log('Refining TikTok...');
    const ttCategories = [
      { name: '👥 Подписчики в профиль', slug: 'tt-subscribers', sort: 1 },
      { name: '👁️ Просмотры видео', slug: 'tt-views', sort: 2 },
      { name: '❤️ Лайки на видео', slug: 'tt-likes', sort: 3 },
      { name: '🔄 Репосты и сохранения', slug: 'tt-shares', sort: 4 },
    ];

    const ttCatMap = new Map<string, string>();
    for (const c of ttCategories) {
      const existing = await db.category.findFirst({
        where: { networkId: ttNet.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        ttCatMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: ttNet.id, tenantId: 'smmplan' }
        });
        ttCatMap.set(c.slug, created.id);
      }
    }

    const ttServices = await db.service.findMany({ where: { category: { networkId: ttNet.id } } });
    for (const s of ttServices) {
      let catSlug = 'tt-views';
      let cleanName = s.name;
      let cleanDesc = 'Продвижение видео в рекомендации TikTok с высокой скоростью набора метрик.';

      const lower = s.name.toLowerCase();
      const r = s.rate || 0;

      if (lower.includes('подписчик') || r >= 1500) {
        catSlug = 'tt-subscribers';
        cleanName = r >= 4000 ? '[Без списаний] Подписчики TikTok (Гарантия)' : '[Быстрый рост] Подписчики в профиль TikTok';
        cleanDesc = 'Быстрые подписчики в профиль TikTok для доступа к прямым эфирам и расширенным функциям.';
      } else if (lower.includes('лайк') || (r >= 400 && r < 1500)) {
        catSlug = 'tt-likes';
        cleanName = '[Быстрые] Лайки на видео TikTok (HQ)';
        cleanDesc = 'Лайки от активных пользователей TikTok для вывода видео в тренды.';
      } else if (lower.includes('репост') || lower.includes('сохранен')) {
        catSlug = 'tt-shares';
        cleanName = '[Рекомендации] Репосты и добавления в избранное TikTok';
        cleanDesc = 'Добавления видео в закладки и репосты для взрывного роста виральности.';
      } else {
        catSlug = 'tt-views';
        if (r < 50) {
          cleanName = '[Моментальные] Просмотры видео TikTok (Эконом)';
        } else if (r >= 50 && r < 200) {
          cleanName = '[Тренды] Просмотры видео TikTok (Стандарт)';
        } else {
          cleanName = '[Максимальный охват] Просмотры видео TikTok (Премиум)';
        }
        cleanDesc = 'Моментальные просмотры видео с плавным стартом для продвижения в рекомендации.';
      }

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: ttCatMap.get(catSlug)!,
          isActive: true
        }
      });
    }
  }

  // =========================================================================
  // 7. CLEANUP ALL EMPTY CATEGORIES ACROSS ALL NETWORKS
  // =========================================================================
  console.log('\n🧹 Cleaning up any empty categories across the entire catalog...');
  const emptyCategories = await db.category.findMany({
    where: {
      services: { none: {} }
    }
  });

  console.log(`Found ${emptyCategories.length} empty categories.`);
  for (const c of emptyCategories) {
    await db.category.delete({ where: { id: c.id } });
    console.log(`✓ Deleted empty category: "${c.name}" (${c.id})`);
  }

  console.log('\n=============================================================');
  console.log('🎉 DEEP CATALOG TAXONOMY UNIFICATION COMPLETED 100% GREEN!');
  console.log('=============================================================');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
