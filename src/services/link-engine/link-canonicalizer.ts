import { IntelligencePlatform } from '../analyzer/link-rules';

const TRACKING_PARAM_PREFIXES = [
  'utm_',
  'igsh',
  'igshid',
  'fbclid',
  'gclid',
  'yclid',
  'ttref',
  'feature',
  'si',
  'ref',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
  'from',
  'source',
];

/**
 * Strips tracking parameters from a URL while preserving functional parameters
 * (such as ?reply= for VK comments, ?start= for Telegram bots, ?v= for YouTube, ?comment= and ?single for TG).
 */
export function stripTrackingParams(urlObj: URL, platform?: IntelligencePlatform | null, targetType?: string | null): void {
  const normTarget = (targetType || '').toUpperCase();
  const host = urlObj.hostname.toLowerCase();

  // YouTube watch URLs: only keep v and lc (for comment)
  if (host.includes('youtube.com') && urlObj.pathname === '/watch') {
    const v = urlObj.searchParams.get('v');
    const lc = urlObj.searchParams.get('lc');
    urlObj.search = '';
    if (v) urlObj.searchParams.set('v', v);
    if (lc && normTarget === 'COMMENT') urlObj.searchParams.set('lc', lc);
    return;
  }

  // Telegram: keep ?start= for bots, ?comment= for comments, ?single for media groups
  if (host === 't.me' || host === 'telegram.me' || host === 'telegram.dog') {
    const start = urlObj.searchParams.get('start');
    const comment = urlObj.searchParams.get('comment');
    const hasSingle = urlObj.searchParams.has('single');
    const isPrivate = urlObj.pathname.includes('/+') || urlObj.pathname.includes('/joinchat/');

    if (normTarget === 'CHANNEL' || normTarget === 'PROFILE' || normTarget === 'CHANNEL_POSTS') {
      if (!isPrivate) {
        urlObj.search = '';
      }
      return;
    }

    if (normTarget === 'TELEGRAM_BOT' || normTarget === 'BOT') {
      urlObj.search = '';
      if (start) urlObj.searchParams.set('start', start);
      return;
    }

    // Default TG post/poll/comment
    const keysToDelete: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'single' && lowerKey !== 'comment' && lowerKey !== 'start' && TRACKING_PARAM_PREFIXES.some(p => lowerKey.startsWith(p))) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(k => urlObj.searchParams.delete(k));
    return;
  }

  // VK: keep reply for comments
  if (host === 'vk.com' || host === 'm.vk.com' || host === 'vk.ru' || host === 'vkvideo.ru') {
    if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
      urlObj.search = '';
      return;
    }
    const reply = urlObj.searchParams.get('reply');
    if (reply) {
      urlObj.search = '';
      urlObj.searchParams.set('reply', reply);
      return;
    }
    // Delete tracking params
    const keysToDelete: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAM_PREFIXES.some(p => lower.startsWith(p))) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(k => urlObj.searchParams.delete(k));
    return;
  }

  // TikTok: all query params are tracking/session params
  if (host.includes('tiktok.com')) {
    urlObj.search = '';
    return;
  }

  // Generic tracking strip
  const keysToDelete: string[] = [];
  urlObj.searchParams.forEach((_, key) => {
    const lowerKey = key.toLowerCase();
    if (TRACKING_PARAM_PREFIXES.some(prefix => lowerKey.startsWith(prefix))) {
      keysToDelete.push(key);
    }
  });

  for (const k of keysToDelete) {
    urlObj.searchParams.delete(k);
  }

  // Channel/Profile URLs typically should have empty query strings
  if (normTarget === 'CHANNEL' || normTarget === 'PROFILE' || normTarget === 'STORY') {
    urlObj.search = '';
  }
}

/**
 * Canonicalizes a social media URL into a standardized form.
 * Ensures consistent protocol, domain, path, and clean query parameters.
 */
