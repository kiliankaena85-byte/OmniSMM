/**
 * Target Type Mapper & Compatibility Engine
 * Bridges the gap between IntelligenceLinkAnalyzer (lowercase URL types)
 * and ServiceTargetType / SmartAnalyzerLogic (uppercase DB types).
 */

export enum TargetTypeEnum {
  CHANNEL = 'CHANNEL',
  POST = 'POST',
  PROFILE = 'PROFILE',
  STORY = 'STORY',
  VIDEO = 'VIDEO',
  CHANNEL_POSTS = 'CHANNEL_POSTS',
  POLL = 'POLL',
  COMMENTS = 'COMMENTS',
  BOT = 'BOT',
  CUSTOM = 'CUSTOM',

  // === Псевдонимы обратной совместимости с Движком №1 (Legacy ServiceTargetType) ===
  POST_INTERACTION = 'POST',
  VIDEO_INTERACTION = 'VIDEO',
  STORY_INTERACTION = 'STORY',
  POLL_VOTES = 'POLL',
  BOT_STARTS = 'BOT',
}

export const LinkType = TargetTypeEnum;
export type LinkType = TargetTypeEnum;

export type ServiceTargetType =
  | TargetTypeEnum
  | 'CHANNEL'
  | 'POST'
  | 'PROFILE'
  | 'VIDEO'
  | 'STORY'
  | 'POLL'
  | 'COMMENTS'
  | 'CHANNEL_POSTS'
  | 'BOT'
  | 'CUSTOM'
  | 'POST_INTERACTION'
  | 'VIDEO_INTERACTION'
  | 'STORY_INTERACTION'
  | 'POLL_VOTES'
  | 'BOT_STARTS';

/**
 * Normalizes any detected link type string into canonical uppercase TargetTypeEnum.
 * Handles casing ("channel" -> CHANNEL, "post" -> POST, "video" -> VIDEO).
 */
export function normalizeTargetType(rawType: string | null | undefined): TargetTypeEnum {
  if (!rawType) return TargetTypeEnum.CUSTOM;
  const clean = rawType.trim().toUpperCase();

  switch (clean) {
    case 'CHANNEL':
    case 'GROUP':
    case 'CHAT':
    case 'PUBLIC':
    case 'COMMUNITY':
    case 'COMMUNITIES':
    case 'SUBSCRIBERS':
    case 'MEMBERS':
    case 'BOOST':
      return TargetTypeEnum.CHANNEL;

    case 'POST':
    case 'PRIVATE_POST':
    case 'PHOTO':
    case 'WALL':
    case 'TWEET':
    case 'STATUS':
    case 'TRACK':
    case 'POST_INTERACTION':
    case 'LIKES':
    case 'REACTIONS':
    case 'VIEWS':
    case 'REPOSTS':
    case 'SHARES':
      return TargetTypeEnum.POST;

    case 'PROFILE':
    case 'USER':
    case 'ACCOUNT':
    case 'ARTIST':
    case 'FOLLOWERS':
    case 'FRIENDS':
      return TargetTypeEnum.PROFILE;

    case 'VIDEO':
    case 'SHORT_VIDEO':
    case 'SHORT_LINK':
    case 'CLIP':
    case 'REEL':
    case 'SHORTS':
    case 'VK_VIDEO':
    case 'VK_CLIP':
    case 'VK_PLAY':
    case 'PHOTO_MODE':
    case 'VIDEO_INTERACTION':
    case 'WATCH_TIME':
    case 'LIVESTREAM':
      return TargetTypeEnum.VIDEO;

    case 'STORY':
    case 'STORIES':
    case 'HIGHLIGHT':
    case 'HIGHLIGHTS':
    case 'STORY_INTERACTION':
      return TargetTypeEnum.STORY;

    case 'POLL':
    case 'VOTE':
    case 'VOTES':
    case 'POLL_VOTES':
      return TargetTypeEnum.POLL;

    case 'COMMENT':
    case 'COMMENTS':
    case 'REVIEWS':
      return TargetTypeEnum.COMMENTS;

    case 'BOT':
    case 'REFERRAL':
    case 'BOT_STARTS':
      return TargetTypeEnum.BOT;

    case 'CHANNEL_POSTS':
    case 'AUTO_POSTS':
    case 'AUTO_VIEWS':
    case 'AUTO_LIKES':
    case 'AUTO':
      return TargetTypeEnum.CHANNEL_POSTS;

    case 'CUSTOM':
    case 'GENERIC_LINK':
    case 'OTHER':
    case 'UNKNOWN':
    default:
      return TargetTypeEnum.CUSTOM;
  }
}

