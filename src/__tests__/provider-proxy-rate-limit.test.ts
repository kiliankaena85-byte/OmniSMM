import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveRateLimiterService } from '@/services/providers/adaptive-rate-limiter.service';
import { ProxyPoolService } from '@/services/providers/proxy-pool.service';
import { LiveOrderVerifierService } from '@/services/telemetry/live-order-verifier.service';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

const mockRedisStore = new Map<string, any>();
const mockDbStore = {
  providerProxies: new Map<string, any>(),
};

vi.mock('@/lib/db', () => ({
  db: {
    providerProxy: {
      findFirst: vi.fn(async ({ where }: { where: { providerId?: string; isActive?: boolean } }) => {
        for (const proxy of mockDbStore.providerProxies.values()) {
          if (where.providerId && proxy.providerId === where.providerId && proxy.isActive) {
            return proxy;
          }
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }: { where: { isActive?: boolean } }) => {
        const list: any[] = [];
        for (const proxy of mockDbStore.providerProxies.values()) {
          if (where.isActive === undefined || proxy.isActive === where.isActive) {
            list.push(proxy);
          }
        }
        return list;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockDbStore.providerProxies.get(where.id) || null;
      }),
    },
  }
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn(async (key: string) => {
      const val = (mockRedisStore.get(key) || 0) + 1;
      mockRedisStore.set(key, val);
      return val;
    }),
    expire: vi.fn(async () => 1),
    get: vi.fn(async (key: string) => mockRedisStore.get(key) || null),
    set: vi.fn(async (key: string, val: any) => {
      mockRedisStore.set(key, val);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      mockRedisStore.delete(key);
      return 1;
    }),
  }
}));

describe('🛡️ Provider Proxy Pool, Rate Limiter & Anti-Ban Telemetry Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AdaptiveRateLimiterService.resetLocalState();
    mockDbStore.providerProxies.clear();
    mockRedisStore.clear();
  });

  // =========================================================================
  // VECTOR 1: Adaptive Rate Limiter (Token Bucket & Concurrency Control)
  // =========================================================================
  describe('Vector 1: Adaptive Rate Limiter Token Bucket', () => {
    it('allows burst up to RPS limit immediately', async () => {
      const providerId = 'prov_vexboost_1';
      const rps = 3;

      const t1 = await AdaptiveRateLimiterService.acquireToken(providerId, rps);
      const t2 = await AdaptiveRateLimiterService.acquireToken(providerId, rps);
      const t3 = await AdaptiveRateLimiterService.acquireToken(providerId, rps);

      expect(t1).toBe(true);
      expect(t2).toBe(true);
      expect(t3).toBe(true);
    });

    it('throttles when burst capacity is exceeded within window', async () => {
      const providerId = 'prov_vexboost_2';
      const rps = 2;

      // Consume 2 allowed tokens
      await AdaptiveRateLimiterService.acquireToken(providerId, rps);
      await AdaptiveRateLimiterService.acquireToken(providerId, rps);

      // 3rd attempt with short maxWaitMs (50ms) should return false (throttled)
      const throttled = await AdaptiveRateLimiterService.acquireToken(providerId, rps, 50);
      expect(throttled).toBe(false);
    });
  });

  // =========================================================================
  // VECTOR 2: ProxyPoolService & Automatic Quarantine
  // =========================================================================
  describe('Vector 2: ProxyPoolService Health & Quarantine', () => {
    it('quarantines proxy when HTTP 429 Too Many Requests is reported', async () => {
      const proxyId = 'proxy_eu_101';

      await ProxyPoolService.reportFailure(proxyId, 'Rate limited by provider', 429);

      const isQuarantined = await ProxyPoolService.isProxyQuarantined(proxyId);
      expect(isQuarantined).toBe(true);
    });

    it('quarantines proxy when HTTP 403 Cloudflare Block is reported', async () => {
      const proxyId = 'proxy_us_202';

      await ProxyPoolService.reportFailure(proxyId, 'Cloudflare Challenge / 403', 403);

      const isQuarantined = await ProxyPoolService.isProxyQuarantined(proxyId);
      expect(isQuarantined).toBe(true);
    });

    it('resets failure count on reportSuccess', async () => {
      const proxyId = 'proxy_ru_303';

      await ProxyPoolService.reportSuccess(proxyId, 120);

      const isQuarantined = await ProxyPoolService.isProxyQuarantined(proxyId);
      expect(isQuarantined).toBe(false);
    });
  });

  // =========================================================================
  // VECTOR 3: SSRF Safety Verification
  // =========================================================================
  describe('Vector 3: SSRF Outbound Guard', () => {
    it('blocks dangerous internal metadata endpoints', async () => {
      const res1 = await assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/');
      expect(res1.ok).toBe(false);

      const res2 = await assertSafeOutboundUrl('http://127.0.0.1:8100/admin');
      expect(res2.ok).toBe(false);

      const res3 = await assertSafeOutboundUrl('http://localhost:3000/api');
      expect(res3.ok).toBe(false);
    });

    it('allows valid public Telegram targets', async () => {
      const res = await assertSafeOutboundUrl('https://t.me/smmMarket69/29');
      expect(res.ok).toBe(true);
    });
  });

  // =========================================================================
  // VECTOR 4: LiveOrderVerifier & Fake Completion Detection
  // =========================================================================
  describe('Vector 4: LiveOrderVerifier & Fake Completion Detection', () => {
    it('verifies genuine delivery when delta >= 70% of ordered quantity', () => {
      const startCount = 137;
      const currentCount = 237; // +100 delivered
      const ordered = 100;

      const result = LiveOrderVerifierService.verifyDelivery(startCount, currentCount, ordered);
      expect(result.isVerified).toBe(true);
      expect(result.isSuspicious).toBe(false);
      expect(result.delta).toBe(100);
    });

    it('detects fake completion when delta < 30% of ordered quantity', () => {
      const startCount = 137;
      const currentCount = 145; // only +8 delivered, but provider marked COMPLETED
      const ordered = 100;

      const result = LiveOrderVerifierService.verifyDelivery(startCount, currentCount, ordered);
      expect(result.isVerified).toBe(false);
      expect(result.isSuspicious).toBe(true);
      expect(result.reason).toContain('Discrepancy detected');
    });

    it('identifies partial delivery when delta is between 30% and 70%', () => {
      const startCount = 137;
      const currentCount = 187; // +50 delivered out of 100
      const ordered = 100;

      const result = LiveOrderVerifierService.verifyDelivery(startCount, currentCount, ordered);
      expect(result.isVerified).toBe(false);
      expect(result.isSuspicious).toBe(false);
      expect(result.reason).toContain('Partial delivery');
    });
  });
});
