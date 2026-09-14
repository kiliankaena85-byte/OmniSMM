import { headers } from "next/headers";

const ALLOWED_HOST_DOMAINS = [
  'smmplan.pro',
  'www.smmplan.pro',
  'test.smmplan.pro',
  'smmflux.ru',
  'www.smmflux.ru',
  'test.smmflux.ru',
  'localhost',
  '127.0.0.1'
];

export function isAllowedHost(host: string): boolean {
  if (!host) return false;
  const cleanHost = host.split(':')[0].toLowerCase();
  if (cleanHost === '0.0.0.0' || cleanHost === 'host.docker.internal') return false;
  return (
    ALLOWED_HOST_DOMAINS.includes(cleanHost) ||
    cleanHost.endsWith('.smmplan.pro') ||
    cleanHost.endsWith('.smmflux.ru') ||
    cleanHost.endsWith('.ts.net') ||
    cleanHost === 'desktop-25m6el7.tailbb9d28.ts.net'
  );
}

export async function getBaseUrlAsync(reqHost?: string | null, reqProto?: string | null): Promise<string> {
  const envUrl = process.env.WEBAPP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  // 1. Check inside a request context with Host whitelist validation
  try {
    const headersList = await headers();

    // Priority 1: Check origin / referer header for exact client origin
    const originHeader = headersList.get("origin") || headersList.get("referer");
    if (originHeader) {
      try {
        const u = new URL(originHeader);
        if (isAllowedHost(u.host)) {
          return `${u.protocol}//${u.host}`;
        }
      } catch {
        // ignore malformed url
      }
    }

    let host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : (process.env.NODE_ENV === "production" ? "https" : "http"));

    if (host) {
      if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
        host = process.env.NODE_ENV === "production" 
          ? (process.env.APP_URL ? new URL(process.env.APP_URL).host : "test.smmplan.pro") 
          : "localhost:3000";
      }
      if (isAllowedHost(host)) {
        const cleanHost = host.split(':')[0].toLowerCase();
        const isTunnelOrProd = cleanHost.endsWith('.ts.net') || cleanHost.endsWith('.trycloudflare.com') || cleanHost.endsWith('.smmplan.pro') || cleanHost.endsWith('.smmflux.ru');
        const resolvedProto = isTunnelOrProd ? 'https' : proto;
        return `${resolvedProto}://${host}`;
      }
    }
  } catch {
    // Outside of a Next.js request context
  }

  // 2. Fallback to provided reqHost with whitelist check
  if (reqHost) {
    try {
      if (reqHost.startsWith("http://") || reqHost.startsWith("https://")) {
        const u = new URL(reqHost);
        if (isAllowedHost(u.host)) {
          return `${u.protocol}//${u.host}`;
        }
      }
    } catch {}

    let host = reqHost;
    if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
      host = process.env.NODE_ENV === "production" 
        ? (process.env.APP_URL ? new URL(process.env.APP_URL).host : "test.smmplan.pro") 
        : "localhost:3000";
    }
    if (isAllowedHost(host)) {
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      const proto = reqProto || (isLocal ? "http" : (process.env.NODE_ENV === "production" ? "https" : "http"));
      return `${proto}://${host}`;
    }
  }

  // 3. If we have a valid URL in env, use it (guard against using localhost env in production)
  if (envUrl) {
    const isLocalEnvUrl = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");
    if (!isLocalEnvUrl || process.env.NODE_ENV !== "production") {
      return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
    }
  }

  // 4. Absolute canonical fallback
  return process.env.NODE_ENV === "production" ? "https://test.smmplan.pro" : "http://localhost:3000";
}

/**
 * Synchronous version for when we already have the host/proto, 
 * or for places that cannot use async headers().
 */
export function getBaseUrlSync(reqHost?: string | null, reqProto?: string | null): string {
  const envUrl = process.env.WEBAPP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (reqHost) {
    try {
      if (reqHost.startsWith("http://") || reqHost.startsWith("https://")) {
        const u = new URL(reqHost);
        if (isAllowedHost(u.host)) {
          return `${u.protocol}//${u.host}`;
        }
      }
    } catch {}

    let host = reqHost;
    if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
      host = process.env.NODE_ENV === "production" 
        ? (process.env.APP_URL ? new URL(process.env.APP_URL).host : "test.smmplan.pro") 
        : "localhost:3000";
    }
    if (isAllowedHost(host)) {
      const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
      const proto = reqProto || (isLocal ? "http" : (process.env.NODE_ENV === "production" ? "https" : "http"));
      return `${proto}://${host}`;
    }
  }

  if (envUrl) {
    const isLocalEnvUrl = envUrl.includes("localhost") || envUrl.includes("127.0.0.1");
    if (!isLocalEnvUrl || process.env.NODE_ENV !== "production") {
      return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
    }
  }

  return process.env.NODE_ENV === "production" ? "https://test.smmplan.pro" : "http://localhost:3000";
}
