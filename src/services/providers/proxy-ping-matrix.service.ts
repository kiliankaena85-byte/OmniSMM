import { redis } from '@/lib/redis';
import { db } from '@/lib/db';
import { ChainedProxyService, type ProxyHop, type ChainedRoute } from '@/services/providers/chained-proxy.service';
import { ProxyPoolService } from '@/services/providers/proxy-pool.service';
import type { ProxyConfig } from '@/types/provider-proxy';

export interface RouteScore {
  hop1: ProxyConfig;
  hop2?: ProxyConfig;
  estimatedLatencyMs: number;
  isDegraded: boolean;
  score: number; // Higher is better
}

export class ProxyPingMatrixService {
  private static readonly MAX_ACCEPTABLE_LATENCY_MS = 350;
  private static readonly MATRIX_REDIS_PREFIX = 'proxy:matrix:latency:';
  private static readonly STICKY_ROUTE_PREFIX = 'proxy:sticky:route:';
  private static readonly STICKY_TTL_SECONDS = 300; // 5 minutes

  /**
   * Generates a unique route key for caching latency statistics.
   */
  public static getRouteKey(hop1Id: string, hop2Id?: string): string {
    return hop2Id ? `${hop1Id}->${hop2Id}` : hop1Id;
  }

  /**
   * Records observed latency for a given route in Redis.
   */
  public static async recordLatency(hop1Id: string, hop2Id: string | undefined, latencyMs: number): Promise<void> {
    const key = `${this.MATRIX_REDIS_PREFIX}${this.getRouteKey(hop1Id, hop2Id)}`;
    try {
      if (redis) {
        await redis.set(key, String(latencyMs), 'EX', 3600); // 1 hour TTL
      }
    } catch {
      // Non-critical cache error fallback
    }
  }

  /**
   * Retrieves cached latency for a route.
   */
  public static async getCachedLatency(hop1Id: string, hop2Id?: string): Promise<number | null> {
    const key = `${this.MATRIX_REDIS_PREFIX}${this.getRouteKey(hop1Id, hop2Id)}`;
    try {
      if (redis) {
        const val = await redis.get(key);
        if (val) return parseInt(val, 10);
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Selects the optimal low-latency route for a provider or target:
   * 1. Check for active Sticky Route (affinity).
   * 2. If none or degraded, evaluates candidate 1-hop and 2-hop chains.
   * 3. Sorts by estimated latency, filtering out degraded nodes (> 350ms).
   */
  public static async resolveOptimalRoute(options: {
    providerId?: string;
    targetHost: string;
    targetPort?: number;
    forceChain?: boolean;
    useTls?: boolean;
  }): Promise<{
    route: ChainedRoute;
    hop1Config: ProxyConfig;
    hop2Config?: ProxyConfig;
    estimatedLatencyMs: number;
  } | null> {
    const targetPort = options.targetPort || (options.useTls !== false ? 443 : 80);

    // 1. Check sticky route cache if providerId specified
    if (options.providerId && redis) {
      try {
        const stickyRaw = await redis.get(`${this.STICKY_ROUTE_PREFIX}${options.providerId}`);
        if (stickyRaw) {
          const sticky = JSON.parse(stickyRaw) as { hop1Id: string; hop2Id?: string };
          const hop1 = await this.getProxyById(sticky.hop1Id);
          if (hop1 && hop1.isActive) {
            const hop2 = sticky.hop2Id ? await this.getProxyById(sticky.hop2Id) : null;
            const latency = (await this.getCachedLatency(hop1.id || '', hop2?.id || undefined)) || 100;
            if (latency <= this.MAX_ACCEPTABLE_LATENCY_MS) {
              return {
                route: {
                  hop1: ChainedProxyService.toHop(hop1),
                  hop2: hop2 ? ChainedProxyService.toHop(hop2) : undefined,
                  targetHost: options.targetHost,
                  targetPort,
                  useTls: options.useTls ?? true,
                },
                hop1Config: hop1,
                hop2Config: hop2 || undefined,
                estimatedLatencyMs: latency,
              };
            }
          }
        }
      } catch {
        // Sticky lookup failed, fallback to candidate resolution
      }
    }

    // 2. Fetch healthy entry gateway (Quattro VPN / PAID_PREMIUM)
    const premiumGateways = await db.providerProxy.findMany({
      where: {
        isActive: true,
        category: 'PAID_PREMIUM',
      },
      orderBy: {
        lastTestLatencyMs: 'asc',
      },
      take: 5,
    });

    if (!premiumGateways || premiumGateways.length === 0) {
      return null;
    }

    const primaryGateway = ProxyPoolService.hydrateProxyConfig(premiumGateways[0]);
    if (!primaryGateway) {
      return null;
    }

    // 3. If forceChain is requested (e.g. for US target unreachable from RU) or free nodes available:
    let secondaryExitNode: ProxyConfig | undefined;
    if (options.forceChain) {
      const freeExitNodes = await db.providerProxy.findMany({
        where: {
          isActive: true,
          category: 'FREE_PUBLIC',
          lastTestLatencyMs: { lte: 250 },
        },
        orderBy: {
          lastTestLatencyMs: 'asc',
        },
        take: 5,
      });

      if (freeExitNodes.length > 0) {
        secondaryExitNode = ProxyPoolService.hydrateProxyConfig(freeExitNodes[0]) || undefined;
      }
    }

    const hop1Latency = primaryGateway.lastTestLatencyMs || 50;
    const hop2Latency = secondaryExitNode?.lastTestLatencyMs || 0;
    const totalEstimatedLatency = hop1Latency + hop2Latency;

    // Cache sticky assignment
    if (options.providerId && redis) {
      try {
        await redis.set(
          `${this.STICKY_ROUTE_PREFIX}${options.providerId}`,
          JSON.stringify({ hop1Id: primaryGateway.id, hop2Id: secondaryExitNode?.id }),
          'EX',
          this.STICKY_TTL_SECONDS
        );
      } catch {
        // Ignore cache failure
      }
    }

    return {
      route: {
        hop1: ChainedProxyService.toHop(primaryGateway),
        hop2: secondaryExitNode ? ChainedProxyService.toHop(secondaryExitNode) : undefined,
        targetHost: options.targetHost,
        targetPort,
        useTls: options.useTls ?? true,
      },
      hop1Config: primaryGateway,
      hop2Config: secondaryExitNode,
      estimatedLatencyMs: totalEstimatedLatency,
    };
  }

  /**
   * Helper to retrieve a hydrated ProxyConfig by DB ID.
   */
  private static async getProxyById(id: string): Promise<ProxyConfig | null> {
    const raw = await db.providerProxy.findUnique({ where: { id } });
    if (!raw) return null;
    return ProxyPoolService.hydrateProxyConfig(raw);
  }
}
