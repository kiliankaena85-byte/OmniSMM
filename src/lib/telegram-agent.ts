import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ProxyAgent } from 'undici';

let cachedDbProxyUrl: string | null = null;
let lastDbProxyCheck = 0;
let lastDirectConnectivityState: boolean | null = null; // tracks previous probe result
const DB_PROXY_CACHE_TTL = 10_000; // 10s — fast re-probe when Clash Verge toggled

/**
 * Resolves the configured Telegram Proxy URL from environment variables.
 * Supports: TELEGRAM_PROXY_URL, HTTPS_PROXY, HTTP_PROXY, ALL_PROXY.
 */
export function getTelegramProxyUrl(): string | undefined {
  return (
    process.env.TELEGRAM_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    cachedDbProxyUrl ||
    undefined
  );
}

/**
 * Resolves active proxy from Database (SystemSettings + TelegramProxy) if not set in ENV.
 */
export async function resolveActiveTelegramProxyUrl(tenantId = 'smmplan'): Promise<string | undefined> {
  // ── Auto-detect: if direct connection to Telegram works, skip internal proxy.
  // This handles the case where Clash Verge TUN on Windows is active —
  // using http://clash:7890 AND Clash Verge simultaneously causes double-routing and failures.
  try {
    const directOk = await Promise.race<boolean>([
      fetch('https://api.telegram.org', { method: 'HEAD', signal: AbortSignal.timeout(2500) })
        .then(r => r.status < 500)
        .catch(() => false),
      new Promise<boolean>(res => setTimeout(() => res(false), 2600)),
    ]);

    // If connectivity state changed (Clash Verge toggled), flush cache immediately
    if (lastDirectConnectivityState !== null && lastDirectConnectivityState !== directOk) {
      cachedDbProxyUrl = null;
      lastDbProxyCheck = 0;
      console.info(`[TelegramAgent] 🔄 Network mode changed (direct=${directOk}) — proxy cache cleared.`);
    }
    lastDirectConnectivityState = directOk;

    if (directOk) {
      console.info('[TelegramAgent] ✅ Direct Telegram connection OK (OS-level VPN/TUN active) — skipping internal proxy.');
      return undefined;
    }
  } catch {
    // probe failed → need proxy
  }

  // Direct probe failed — network is blocked (Russian ISP ТСПУ), need proxy.
  // First check explicit override envs, then fall back to internal Mihomo container.
  const envUrl = process.env.TELEGRAM_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  if (envUrl) return envUrl;

  // Use the internal Docker Mihomo container if configured
  const clashInternalUrl = process.env.CLASH_INTERNAL_PROXY_URL;
  if (clashInternalUrl) {
    console.info(`[TelegramAgent] 🛡️ Direct probe failed — routing via internal Mihomo proxy: ${clashInternalUrl}`);
    return clashInternalUrl;
  }

  const now = Date.now();
  if (cachedDbProxyUrl !== null && now - lastDbProxyCheck < DB_PROXY_CACHE_TTL) {
    return cachedDbProxyUrl || undefined;
  }

  try {
    const { db } = await import('@/lib/db');
    const settings = await db.systemSettings.findFirst({
      where: { id: tenantId },
      select: { telegramProxyId: true },
    });

    if (settings?.telegramProxyId) {
      const proxy = await db.telegramProxy.findUnique({
        where: { id: settings.telegramProxyId },
      });

      if (proxy && proxy.isActive && proxy.host && proxy.port) {
        let auth = '';
        if (proxy.username) {
          let password = '';
          if (proxy.passwordEncrypted) {
            try {
              const { VaultService } = await import('@/lib/vault');
              password = VaultService.decrypt(proxy.passwordEncrypted);
            } catch {
              password = proxy.passwordEncrypted;
            }
          }
          auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(password)}@`;
        }
        const protocol = (proxy.protocol || 'socks5').toLowerCase() === 'socks5' ? 'socks5h' : (proxy.protocol || 'http').toLowerCase();
        cachedDbProxyUrl = `${protocol}://${auth}${proxy.host}:${proxy.port}`;
        lastDbProxyCheck = now;
        return cachedDbProxyUrl;
      }
    }

    // 2. Fallback to healthy proxy from general providerProxy pool
    const providerProxy = await db.providerProxy.findFirst({
      where: {
        isActive: true,
        consecutiveFailures: { lt: 3 },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: [
        { consecutiveFailures: 'asc' },
        { lastTestLatencyMs: 'asc' },
        { errorCount: 'asc' },
      ],
    });

    if (providerProxy && providerProxy.host && providerProxy.port) {
      const protocol = (providerProxy.protocol || 'socks5').toLowerCase() === 'socks5' ? 'socks5h' : (providerProxy.protocol || 'http').toLowerCase();
      let auth = '';
      if (providerProxy.username) {
        let password = '';
        if (providerProxy.passwordEncrypted) {
          try {
            const { VaultService } = await import('@/lib/vault');
            password = VaultService.decrypt(providerProxy.passwordEncrypted);
          } catch {
            password = providerProxy.passwordEncrypted;
          }
        }
        auth = `${encodeURIComponent(providerProxy.username)}:${encodeURIComponent(password)}@`;
      }
      cachedDbProxyUrl = `${protocol}://${auth}${providerProxy.host}:${providerProxy.port}`;
      lastDbProxyCheck = now;
      console.info(`[TelegramAgent] 🛡️ Auto-routed Telegram bot through healthy pool proxy: ${providerProxy.label || providerProxy.host}`);
      return cachedDbProxyUrl;
    }

    cachedDbProxyUrl = '';
    lastDbProxyCheck = now;
    return undefined;
  } catch (err) {
    console.warn('[TelegramAgent] Could not resolve proxy from database:', err);
    return undefined;
  }
}

/**
 * Reports failure for a proxy URL, penalizes it in DB and invalidates cache.
 */
export async function reportTelegramProxyFailure(failedProxyUrl?: string): Promise<void> {
  cachedDbProxyUrl = null;
  lastDbProxyCheck = 0;

  if (!failedProxyUrl) return;

  try {
    const cleanUrl = failedProxyUrl.replace(/^socks5h:/i, 'http:').replace(/^socks5:/i, 'http:');
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10);

    if (host && port) {
      const { db } = await import('@/lib/db');
      await db.providerProxy.updateMany({
        where: { host, port },
        data: {
          lastTestSuccess: false,
          lastErrorAt: new Date(),
          errorCount: { increment: 1 },
          consecutiveFailures: { increment: 1 },
        },
      });
      console.warn(`[TelegramAgent] ⚠️ Quarantined failing Telegram proxy: ${host}:${port}`);
    }
  } catch (err) {
    console.warn('[TelegramAgent] Failed to parse failedProxyUrl:', err);
  }
}

