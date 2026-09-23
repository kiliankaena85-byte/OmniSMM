/**
 * Smart URL Cleaner & Normalizer for SMMplan Link Analyzer
 * Strips tracking parameters, mobile subdomains, and normalizes URL structures.
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'igsh',
  'si',
  'feature',
  'fbclid',
  'gclid',
  'yclid',
  'ref',
  'ref_src',
  't',
  'src',
  'share_id',
  'app',
]);

const DOMAIN_NORMALIZATIONS: Record<string, string> = {
  'm.vk.com': 'vk.com',
  'mobile.twitter.com': 'x.com',
  'twitter.com': 'x.com',
  'm.youtube.com': 'youtube.com',
  'youtu.be': 'youtube.com',
  'm.tiktok.com': 'tiktok.com',
  'vt.tiktok.com': 'tiktok.com',
  'vm.tiktok.com': 'tiktok.com',
  'telegram.me': 't.me',
  'telegram.dog': 't.me',
  'instagr.am': 'instagram.com',
  'ig.me': 'instagram.com',
};

export class UrlCleaner {
  /**
   * Clean and normalize raw user URL input
   */
  static clean(rawInput: string): string {
    if (!rawInput || typeof rawInput !== 'string') return '';

    let trimmed = rawInput.trim();
    if (!trimmed) return '';

    // If starts with @ (e.g. @username or @channel), leave as is or normalize to t.me/
    if (trimmed.startsWith('@')) {
      return trimmed;
    }

    // Add protocol if missing for URL parsing
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const urlStringToParse = hasProtocol ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(urlStringToParse);

      // 1. Normalize domain
      let hostname = parsed.hostname.toLowerCase();
      if (hostname.startsWith('www.')) {
        hostname = hostname.slice(4);
      }

      if (DOMAIN_NORMALIZATIONS[hostname]) {
        hostname = DOMAIN_NORMALIZATIONS[hostname];
      }

      // 2. Handle YouTube Short URL (youtu.be/xyz -> youtube.com/watch?v=xyz)
      let pathname = parsed.pathname;
      const searchParams = parsed.searchParams;

      if (parsed.hostname.toLowerCase().includes('youtu.be')) {
        const videoId = pathname.replace(/^\/+/, '');
        if (videoId) {
          hostname = 'youtube.com';
          pathname = '/watch';
          searchParams.set('v', videoId);
        }
      }

      // 3. Filter tracking query params
      const cleanParams = new URLSearchParams();
      for (const [key, value] of searchParams.entries()) {
        const lowerKey = key.toLowerCase();
        if (!TRACKING_PARAMS.has(lowerKey)) {
          cleanParams.set(key, value);
        }
      }

      const queryString = cleanParams.toString();
      const normalizedPath = pathname.replace(/\/+$/, '') || '/';
      const cleanUrl = `${hostname}${normalizedPath === '/' && !queryString ? '' : normalizedPath}${queryString ? `?${queryString}` : ''}`;

      return cleanUrl;
    } catch {
      // Fallback simple regex strip if URL parsing fails (e.g. invalid string)
      return trimmed
        .replace(/^[a-z]+:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/[?&](?:utm_[^&=]+|igsh|si|fbclid)=[^&]+/gi, '')
        .replace(/[?&]$/, '');
    }
  }

  /**
   * Extract basic domain identifier from URL
   */
  static extractDomain(rawInput: string): string {
    const cleaned = this.clean(rawInput);
    if (cleaned.startsWith('@')) return 'telegram';
    const match = cleaned.match(/^([a-z0-9.-]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}
