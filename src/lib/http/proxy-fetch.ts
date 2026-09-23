// ==============================================================
// Proxy-aware HTTP fetch for provider API connections
// Supports: HTTP, HTTPS, SOCKS5 proxies
// ==============================================================
// OWASP A10: SSRF — target URL validation via ssrf-guard
// OWASP A02: Proxy credentials encrypted at rest, decrypted only in memory
// ==============================================================

import type { ProxyConfig, ProxyProtocol } from '@/types/provider-proxy';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

export async function createProxyDispatcher(proxy: ProxyConfig) {
  const { ProxyAgent, Agent } = await import('undici');

  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || '')}@`
    : '';

  if (proxy.protocol === 'socks5') {
    const { SocksProxyAgent } = await import('socks-proxy-agent');
    // Use socks5h:// to enforce remote DNS resolution inside the tunnel (prevents local DNS leaks)
    const socksUrl = `socks5h://${auth}${proxy.host}:${proxy.port}`;
    const socksAgent = new SocksProxyAgent(socksUrl);
    socksAgent.on('error', () => {});

    // Custom connector for undici to route via SOCKS5
    const connectFn = (opts: unknown, callback: (err: Error | null, socket: unknown) => void) => {
      try {
        const anyOpts = (opts || {}) as Record<string, unknown>;
        const rawPort = anyOpts.port;
        const port = typeof rawPort === 'number' && !isNaN(rawPort) && rawPort > 0
          ? rawPort
          : (typeof rawPort === 'string' && !isNaN(parseInt(rawPort, 10)) && parseInt(rawPort, 10) > 0
              ? parseInt(rawPort, 10)
              : (anyOpts.protocol === 'http:' ? 80 : 443));
        const host = (anyOpts.hostname || anyOpts.host || 'localhost') as string;
        const safeOpts = { ...anyOpts, port, host };

        const rawConnect = socksAgent.connect.bind(socksAgent);
        const mockReq = {
          emit: () => false,
          on: () => {},
          once: () => {},
          removeListener: () => {},
          getHeader: () => undefined,
          setHeader: () => {},
        };
        const sock = (rawConnect as unknown as (req: unknown, opts: unknown, cb: (err: Error | null, socket: unknown) => void) => unknown)(
          mockReq,
          safeOpts,
          (err: Error | null, socket: unknown) => {
            if (socket && typeof (socket as { on?: unknown }).on === 'function') {
              (socket as { on: (event: string, cb: () => void) => void }).on('error', () => {});
            }
            if (err) return callback(err, null);
            callback(null, socket || null);
          },
        );
        if (sock && typeof (sock as { on?: unknown }).on === 'function') {
          (sock as { on: (event: string, cb: () => void) => void }).on('error', () => {});
        }
      } catch (err: unknown) {
        callback(err instanceof Error ? err : new Error(String(err)), null);
      }
    };

    return new Agent({
      connect: connectFn as unknown as NonNullable<ConstructorParameters<typeof Agent>[0]>['connect'],
      connectTimeout: 8000,
      headersTimeout: 15000,
    });
  }

  // http and https proxies use undici's native ProxyAgent
  const proxyUrl = `${proxy.protocol}://${auth}${proxy.host}:${proxy.port}`;
  return new ProxyAgent({
    uri: proxyUrl,
    connectTimeout: 8000,
    headersTimeout: 15000,
  });
}

/**
 * Main entry point: proxiedFetch
 * Drop-in replacement for safeFetch() that routes through a proxy.
 *
 * Usage:
 *   const resp = await proxiedFetch(targetUrl, { method: 'POST', body, proxy: proxyConfig });
 */
export async function proxiedFetch(
  url: string,
  init?: RequestInit & { proxy?: ProxyConfig | null },
): Promise<Response> {
  const proxy = init?.proxy;
  const cleanInit = { ...init };
  delete (cleanInit as Record<string, unknown>).proxy;

  const { UniversalNetworkRouter } = await import('@/lib/network/network-router');
  return UniversalNetworkRouter.fetch(url, cleanInit, {
    service: 'PROVIDERS',
    customProxy: proxy,
  });
}

/**
 * Build proxy config from decrypted DB record
 */
export function buildProxyConfig(record: {
  protocol: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
}): ProxyConfig | null {
  if (!record.host || !record.port) return null;
  return {
    protocol: record.protocol as ProxyProtocol,
    host: record.host,
    port: record.port,
    username: record.username || undefined,
    password: record.password || undefined,
  };
}

/**
 * Test proxy connectivity by making a request to a target URL
 */
export async function testProxyConnection(
  proxy: ProxyConfig,
  targetUrl: string = 'https://httpbin.org/ip',
  timeoutMs: number = 15000,
): Promise<{
  success: boolean;
  latencyMs: number;
  statusCode?: number;
  resolvedIp?: string;
  error?: string;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const ssrfCheck = await assertSafeOutboundUrl(targetUrl);
    if (!ssrfCheck.ok) {
      return { success: false, latencyMs: 0, error: `SSRF: ${ssrfCheck.reason}` };
    }

    const dispatcher = await createProxyDispatcher(proxy);
    const { fetch: undiciFetch } = await import('undici');

    const response = await undiciFetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      dispatcher: dispatcher as unknown as NonNullable<Parameters<typeof undiciFetch>[1]>['dispatcher'],
      headers: {
        'User-Agent': 'SMMplan-ProxyTest/1.0',
      },
    });

    const latencyMs = Date.now() - start;
    const text = await response.text();

    let resolvedIp: string | undefined;
    try {
      const data = JSON.parse(text);
      resolvedIp = data.origin || data.ip;
    } catch {
      // non-JSON response
    }

    return {
      success: response.ok,
      latencyMs,
      statusCode: response.status,
      resolvedIp,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      latencyMs,
      error: msg.includes('abort') ? `Таймаут (${timeoutMs}ms)` : msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