export function canonicalizeUrl(rawUrl: string, platform?: IntelligencePlatform | string | null, targetType?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim().replace(/[\x00-\x1F\x7F]/g, '');
  if (!url) return '';

  const normTarget = (targetType || '').toUpperCase();
  const platStr = (platform || '').toUpperCase();

  // Handle bare @handle if platform is provided
  if (url.startsWith('@')) {
    const handle = url.substring(1);
    if (platStr === 'TELEGRAM' || platStr === 'TG') return `https://t.me/${handle}`;
    if (platStr === 'INSTAGRAM') return `https://www.instagram.com/${handle}`;
    if (platStr === 'TIKTOK') return `https://www.tiktok.com/@${handle}`;
    if (platStr === 'TWITTER' || platStr === 'X') return `https://x.com/${handle}`;
    if (platStr === 'YOUTUBE') return `https://www.youtube.com/@${handle}`;
    if (platStr === 'THREADS') return `https://www.threads.net/@${handle}`;
    if (platStr === 'VK') return `https://vk.com/${handle}`;
  }

  // Handle bare handle without dots/slashes for TG if platform explicitly TELEGRAM
  if ((platStr === 'TELEGRAM' || platStr === 'TG') && !url.includes('/') && !url.includes('.')) {
    return `https://t.me/${url}`;
  }

  // Auto-fix double http(s):// prefixes like https://https://... or http://https://...
  url = url.replace(/^(?:https?:\/\/)+(https?:\/\/)/i, '$1');

  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  } else if (url.startsWith('http://')) {
    url = 'https://' + url.slice(7);
  }

  // VK photo from z= parameter (nested in wall post or album)
  const vkPhotoMatch = url.match(/z=(photo-?\d+_\d+)/);
  if (vkPhotoMatch && (url.includes('vk.com') || url.includes('vk.ru') || platStr === 'VK')) {
    return `https://vk.com/${vkPhotoMatch[1]}`;
  }

  // YouTube youtu.be/ID -> youtube.com/watch?v=ID
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0];
    if (id) {
      url = `https://www.youtube.com/watch?v=${id}`;
    }
  }

  // YouTube /shorts/ID, /live/, /embed/ -> watch or channel
  if (url.includes('youtube.com') || url.includes('youtu.be') || platStr === 'YOUTUBE' || platStr === 'YT') {
    if (url.includes('/shorts/')) {
      const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch) {
        const userMatch = url.match(/youtube\.com\/(@[\w.-]+)\/shorts/i);
        if (userMatch && (normTarget === 'CHANNEL' || normTarget === 'PROFILE')) {
          return `https://www.youtube.com/${userMatch[1]}`;
        }
        url = `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
      }
    }

    if (url.includes('/live/')) {
      const id = url.split('/live/')[1]?.split('?')[0]?.split('/')[0];
      if (id) url = `https://www.youtube.com/watch?v=${id}`;
    }
    if (url.includes('/embed/')) {
      const id = url.split('/embed/')[1]?.split('?')[0]?.split('/')[0];
      if (id) url = `https://www.youtube.com/watch?v=${id}`;
    }
  }

  // Rutube /shorts/ID -> /video/ID/
  if (url.includes('rutube.ru/shorts/')) {
    const id = url.split('/shorts/')[1]?.split('?')[0]?.split('/')[0];
    if (id) url = `https://rutube.ru/video/${id}/`;
  }

  try {
    const urlObj = new URL(url);

    // 1. Domain normalizations
    const host = urlObj.hostname.toLowerCase();
    if (host === 'm.vk.com' || host === 'vk.ru' || host === 'vkontakte.ru' || host === 'vkvideo.ru') {
      urlObj.hostname = 'vk.com';
    } else if (host === 'discord.com' && urlObj.pathname.startsWith('/invite/')) {
      const code = urlObj.pathname.replace(/^\/invite\//, '').replace(/\/$/, '');
      return `https://discord.gg/${code}`;
    } else if (host === 'instagr.am' || host === 'm.instagram.com') {
      urlObj.hostname = 'www.instagram.com';
    } else if (host === 'm.tiktok.com') {
      urlObj.hostname = 'www.tiktok.com';
    } else if (host === 'm.youtube.com' || host === 'youtube.com') {
      urlObj.hostname = 'www.youtube.com';
    } else if (host === 'twitter.com' || host === 'mobile.twitter.com') {
      urlObj.hostname = 'x.com';
    } else if (host === 'telegram.me' || host === 'telegram.dog') {
      urlObj.hostname = 't.me';
    } else if (host === 'm.facebook.com') {
      urlObj.hostname = 'www.facebook.com';
    }

    // 2. Platform-specific pre-cleanup before stripping params
    // Instagram:
    if (urlObj.hostname.includes('instagram.com')) {
      urlObj.pathname = urlObj.pathname.replace(/^\/@/, '/');
      if (normTarget === 'STORY') {
        const storyMatch = urlObj.pathname.match(/\/stories\/([^/?#]+)/i);
        if (storyMatch) {
          return `https://www.instagram.com/${storyMatch[1]}/`;
        }
      }
    }

    // VK:
    if (urlObj.hostname === 'vk.com') {
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        const wallMatch = urlObj.pathname.match(/\/wall(-?\d+)_\d+/i);
        if (wallMatch) {
          const id = wallMatch[1];
          return id.startsWith('-') ? `https://vk.com/public${id.substring(1)}` : `https://vk.com/id${id}`;
        }
      }
    }

    // Telegram:
    if (urlObj.hostname === 't.me') {
      // web.telegram.org/k/#@channel
      const webMatch = url.match(/web\.telegram\.org\/(?:k|a)\/#@?([a-zA-Z0-9_]+)/i);
      if (webMatch) {
        return `https://t.me/${webMatch[1]}`;
      }
      // t.me/s/channel -> t.me/channel
      urlObj.pathname = urlObj.pathname.replace(/^\/s\/([a-zA-Z0-9_]+)/i, '/$1');
      // t.me/@channel -> t.me/channel
      urlObj.pathname = urlObj.pathname.replace(/^\/@/, '/');
      // t.me/group/topic/100/250 -> t.me/group/100/250
      urlObj.pathname = urlObj.pathname.replace(/\/topic\/(\d+)\/(\d+)/i, '/$1/$2');

      // Strip post ID if channel/profile target
      if (normTarget === 'CHANNEL' || normTarget === 'CHANNEL_POSTS' || normTarget === 'PROFILE') {
        const postMatch = urlObj.pathname.match(/^\/([\w-]+)\/\d+\/?$/i);
        if (postMatch && postMatch[1] !== 'c' && postMatch[1] !== 's') {
          urlObj.pathname = `/${postMatch[1]}`;
        }
      }
    }

    // TikTok:
    if (urlObj.hostname.includes('tiktok.com')) {
      if (normTarget === 'CHANNEL' || normTarget === 'PROFILE') {
        const videoMatch = urlObj.pathname.match(/(@[\w.-]+)\/(?:video|photo)\/\d+/i);
        if (videoMatch) {
          return `https://www.tiktok.com/${videoMatch[1]}`;
        }
        const noAtMatch = urlObj.pathname.match(/^\/([a-zA-Z0-9_.]+)$/);
        if (noAtMatch && !noAtMatch[1].startsWith('@')) {
          urlObj.pathname = `/@${noAtMatch[1]}`;
        }
      }
    }

    // Twitter / X:
    if (urlObj.hostname === 'x.com') {
      urlObj.pathname = urlObj.pathname.replace(/^\/@/, '/');
    }

    // 3. Strip tracking params
    const intellPlatform = (typeof platform === 'string' ? platform : platform) as IntelligencePlatform;
    stripTrackingParams(urlObj, intellPlatform, targetType);

    // 4. URL string post-cleanups
    let result = urlObj.toString();

    // Instagram path cleanups: /share/p/123/ -> /p/123/, /share/reel/123/ -> /reel/123/
    if (urlObj.hostname.includes('instagram.com')) {
      result = result.replace(/\/share\/p\/([a-zA-Z0-9_-]+)\/?/i, '/p/$1/');
      result = result.replace(/\/share\/reel\/([a-zA-Z0-9_-]+)\/?/i, '/reel/$1/');
      result = result.replace(/\/reels\/([a-zA-Z0-9_-]+)\/?/i, '/reel/$1/');
    }

    // Remove trailing slash for profile and channel URLs if there are no search params
    if ((normTarget === 'CHANNEL' || normTarget === 'PROFILE' || normTarget === 'STORY') && urlObj.search === '') {
      result = result.replace(/\/+$/, '');
    }

    return result;
  } catch {
    return url;
  }
}

