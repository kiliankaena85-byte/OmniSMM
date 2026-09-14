import { URL } from 'node:url';
import { promises as dns } from 'node:dns';
import net from 'node:net';

const ALLOWED_SCHEMES = new Set(['https:', 'http:']);
const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]);
const AWS_METADATA_HOST = '169.254.169.254';

export type SsrfCheckResult =
  | { ok: true; ip: string; hostname: string }
  | { ok: false; reason: string };

export function isPublicIp(ip: string): boolean {
  if (!ip) return false;

  // Handle IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (ip === AWS_METADATA_HOST) return false;

  // Check IPv4 ranges
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length === 4) {
      // 0.0.0.0/8 (Current network)
      if (parts[0] === 0) return false;
      // 10.0.0.0/8 (Private)
      if (parts[0] === 10) return false;
      // 127.0.0.0/8 (Loopback)
      if (parts[0] === 127) return false;
      // 169.254.0.0/16 (Link-local & cloud metadata)
      if (parts[0] === 169 && parts[1] === 254) return false;
      // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      // 192.168.0.0/16 (Private)
      if (parts[0] === 192 && parts[1] === 168) return false;
      // 100.64.0.0/10 (Carrier-grade NAT)
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false;
      // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
      if (parts[0] >= 224) return false;
    }
    return true;
  }

  // Check IPv6 ranges
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return false;
    // Unique local address fc00::/7 (fc00... to fdff...)
    if (lower.startsWith('fc') || lower.startsWith('fd')) return false;
    // Link-local unicast fe80::/10 (fe80... to febf...)
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export async function assertSafeOutboundUrl(rawUrl: string): Promise<SsrfCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { ok: false, reason: `scheme-${parsed.protocol}-blocked` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow internal mock provider routes for dev/test environments
  if (
    parsed.pathname.includes('/api/dev/mock-provider') &&
    (process.env.ENABLE_DEV_ROUTES === 'true' || process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')
  ) {
    return { ok: true, ip: '127.0.0.1', hostname };
  }

  if (BLOCKED_HOSTS.has(hostname) || hostname === AWS_METADATA_HOST) {
    return { ok: false, reason: `host-${hostname}-blocked` };
  }

  // Trusted system services: payment gateways, Telegram Bot API, AI endpoints, and verified provider gateways
  const TRUSTED_SYSTEM_DOMAINS = [
    'api.yookassa.ru',
    'yookassa.ru',
    'api.cryptomus.com',
    'pay.cryptomus.com',
    'api.telegram.org',
    't.me',
    'auth.robokassa.ru',
    'merchant.roboxchange.com',
    'generativelanguage.googleapis.com',
    // Verified official provider gateways
    'vexboost.ru',
    'api.vexboost.ru',
    'soc-rocket.ru',
    'stream-promotion.ru',
    'likedrom.com',
    'smmprime.com',
    'smmpanelus.com',
  ];
  if (TRUSTED_SYSTEM_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
    return { ok: true, ip: 'trusted-gateway', hostname };
  }

  // If the hostname itself is an IP literal
  if (net.isIP(hostname)) {
    if (!isPublicIp(hostname)) {
      return { ok: false, reason: `ip-${hostname}-private` };
    }
    return { ok: true, ip: hostname, hostname };
  }

  // Helper to check if IP is a recognized Clash/Mihomo Fake-IP
  const isFakeIp = (ip: string) => {
    if (ip.startsWith('198.18.') || ip.startsWith('198.19.')) return true;
    if (ip.toLowerCase().startsWith('fdfe:dcba:9876:')) return true;
    return false;
  };

  // Resolve hostname via DNS (Phase 1)
  let addrs: string[] = [];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addrs = records.map(r => r.address);
  } catch {
    return { ok: false, reason: 'dns-failed' };
  }

  if (addrs.length === 0) {
    return { ok: false, reason: 'dns-no-records' };
  }

  for (const ip of addrs) {
    if (!isPublicIp(ip) && !isFakeIp(ip)) {
      return { ok: false, reason: `ip-${ip}-private` };
    }
  }

  // Phase 2: Double-resolution verification to mitigate DNS rebinding race conditions
  try {
    const secondCheckRecords = await dns.lookup(hostname, { all: true });
    const secondAddrs = secondCheckRecords.map(r => r.address);
    for (const ip of secondAddrs) {
      if (!isPublicIp(ip) && !isFakeIp(ip)) {
        return { ok: false, reason: `ip-${ip}-private-rebinding` };
      }
    }
  } catch {
    return { ok: false, reason: 'dns-rebinding-lookup-failed' };
  }

  return { ok: true, ip: addrs[0], hostname };
}

export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const check = await assertSafeOutboundUrl(url);
  if (!check.ok) {
    throw new Error(`SSRF blocked: ${check.reason} for URL ${url}`);
  }

  return fetch(url, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(10000),
  });
}
