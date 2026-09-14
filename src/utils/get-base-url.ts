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

export const ALLOWED_TUNNEL_SUFFIXES = [
  '.ts.net',
  '.trycloudflare.com',
  '.loca.lt',
  '.ngrok-free.app',
  '.ngrok.app',
  '.ngrok.io',
  '.lhr.life',
  '.serveo.net',
  '.pinggy-free.link',
  '.pinggy.link',
  '.free.pinggy.net',
  '.pinggy.net',
];

export function isAllowedHost(host: string): boolean {
  if (!host) return false;
  const cleanHost = host.split(':')[0].toLowerCase();
  if (cleanHost === '0.0.0.0' || cleanHost === 'host.docker.internal') return false;
  return (
    ALLOWED_HOST_DOMAINS.includes(cleanHost) ||
    cleanHost.endsWith('.smmplan.pro') ||
    cleanHost.endsWith('.smmflux.ru') ||
    ALLOWED_TUNNEL_SUFFIXES.some(suffix => cleanHost.endsWith(suffix))
  );
}

export async function getBaseUrlAsync(reqHost?: string | null, reqProto?: string | null): Promise<string> {
  const envUrl = process.env.WEBAPP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

  // 1. Check inside a request context with Host whitelist validation
  try {
    const headersList = await headers();
    let host = headersList.get("x-forwarded-host") || headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");

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

  // 2. If we have a valid URL in env, use it.
  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  // 3. Fallback to provided reqHost with whitelist check
  if (reqHost) {
    let host = reqHost;
    if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
      host = process.env.NODE_ENV === "production" 
        ? (process.env.APP_URL ? new URL(process.env.APP_URL).host : "test.smmplan.pro") 
        : "localhost:3000";
    }
    if (isAllowedHost(host)) {
      const cleanHost = host.split(':')[0].toLowerCase();
      const isTunnelOrProd = cleanHost.endsWith('.ts.net') || cleanHost.endsWith('.trycloudflare.com') || cleanHost.endsWith('.smmplan.pro') || cleanHost.endsWith('.smmflux.ru');
      const proto = isTunnelOrProd ? 'https' : (reqProto || (process.env.NODE_ENV === "production" ? "https" : "http"));
      return `${proto}://${host}`;
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
    let host = reqHost;
    if (host.includes("0.0.0.0") || host.includes("host.docker.internal")) {
      host = process.env.NODE_ENV === "production" 
        ? (process.env.APP_URL ? new URL(process.env.APP_URL).host : "test.smmplan.pro") 
        : "localhost:3000";
    }
    if (isAllowedHost(host)) {
      const cleanHost = host.split(':')[0].toLowerCase();
      const isTunnelOrProd = cleanHost.endsWith('.ts.net') || cleanHost.endsWith('.trycloudflare.com') || cleanHost.endsWith('.smmplan.pro') || cleanHost.endsWith('.smmflux.ru');
      const proto = isTunnelOrProd ? 'https' : (reqProto || (process.env.NODE_ENV === "production" ? "https" : "http"));
      return `${proto}://${host}`;
    }
  }

  if (envUrl) {
    return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
  }

  return process.env.NODE_ENV === "production" ? "https://test.smmplan.pro" : "http://localhost:3000";
}
