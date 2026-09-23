/**
 * Safely formats a URL for logging by stripping query parameters and hashes.
 * Returns 'protocol//host/path' or '[unparseable-url]' if invalid.
 */
export function safeUrlForLog(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '[unparseable-url]';
  try {
    const raw = url.trim();
    if (raw.length === 0) return '[unparseable-url]';
    const formatted = raw.includes('://') ? raw : `https://${raw}`;
    const parsed = new URL(formatted);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '[unparseable-url]';
  }
}
