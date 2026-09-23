// tenant-isolation-ignore: Unit test for dynamic domain registry and proxy resolution
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DomainRegistryService } from '@/services/tenant/domain-registry.service';
import { proxy, isKnownOrAllowedHost } from '@/proxy';
import { NextRequest } from 'next/server';
import { isValidTenant, VALID_TENANTS } from '@/lib/tenant-resolver-edge';

// Mock dependencies
const mockRedis = {
  hget: vi.fn(),
  hset: vi.fn(),
  hdel: vi.fn(),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  zadd: vi.fn().mockResolvedValue(1),
  zcard: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn(() => ({
    hset: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  })),
};

const mockDb = {
  tenant: {
    findFirst: vi.fn(),
  },
};

vi.mock('@/lib/redis', () => ({
  redis: mockRedis,
}));

vi.mock('@/lib/db', () => ({
  db: mockDb,
}));

describe('Dynamic L1/L2 Domain Resolver & Proxy Integration Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    DomainRegistryService.invalidateCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('1. DomainRegistryService Tiered Resolution', () => {
    it('resolves core brand domains immediately without DB or Redis calls', async () => {
      const smmplan = await DomainRegistryService.resolveDomain('smmplan.pro');
      expect(smmplan?.tenantId).toBe('smmplan');
      expect(mockRedis.hget).not.toHaveBeenCalled();
      expect(mockDb.tenant.findFirst).not.toHaveBeenCalled();

      const flux = await DomainRegistryService.resolveDomain('smmflux.ru');
      expect(flux?.tenantId).toBe('flux');
      expect(mockRedis.hget).not.toHaveBeenCalled();
      expect(mockDb.tenant.findFirst).not.toHaveBeenCalled();
    });

    it('resolves dynamic domain via L2 Redis cache when not in L1', async () => {
      mockRedis.hget.mockResolvedValueOnce(
        JSON.stringify({
          tenantId: 'alpha-smm',
          slug: 'alpha-smm',
          domain: 'alpha-smm.com',
          isActive: true,
          isVerified: true,
        })
      );

      const entry = await DomainRegistryService.resolveDomain('alpha-smm.com');
      expect(entry?.tenantId).toBe('alpha-smm');
      expect(mockRedis.hget).toHaveBeenCalledWith('domain:registry', 'alpha-smm.com');
      expect(mockDb.tenant.findFirst).not.toHaveBeenCalled();
      expect(isValidTenant('alpha-smm')).toBe(true);

      // Subsequent call should hit L1 in-memory cache without hitting Redis again
      mockRedis.hget.mockClear();
      const cached = await DomainRegistryService.resolveDomain('alpha-smm.com');
      expect(cached?.tenantId).toBe('alpha-smm');
      expect(mockRedis.hget).not.toHaveBeenCalled();
    });

    it('resolves dynamic domain via L3 PostgreSQL fallback when Redis misses', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockDb.tenant.findFirst.mockResolvedValueOnce({
        id: 'beta-agency',
        slug: 'beta-agency',
        domain: 'beta-agency.ru',
        customDomain: 'promo.beta-agency.ru',
        isActive: true,
      });

      const entry = await DomainRegistryService.resolveDomain('beta-agency.ru');
      expect(entry?.tenantId).toBe('beta-agency');
      expect(mockDb.tenant.findFirst).toHaveBeenCalled();
      expect(mockRedis.hset).toHaveBeenCalled();
      expect(isValidTenant('beta-agency')).toBe(true);

      // Next call should hit L1 cache
      mockDb.tenant.findFirst.mockClear();
      const l1Hit = await DomainRegistryService.resolveDomain('beta-agency.ru');
      expect(l1Hit?.tenantId).toBe('beta-agency');
      expect(mockDb.tenant.findFirst).not.toHaveBeenCalled();
    });

    it('implements negative caching for non-existent domains to prevent DB hammering', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockDb.tenant.findFirst.mockResolvedValue(null);

      const entry1 = await DomainRegistryService.resolveDomain('not-a-tenant.io');
      expect(entry1).toBeNull();
      expect(mockDb.tenant.findFirst).toHaveBeenCalledTimes(1);

      // Second call immediately hits negative cache
      const entry2 = await DomainRegistryService.resolveDomain('not-a-tenant.io');
      expect(entry2).toBeNull();
      expect(mockDb.tenant.findFirst).toHaveBeenCalledTimes(1);
    });

    it('registers and invalidates domains correctly in L1 and L2', async () => {
      await DomainRegistryService.registerDomain({
        slug: 'gamma-panel',
        domain: 'gamma.pro',
        customDomain: 'smm.gamma.pro',
        isActive: true,
      });

      expect(DomainRegistryService.isKnownInMemory('gamma.pro')).toBe(true);
      expect(DomainRegistryService.getCachedTenantId('gamma.pro')).toBe('gamma-panel');
      expect(DomainRegistryService.getCachedTenantId('smm.gamma.pro')).toBe('gamma-panel');
      expect(isValidTenant('gamma-panel')).toBe(true);

      await DomainRegistryService.removeDomains(['gamma.pro', 'smm.gamma.pro']);
      expect(DomainRegistryService.isKnownInMemory('gamma.pro')).toBe(false);
      expect(mockRedis.hdel).toHaveBeenCalledWith(
        'domain:registry',
        'gamma.pro',
        'www.gamma.pro',
        'smm.gamma.pro',
        'www.smm.gamma.pro'
      );
    });
  });

  describe('2. Proxy Dynamic Host & Contour Validation', () => {
    it('isKnownOrAllowedHost checks dynamic L1 domain registry cache', async () => {
      expect(isKnownOrAllowedHost('instant-brand.com')).toBe(false);

      await DomainRegistryService.registerDomain({
        slug: 'instant-brand',
        domain: 'instant-brand.com',
        isActive: true,
      });

      expect(isKnownOrAllowedHost('instant-brand.com')).toBe(true);
      expect(isKnownOrAllowedHost('www.instant-brand.com')).toBe(true);
    });

    it('rejects completely unknown domain with 403 Forbidden', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockDb.tenant.findFirst.mockResolvedValue(null);

      const req = new NextRequest('http://evil-attacker.org/services', {
        headers: { host: 'evil-attacker.org' }
      });

      const res = await proxy(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden: Invalid Host header');
    });

    it('allows registered dynamic domain and assigns proper x-tenant-id header', async () => {
      await DomainRegistryService.registerDomain({
        slug: 'partner-tenant',
        domain: 'partner-tenant.com',
        isActive: true,
      });

      const req = new NextRequest('http://partner-tenant.com/services', {
        headers: { host: 'partner-tenant.com' }
      });

      const res = await proxy(req);
      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-tenant-id')).toBe('partner-tenant');
    });

    it('removes 403 contour block for verified custom domains in production contour', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.CONTOUR = 'prod';

      await DomainRegistryService.registerDomain({
        slug: 'custom-vip',
        domain: 'custom-vip.agency',
        isActive: true,
      });

      const req = new NextRequest('https://custom-vip.agency/services', {
        headers: {
          host: 'custom-vip.agency',
          'x-forwarded-proto': 'https'
        }
      });

      const res = await proxy(req);
      // In production, an unknown host not in TRUSTED_CONTOUR_MAP would get 403 "Host not permitted for active server contour".
      // But verified custom domain bypasses it and proceeds!
      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-tenant-id')).toBe('custom-vip');
    });
  });
});
