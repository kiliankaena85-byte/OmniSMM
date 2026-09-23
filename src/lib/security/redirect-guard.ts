const ALLOWED_PUBLIC_DOMAINS = new Set([
  'smmplan.pro',
  'www.smmplan.pro',
  'test.smmplan.pro',
  'smmflux.ru',
  'www.smmflux.ru',
  'localhost',
  '127.0.0.1',
]);

/**
 * Strict fail-closed Open-Redirect validator.
 * Ensures the target URL cannot escape the application's domain boundaries.
 */
export function sanitizeRedirectUrl(targetUrl: string | null | undefined, fallbackPath = '/dashboard'): string {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return fallbackPath;
  }

  const trimmed = targetUrl.trim();

  // 1. Block control characters, newlines, and protocol-relative shortcuts
  if (/[\r\n\t]/.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.includes('\\')) {
    return fallbackPath;
  }

  // 2. Relative URLs starting with '/' and NOT '//' or '/\'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (decoded.startsWith('//') || decoded.startsWith('/\\') || decoded.includes('\\')) {
        return fallbackPath;
      }
      return trimmed;
    } catch {
      return fallbackPath;
    }
  }

  // 3. Absolute URL inspection
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallbackPath;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (ALLOWED_PUBLIC_DOMAINS.has(hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return fallbackPath;
  }

  return fallbackPath;
}