/**
 * Infers TargetTypeEnum directly from service/package name.
 */
export function inferTargetTypeFromName(name: string | null | undefined): TargetTypeEnum {
  if (!name) return TargetTypeEnum.POST;
  // Sanitize vendor/brand names that contain keywords like "boost" (e.g. vexboost, smmboost)
  const n = name.toLowerCase().replace(/vexboost/gi, '').replace(/smmboost/gi, '');
  const nNoPunct = n.replace(/[^a-zа-яё0-9]/gi, '');

  // Auto / Future / Subscription services / Last-N-posts packages
  if (
    nNoPunct.includes('автопросмотр') ||
    nNoPunct.includes('автолайк') ||
    nNoPunct.includes('автореакци') ||
    nNoPunct.includes('авторепост') ||
    nNoPunct.includes('автоактивно') ||
    nNoPunct.includes('autoview') ||
    nNoPunct.includes('autolike') ||
    nNoPunct.includes('autoreact') ||
    nNoPunct.includes('autoshare') ||
    nNoPunct.includes('autorepost') ||
    nNoPunct.includes('futureview') ||
    nNoPunct.includes('futurelike') ||
    (n.includes('подписка') && !n.includes('подписчик') && !n.includes('участник')) ||
    n.includes('будущие просмотры') ||
    n.includes('будущих постов') ||
    n.includes('массовые просмотры') ||
    n.includes('channel posts') ||
    // "Просмотры на последних N постов" / "Последних 50 постов" — applies to channel, NOT post
    n.includes('последних пост') ||
    n.includes('последних публик') ||
    n.includes('последних запис') ||
    (n.includes('последн') && (n.includes('пост') || n.includes('запис') || n.includes('публик'))) ||
    n.includes('last post') ||
    n.includes('last 5 post') ||
    n.includes('last 10 post') ||
    n.includes('last 20 post') ||
    n.includes('last 50 post') ||
    // "Пакет охвата" — views package on last N posts of a channel
    (n.includes('пакет') && n.includes('охват')) ||
    (n.includes('пакет') && n.includes('просмотр'))
  ) {
    return TargetTypeEnum.CHANNEL_POSTS;
  }

  // Polls / Votes (prioritize before channel/group because polls often happen in channels/groups)
  if (n.includes('опрос') || n.includes('голос') || n.includes('poll') || n.includes('vote')) {
    return TargetTypeEnum.POLL;
  }

  // Channel / Group / Subscribers
  if (
    n.includes('подписчик') ||
    n.includes('участник') ||
    n.includes('фолловер') ||
    n.includes('subscriber') ||
    n.includes('member') ||
    n.includes('follower') ||
    n.includes('канал') ||
    n.includes('channel') ||
    n.includes('групп') ||
    n.includes('group') ||
    n.includes('буст') ||
    n.includes('boost') ||
    n.includes('инвайт') ||
    n.includes('invite')
  ) {
    return TargetTypeEnum.CHANNEL;
  }

  // Stories
  if (n.includes('стори') || n.includes('story') || n.includes('stories') || n.includes('истори')) {
    return TargetTypeEnum.STORY;
  }

  // Video / Shorts / Reels
  if (n.includes('видео') || n.includes('video') || n.includes('shorts') || n.includes('reels') || n.includes('clip') || n.includes('клип') || n.includes('стрим') || n.includes('stream') || n.includes('зрител')) {
    return TargetTypeEnum.VIDEO;
  }

  // Profile / Friends / Visits
  if (n.includes('профиль') || n.includes('profile') || n.includes('аккаунт') || n.includes('друг') || n.includes('friend')) {
    return TargetTypeEnum.PROFILE;
  }

  // Comments
  if (n.includes('коммент') || n.includes('comment') || n.includes('отзыв') || n.includes('review')) {
    return TargetTypeEnum.COMMENTS;
  }

  // Bots / Referrals
  if (n.includes('бот') || n.includes('bot') || n.includes('реферал') || n.includes('referral')) {
    return TargetTypeEnum.BOT;
  }

  return TargetTypeEnum.POST;
}