/**
 * Returns an HTTP/SOCKS agent for Telegraf bot instance.
 */
export function getTelegramProxyAgent(proxyUrlOverride?: string): HttpsProxyAgent<string> | SocksProxyAgent | undefined {
  const rawUrl = proxyUrlOverride || getTelegramProxyUrl();
  if (!rawUrl) return undefined;

  // Enforce socks5h:// for remote DNS resolution (prevent domestic DNS blocking)
  const proxyUrl = rawUrl.startsWith('socks5://') ? rawUrl.replace('socks5://', 'socks5h://') : rawUrl;

  try {
    if (proxyUrl.startsWith('socks')) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  } catch (err) {
    console.error('[TelegramAgent] Failed to create proxy agent for Telegraf:', err);
    return undefined;
  }
}

/**
 * Returns a ProxyAgent dispatcher for native fetch / undici HTTP calls (alerts, webhooks, diagnostics).
 */
export function getTelegramDispatcher(proxyUrlOverride?: string): ProxyAgent | undefined {
  const proxyUrl = proxyUrlOverride || getTelegramProxyUrl();
  if (!proxyUrl) return undefined;

  try {
    return new ProxyAgent(proxyUrl);
  } catch (err) {
    console.error('[TelegramAgent] Failed to create undici ProxyAgent dispatcher:', err);
    return undefined;
  }
}
