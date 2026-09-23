import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { isIP } from 'net';

function isValidIp(ip: string): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  if (isIP(trimmed) !== 0) return true;
  if (trimmed.startsWith('::ffff:')) {
    return isIP(trimmed.slice(7)) === 4;
  }
  return false;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:') && isIP(trimmed.slice(7)) === 4) {
    return trimmed.slice(7);
  }
  return trimmed;
}

export function isInternalOrPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const clean = ip.trim().toLowerCase();
  if (clean === '127.0.0.1' || clean === '::1' || clean === '0.0.0.0' || clean === 'localhost') return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(clean)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(clean)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(clean)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+$/.test(clean)) return true;
  return false;
}

/**
 * Извлекает IP-адрес клиента из HTTP-заголовков.
 *
 * Приоритет при TRUST_CF_CONNECTING_IP === 'true' (Cloudflare Tunnel / CDN mode):
 * 1. cf-connecting-ip (выставлен доверенным edge Cloudflare)
 * 2. x-real-ip (перезаписан reverse proxy)
 * 3. x-forwarded-for (правый хоп к доверенному прокси)
 * 4. fallback
 *
 * Приоритет по умолчанию (прямой хостинг РФ / Nginx без CDN):
 * 1. x-real-ip (доверенный, перезаписанный Nginx / DDoS-Guard)
 * 2. x-forwarded-for (правый хоп к доверенному прокси)
 * 3. fallback
 *
 * ARCHITECTURE CONTRACT: Единственный источник правды для IP.
 * Не дублируйте эту логику — используйте этот вызов.
 */
export async function getClientIp(
  reqOrHeadersOrFallback?: Request | NextRequest | Headers | string | null,
  fallback: string = '0.0.0.0'
): Promise<string> {
  try {
    let reqHeaders: Headers | undefined;
    let effectiveFallback = fallback;

    if (typeof reqOrHeadersOrFallback === 'string') {
      effectiveFallback = reqOrHeadersOrFallback;
    } else if (reqOrHeadersOrFallback) {
      if (typeof (reqOrHeadersOrFallback as { get?: unknown }).get === 'function') {
        reqHeaders = reqOrHeadersOrFallback as Headers;
      } else if ('headers' in reqOrHeadersOrFallback && reqOrHeadersOrFallback.headers) {
        reqHeaders = reqOrHeadersOrFallback.headers;
      }
    }

    if (!reqHeaders) {
      reqHeaders = await headers();
    }

    const trustCf = process.env.TRUST_CF_CONNECTING_IP === 'true';
    if (trustCf) {
      const cfIp = reqHeaders.get('cf-connecting-ip');
      if (cfIp && isValidIp(cfIp)) {
        return normalizeIp(cfIp);
      }
    }

    const realIp = reqHeaders.get('x-real-ip');
    if (realIp && isValidIp(realIp)) {
      return normalizeIp(realIp);
    }

    const forwardedFor = reqHeaders.get('x-forwarded-for');
    if (forwardedFor) {
      const hops = forwardedFor.split(',').map(s => s.trim()).filter(s => isValidIp(s));
      if (hops.length > 0) {
        // Take rightmost valid hop (closest to trusted reverse proxy)
        return normalizeIp(hops[hops.length - 1]);
      }
    }
    return effectiveFallback;
  } catch {
    return typeof reqOrHeadersOrFallback === 'string' ? reqOrHeadersOrFallback : fallback;
  }
}
