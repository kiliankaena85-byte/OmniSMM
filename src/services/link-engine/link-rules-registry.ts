import { z } from 'zod';
import { IntelligencePlatform } from '../analyzer/link-rules';

/**
 * Unified and pre-compiled regex registry for platform & targetType combinations.
 * All patterns are vetted for linear execution (ReDoS immune).
 */
export const UNIFIED_REGEX = {
  TELEGRAM: {
    // Allows public channel / group / profile: t.me/durov, t.me/@durov, t.me/joinchat/xxx, t.me/+xxx, t.me/s/durov
    CHANNEL: /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+|s\/)?@?[\w-]+\/?(?:\?.*)?$/i,
    // Allows posts: t.me/channel/123, topic posts: t.me/group/100/250, web previews: t.me/s/channel/123
    POST: /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?[\w-]+\/(?:topic\/)?\d+(?:\/\d+)?\/?(?:\?.*)?$/i,
    // Allows stories: t.me/channel/s/123
    STORY: /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+\/s\/\d+\/?$/i,
    // Allows comments: t.me/channel/123?comment=456
    COMMENT: /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+\/\d+\?(?:.*&)?comment=\d+$/i,
    // Allows bot: t.me/my_bot, t.me/my_bot?start=ref
    BOT: /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+_bot(?:\?start=[\w-]+)?$/i,
    // Allows poll: t.me/channel/123
    POLL: /^https?:\/\/(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?[\w-]+\/\d+\/?$/i,
  },

  VK: {
    // Allows posts, videos, clips, photos: vk.com/wall-1_2, vk.com/video-1_2, vk.com/clip-1_2, vk.com/photo-1_2
    POST: /^https?:\/\/(?:m\.)?(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|video|clip|photo)-?\d+_\d+/i,
    // Allows groups, publics, users: vk.com/durov, vk.com/public123, vk.com/club123, vk.com/id123
    CHANNEL: /^https?:\/\/(?:m\.)?vk\.(?:com|ru)\/(?:public\d+|club\d+|id\d+|[a-zA-Z0-9_.]+)\/?$/i,
    // Allows comments with reply param (ReDoS hardened)
    COMMENT: /^https?:\/\/(?:m\.)?(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|video|clip|photo)-?\d+_\d+\?[^#]*\breply=\d+/i,
    // Allows polls
    POLL: /^https?:\/\/(?:m\.)?(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|video|clip|photo)-?\d+_\d+/i,
  },

  INSTAGRAM: {
    // Allows p, reel, reels, tv, share/p, share/reel
    POST: /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:p|reel|reels|tv|share\/[a-zA-Z0-9_-]+)\/[a-zA-Z0-9_-]+\/?/i,
    // Allows profile
    CHANNEL: /^https?:\/\/(?:www\.|m\.)?instagram\.com\/@?[a-zA-Z0-9_.]+\/?$/i,
    // Allows story: instagram.com/stories/username/123 or profile
    STORY: /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:stories\/[a-zA-Z0-9_.]+\/\d+|@?[a-zA-Z0-9_.]+)\/?$/i,
    // Allows comments: instagram.com/p/xxx/c/yyy
    COMMENT: /^https?:\/\/(?:www\.|m\.)?instagram\.com\/(?:p|reel|reels|tv)\/[a-zA-Z0-9_-]+\/c\/[a-zA-Z0-9_-]+\/?/i,
    // Allows polls
    POLL: /^https?:\/\/(?:www\.|m\.)?instagram\.com\/@?[a-zA-Z0-9_.]+\/?$/i,
  },

  TIKTOK: {
    // Allows video/photo posts or share links
    POST: /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/(?:video|photo)\/\d+|^https?:\/\/(?:vm|vt)\.tiktok\.com\/[a-zA-Z0-9_]+/i,
    // Allows profile
    CHANNEL: /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@?[a-zA-Z0-9_.]+\/?$/i,
  },

  YOUTUBE: {
    // Allows watch, shorts, live, embed, youtu.be
    POST: /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|shorts\/|live\/|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]+/i,
    // Allows channels: @handle, channel/UC..., c/..., user/...
    CHANNEL: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(@[a-zA-Z0-9_.-]+|channel\/UC[a-zA-Z0-9_.-]+|c\/[a-zA-Z0-9_.-]+|user\/[a-zA-Z0-9_.-]+)\/?$/i,
    // Allows comments with &lc= param
    COMMENT: /^https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?.*[?&]v=[a-zA-Z0-9_-]+.*[?&]lc=[a-zA-Z0-9_-]+/i,
  },

  RUTUBE: {
    POST: /^https?:\/\/(?:www\.)?rutube\.ru\/(?:video|shorts|play\/embed)\/[a-zA-Z0-9_-]+\/?/i,
    CHANNEL: /^https?:\/\/(?:www\.)?rutube\.ru\/(?:channel\/\d+|u\/[a-zA-Z0-9_.-]+|feeds\/[a-zA-Z0-9_.-]+)\/?/i,
  },

  OK: {
    POST: /^https?:\/\/(?:www\.|m\.)?ok\.ru\/(?:group|profile)\/\d+\/(?:topic|statuses)\/\d+/i,
    CHANNEL: /^https?:\/\/(?:www\.|m\.)?ok\.ru\/(?:group\/\d+|profile\/\d+|[a-zA-Z0-9_.-]+)\/?$/i,
  },

  TWITTER: {
    POST: /^https?:\/\/(?:twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/status\/\d+/i,
    CHANNEL: /^https?:\/\/(?:twitter\.com|x\.com)\/@?[a-zA-Z0-9_]+\/?$/i,
  },

  THREADS: {
    POST: /^https?:\/\/(?:www\.)?threads\.net\/@[a-zA-Z0-9_.]+\/post\/[a-zA-Z0-9_-]+/i,
    CHANNEL: /^https?:\/\/(?:www\.)?threads\.net\/@?[a-zA-Z0-9_.]+\/?$/i,
  },

  FACEBOOK: {
    POST: /^https?:\/\/(?:www\.|m\.)?(?:facebook\.com|fb\.watch)\/.+/i,
    CHANNEL: /^https?:\/\/(?:www\.|m\.)?facebook\.com\/.+/i,
  },

  TWITCH: {
    POST: /^https?:\/\/(?:www\.|m\.)?twitch\.tv\/videos\/\d+/i,
    CHANNEL: /^https?:\/\/(?:www\.|m\.)?twitch\.tv\/[a-zA-Z0-9_]+\/?$/i,
  },

  KICK: {
    CHANNEL: /^https?:\/\/(?:www\.)?kick\.com\/[a-zA-Z0-9_.-]+\/?$/i,
  },

  SPOTIFY: {
    POST: /^https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9_-]+/i,
    CHANNEL: /^https?:\/\/open\.spotify\.com\/(?:playlist|album|artist)\/[a-zA-Z0-9_-]+/i,
  },

  MAX: {
    CHANNEL: /^https?:\/\/(?:www\.)?max\.ru\/(?:c\/(?:-?\d+(?:\/[a-zA-Z0-9_-]+)?|[a-zA-Z0-9_.-]+)|[a-zA-Z0-9_.-]+)\/?$/i,
  }
};

