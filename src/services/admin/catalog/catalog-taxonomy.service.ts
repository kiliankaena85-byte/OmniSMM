import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ServiceAuditEngine } from '../audit-engine';

/**
 * Strict boolean parser for provider API responses (handles '1', 1, 'true', true vs '0', 0, 'false', false)
 */
export function parseProviderBoolean(val: unknown): boolean {
  if (val === true || val === 1 || val === '1' || val === 'true') return true;
  return false;
}

export function parseProviderBooleanOptional(val: unknown): boolean | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  return parseProviderBoolean(val);
}

/**
 * Ensures a category (and its network) is visible to every tenant targeted by
 * an import by promoting tenantId to 'all'.
 */
export async function ensureTaxonomyTenantAccess(categoryId: string): Promise<{ categoryName: string } | null> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true, tenantId: true, networkId: true }
  });
  if (category && category.tenantId !== 'all') {
    await db.category.update({
      where: { id: categoryId },
      data: { tenantId: 'all' }
    });
    if (category.networkId) {
      await db.network.update({
        where: { id: category.networkId },
        data: { tenantId: 'all' }
      });
    }
    return { categoryName: category.name };
  }
  return null;
}

export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  SUBSCRIBERS: 'Подписчики',
  GROUPS: 'Вступление в группы',
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
  POLLS: 'Голоса',
  STORIES: 'Сторис',
  BOTS: 'Боты',
  REFERRALS: 'Рефералы',
  FRIENDS: 'Друзья',
  PLAYS: 'Прослушивания',
  TRAFFIC: 'Трафик',
  DISLIKES: 'Дизлайки',
  STARS: 'Звёзды',
  SAVES: 'Сохранения',
  COMPLAINTS: 'Жалобы',
  STREAMS: 'Стримы',
  PREMIUM: 'Премиум',
  RECOVER: 'Восстановление',
  OTHER: 'Другое',
};

export const CATEGORY_SORT_ORDER: Record<string, number> = {
  SUBSCRIBERS: 10, LIKES: 20, VIEWS: 30, REACTIONS: 40, REPOSTS: 50,
  COMMENTS: 60, STORIES: 70, BOOSTS: 80, AUTO_VIEWS: 90, AUTO_LIKES: 100,
  AUTO_REACTIONS: 110, AUTO_REPOSTS: 120, AUTO_COMMENTS: 130, PLAYS: 140,
  POLLS: 150, GROUPS: 160, FRIENDS: 170, PREMIUM: 180, STARS: 190,
  SAVES: 200, TRAFFIC: 210, REFERRALS: 220, STREAMS: 230, BOTS: 240,
  DISLIKES: 250, RECOVER: 260, COMPLAINTS: 270, OTHER: 999,
};

