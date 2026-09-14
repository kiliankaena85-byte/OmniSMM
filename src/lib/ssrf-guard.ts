import dns from 'dns/promises';
import { URL } from 'url';

export const SHORT_LINK_HOSTS = new Set([
  'bit.ly',
  'youtu.be',
  'vm.tiktok.com',
  't.co',
  'cutt.ly',
  'clck.ru',
  'tinyurl.com',
  'is.gd',
]);

export function isPublicIp(rawIp: string): boolean {
  let ip = rawIp.trim().toLowerCase();

  // Strip IPv6 bracket notation: [::1] -> ::1
  if (ip.startsWith('[') && ip.endsWith(']')) {
    ip = ip.slice(1, -1);
  }

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or hex ::ffff:7f00:1
  if (ip.startsWith('::ffff:')) {
    const rem = ip.slice(7);
    if (rem.includes('.')) {
      ip = rem;
    } else {
      const parts = rem.split(':');
      if (parts.length === 2) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);
        if (!isNaN(high) && !isNaN(low)) {
          const b1 = (high >> 8) & 0xff;
          const b2 = high & 0xff;
          const b3 = (low >> 8) & 0xff;
          const b4 = low & 0xff;
          ip = `${b1}.${b2}.${b3}.${b4}`;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  // IPv4 Private & Loopback & Special ranges
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('169.254.') ||
    ip.startsWith('192.168.') ||
    ip === '0.0.0.0' ||
    ip.startsWith('0.')
  ) {
    return false;
  }

  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
    }
  }

  // IPv6 Loopback, Unique Local, Link-Local, Cloud Metadata
  if (
    ip === '::1' ||
    ip === '::' ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fd00:') ||
    ip.startsWith('fe80:') ||
    ip === 'fd00:ec2::254'
  ) {
    return false;
  }

  return true;
}

export function isUrlSafeForFetch(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;

  const rawHost = parsedUrl.hostname.toLowerCase().trim();
  const host = (rawHost.startsWith('[') && rawHost.endsWith(']')) ? rawHost.slice(1, -1) : rawHost;

  // Block local/internal hostnames & cloud metadata
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal' ||
    host.endsWith('.metadata.internal')
  ) {
    return false;
  }

  // Direct IP address check (both IPv4 and IPv6)
  if (!isPublicIp(host)) {
    return false;
  }

  return true;
}

export async function isPublicHost(hostname: string): Promise<boolean> {
  const cleanHost = hostname.toLowerCase().trim();

  if (cleanHost === 'localhost' || cleanHost.endsWith('.local') || cleanHost.endsWith('.internal')) {
    return false;
  }

  // Direct IP address check
  if (!isPublicIp(cleanHost)) {
    return false;
  }

  try {
    const records = await dns.lookup(cleanHost, { all: true });
    if (!records || records.length === 0) return false;

    for (const record of records) {
      if (!isPublicIp(record.address)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function resolveShortLink(rawUrl: string): Promise<string> {
  let currentUrl = rawUrl.trim();
  if (!currentUrl) return rawUrl;

  try {
    const initialTest = new URL(currentUrl.includes('://') ? currentUrl : `https://${currentUrl}`);
    if (initialTest.protocol !== 'http:' && initialTest.protocol !== 'https:') {
      return rawUrl;
    }
  } catch {
    return rawUrl;
  }

  if (!currentUrl.startsWith('http')) {
    currentUrl = `https://${currentUrl}`;
  }

  const maxHops = 5;

  for (let hop = 0; hop < maxHops; hop++) {
    try {
      const parsed = new URL(currentUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return currentUrl;
      }
      const isAllowedHost = await isPublicHost(parsed.hostname);
      if (!isAllowedHost) {
        return currentUrl;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const location = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && location) {
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = nextUrl;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return currentUrl;
}
