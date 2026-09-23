import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionSyncService } from '@/services/providers/subscription-sync.service';
import { ProxyPoolService } from '@/services/providers/proxy-pool.service';

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

// Mock ssrf-guard
vi.mock('@/lib/security/ssrf-guard', () => ({
  assertSafeOutboundUrl: vi.fn(async (url: string) => {
    if (url.includes('127.0.0.1') || url.includes('localhost') || url.includes('8100')) {
      return { ok: false, reason: 'URL подписки отклонен: запрещен локальный хост' };
    }
    return { ok: true, ip: '198.51.100.1', hostname: 'example.com' };
  }),
}));

describe('🛡️ Proxy Subscription Auto-Sync & Harvester Test Suite', () => {
  beforeEach(() => {
    mockProxies.length = 0;
    redisStore.clear();
    vi.clearAllMocks();
  });

  describe('Vector 1: Subscription-Userinfo Header Parsing', () => {
    it('accurately parses standard Subscription-Userinfo header (Quattro VPN / Marzban / X-UI)', () => {
      const futureExpire = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days in future
      const header = `upload=1073741824; download=53687091200; total=107374182400; expire=${futureExpire}`;
      const parsed = SubscriptionSyncService.parseUserinfo(header);

      expect(parsed.uploadBytes).toBe(BigInt(1073741824));
      expect(parsed.downloadBytes).toBe(BigInt(53687091200));
      expect(parsed.totalBytes).toBe(BigInt(107374182400));
      expect(parsed.expiresAt).toBeInstanceOf(Date);
      expect(parsed.expiresAt?.getTime()).toBe(futureExpire * 1000);
      expect(parsed.daysLeft).toBeGreaterThan(0);
    });

    it('handles quoted and variant expires format', () => {
      const header = 'upload="5000"; download="15000"; total="2000000000"; expires="1800000000"';
      const parsed = SubscriptionSyncService.parseUserinfo(header);

      expect(parsed.uploadBytes).toBe(BigInt(5000));
      expect(parsed.downloadBytes).toBe(BigInt(15000));
      expect(parsed.totalBytes).toBe(BigInt(2000000000));
      expect(parsed.expiresAt?.getTime()).toBe(1800000000 * 1000);
    });

    it('gracefully handles missing or malformed header values without throwing', () => {
      const parsedEmpty = SubscriptionSyncService.parseUserinfo('');
      expect(parsedEmpty.uploadBytes).toBe(BigInt(0));
      expect(parsedEmpty.expiresAt).toBeNull();
      expect(parsedEmpty.daysLeft).toBeNull();

      const parsedCorrupted = SubscriptionSyncService.parseUserinfo('foo=bar; expire=invalid_timestamp');
      expect(parsedCorrupted.expiresAt).toBeNull();
    });
  });

  describe('Vector 2: SubscriptionSyncService DB Integration & SSRF Protection', () => {
    it('blocks dangerous internal subscription URLs via SSRF guard', async () => {
      mockProxies.push({
        id: 'proxy_malicious',
        label: 'Internal Attacker',
        subscriptionUrl: 'http://127.0.0.1:8100/api/secret',
        category: 'PAID_PREMIUM',
        isActive: true,
      });

      const res = await SubscriptionSyncService.syncSubscription('proxy_malicious');
      expect(res.success).toBe(false);
      expect(res.error).toContain('URL подписки отклонен');
    });

    it('successfully syncs and updates database record when valid Subscription-Userinfo is returned', async () => {
      mockProxies.push({
        id: 'proxy_quattro_1',
        label: 'Quattro VPN Dedicated',
        subscriptionUrl: 'https://quattro-tech.ru/sub/test-token-123',
        category: 'PAID_PREMIUM',
        isActive: true,
        host: '127.0.0.1',
        port: 7891,
      });

      // Mock fetch
      const originalFetch = global.fetch;
      global.fetch = vi.fn(async () => {
        return new Response('proxies: []', {
          status: 200,
          headers: {
            'Subscription-Userinfo': 'upload=1000; download=2000; total=50000000; expire=1787836800',
          },
        });
      }) as any;

      try {
        const res = await SubscriptionSyncService.syncSubscription('proxy_quattro_1');
        expect(res.success).toBe(true);
        expect(res.info?.expiresAt?.getTime()).toBe(1787836800 * 1000);

        const updated = mockProxies.find((p) => p.id === 'proxy_quattro_1');
        expect(updated.trafficUsedBytes).toBe(BigInt(3000));
        expect(updated.trafficTotalBytes).toBe(BigInt(50000000));
        expect(updated.lastSyncAt).toBeInstanceOf(Date);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('Vector 3: Multi-Tier ProxyPoolService Routing Isolation', () => {
    it('prioritizes PAID_PREMIUM proxies for critical provider orders', async () => {
      mockProxies.push(
        {
          id: 'free_proxy_1',
          label: 'Free SOCKS5 Public',
          category: 'FREE_PUBLIC',
          protocol: 'socks5',
          host: '198.51.100.10',
          port: 1080,
          isActive: true,
          lastTestLatencyMs: 40,
        },
        {
          id: 'quattro_premium_1',
          label: 'Quattro VPN Premium',
          category: 'PAID_PREMIUM',
          protocol: 'socks5',
          host: '127.0.0.1',
          port: 7891,
          isActive: true,
          lastTestLatencyMs: 60,
        }
      );

      // Requesting PAID_PREMIUM should pick Quattro VPN even if free proxy exists
      const selected = await ProxyPoolService.getHealthyProxy(undefined, 'PAID_PREMIUM');
      expect(selected).not.toBeNull();
      expect(selected?.host).toBe('127.0.0.1');
      expect(selected?.port).toBe(7891);
    });

    it('routes telemetry scraping requests to FREE_PUBLIC pool when available', async () => {
      mockProxies.push(
        {
          id: 'free_proxy_1',
          label: 'Free SOCKS5 Public',
          category: 'FREE_PUBLIC',
          protocol: 'socks5',
          host: '198.51.100.10',
          port: 1080,
          isActive: true,
          lastTestLatencyMs: 45,
        },
        {
          id: 'quattro_premium_1',
          label: 'Quattro VPN Premium',
          category: 'PAID_PREMIUM',
          protocol: 'socks5',
          host: '127.0.0.1',
          port: 7891,
          isActive: true,
          lastTestLatencyMs: 60,
        }
      );

      const selected = await ProxyPoolService.getHealthyProxy(undefined, 'FREE_PUBLIC');
      expect(selected).not.toBeNull();
      expect(selected?.host).toBe('198.51.100.10');
      expect(selected?.port).toBe(1080);
    });
  });
});
