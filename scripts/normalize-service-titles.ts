/**
 * scripts/normalize-service-titles.ts
 *
 * Super-clean normalization of all service names in DB:
 * Format: "{Тип услуги} — {Тариф / Качество} [{Бейджи}]"
 *
 * Examples:
 *   "Подписчики — Эконом"
 *   "Подписчики — Стандарт [Гарантия 30д]"
 *   "Подписчики — Премиум [RU • Живые]"
 *   "Лайки — Моментальные"
 *   "Просмотры видео — Быстрый старт [до 50k/д]"
 *   "Реакции — Позитивные микс [⚡ Быстрые]"
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const ACTION_TITLES: Record<string, string> = {
  SUBSCRIBERS: 'Подписчики',
  GROUPS: 'Подписчики в группу',
  LIKES: 'Лайки',
  VIEWS: 'Просмотры',
  COMMENTS: 'Комментарии',
  REACTIONS: 'Реакции',
  REPOSTS: 'Репосты',
  AUTO_VIEWS: 'Автопросмотры',
  AUTO_LIKES: 'Автолайки',
  AUTO_REACTIONS: 'Автореакции',
  AUTO_REPOSTS: 'Авторепосты',
  AUTO_COMMENTS: 'Автокомментарии',
  BOOSTS: 'Бусты',
  POLLS: 'Голоса в опросе',
  STORIES: 'Просмотры историй',
  BOTS: 'Запуск ботов',
  REFERRALS: 'Рефералы',
  FRIENDS: 'Заявки в друзья',
  PLAYS: 'Прослушивания',
  TRAFFIC: 'Трафик',
  DISLIKES: 'Дизлайки',
  STARS: 'Telegram Звёзды',
  SAVES: 'Сохранения',
  COMPLAINTS: 'Жалобы',
  STREAMS: 'Зрители на стрим',
  PREMIUM: 'Премиум подписчики',
  RECOVER: 'Восстановление',
  OTHER: 'Продвижение',
};

function getActionTitle(category: { name: string; activityType: string | null } | null): string {
  if (!category) return 'Услуга';
  if (category.activityType && ACTION_TITLES[category.activityType]) {
    return ACTION_TITLES[category.activityType];
  }

  const catName = category.name.toLowerCase();
  if (catName.includes('подпис') || catName.includes('участник') || catName.includes('фолловер') || catName.includes('читател')) {
    if (catName.includes('групп')) return 'Подписчики в группу';
    if (catName.includes('канал')) return 'Подписчики на канал';
    if (catName.includes('профил')) return 'Подписчики в профиль';
    return 'Подписчики';
  }
  if (catName.includes('лайк') || catName.includes('класс') || catName.includes('нравится')) return 'Лайки';
  if (catName.includes('просмотр') || catName.includes('охват') || catName.includes('дочитыван')) {
    if (catName.includes('видео')) return 'Просмотры видео';
    if (catName.includes('пост') || catName.includes('запис')) return 'Просмотры постов';
    return 'Просмотры';
  }
  if (catName.includes('реакц') || catName.includes('эмодзи')) return 'Реакции';
  if (catName.includes('коммент') || catName.includes('отзыв')) return 'Комментарии';
  if (catName.includes('репост') || catName.includes('подели')) return 'Репосты';
  if (catName.includes('буст')) return 'Бусты';
  if (catName.includes('бот')) return 'Боты';
  if (catName.includes('опрос') || catName.includes('голос')) return 'Голоса';

  return category.name.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

function polishTariff(rawName: string, actionTitle: string): string {
  let text = rawName.trim();

  // Strip existing action prefix like "Подписчики — " if present
  text = text.replace(/^.*?[—–-]\s*/, '');

  // Strip raw IDs e.g. "ID1238", "ID: 412", "#1256"
  text = text.replace(/\b(id:?\s*\d+|#\d+)\b/gi, '');

  // Strip emojis from the tariff name body
  text = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}♻️]/gu, '');

  // Strip platform brand names from inside tariff
  const platformRegex = /\b(telegram|tg|instagram|inst|tiktok|youtube|yt|vk|вконтакте|max|ok|likee|dzen|twitch|twitter|facebook)\b/gi;
  text = text.replace(platformRegex, '');

  // Strip redundant action words if they are already in actionTitle
  const actionWordsRegex = /\b(подписчики|фолловеры|читатели|участники|просмотры|охваты|лайки|классы|реакции|комментарии|репосты|бусты|запуск ботов|боты|рефералы|дочитывания)\b/gi;
  text = text.replace(actionWordsRegex, '');

  // Strip target words
  const targetWordsRegex = /\b(в группу|на канал|в профиль|на страницу|на видео|на посты|на посты и фото|видео|постов и клипов|публикаций и тем|записей и историй|для ботов|канала)\b/gi;
  text = text.replace(targetWordsRegex, '');

  // Extract badges in brackets e.g. "[Гарантия 30д]" or "[Базовый рост]"
  const badges: string[] = [];
  const bracketMatches = text.match(/\[(.*?)\]/g);
  if (bracketMatches) {
    for (const b of bracketMatches) {
      const inside = b.replace(/^\[|\]$/g, '').trim();
      // Clean inside
      const cleanInside = inside
        .replace(platformRegex, '')
        .replace(actionWordsRegex, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanInside.length > 1) {
        badges.push(cleanInside);
      }
    }
    text = text.replace(/\[.*?\]/g, '');
  }

  // Clean parentheses
  const parenMatches = text.match(/\((.*?)\)/g);
  if (parenMatches) {
    for (const p of parenMatches) {
      const inside = p.replace(/^\(|\)$/g, '').trim();
      if (inside.length > 1 && !badges.some(b => b.toLowerCase() === inside.toLowerCase())) {
        badges.push(inside);
      }
    }
    text = text.replace(/\(.*?\)/g, '');
  }

  // Cleanup punctuation and multiple spaces
  text = text.replace(/[:|•–—/\\#*]+/g, ' ').replace(/\s+/g, ' ').trim();

  // If text is empty or too short, pick the first badge as tariff or default to "Стандарт"
  let mainTariff = text;
  if (!mainTariff || mainTariff.length < 2) {
    if (badges.length > 0) {
      mainTariff = badges.shift()!;
    } else {
      mainTariff = 'Стандарт';
    }
  }

  // Capitalize first letter
  mainTariff = mainTariff.charAt(0).toUpperCase() + mainTariff.slice(1);

  // Rebuild final title
  let finalTitle = `${actionTitle} — ${mainTariff}`;
  if (badges.length > 0) {
    // Filter duplicates
    const uniqueBadges = Array.from(new Set(badges.map(b => b.trim()))).filter(b => b.length > 1 && b.toLowerCase() !== mainTariff.toLowerCase());
    if (uniqueBadges.length > 0) {
      finalTitle += ` [${uniqueBadges.join(' • ')}]`;
    }
  }

  return finalTitle;
}

async function main() {
  console.log('====================================================');
  console.log('  ✨ Polishing All Service Titles to Perfection     ');
  console.log('====================================================\n');

  const services = await db.service.findMany({
    where: { isActive: true },
    include: {
      category: {
        include: { network: true },
      },
    },
    orderBy: { numericId: 'asc' },
  });

  console.log(`Processing ${services.length} active services...\n`);

  let updatedCount = 0;

  for (const s of services) {
    const actionTitle = getActionTitle(s.category);
    const polishedTitle = polishTariff(s.name, actionTitle);

    if (polishedTitle !== s.name) {
      await db.service.update({
        where: { id: s.id },
        data: { name: polishedTitle },
      });
      updatedCount++;
    }
  }

  console.log(`✅ Updated ${updatedCount} service names.\n`);

  // Show 20 samples
  const samples = await db.service.findMany({
    take: 20,
    where: { isActive: true },
    select: {
      numericId: true,
      name: true,
      category: { select: { name: true, network: { select: { name: true } } } },
    },
    orderBy: { numericId: 'asc' },
  });

  console.log('📋 Sample Cleaned Services:');
  samples.forEach(s => {
    console.log(`  #${s.numericId} [${s.category?.network?.name || 'Net'} > ${s.category?.name || 'Cat'}]: "${s.name}"`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
