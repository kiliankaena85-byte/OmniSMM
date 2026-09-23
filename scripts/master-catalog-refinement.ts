import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

interface CategoryTemplate {
  name: string;
  slug: string;
  sort: number;
  keywords: string[];
  defaultDesc: string;
}

interface NetworkRefinementConfig {
  slug: string;
  name: string;
  categories: CategoryTemplate[];
  defaultCategorySlug: string;
}

const REFINEMENT_CONFIGS: NetworkRefinementConfig[] = [
  {
    slug: 'likee',
    name: 'Likee',
    defaultCategorySlug: 'likee-subscribers',
    categories: [
      {
        name: '👥 Подписчики',
        slug: 'likee-subscribers',
        sort: 1,
        keywords: ['подписчик', 'профиль', 'фолловер', 'subscribers', 'followers'],
        defaultDesc: 'Качественные подписчики в профиль Likee с плавным стартом и естественной скоростью.'
      },
      {
        name: '❤️ Лайки',
        slug: 'likee-likes',
        sort: 2,
        keywords: ['лайк', 'like', 'сердечк'],
        defaultDesc: 'Быстрые лайки на видео Likee для быстрого вывода в рекомендации.'
      },
      {
        name: '👁️ Просмотры видео',
        slug: 'likee-views',
        sort: 3,
        keywords: ['просмотр', 'view', 'охват'],
        defaultDesc: 'Просмотры на видео Likee с высоким удержанием для продвижения в алгоритмах.'
      },
      {
        name: '🔄 Репосты',
        slug: 'likee-shares',
        sort: 4,
        keywords: ['репост', 'поделит', 'share'],
        defaultDesc: 'Репосты видео Likee для вирального охвата аудитории.'
      }
    ]
  },
  {
    slug: 'rutube',
    name: 'Rutube',
    defaultCategorySlug: 'rutube-views',
    categories: [
      {
        name: '👁️ Просмотры видео',
        slug: 'rutube-views',
        sort: 1,
        keywords: ['просмотр', 'view', 'удержан'],
        defaultDesc: 'Просмотры видео на Rutube с высоким удержанием аудитории.'
      },
      {
        name: '👥 Подписчики на канал',
        slug: 'rutube-subscribers',
        sort: 2,
        keywords: ['подписчик', 'канал', 'subscribers'],
        defaultDesc: 'Живые подписчики на канал Rutube для роста авторитета и монетизации.'
      },
      {
        name: '❤️ Лайки и реакции',
        slug: 'rutube-likes',
        sort: 3,
        keywords: ['лайк', 'топ', 'реакци', 'like'],
        defaultDesc: 'Положительные реакции и лайки для продвижения видео в ТОП Rutube.'
      },
      {
        name: '💬 Комментарии',
        slug: 'rutube-comments',
        sort: 4,
        keywords: ['комментар', 'отзыв', 'comment'],
        defaultDesc: 'Осмысленные комментарии под видео для повышения вовлеченности.'
      }
    ]
  },
  {
    slug: 'ok',
    name: 'Одноклассники',
    defaultCategorySlug: 'ok-subscribers',
    categories: [
      {
        name: '👥 Участники в группу',
        slug: 'ok-subscribers',
        sort: 1,
        keywords: ['участник', 'групп', 'подписчик', 'друзь'],
        defaultDesc: 'Участники в группу или паблик в Одноклассниках с гарантией от списаний.'
      },
      {
        name: '❤️ Классы и лайки',
        slug: 'ok-likes',
        sort: 2,
        keywords: ['класс', 'лайк', 'like'],
        defaultDesc: 'Классы на посты и фото в Одноклассниках для максимального вирусного охвата.'
      },
      {
        name: '👁️ Просмотры записей',
        slug: 'ok-views',
        sort: 3,
        keywords: ['просмотр', 'view'],
        defaultDesc: 'Просмотры видео и публикаций в Одноклассниках.'
      },
      {
        name: '🔄 Поделиться / Репосты',
        slug: 'ok-shares',
        sort: 4,
        keywords: ['поделит', 'репост', 'share'],
        defaultDesc: 'Репосты записей в личные ленты пользователей ОК.'
      }
    ]
  },
  {
    slug: 'twitch',
    name: 'Twitch',
    defaultCategorySlug: 'twitch-followers',
    categories: [
      {
        name: '👥 Фолловеры на канал',
        slug: 'twitch-followers',
        sort: 1,
        keywords: ['фолловер', 'подписчик', 'follower', 'канал'],
        defaultDesc: 'Быстрые и стабильные фолловеры на канал Twitch для партнерки и аффилейта.'
      },
      {
        name: '👁️ Зрители на стрим',
        slug: 'twitch-viewers',
        sort: 2,
        keywords: ['зрител', 'минут', 'час', 'стрим', 'view', 'онлайн'],
        defaultDesc: 'Стабильные зрители на прямой эфир Twitch с удержанием выбранного времени.'
      },
      {
        name: '💬 Чат-боты и активность',
        slug: 'twitch-chat',
        sort: 3,
        keywords: ['чат', 'сообщен', 'chat'],
        defaultDesc: 'Активность в чате стрима для создания живой атмосферы.'
      }
    ]
  },
  {
    slug: 'twitter',
    name: 'Twitter (X)',
    defaultCategorySlug: 'twitter-followers',
    categories: [
      {
        name: '👥 Читатели / Подписчики',
        slug: 'twitter-followers',
        sort: 1,
        keywords: ['читател', 'подписчик', 'follower'],
        defaultDesc: 'Читатели профиля в Twitter (X) с аватарками и заполненными профилями.'
      },
      {
        name: '❤️ Лайки и ретвиты',
        slug: 'twitter-likes',
        sort: 2,
        keywords: ['лайк', 'ретвит', 'retweet', 'like'],
        defaultDesc: 'Лайки и ретвиты твитов для повышения охвата и попадания в тренды.'
      },
      {
        name: '👁️ Просмотры твитов',
        slug: 'twitter-views',
        sort: 3,
        keywords: ['просмотр', 'view', 'impression'],
        defaultDesc: 'Официальные показы и просмотры твитов в ленте.'
      }
    ]
  },
  {
    slug: 'facebook',
    name: 'Facebook',
    defaultCategorySlug: 'fb-followers',
    categories: [
      {
        name: '👥 Подписчики на страницу / профиль',
        slug: 'fb-followers',
        sort: 1,
        keywords: ['подписчик', 'страниц', 'профил', 'групп', 'follower'],
        defaultDesc: 'Подписчики на бизнес-страницы и личные профили Facebook.'
      },
      {
        name: '❤️ Лайки и реакции',
        slug: 'fb-likes',
        sort: 2,
        keywords: ['лайк', 'реакци', 'like'],
        defaultDesc: 'Лайки и эмоциональные реакции (👍, ❤️, 😮) на посты Facebook.'
      },
      {
        name: '👁️ Просмотры видео',
        slug: 'fb-views',
        sort: 3,
        keywords: ['просмотр', 'video', 'view', 'reels'],
        defaultDesc: 'Просмотры видео и Reels в Facebook с высокой скоростью запуска.'
      }
    ]
  },
  {
    slug: 'dzen',
    name: 'Дзен',
    defaultCategorySlug: 'dzen-subscribers',
    categories: [
      {
        name: '👥 Подписчики на канал',
        slug: 'dzen-subscribers',
        sort: 1,
        keywords: ['подписчик', 'канал', 'subscriber'],
        defaultDesc: 'Активные подписчики на канал Яндекс Дзен для монетизации и роста.'
      },
      {
        name: '👁️ Дочитывания и просмотры',
        slug: 'dzen-reads',
        sort: 2,
        keywords: ['дочитыван', 'просмотр', 'секунд', 'сек', 'read', 'time'],
        defaultDesc: 'Дочитывания статей и просмотры видео с гарантированным временем удержания.'
      },
      {
        name: '❤️ Лайки на публикации',
        slug: 'dzen-likes',
        sort: 3,
        keywords: ['лайк', 'like'],
        defaultDesc: 'Лайки на статьи и посты Дзен для попадания в рекомендательные ленты.'
      }
    ]
  },
  {
    slug: 'max',
    name: 'MAX',
    defaultCategorySlug: 'max-subscribers',
    categories: [
      {
        name: '👥 Подписчики на канал',
        slug: 'max-subscribers',
        sort: 1,
        keywords: ['подписчик', 'канал', 'гарантия'],
        defaultDesc: 'Подписчики в каналы мессенджера MAX с быстрой скоростью набора.'
      },
      {
        name: '👁️ Просмотры постов',
        slug: 'max-views',
        sort: 2,
        keywords: ['просмотр', 'пост'],
        defaultDesc: 'Просмотры на последние и отдельные посты в MAX.'
      },
      {
        name: '❤️ Реакции на пост',
        slug: 'max-reactions',
        sort: 3,
        keywords: ['реакци', '👍', '❤️', '🔥', 'положительн'],
        defaultDesc: 'Живые реакции на публикации в мессенджере MAX.'
      }
    ]
  }
];