/**
 * Returns a compiled Zod schema validator for a specific platform and targetType.
 */
export function getUnifiedLinkValidator(platform: string, targetType: string): z.ZodType<string> {
  const normPlatform = (platform || '').toUpperCase();
  const normTarget = (targetType || '').toUpperCase();

  switch (normPlatform) {
    case 'TELEGRAM':
      if (normTarget === 'CHANNEL' || normTarget === 'CHANNEL_POSTS' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.TELEGRAM.CHANNEL, "Укажите ссылку на канал или чат Telegram (например, https://t.me/durov)");
      }
      if (normTarget === 'POST') {
        return z.string()
          .refine(val => !val.includes('/c/'), "Невозможно заказать услугу в закрытый чат (ссылка содержит /c/). Сделайте канал публичным.")
          .and(z.string().regex(UNIFIED_REGEX.TELEGRAM.POST, "Укажите ссылку на конкретный пост (например, https://t.me/durov/123)"));
      }
      if (normTarget === 'STORY') {
        return z.string().regex(UNIFIED_REGEX.TELEGRAM.STORY, "Укажите ссылку на историю Telegram (например, https://t.me/durov/s/1)");
      }
      if (normTarget === 'COMMENT') {
        return z.string().regex(UNIFIED_REGEX.TELEGRAM.COMMENT, "Укажите ссылку на комментарий в Telegram (например, https://t.me/durov/123?comment=456)");
      }
      if (normTarget === 'TELEGRAM_BOT' || normTarget === 'BOT') {
        return z.string().regex(UNIFIED_REGEX.TELEGRAM.BOT, "Укажите ссылку на Telegram-бота (например, https://t.me/my_bot или ?start=ref123)");
      }
      if (normTarget === 'POLL') {
        return z.string().regex(UNIFIED_REGEX.TELEGRAM.POLL, "Укажите ссылку на пост с опросом (например, https://t.me/durov/123)");
      }
      break;

    case 'VK':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.VK.POST, "Укажите ссылку на пост, фото, клип или видео ВКонтакте.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.VK.CHANNEL, "Укажите прямую ссылку на группу или профиль ВКонтакте.");
      }
      if (normTarget === 'COMMENT') {
        return z.string().regex(UNIFIED_REGEX.VK.COMMENT, "Укажите ссылку на комментарий ВКонтакте (должна содержать параметр reply).");
      }
      if (normTarget === 'POLL') {
        return z.string().regex(UNIFIED_REGEX.VK.POLL, "Укажите ссылку на пост с опросом ВКонтакте.");
      }
      break;

    case 'INSTAGRAM':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.INSTAGRAM.POST, "Укажите ссылку на публикацию или Reel в Instagram.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.INSTAGRAM.CHANNEL, "Укажите правильную ссылку на профиль Instagram.");
      }
      if (normTarget === 'STORY') {
        return z.string().regex(UNIFIED_REGEX.INSTAGRAM.STORY, "Укажите ссылку на историю или профиль Instagram.");
      }
      if (normTarget === 'COMMENT') {
        return z.string().regex(UNIFIED_REGEX.INSTAGRAM.COMMENT, "Укажите ссылку на комментарий Instagram.");
      }
      if (normTarget === 'POLL') {
        return z.string().regex(UNIFIED_REGEX.INSTAGRAM.POLL, "Укажите ссылку на профиль или историю Instagram с опросом.");
      }
      break;

    case 'TIKTOK':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.TIKTOK.POST, "Скопируйте ссылку на видео или фото из приложения TikTok.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.TIKTOK.CHANNEL, "Укажите ссылку на профиль TikTok.");
      }
      break;

    case 'YOUTUBE':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.YOUTUBE.POST, "Укажите ссылку на YouTube видео, Shorts или стрим.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.YOUTUBE.CHANNEL, "Укажите ссылку на канал YouTube.");
      }
      if (normTarget === 'COMMENT') {
        return z.string().regex(UNIFIED_REGEX.YOUTUBE.COMMENT, "Укажите ссылку на комментарий YouTube (с параметром &lc=).");
      }
      break;

    case 'RUTUBE':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.RUTUBE.POST, "Укажите ссылку на Rutube-видео или Shorts.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.RUTUBE.CHANNEL, "Укажите ссылку на канал или профиль Rutube.");
      }
      break;

    case 'OK':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.OK.POST, "Укажите ссылку на тему или статус в Одноклассниках.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.OK.CHANNEL, "Укажите прямую ссылку на группу или профиль в Одноклассниках.");
      }
      break;

    case 'TWITTER':
    case 'X':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.TWITTER.POST, "Укажите ссылку на твит/пост в Twitter / X.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.TWITTER.CHANNEL, "Укажите ссылку на профиль Twitter / X.");
      }
      break;

    case 'THREADS':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.THREADS.POST, "Укажите ссылку на пост в Threads.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.THREADS.CHANNEL, "Укажите ссылку на профиль Threads.");
      }
      break;

    case 'FACEBOOK':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.FACEBOOK.POST, "Укажите ссылку на публикацию или видео Facebook.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE' || normTarget === 'GROUP') {
        return z.string().regex(UNIFIED_REGEX.FACEBOOK.CHANNEL, "Укажите ссылку на страницу, группу или профиль Facebook.");
      }
      break;

    case 'TWITCH':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.TWITCH.POST, "Укажите ссылку на запись трансляции (VOD) Twitch.");
      }
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        return z.string().regex(UNIFIED_REGEX.TWITCH.CHANNEL, "Укажите ссылку на Twitch-канал.");
      }
      break;

    case 'KICK':
      return z.string().regex(UNIFIED_REGEX.KICK.CHANNEL, "Укажите правильную ссылку на Kick-канал.");

    case 'SPOTIFY':
      if (normTarget === 'POST') {
        return z.string().regex(UNIFIED_REGEX.SPOTIFY.POST, "Укажите ссылку на трек Spotify.");
      }
      return z.string().regex(UNIFIED_REGEX.SPOTIFY.CHANNEL, "Укажите ссылку на плейлист, альбом или артиста Spotify.");

    case 'MAX':
      return z.string().regex(UNIFIED_REGEX.MAX.CHANNEL, "Укажите ссылку на профиль или канал мессенджера МАКС.");
  }

  // Universal Fallback validator
  return z.string().url("Укажите корректную ссылку (URL), начинающуюся с https://");
}

/**
 * Validates custom parameter inputs (e.g. comments list, numbers, text).
 */
export function getUnifiedCustomValidator(customDataType?: string | null): z.ZodType<string> {
  const type = (customDataType || 'NONE').toUpperCase();
  if (type === 'NUMBER') {
    return z.string().trim().regex(/^\d+$/, "Значение должно состоять только из цифр");
  }
  if (type === 'TEXTAREA') {
    return z.string().trim()
      .min(1, "Поле не может быть пустым")
      .max(10000, "Текст слишком длинный (максимум 10000 символов)")
      // eslint-disable-next-line no-control-regex
      .refine(val => !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(val), "Текст содержит недопустимые управляющие символы");
  }
  return z.string().trim().min(1, "Поле не может быть пустым");
}