export async function ensureCategoryForActivityType(
  networkId: string,
  networkName: string,
  networkSlug: string,
  activityType: string,
  tenantId: string
): Promise<string> {
  const existing = await db.category.findFirst({
    where: {
      networkId,
      tenantId: { in: [tenantId, 'all'] },
      OR: [
        { activityType },
        ...(activityType === 'SUBSCRIBERS' ? [{ name: { contains: 'подписч', mode: 'insensitive' as const } }] : []),
        ...(activityType === 'VIEWS' ? [{ name: { contains: 'просмотр', mode: 'insensitive' as const } }] : []),
        ...(activityType === 'LIKES' ? [{ name: { contains: 'лайк', mode: 'insensitive' as const } }] : []),
        ...(activityType === 'COMMENTS' ? [{ name: { contains: 'коммент', mode: 'insensitive' as const } }] : []),
        ...(activityType === 'REACTIONS' ? [{ name: { contains: 'реакц', mode: 'insensitive' as const } }] : []),
      ]
    },
    orderBy: [
      { sort: 'asc' },
      { createdAt: 'asc' }
    ],
    select: { id: true, activityType: true },
  });
  if (existing) {
    if (!existing.activityType && activityType) {
      await db.category.update({ where: { id: existing.id }, data: { activityType } });
    }
    return existing.id;
  }

  const displayName = CATEGORY_DISPLAY_NAMES[activityType] || activityType;
  const fullName = displayName;
  const baseSlug = `${networkSlug}-${activityType.toLowerCase().replace(/_/g, '-')}`;

  let finalSlug = baseSlug;
  let attempts = 0;
  while (await db.category.findFirst({ where: { slug: finalSlug, tenantId: { in: [tenantId, 'all'] } } })) {
    attempts++;
    finalSlug = `${baseSlug}-${attempts}`;
    if (attempts > 20) {
      finalSlug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  const newCat = await db.category.create({
    data: {
      name: fullName,
      slug: finalSlug,
      networkId,
      tenantId,
      activityType,
      sort: CATEGORY_SORT_ORDER[activityType] ?? 500,
    },
  });

  logger.info(`[CATEGORY-FIX] Auto-created category "${fullName}" (${activityType}) for network ${networkName}`, {
    networkId, activityType, categoryId: newCat.id,
  });

  return newCat.id;
}

export const PLATFORM_BRAND_PATTERNS: Array<{
  platform: string;
  pattern: RegExp;
}> = [
  { platform: 'Telegram', pattern: /(?:telegram|телеграм|(?<![а-яёa-z0-9])тг(?![а-яёa-z0-9]))/i },
  { platform: 'Instagram', pattern: /(?:instagram|инстаграм|инста|(?<![а-яёa-z0-9])(?:инст|ig)(?![а-яёa-z0-9]))/i },
  { platform: 'VK', pattern: /(?:вконтакте|(?<![а-яёa-z0-9])(?:vk|вк)(?![а-яёa-z0-9]))/i },
  { platform: 'YouTube', pattern: /(?:youtube|ютуб|(?<![а-яёa-z0-9])(?:ют|yt)(?![а-яёa-z0-9]))/i },
  { platform: 'TikTok', pattern: /(?:tiktok|тикток|(?<![а-яёa-z0-9])(?:тт|tt)(?![а-яёa-z0-9]))/i },
  { platform: 'Rutube', pattern: /(?:rutube|рутуб)/i },
  { platform: 'Twitch', pattern: /(?:twitch|твич)/i },
  { platform: 'Twitter', pattern: /(?:twitter|твиттер|(?<![а-яёa-z0-9])x(?![а-яёa-z0-9]))/i },
  { platform: 'Facebook', pattern: /(?:facebook|фейсбук|(?<![а-яёa-z0-9])(?:фб|fb)(?![а-яёa-z0-9]))/i },
  { platform: 'Discord', pattern: /(?:discord|дискорд|(?<![а-яёa-z0-9])(?:дс|ds)(?![а-яёa-z0-9]))/i },
  { platform: 'Kick', pattern: /(?:kick|кик)/i },
  { platform: 'Likee', pattern: /(?:likee|лайки)/i },
  { platform: 'Threads', pattern: /(?:threads|тредс)/i },
  { platform: 'Dzen', pattern: /(?:dzen|дзен)/i },
  { platform: 'OK', pattern: /(?:одноклассники|(?<![а-яёa-z0-9])(?:ок|ok)(?![а-яёa-z0-9]))/i },
];

export function detectTargetPlatform(categoryName?: string | null, networkName?: string | null): string | null {
  if (networkName) {
    const matched = PLATFORM_BRAND_PATTERNS.find(p => p.pattern.test(networkName));
    if (matched) return matched.platform;
    return networkName;
  }
  if (categoryName) {
    const matched = PLATFORM_BRAND_PATTERNS.find(p => p.pattern.test(categoryName));
    if (matched) return matched.platform;
  }
  return null;
}

export function inferCanonicalActivityType(
  normalizedCategory: string | undefined | null,
  serviceName: string,
  targetType?: string
): string | null {
  const n = (serviceName || '').toLowerCase();

  if (
    (/подписч|member|follower|читател|фолловер/i.test(n) ||
      (/участник/i.test(n) && !/опрос|голос|викторин|poll|vote/i.test(n))) &&
    !/авто.*просмотр|просмотр.*подпис/i.test(n)
  ) {
    return 'SUBSCRIBERS';
  }

  if (/истори|сторис|story|stories/i.test(n) && !/подписч/i.test(n)) {
    return 'STORIES';
  }

  if (/просмотр|view|гляделок|глаз/i.test(n) && !/подписч|member|участник|истори|сторис|реакц|лайк/i.test(n)) {
    return /авто|auto|будущ/i.test(n) ? 'AUTO_VIEWS' : 'VIEWS';
  }
  if (/лайк|like|сердеч|мне нравится/i.test(n) && !/подписч|просмотр|репост/i.test(n)) {
    return /авто|auto|будущ/i.test(n) ? 'AUTO_LIKES' : 'LIKES';
  }
  if (/реакци|emoji|reaction|эмодзи/i.test(n) && !/подписч/i.test(n)) {
    return /авто|auto/i.test(n) ? 'AUTO_REACTIONS' : 'REACTIONS';
  }
  if (/коммент|отзыв|comment/i.test(n) && !/подписч|лайк|просмотр/i.test(n)) {
    return /авто|auto/i.test(n) ? 'AUTO_COMMENTS' : 'COMMENTS';
  }
  if (/репост|share|repost|поделиться/i.test(n) && !/подписч/i.test(n)) {
    return /авто|auto/i.test(n) ? 'AUTO_REPOSTS' : 'REPOSTS';
  }
  if (/буст|boost/i.test(n) && !/подписч/i.test(n)) {
    return 'BOOSTS';
  }
  if (/опрос|голос|викторин|poll|vote/i.test(n)) {
    return 'POLLS';
  }
  if (/стрим|stream|live|эфир|баттл|battle/i.test(n) && !/подписч/i.test(n)) {
    return 'STREAMS';
  }
  if (/stars|звезд/i.test(n) && !/подписч/i.test(n)) {
    return 'STARS';
  }

  if (normalizedCategory && normalizedCategory !== 'OTHER') {
    return normalizedCategory;
  }

  if (targetType === 'CHANNEL') {
    return 'SUBSCRIBERS';
  }

  return null;
}

export function formatFullServiceName(
  rawName: string,
  categoryName?: string | null,
  networkName?: string | null
): string {
  let clean = ServiceAuditEngine.cleanText(rawName);
  if (!categoryName && !networkName) return clean;

  const targetPlatform = detectTargetPlatform(categoryName, networkName);

  const catKeywords = [
    'подпис', 'лайк', 'просмотр', 'реакц', 'коммент', 'репост', 'буст', 'бот', 'голос', 'истори',
    'фолловер', 'зрител', 'слуш', 'трафик', 'читател', 'участник',
    'sub', 'member', 'follow', 'like', 'view', 'watch', 'react', 'emoji', 'comment', 'repost',
    'share', 'boost', 'bot', 'poll', 'vote', 'story', 'friend', 'play', 'traffic'
  ];
  const hasCat = catKeywords.some(k => clean.toLowerCase().includes(k));

  if (!hasCat && categoryName) {
    const cleanCat = categoryName.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    const platformKeywords = ['telegram', 'instagram', 'tiktok', 'youtube', 'vk', 'вконтакте', 'max', 'ok', 'likee', 'dzen', 'twitch', 'twitter', 'facebook', 'other', 'другое'];
    if (!platformKeywords.includes(cleanCat.toLowerCase())) {
      clean = `${cleanCat} - ${clean}`;
    }
  }

  if (targetPlatform) {
    const brandEntry = PLATFORM_BRAND_PATTERNS.find(p => p.platform.toLowerCase() === targetPlatform.toLowerCase());
    const hasBrand = brandEntry ? brandEntry.pattern.test(clean) : clean.toLowerCase().includes(targetPlatform.toLowerCase());
    if (!hasBrand) {
      clean = `${targetPlatform} ${clean}`;
    }
  }

  return clean;
}
