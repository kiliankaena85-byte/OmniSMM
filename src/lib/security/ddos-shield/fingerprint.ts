import crypto from 'crypto';

/**
 * Computes a deterministic SHA-256 fingerprint hash of client HTTP request headers.
 * Groups rotating proxy clients sharing identical browser signatures into a single bucket.
 */
export function computeHeaderFingerprint(headers: Headers, clientIp?: string): string {
  const ua = headers.get('user-agent') || '';
  const acceptLang = headers.get('accept-language') || '';
  const secChUa = headers.get('sec-ch-ua') || '';
  const secChUaPlatform = headers.get('sec-ch-ua-platform') || '';
  const secChUaMobile = headers.get('sec-ch-ua-mobile') || '';
  const secFetchDest = headers.get('sec-fetch-dest') || '';
  const secFetchMode = headers.get('sec-fetch-mode') || '';

  const rawFingerprint = [
    clientIp ? clientIp.trim() : '',
    ua.trim(),
    acceptLang.split(',')[0]?.trim() || '',
    secChUa.trim(),
    secChUaPlatform.replace(/"/g, '').trim().toLowerCase(),
    secChUaMobile.trim(),
    secFetchDest.trim(),
    secFetchMode.trim(),
  ].join('|');

  return crypto.createHash('sha256').update(rawFingerprint).digest('hex');
}

export interface ClientHintsAnomalyResult {
  isAnomalous: boolean;
  reason?: string;
}

/**
 * Detects structural anomalies and spoofing in Client Hints vs User-Agent headers.
 */
export function checkClientHintsAnomaly(headers: Headers): ClientHintsAnomalyResult {
  const ua = (headers.get('user-agent') || '').toLowerCase();
  const rawPlatform = headers.get('sec-ch-ua-platform');
  const secChUaMobile = headers.get('sec-ch-ua-mobile');

  if (rawPlatform) {
    const platform = rawPlatform.replace(/"/g, '').toLowerCase().trim();

    // Check Windows mismatch
    if (ua.includes('windows') && platform !== 'windows') {
      return {
        isAnomalous: true,
        reason: `Platform mismatch: User-Agent indicates Windows, but sec-ch-ua-platform is "${platform}"`,
      };
    }

    // Check Android mismatch
    if (ua.includes('android') && platform !== 'android') {
      return {
        isAnomalous: true,
        reason: `Platform mismatch: User-Agent indicates Android, but sec-ch-ua-platform is "${platform}"`,
      };
    }

    // Check MacOS/iOS mismatch
    if ((ua.includes('macintosh') || ua.includes('mac os x')) && platform !== 'macos' && platform !== 'ios') {
      return {
        isAnomalous: true,
        reason: `Platform mismatch: User-Agent indicates MacOS, but sec-ch-ua-platform is "${platform}"`,
      };
    }

    // Check Linux (desktop) vs Windows platform
    if (ua.includes('linux') && !ua.includes('android') && platform === 'windows') {
      return {
        isAnomalous: true,
        reason: `Platform mismatch: User-Agent indicates Linux, but sec-ch-ua-platform is Windows`,
      };
    }
  }

  if (secChUaMobile) {
    // Tablets (iPad or Android tablet where UA has "android" but NOT "mobile") legitimately send sec-ch-ua-mobile: ?0
    const isTablet = ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'));
    const isMobileUa = (ua.includes('mobile') || ua.includes('iphone')) && !isTablet;
    
    // Contradiction: UA claims to be mobile, but hint explicitly specifies desktop ?0
    if (isMobileUa && secChUaMobile.includes('?0')) {
      return {
        isAnomalous: true,
        reason: `Mobile hint mismatch: User-Agent claims mobile, but sec-ch-ua-mobile is ?0`,
      };
    }
  }

  return { isAnomalous: false };
}

const WHITELISTED_BOT_PATTERNS = [
  /yandex\.com\/bots/i,
  /yandexbot/i,
  /googlebot/i,
  /google\.com\/bot\.html/i,
  /mail\.ru_bot/i,
  /bingbot/i,
];

/**
 * Checks if the request originates from a verified search engine crawler.
 */
export function isWhitelistedGoodBot(headers: Headers): boolean {
  const ua = headers.get('user-agent') || '';
  if (!ua) return false;

  return WHITELISTED_BOT_PATTERNS.some(pattern => pattern.test(ua));
}
