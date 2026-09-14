import { IntelligencePlatform } from '@/services/analyzer/link-rules';

export function extractLinks(text: string): string[] {
  if (!text) return [];
  
  const tokens = text.split(/\s+/).filter(Boolean);
  const results: string[] = [];

  for (const token of tokens) {
    // 1. Never treat email addresses as links
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token)) {
      continue;
    }

    if (/^https?:\/\//i.test(token)) {
      results.push(token);
    } else {
      const lazyRegex = /^(?:t\.me|vk\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|twitch\.tv|x\.com|twitter\.com|likee\.video)\/[^\s]+/i;
      if (lazyRegex.test(token)) {
        results.push('https://' + token);
      } else if (token.startsWith('@') && token.length > 2) {
        results.push(token); // Valid handle like @channel
      } else if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\/[^\s]+/i.test(token)) {
        results.push('https://' + token); // Domain with path like site.ru/page
      }
    }
  }

  return Array.from(new Set(results)); // Deduplicate
}

export function detectPlatformLite(url: string): IntelligencePlatform {
  const lower = url.toLowerCase();
  if (lower.includes('t.me') || lower.includes('telegram')) return IntelligencePlatform.TELEGRAM;
  if (lower.includes('vk.com') || lower.includes('vkontakte')) return IntelligencePlatform.VK;
  if (lower.includes('instagram.com')) return IntelligencePlatform.INSTAGRAM;
  if (lower.includes('tiktok.com')) return IntelligencePlatform.TIKTOK;
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return IntelligencePlatform.YOUTUBE;
  if (lower.includes('twitch.tv')) return IntelligencePlatform.TWITCH;
  if (lower.includes('twitter.com') || lower.includes('x.com')) return IntelligencePlatform.TWITTER;
  if (lower.includes('likee.video')) return IntelligencePlatform.LIKEE;
  return IntelligencePlatform.OTHER;
}

export function cleanUrlTitle(url: string): string {
  try {
    let clean = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (clean.length > 40) clean = clean.substring(0, 37) + '...';
    return clean;
  } catch {
    return url;
  }
}
