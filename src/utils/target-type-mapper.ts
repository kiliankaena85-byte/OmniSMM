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
}

export type ServiceTargetType =
  | 'CHANNEL'
  | 'POST'
  | 'PROFILE'
  | 'VIDEO'
  | 'STORY'
  | 'POLL'
  | 'COMMENTS'
  | 'CHANNEL_POSTS'
  | 'BOT'
  | 'CUSTOM';

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
      return TargetTypeEnum.CHANNEL;

    case 'POST':
    case 'PRIVATE_POST':
    case 'PHOTO':
    case 'WALL':
    case 'TWEET':
    case 'STATUS':
      return TargetTypeEnum.POST;

    case 'PROFILE':
    case 'USER':
    case 'ACCOUNT':
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
      return TargetTypeEnum.VIDEO;

    case 'STORY':
    case 'STORIES':
      return TargetTypeEnum.STORY;

    case 'POLL':
    case 'VOTE':
      return TargetTypeEnum.POLL;

    case 'COMMENT':
    case 'COMMENTS':
      return TargetTypeEnum.COMMENTS;

    case 'BOT':
      return TargetTypeEnum.BOT;

    case 'CHANNEL_POSTS':
    case 'AUTO_POSTS':
    case 'AUTO':
      return TargetTypeEnum.CHANNEL_POSTS;

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
 * database targetType values when service name unambiguously indicates the target.
 */
export function resolveServiceTargetType(service: { name: string; targetType?: string | null }): string {
  const inferred = inferTargetTypeFromName(service.name);
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
 * Checks whether a detected URL link target type is compatible with a Service target type.
 */
export function isTargetTypeCompatible(
  detectedLinkType: string | null | undefined,
  serviceTargetType: string | null | undefined
): boolean {
  if (!detectedLinkType || !serviceTargetType) return true;

  const detected = normalizeTargetType(detectedLinkType);
  const service = normalizeTargetType(serviceTargetType);

  if (detected === TargetTypeEnum.CUSTOM || service === TargetTypeEnum.CUSTOM) return true;
  if (detected === service) return true;

  switch (detected) {
    case TargetTypeEnum.CHANNEL:
      return (
        service === TargetTypeEnum.CHANNEL ||
        service === TargetTypeEnum.CHANNEL_POSTS ||
        service === TargetTypeEnum.PROFILE
      );

    case TargetTypeEnum.POST:
      return (
        service === TargetTypeEnum.POST ||
        service === TargetTypeEnum.VIDEO ||
        service === TargetTypeEnum.COMMENTS
      );

    case TargetTypeEnum.PROFILE:
      return (
        service === TargetTypeEnum.PROFILE ||
        service === TargetTypeEnum.CHANNEL
      );

    case TargetTypeEnum.VIDEO:
      return (
        service === TargetTypeEnum.VIDEO ||
        service === TargetTypeEnum.POST
      );

    case TargetTypeEnum.STORY:
      return service === TargetTypeEnum.STORY;

    case TargetTypeEnum.POLL:
      return service === TargetTypeEnum.POLL || service === TargetTypeEnum.POST;

    case TargetTypeEnum.BOT:
      return service === TargetTypeEnum.BOT || service === TargetTypeEnum.CHANNEL;

    case TargetTypeEnum.CHANNEL_POSTS:
      return service === TargetTypeEnum.CHANNEL_POSTS || service === TargetTypeEnum.CHANNEL;

    default:
      return true;
  }
}