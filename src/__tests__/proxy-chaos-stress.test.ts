import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as net from 'node:net';
import { SocksClient } from 'socks';
import { ChainedProxyService } from '@/services/providers/chained-proxy.service';
import { ProxyPingMatrixService } from '@/services/providers/proxy-ping-matrix.service';

// Mock DB
const mockProxies: any[] = [];
vi.mock('@/lib/db', () => ({
  db: {
    providerProxy: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockProxies.find((p) => p.id === where.id) || null;
      }),
      findMany: vi.fn(async ({ where }: { where?: any }) => {
        return mockProxies.filter((p) => {
          if (!where) return true;
          if (where.isActive !== undefined && p.isActive !== where.isActive) return false;
          if (where.category && p.category !== where.category) return false;
          return true;
        });
      }),
    },
  },
}));

// Mock Redis
const redisStore = new Map<string, string>();
vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(async (key: string) => redisStore.get(key) || null),
    set: vi.fn(async (key: string, val: string) => redisStore.set(key, val)),
    del: vi.fn(async (key: string) => redisStore.delete(key)),
  },
}));

// Mock SocksClient createConnection
vi.mock('socks', () => ({
  SocksClient: {
    createConnection: vi.fn(async (options: any) => {
      // Simulate socket
      const fakeSocket = new net.Socket();
      (fakeSocket as any).destroyed = false;
      fakeSocket.destroy = vi.fn(() => {
        (fakeSocket as any).destroyed = true;
        return fakeSocket;
      });

      // Simulate failure mode if destination is "fail-node"
      if (options.destination.host === 'fail-node.invalid' || options.proxy.host === 'broken-hop.invalid') {
        throw new Error('SOCKS5 handshake failed: Connection reset by peer (RST)');
      }

      return { socket: fakeSocket };
    }),
  },
}));

describe('🌪️ Proxy Chaining, Latency Arbiter & Chaos Stress Suite', () => {
  beforeEach(() => {
    mockProxies.length = 0;
    redisStore.clear();
    vi.clearAllMocks();
  });

  describe('Pre-Mortem Vector 1: Chained SOCKS5 Tunneling (Hop 1 -> Hop 2 -> Target)', () => {
    it('successfully constructs a 2-hop chained connection (RU -> Quattro EU -> US Free -> Target)', async () => {
      const route = {
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        hop2: { host: '198.51.100.25', port: 1080, protocol: 'socks5' as const },
        targetHost: 'api.justanotherpanel.com',
        targetPort: 443,
        useTls: false,
      };

      const result = await ChainedProxyService.createChainedConnection(route);

      expect(result.socket).toBeDefined();
      expect(result.chainDescription).toContain('127.0.0.1:7891 -> 198.51.100.25:1080 -> api.justanotherpanel.com:443');
      expect(SocksClient.createConnection).toHaveBeenCalledTimes(2);
    });

    it('falls back seamlessly to 1-hop direct connection if no hop2 is configured', async () => {
      const route = {
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        targetHost: 'api.justanotherpanel.com',
        targetPort: 443,
        useTls: false,
      };

      const result = await ChainedProxyService.createChainedConnection(route);

      expect(result.socket).toBeDefined();
      expect(result.chainDescription).toContain('127.0.0.1:7891 -> api.justanotherpanel.com:443');
      expect(SocksClient.createConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pre-Mortem Vector 2: Chaos Socket Failure & Exception Trapping', () => {
    it('throws catchable error when Hop 2 drops or resets connection mid-handshake', async () => {
      const brokenRoute = {
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        hop2: { host: 'broken-hop.invalid', port: 1080, protocol: 'socks5' as const },
        targetHost: 'api.justanotherpanel.com',
        targetPort: 443,
      };

      await expect(ChainedProxyService.createChainedConnection(brokenRoute)).rejects.toThrow(
        /SOCKS5 handshake failed/
      );
    });
  });

  describe('Pre-Mortem Vector 3: High-Concurrency Burst & Socket Cleanup Stress', () => {
    it('executes 50 parallel proxy chain handshakes without socket leaks or unhandled rejections', async () => {
      const routes = Array.from({ length: 50 }).map((_, i) => ({
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        hop2: { host: `198.51.100.${(i % 10) + 1}`, port: 1080, protocol: 'socks5' as const },
        targetHost: 'api.provider.com',
        targetPort: 443,
        useTls: false,
      }));

      const results = await Promise.allSettled(
        routes.map((r) => ChainedProxyService.createChainedConnection(r))
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBe(50);

      // Cleanup sockets
      for (const res of successful) {
        if (res.status === 'fulfilled') {
          res.value.socket.destroy();
          expect(res.value.socket.destroy).toHaveBeenCalled();
        }
      }
    });
  });

  describe('Pre-Mortem Vector 4: Smart Ping Arbiter & Dynamic Route Optimization', () => {
    it('resolves optimal route prioritizing Quattro VPN with lowest latency', async () => {
      mockProxies.push(
        {
          id: 'quattro_gateway_1',
          label: 'Quattro VPN Europe',
          category: 'PAID_PREMIUM',
          protocol: 'socks5',
          host: '127.0.0.1',
          port: 7891,
          isActive: true,
          lastTestLatencyMs: 42,
        },
        {
          id: 'free_us_proxy_1',
          label: 'US Free SOCKS5',
          category: 'FREE_PUBLIC',
          protocol: 'socks5',
          host: '198.51.100.50',
          port: 1080,
          isActive: true,
          lastTestLatencyMs: 80,
        }
      );

      const resolved = await ProxyPingMatrixService.resolveOptimalRoute({
        providerId: 'prov_test_1',
        targetHost: 'api.us-provider.com',
        forceChain: true,
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.route.hop1.host).toBe('127.0.0.1');
      expect(resolved?.route.hop2?.host).toBe('198.51.100.50');
      expect(resolved?.estimatedLatencyMs).toBe(122); // 42 + 80
    });

    it('rejects degraded sticky route (> 350ms) and dynamically swaps to fresh low-latency route', async () => {
      mockProxies.push({
        id: 'quattro_gateway_1',
        label: 'Quattro VPN Europe',
        category: 'PAID_PREMIUM',
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 7891,
        isActive: true,
        lastTestLatencyMs: 45,
      });

      // Set sticky route in Redis with degraded latency (500ms)
      redisStore.set('proxy:sticky:route:prov_degraded', JSON.stringify({ hop1Id: 'quattro_gateway_1' }));
      redisStore.set('proxy:matrix:latency:quattro_gateway_1', '500'); // Degraded!

      const resolved = await ProxyPingMatrixService.resolveOptimalRoute({
        providerId: 'prov_degraded',
        targetHost: 'api.provider.com',
        forceChain: false,
      });

      expect(resolved).not.toBeNull();
      // Should fall back to candidate resolution with real healthy latency
      expect(resolved?.estimatedLatencyMs).toBe(45);
    });
  });
});
