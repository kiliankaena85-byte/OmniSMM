import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { VaultService } from '@/lib/vault';
import type { ProxyConfig, ProxyProtocol } from '@/types/provider-proxy';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

export interface ManagedProxy extends ProxyConfig {
  id: string;
  latencyMs: number;
  failureCount: number;
  lastSuccessAt: Date | null;
  isQuarantined: boolean;
  quarantineUntil: Date | null;
}

export class ProxyPoolService {
  private static readonly QUARANTINE_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_FAILURES_BEFORE_QUARANTINE = 3;
  private static readonly REDIS_HEALTH_PREFIX = 'proxy:health:';

  /**
   * Fetch active, healthy proxies from database & cache.
   */
  public static async getHealthyProxy(
    providerId?: string,
    category: 'PAID_PREMIUM' | 'FREE_PUBLIC' | 'BACKUP_RESERVE' = 'PAID_PREMIUM'
  ): Promise<ProxyConfig | null> {
    try {
      if (!db || !db.providerProxy) return null;

      const notExpired = {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      };

      // 1. Check if provider has dedicated proxy assigned
      if (providerId) {
        const dedicated = await db.providerProxy.findFirst({
          where: {
            providers: {
              some: { id: providerId },
            },
            isActive: true,
            ...notExpired,
          },
        });
        if (dedicated) {
          const isQuarantined = await this.isProxyQuarantined(dedicated.id);
          if (!isQuarantined) {
            return this.hydrateProxyConfig(dedicated);
          }
        }
      }

      // 2. Fetch general pool filtered by requested category first
      let pool = await db.providerProxy.findMany({
        where: {
          isActive: true,
          category,
          ...notExpired,
        },
        orderBy: {
          lastTestLatencyMs: 'asc',
        },
        take: 20,
      });

      // Fallback to any active proxy if requested category is empty
      if (!pool || pool.length === 0) {
        pool = await db.providerProxy.findMany({
          where: {
            isActive: true,
            ...notExpired,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 20,
        });
      }

      if (!pool || pool.length === 0) {
        return null;
      }

      // 3. Filter out quarantined proxies
      const healthyList: ProxyConfig[] = [];
      for (const p of pool) {
        const isQuarantined = await this.isProxyQuarantined(p.id);
        if (!isQuarantined) {
          const config = this.hydrateProxyConfig(p);
          if (config) healthyList.push(config);
        }
      }

      if (healthyList.length === 0) {
        // Fallback: If all are quarantined, pick the oldest updated one to avoid total outage
        return this.hydrateProxyConfig(pool[0]);
      }

      // 4. Return random healthy proxy to distribute load
      const randomIndex = Math.floor(Math.random() * healthyList.length);
      return healthyList[randomIndex];
    } catch (err) {
      console.error('[ProxyPoolService] Error selecting healthy proxy:', err);
      return null;
    }
  }

  /**
   * Fetch active, healthy Russian proxy (RU_SOVEREIGN_POOL)
   * used as a secure domestic bridge when platform is hosted overseas.
   */
  public static async getHealthyRuProxy(): Promise<ProxyConfig | null> {
    try {
      if (!db || !db.providerProxy) return null;

      const ruPool = await db.providerProxy.findMany({
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
          AND: [
            {
              OR: [
                { geoCountry: 'RU' },
                { tags: { contains: 'RU' } },
                { tags: { contains: 'SOVEREIGN' } },
                { label: { contains: 'Россия', mode: 'insensitive' } },
                { label: { contains: 'RU', mode: 'insensitive' } },
              ],
            },
          ],
        },
        orderBy: {
          lastTestLatencyMs: 'asc',
        },
        take: 10,
      });

      if (!ruPool || ruPool.length === 0) return null;

      for (const p of ruPool) {
        const isQuarantined = await this.isProxyQuarantined(p.id);
        if (!isQuarantined) {
          const cfg = this.hydrateProxyConfig(p);
          if (cfg) return cfg;
        }
      }

      return this.hydrateProxyConfig(ruPool[0]);
    } catch (err) {
      console.error('[ProxyPoolService] Error selecting healthy RU proxy:', err);
      return null;
    }
  }

  /**
   * Report proxy failure (HTTP 429, 403, 500, timeout).
   */
  public static async reportFailure(proxyId: string, errorReason: string, httpStatus?: number): Promise<void> {
    if (!proxyId) return;

    try {
      if (redis) {
        const key = `${this.REDIS_HEALTH_PREFIX}${proxyId}:fails`;
        const count = await redis.incr(key);
        await redis.expire(key, 1800); // 30 min window

        if (count >= this.MAX_FAILURES_BEFORE_QUARANTINE || httpStatus === 429 || httpStatus === 403) {
          const quarantineKey = `${this.REDIS_HEALTH_PREFIX}${proxyId}:quarantine`;
          await redis.set(quarantineKey, errorReason, 'PX', this.QUARANTINE_DURATION_MS);
          console.warn(`[ProxyPoolService] Proxy ${proxyId} quarantined for 15m. Reason: ${errorReason} (Status: ${httpStatus})`);
        }
      }
    } catch (err) {
      console.error(`[ProxyPoolService] Failed to record proxy failure for ${proxyId}:`, err);
    }
  }

  /**
   * Report proxy success to reset failure counts.
   */
  public static async reportSuccess(proxyId: string, latencyMs?: number): Promise<void> {
    if (!proxyId) return;

    try {
      if (redis) {
        const key = `${this.REDIS_HEALTH_PREFIX}${proxyId}:fails`;
        await redis.del(key);
        if (latencyMs) {
          await redis.set(`${this.REDIS_HEALTH_PREFIX}${proxyId}:latency`, latencyMs, 'EX', 3600);
        }
      }
    } catch (err) {
      console.error(`[ProxyPoolService] Failed to record proxy success for ${proxyId}:`, err);
    }
  }

  /**
   * Check if proxy is currently quarantined.
   */
  public static async isProxyQuarantined(proxyId: string): Promise<boolean> {
    try {
      if (!redis) return false;
      const quarantine = await redis.get(`${this.REDIS_HEALTH_PREFIX}${proxyId}:quarantine`);
      return !!quarantine;
    } catch {
      return false;
    }
  }

  /**
   * Decrypt and build ProxyConfig safely.
   */
  public static hydrateProxyConfig(record: any): ProxyConfig | null {
    if (!record.host || !record.port) return null;

    let decryptedPass = record.password;
    if (record.password && (record.password.includes(':') || record.password.length > 32)) {
      try {
        decryptedPass = VaultService.decrypt(record.password);
      } catch {
        decryptedPass = record.password;
      }
    }

    return {
      id: record.id,
      protocol: record.protocol as ProxyProtocol,
      host: record.host,
      port: record.port,
      username: record.username || undefined,
      password: decryptedPass || undefined,
      lastTestLatencyMs: record.lastTestLatencyMs ?? null,
      category: record.category || 'PAID_PREMIUM',
      isActive: record.isActive ?? true,
    };
  }
}