async function main() {
  console.log('=== STARTING MASTER CATALOG REFINEMENT ===\n');

  for (const netCfg of REFINEMENT_CONFIGS) {
    const net = await db.network.findFirst({ where: { slug: netCfg.slug } });
    if (!net) {
      console.log(`Network ${netCfg.slug} not found, skipping.`);
      continue;
    }

    console.log(`\n========================================`);
    console.log(`🌐 Refining Network: ${net.name} (${net.slug})`);
    console.log(`========================================`);

    // 1. Create/update canonical categories
    const catMap = new Map<string, { id: string; defaultDesc: string; name: string }>();
    for (const c of netCfg.categories) {
      const existing = await db.category.findFirst({
        where: {
          networkId: net.id,
          OR: [{ slug: c.slug }, { name: c.name }]
        }
      });

      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        catMap.set(c.slug, { id: u.id, defaultDesc: c.defaultDesc, name: c.name });
        console.log(`  ✓ Updated Category: "${u.name}" (${u.id})`);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: net.id, tenantId: 'smmplan' }
        });
        catMap.set(c.slug, { id: created.id, defaultDesc: c.defaultDesc, name: created.name });
        console.log(`  + Created Category: "${created.name}" (${created.id})`);
      }
    }

    // 2. Fetch all services for this network
    const services = await db.service.findMany({
      where: { category: { networkId: net.id } }
    });

    console.log(`  📊 Classifying and improving ${services.length} services...`);

    for (const s of services) {
      const lower = s.name.toLowerCase();
      let matchedSlug = netCfg.defaultCategorySlug;

      for (const c of netCfg.categories) {
        if (c.keywords.some(kw => lower.includes(kw))) {
          matchedSlug = c.slug;
          break;
        }
      }

      const targetCatInfo = catMap.get(matchedSlug) || catMap.get(netCfg.defaultCategorySlug)!;
      
      // Construct a clean, beautiful name
      let cleanName = s.name
        .replace(/primelike/gi, '')
        .replace(/vexboost/gi, '')
        .replace(/smm_panelus/gi, '')
        .replace(/smmprime/gi, '')
        .replace(/stream_promotion/gi, '')
        .replace(/soc_rocket/gi, '')
        .replace(/boost_like/gi, '')
        .replace(/#\d+/g, '')
        .trim();

      // If name is too short/generic (e.g. "Стандарт", "Эконом"), prepend the activity name
      if (['эконом', 'стандарт', 'премиум', 'быстрые', 'супер эконом', 'офферные рф/снг', 'живые пользователи'].includes(cleanName.toLowerCase())) {
        const rawCategoryClean = targetCatInfo.name.replace(/^[^\wа-яА-ЯёЁ]+/, '').trim(); // Strip emoji
        cleanName = `${rawCategoryClean} [${cleanName}]`;
      }

      // Professional description
      const cleanDesc = targetCatInfo.defaultDesc;

      await db.service.update({
        where: { id: s.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          categoryId: targetCatInfo.id,
          isActive: true
        }
      });
    }

    // 3. Delete obsolete empty categories
    const validCatIds = Array.from(catMap.values()).map(v => v.id);
    const obsolete = await db.category.findMany({
      where: { networkId: net.id, id: { notIn: validCatIds } },
      include: { services: true }
    });

    for (const obs of obsolete) {
      if (obs.services.length === 0) {
        await db.category.delete({ where: { id: obs.id } });
        console.log(`  ✓ Deleted obsolete empty category: "${obs.name}" (${obs.id})`);
      } else {
        console.log(`  ⚠️ Obsolete category "${obs.name}" still has ${obs.services.length} services`);
      }
    }
  }

  // 4. Global cleanup of all remaining descriptions across ALL services in the entire DB
  console.log(`\n🧹 Performing global description cleansing across all services...`);
  const allServices = await db.service.findMany({
    where: {
      OR: [
        { description: { contains: 'toolbox', mode: 'insensitive' } },
        { description: { contains: 'primelike', mode: 'insensitive' } },
        { description: { contains: 'vexboost', mode: 'insensitive' } },
      ]
    },
    include: { category: true }
  });

  console.log(`Found ${allServices.length} services with legacy vendor descriptions.`);
  for (const s of allServices) {
    const cleanDesc = 'Высококачественная услуга продвижения с гарантией стабильности и плавным запуском.';
    await db.service.update({
      where: { id: s.id },
      data: { description: cleanDesc }
    });
  }

  console.log('\n🎉 MASTER CATALOG REFINEMENT FINISHED 100% SUCCESSFULLY!');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