/**
 * Resolves the true TargetType for a service, correcting legacy or corrupted
 * database targetType values when service name or category name unambiguously indicates the target.
 */
export function resolveServiceTargetType(service: { name?: string; targetType?: string | null; category?: { name?: string | null } | null }): string {
  if (!service) return TargetTypeEnum.POST;
  const effectiveName = service.name || service.category?.name || '';
  const inferred = inferTargetTypeFromName(effectiveName);
  if (
    (!service.targetType || service.targetType === 'POST' || service.targetType === 'CUSTOM') &&
    (inferred === TargetTypeEnum.CHANNEL ||
      inferred === TargetTypeEnum.CHANNEL_POSTS ||
      inferred === TargetTypeEnum.POLL ||
      inferred === TargetTypeEnum.VIDEO ||
      inferred === TargetTypeEnum.STORY ||
      inferred === TargetTypeEnum.BOT)
  ) {
    return inferred;
  }
  return service.targetType || inferred;
}

/**
 * Unified Compatibility Truth Table (10x10 Matrix according to SPEC-2026-09-14)
 */
const UNIFIED_COMPATIBILITY_MAP: Record<TargetTypeEnum, Set<TargetTypeEnum>> = {
  [TargetTypeEnum.CHANNEL]: new Set([
    TargetTypeEnum.CHANNEL,
    TargetTypeEnum.CHANNEL_POSTS,
    TargetTypeEnum.PROFILE,
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.PROFILE]: new Set([
    TargetTypeEnum.PROFILE,
    TargetTypeEnum.CHANNEL,
    TargetTypeEnum.CHANNEL_POSTS, // Anomaly 1.3: IG/TikTok profile post monitoring
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.POST]: new Set([
    TargetTypeEnum.POST,
    TargetTypeEnum.VIDEO,
    TargetTypeEnum.COMMENTS,
    TargetTypeEnum.POLL, // Anomaly 1.2: TG/VK polls inside posts
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.VIDEO]: new Set([
    TargetTypeEnum.VIDEO,
    TargetTypeEnum.POST,
    TargetTypeEnum.COMMENTS, // Anomaly 1.1: Comments on videos/clips
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.STORY]: new Set([
    TargetTypeEnum.STORY,
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.POLL]: new Set([
    TargetTypeEnum.POLL,
    TargetTypeEnum.POST,
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.BOT]: new Set([
    TargetTypeEnum.BOT,
    TargetTypeEnum.CHANNEL,
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.COMMENTS]: new Set([
    TargetTypeEnum.COMMENTS,
    TargetTypeEnum.POST,
    TargetTypeEnum.VIDEO,
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.CHANNEL_POSTS]: new Set([
    TargetTypeEnum.CHANNEL_POSTS,
    TargetTypeEnum.CHANNEL,
    TargetTypeEnum.PROFILE,
    TargetTypeEnum.CUSTOM,
  ]),
  [TargetTypeEnum.CUSTOM]: new Set([
    TargetTypeEnum.CHANNEL,
    TargetTypeEnum.PROFILE,
    TargetTypeEnum.POST,
    TargetTypeEnum.VIDEO,
    TargetTypeEnum.STORY,
    TargetTypeEnum.POLL,
    TargetTypeEnum.BOT,
    TargetTypeEnum.COMMENTS,
    TargetTypeEnum.CHANNEL_POSTS,
    TargetTypeEnum.CUSTOM,
  ]),
};

/**
 * Checks whether a detected URL link target type is compatible with a Service target type.
 */
export function isTargetTypeCompatible(
  detectedLinkType: TargetTypeEnum | string | null | undefined,
  serviceTargetType: TargetTypeEnum | string | null | undefined
): boolean {
  if (!detectedLinkType || !serviceTargetType) return true;

  const detected = normalizeTargetType(detectedLinkType);
  const service = normalizeTargetType(serviceTargetType);

  if (detected === TargetTypeEnum.CUSTOM || service === TargetTypeEnum.CUSTOM) return true;
  if (detected === service) return true;

  const allowedTargets = UNIFIED_COMPATIBILITY_MAP[detected];
  if (!allowedTargets) return true;

  return allowedTargets.has(service);
}

/**
 * Alias for 100% backward compatibility with Engine 1 imports
 */
export const isLinkServiceCompatible = isTargetTypeCompatible;

/**
 * Human-readable, educational error messages for incompatible combinations.
 */
export function getCompatibilityError(
  rawLinkType: TargetTypeEnum | string | null | undefined,
  rawTargetType: TargetTypeEnum | string | null | undefined,
  serviceName?: string
): string {
  const link = normalizeTargetType(rawLinkType);
  const target = normalizeTargetType(rawTargetType);

  const prefix = serviceName ? `Услуга «${serviceName}»` : 'Выбранная услуга';

  if (link === TargetTypeEnum.PROFILE && target === TargetTypeEnum.POST) {
    return `${prefix} предназначена для публикаций (лайки/просмотры/реакции). Для ее выполнения укажите прямую ссылку на конкретный пост или фото, а не на страницу профиля.`;
  }

  if (link === TargetTypeEnum.CHANNEL && target === TargetTypeEnum.POST) {
    return `${prefix} применяется к конкретным записям. Укажите ссылку на отдельный пост в канале (например, https://t.me/channel/123), а не на канал целиком.`;
  }

  if (link === TargetTypeEnum.POST && target === TargetTypeEnum.CHANNEL) {
    return `${prefix} предназначена для привлечения подписчиков в канал/группу. Пожалуйста, укажите ссылку на сам канал (например, https://t.me/channel), а не на отдельную публикацию.`;
  }

  if (link === TargetTypeEnum.POST && target === TargetTypeEnum.PROFILE) {
    return `${prefix} предназначена для подписчиков на аккаунт/профиль. Укажите ссылку на страницу профиля, а не на отдельный пост.`;
  }

  if (link === TargetTypeEnum.POST && target === TargetTypeEnum.CHANNEL_POSTS) {
    return `${prefix} — это пакет авто-активностей на будущие публикации канала. Для ее запуска требуется ссылка на канал целиком, а не на разовый пост.`;
  }

  if (link === TargetTypeEnum.STORY && target !== TargetTypeEnum.STORY) {
    return `${prefix} не совместима со ссылками на Истории (Stories). Для историй доступны только просмотры и реакции на сториз.`;
  }

  if (link !== TargetTypeEnum.STORY && target === TargetTypeEnum.STORY) {
    return `${prefix} работает исключительно со ссылками на Истории (Stories). Укажите прямую ссылку на активную историю.`;
  }

  return `${prefix} (тип цели: ${target}) несовместима с указанным типом ссылки (${link}). Пожалуйста, проверьте формат ссылки.`;
}