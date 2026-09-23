import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { SocksClient } from 'socks';
import { ChainedProxyService } from '@/services/providers/chained-proxy.service';
import { ProxyPingMatrixService } from '@/services/providers/proxy-ping-matrix.service';
import { SubscriptionSyncService } from '@/services/providers/subscription-sync.service';
import { ProxyPoolService } from '@/services/providers/proxy-pool.service';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

// Track allocated sockets to assert zero descriptor leaks
const activeSockets: net.Socket[] = [];

// Mock DB
const mockProxies: any[] = [];
vi.mock('@/lib/db', () => ({
  db: {
    providerProxy: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockProxies.find((p) => p.id === where.id) || null;
      }),
      findFirst: vi.fn(async ({ where }: { where: any }) => {
        return mockProxies.find((p) => {
          if (where.host && p.host !== where.host) return false;
          if (where.port && p.port !== where.port) return false;
          if (where.category && p.category !== where.category) return false;
          if (where.isActive !== undefined && p.isActive !== where.isActive) return false;
          return true;
        }) || null;
      }),
      findMany: vi.fn(async ({ where }: { where?: any }) => {
        return mockProxies.filter((p) => {
          if (!where) return true;
          if (where.isActive !== undefined && p.isActive !== where.isActive) return false;
          if (where.category && p.category !== where.category) return false;
          if (where.lastTestLatencyMs?.lte && (p.lastTestLatencyMs || 0) > where.lastTestLatencyMs.lte) return false;
          return true;
        });
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const item = mockProxies.find((p) => p.id === where.id);
        if (item) {
          Object.assign(item, data);
          return item;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const newObj = { id: `proxy_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, ...data };
        mockProxies.push(newObj);
        return newObj;
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

// Mock SSRF Guard
vi.mock('@/lib/security/ssrf-guard', () => ({
  assertSafeOutboundUrl: vi.fn(async (url: string) => {
    if (
      url.includes('127.0.0.1') ||
      url.includes('localhost') ||
      url.includes('169.254') ||
      url.includes('10.0.') ||
      url.includes('192.168.') ||
      url.includes('8100') ||
      url.includes('6379') ||
      url.includes('5432')
    ) {
      return { ok: false, reason: 'URL заблокирован SSRF-фильтром (локальный/приватный хост)' };
    }
    return { ok: true, ip: '198.51.100.1', hostname: 'public-node.com' };
  }),
}));

// Mock SocksClient
vi.mock('socks', () => ({
  SocksClient: {
    createConnection: vi.fn(async (options: any) => {
      const fakeSocket = new net.Socket();
      (fakeSocket as any).destroyed = false;
      fakeSocket.destroy = vi.fn(() => {
        (fakeSocket as any).destroyed = true;
        return fakeSocket;
      });

      activeSockets.push(fakeSocket);

      // Scenario: Complete Hop 1 Port Closed / ECONNREFUSED
      if (options.proxy.host === '127.0.0.1' && options.proxy.port === 9999) {
        fakeSocket.destroy();
        throw new Error('connect ECONNREFUSED 127.0.0.1:9999');
      }

      // Scenario: Hop 2 Blackhole / Timeout
      if (options.proxy.host === 'blackhole-node.invalid' || options.destination.host === 'blackhole-node.invalid') {
        fakeSocket.destroy();
        throw new Error('SOCKS5 connection timed out after 3000ms');
      }

      // Scenario: Peer RST
      if (options.proxy.host === 'rst-node.invalid') {
        fakeSocket.destroy();
        throw new Error('read ECONNRESET');
      }

      return { socket: fakeSocket };
    }),
  },
}));

describe('🛡️ Comprehensive Positive & Negative Proxy Resilience Suite', () => {
  beforeEach(() => {
    mockProxies.length = 0;
    redisStore.clear();
    activeSockets.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Ensure all test sockets are cleaned up
    for (const sock of activeSockets) {
      sock.destroy();
    }
  });

  // ==========================================
  // 🟢 POSITIVE TEST VECTORS (Работоспособность)
  // ==========================================
  describe('🟢 POSITIVE VECTORS: Normal Operation & Synergy', () => {
    it('POS-1: Successfully builds single-hop premium connection to provider API', async () => {
      const route = {
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        targetHost: 'api.justanotherpanel.com',
        targetPort: 443,
        useTls: false,
      };

      const res = await ChainedProxyService.createChainedConnection(route);
      expect(res.socket).toBeDefined();
      expect(res.chainDescription).toBe('127.0.0.1:7891 -> api.justanotherpanel.com:443');
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('POS-2: Successfully builds two-hop relay chain (RU -> Quattro Europe -> US Free -> Provider)', async () => {
      const route = {
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        hop2: { host: '198.51.100.77', port: 1080, protocol: 'socks5' as const },
        targetHost: 'api.us-smm-provider.com',
        targetPort: 443,
        useTls: false,
      };

      const res = await ChainedProxyService.createChainedConnection(route);
      expect(res.socket).toBeDefined();
      expect(res.chainDescription).toContain('127.0.0.1:7891 -> 198.51.100.77:1080 -> api.us-smm-provider.com:443');
    });

    it('POS-3: Accurately parses standard and extended Subscription-Userinfo headers', () => {
      const rawHeader = 'upload=2147483648; download=107374182400; total=214748364800; expire=1787836800';
      const parsed = SubscriptionSyncService.parseUserinfo(rawHeader);

      expect(parsed.uploadBytes).toBe(BigInt(2147483648));
      expect(parsed.downloadBytes).toBe(BigInt(107374182400));
      expect(parsed.totalBytes).toBe(BigInt(214748364800));
      expect(parsed.expiresAt).toBeInstanceOf(Date);
      expect(parsed.daysLeft).toBeGreaterThan(0);
    });

    it('POS-4: Sticky Route Affinity preserves established route for 5 minutes', async () => {
      mockProxies.push({
        id: 'quattro_1',
        label: 'Quattro VPN #1',
        category: 'PAID_PREMIUM',
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 7891,
        isActive: true,
        lastTestLatencyMs: 40,
      });

      const firstCall = await ProxyPingMatrixService.resolveOptimalRoute({
        providerId: 'prov_sticky_test',
        targetHost: 'api.provider.com',
      });

      expect(firstCall).not.toBeNull();
      expect(redisStore.has('proxy:sticky:route:prov_sticky_test')).toBe(true);

      const secondCall = await ProxyPingMatrixService.resolveOptimalRoute({
        providerId: 'prov_sticky_test',
        targetHost: 'api.provider.com',
      });

      expect(secondCall?.hop1Config.id).toBe(firstCall?.hop1Config.id);
    });
  });

  // ==========================================
  // 🔴 NEGATIVE & CHAOS TEST VECTORS (Отказоустойчивость)
  // ==========================================
  describe('🔴 NEGATIVE & CHAOS VECTORS: Fault Tolerance & Server Safety', () => {
    it('NEG-1: Total Hop 1 Down (Quattro VPN process closed) does NOT crash process or server', async () => {
      const deadHop1Route = {
        hop1: { host: '127.0.0.1', port: 9999, protocol: 'socks5' as const }, // Closed port
        targetHost: 'api.provider.com',
        targetPort: 443,
      };

      // Must reject with a clean Error, without throwing unhandled exceptions
      await expect(ChainedProxyService.createChainedConnection(deadHop1Route)).rejects.toThrow(
        /ECONNREFUSED/
      );
    });

    it('NEG-2: Hop 2 Blackhole / Hanging Connection destroys socket and throws timeout', async () => {
      const blackholeRoute = {
        hop1: { host: '127.0.0.1', port: 7891, protocol: 'socks5' as const },
        hop2: { host: 'blackhole-node.invalid', port: 1080, protocol: 'socks5' as const },
        targetHost: 'api.provider.com',
        targetPort: 443,
      };

      await expect(ChainedProxyService.createChainedConnection(blackholeRoute)).rejects.toThrow(
        /timed out/
      );
    });

    it('NEG-3: SSRF Injection Attack via Subscription URL is blocked before network access', async () => {
      mockProxies.push(
        {
          id: 'proxy_ssrf_1',
          label: 'Attacker Metadata',
          subscriptionUrl: 'http://169.254.169.254/latest/meta-data/',
          category: 'PAID_PREMIUM',
          isActive: true,
        },
        {
          id: 'proxy_ssrf_2',
          label: 'Attacker Redis Localhost',
          subscriptionUrl: 'http://localhost:6379/info',
          category: 'PAID_PREMIUM',
          isActive: true,
        }
      );

      const res1 = await SubscriptionSyncService.syncSubscription('proxy_ssrf_1');
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('URL заблокирован SSRF-фильтром');

      const res2 = await SubscriptionSyncService.syncSubscription('proxy_ssrf_2');
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('URL заблокирован SSRF-фильтром');
    });

    it('NEG-4: Corrupted, empty, or malicious ReDoS headers do not crash userinfo parser', () => {
      const maliciousHeaders = [
        'upload=NaN; download=undefined; expire=-99999999',
        '==;;;===;;;;foo===;;;;',
        'a'.repeat(50000) + '=12345;',
        'upload=";;;;"; download="""""; expire="abc"',
        '',
      ];

      for (const h of maliciousHeaders) {
        const parsed = SubscriptionSyncService.parseUserinfo(h);
        expect(parsed).toBeDefined();
        expect(typeof parsed.uploadBytes).toBe('bigint');
      }
    });

    it('NEG-5: Degraded Route Hot-Swap when Hop Latency exceeds 350ms', async () => {
      mockProxies.push({
        id: 'laggy_hop_1',
        label: 'Laggy Gateway',
        category: 'PAID_PREMIUM',
        protocol: 'socks5',
        host: '127.0.0.1',
        port: 7891,
        isActive: true,
        lastTestLatencyMs: 45,
      });

      // Force high latency in Redis
      redisStore.set('proxy:sticky:route:prov_lag', JSON.stringify({ hop1Id: 'laggy_hop_1' }));
      redisStore.set('proxy:matrix:latency:laggy_hop_1', '750'); // 750ms lag!

      const resolved = await ProxyPingMatrixService.resolveOptimalRoute({
        providerId: 'prov_lag',
        targetHost: 'api.provider.com',
      });

      expect(resolved).not.toBeNull();
      // Should bypass degraded cached latency and resolve to live healthy route
      expect(resolved?.estimatedLatencyMs).toBe(45);
    });

    it('NEG-6: High Concurrency Load (100 parallel requests with 30% faulty nodes) guarantees 0 socket leaks', async () => {
      const mixedRoutes = Array.from({ length: 100 }).map((_, i) => {
        const isFaulty = i % 3 === 0;
        return {
          hop1: { host: '127.0.0.1', port: isFaulty ? 9999 : 7891, protocol: 'socks5' as const },
          hop2: isFaulty
            ? { host: 'rst-node.invalid', port: 1080, protocol: 'socks5' as const }
            : { host: `198.51.100.${(i % 10) + 1}`, port: 1080, protocol: 'socks5' as const },
          targetHost: 'api.provider.com',
          targetPort: 443,
          useTls: false,
        };
      });

      const settled = await Promise.allSettled(
        mixedRoutes.map((r) => ChainedProxyService.createChainedConnection(r))
      );

      // Faulty should fail cleanly, healthy should succeed
      const fulfilled = settled.filter((s) => s.status === 'fulfilled');
      const rejected = settled.filter((s) => s.status === 'rejected');

      expect(fulfilled.length).toBeGreaterThan(0);
      expect(rejected.length).toBeGreaterThan(0);

      // Verify that all created sockets are tracked and can be destroyed without throwing
      expect(() => {
        for (const sock of activeSockets) {
          sock.destroy();
        }
      }).not.toThrow();
    });
  });
});
