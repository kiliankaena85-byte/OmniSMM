/**
 * @file domain-registry.service.ts
 * Tiered Dynamic Domain Resolution Helper (L1 Memory -> L2 Redis -> L3 PostgreSQL)
 * Provides zero-downtime custom domain routing for OmniSMM Multi-Tenant architecture.
 */

import { registerValidTenant, FLUX_DOMAINS } from '@/lib/tenant-resolver-edge';

export interface DomainRegistryEntry {
  tenantId: string;
  slug: string;
  domain: string;
  customDomain?: string | null;
  isActive: boolean;
  isVerified?: boolean;
}

interface CacheItem {
  entry: DomainRegistryEntry | null;
  expiresAt: number;
}

const L1_TTL_MS = 60 * 1000; // 60 seconds TTL for valid entries
const L1_NEGATIVE_TTL_MS = 10 * 1000; // 10 seconds TTL for negative cache (mitigate DB hammering)
const REDIS_KEY = 'domain:registry';

// L1 In-Memory Cache
const l1Cache = new Map<string, CacheItem>();

export class DomainRegistryService {
  /**
   * Fast synchronous check of L1 in-memory cache.
   */
  static isKnownInMemory(host: string): boolean {
    if (!host) return false;
    let clean = host.split(':')[0].toLowerCase().trim();
    if (clean.startsWith('www.')) clean = clean.slice(4);
    const now = Date.now();
    const cached = l1Cache.get(clean) || l1Cache.get(`www.${clean}`);
    return Boolean(cached && cached.expiresAt > now && cached.entry && cached.entry.isActive);
  }

  /**
   * Retrieves tenantId from L1 in-memory cache if host is active.
   */
  static getCachedTenantId(host: string): string | null {
    if (!host) return null;
    let clean = host.split(':')[0].toLowerCase().trim();
    if (clean.startsWith('www.')) clean = clean.slice(4);
    const now = Date.now();
    const cached = l1Cache.get(clean) || l1Cache.get(`www.${clean}`);
    if (cached && cached.expiresAt > now && cached.entry && cached.entry.isActive) {
      return cached.entry.tenantId;
    }
    return null;
  }

  /**
   * Resolves a domain via tiered cache:
   * 1. Built-in Core Domains (smmplan, flux)
   * 2. L1 In-memory Cache (60s TTL)
   * 3. L2 Redis Cache (HGET domain:registry <host>)
   * 4. L3 PostgreSQL Fallback (Tenant lookup)
   */
  static async resolveDomain(rawHost: string): Promise<DomainRegistryEntry | null> {
    if (!rawHost || typeof rawHost !== 'string') return null;
    let cleanHost = rawHost.split(':')[0].toLowerCase().trim();
    if (cleanHost.startsWith('[') && cleanHost.includes(']')) {
      cleanHost = cleanHost.slice(1, cleanHost.indexOf(']'));
    }

    // 1. Built-in Core Brand Domains
    if (cleanHost === 'smmplan.pro' || cleanHost.endsWith('.smmplan.pro') || cleanHost === 'smmplan.ru' || cleanHost.endsWith('.smmplan.ru')) {
      return {
        tenantId: 'smmplan',
        slug: 'smmplan',
        domain: 'smmplan.pro',
        isActive: true,
        isVerified: true,
      };
    }

    if (cleanHost === 'smmflux.ru' || cleanHost.endsWith('.smmflux.ru') || FLUX_DOMAINS.has(cleanHost)) {
      return {
        tenantId: 'flux',
        slug: 'flux',
        domain: 'smmflux.ru',
        isActive: true,
        isVerified: true,
      };
    }

    const now = Date.now();

    // 2. L1 In-Memory Cache
    const cached = l1Cache.get(cleanHost) || (cleanHost.startsWith('www.') ? l1Cache.get(cleanHost.slice(4)) : null);
    if (cached && cached.expiresAt > now) {
      if (cached.entry && cached.entry.isActive) {
        registerValidTenant(cached.entry.tenantId);
      }
      return cached.entry;
    }

    // 3. L2 Redis Cache
    try {
      const { redis } = await import('@/lib/redis');
      let raw = await redis.hget(REDIS_KEY, cleanHost);
      if (!raw && cleanHost.startsWith('www.')) {
        raw = await redis.hget(REDIS_KEY, cleanHost.slice(4));
      }
      if (raw) {
        const entry = JSON.parse(raw) as DomainRegistryEntry;
        if (entry && entry.isActive) {
          registerValidTenant(entry.tenantId);
          l1Cache.set(cleanHost, { entry, expiresAt: now + L1_TTL_MS });
          return entry;
        }
      }
    } catch (err) {
      // Graceful fallback to PostgreSQL if Redis is temporarily unreachable
      console.warn('[DomainRegistryService] Redis lookup failed, falling back to PostgreSQL:', err);
    }

    // 4. L3 PostgreSQL Fallback
    try {
      const { db } = await import('@/lib/db');
      const searchDomains = [cleanHost];
      if (cleanHost.startsWith('www.')) {
        searchDomains.push(cleanHost.slice(4));
      } else {
        searchDomains.push(`www.${cleanHost}`);
      }

      const tenant = await db.tenant.findFirst({
        where: {
          OR: [
            { domain: { in: searchDomains } },
            { customDomain: { in: searchDomains } },
            { slug: cleanHost },
          ],
          isActive: true,
        },
        select: {
          id: true,
          slug: true,
          domain: true,
          customDomain: true,
          isActive: true,
        },
      });

      if (tenant) {
        const entry: DomainRegistryEntry = {
          tenantId: tenant.slug,
          slug: tenant.slug,
          domain: tenant.domain,
          customDomain: tenant.customDomain,
          isActive: tenant.isActive,
          isVerified: true,
        };

        registerValidTenant(entry.tenantId);
        l1Cache.set(cleanHost, { entry, expiresAt: now + L1_TTL_MS });

        // Hydrate L2 Redis asynchronously
        try {
          const { redis } = await import('@/lib/redis');
          const json = JSON.stringify(entry);
          await redis.hset(REDIS_KEY, cleanHost, json);
          if (entry.domain) await redis.hset(REDIS_KEY, entry.domain, json);
          if (entry.customDomain) await redis.hset(REDIS_KEY, entry.customDomain, json);
        } catch {
          // Non-fatal
        }

        return entry;
      }
    } catch (err) {
      console.error('[DomainRegistryService] PostgreSQL fallback failed:', err);
    }

    // Negative cache to mitigate DDoS / database hammering on invalid hosts
    l1Cache.set(cleanHost, { entry: null, expiresAt: now + L1_NEGATIVE_TTL_MS });
    return null;
  }

  /**
   * Validates whether a domain is authorized and active in the system.
   */
  static async isDynamicDomainAllowed(host: string): Promise<boolean> {
    const entry = await this.resolveDomain(host);
    return Boolean(entry && entry.isActive);
  }

  /**
   * Registers a domain into Redis and hydrates L1 cache.
   */
  static async registerDomain(tenant: {
    id?: string;
    slug: string;
    domain: string;
    customDomain?: string | null;
    isActive?: boolean;
  }): Promise<void> {
    const cleanDomain = tenant.domain.toLowerCase().trim();
    const cleanSlug = tenant.slug.toLowerCase().trim();
    const cleanCustomDomain = tenant.customDomain?.toLowerCase().trim() || null;
    const isActive = tenant.isActive ?? true;

    const entry: DomainRegistryEntry = {
      tenantId: cleanSlug,
      slug: cleanSlug,
      domain: cleanDomain,
      customDomain: cleanCustomDomain,
      isActive,
      isVerified: true,
    };

    registerValidTenant(cleanSlug);

    // Invalidate and pre-fill L1 cache
    const expiresAt = Date.now() + L1_TTL_MS;
    l1Cache.set(cleanDomain, { entry, expiresAt });
    if (cleanDomain.startsWith('www.')) {
      l1Cache.set(cleanDomain.slice(4), { entry, expiresAt });
    } else {
      l1Cache.set(`www.${cleanDomain}`, { entry, expiresAt });
    }
    if (cleanCustomDomain) {
      l1Cache.set(cleanCustomDomain, { entry, expiresAt });
      if (cleanCustomDomain.startsWith('www.')) {
        l1Cache.set(cleanCustomDomain.slice(4), { entry, expiresAt });
      } else {
        l1Cache.set(`www.${cleanCustomDomain}`, { entry, expiresAt });
      }
    }
    l1Cache.set(cleanSlug, { entry, expiresAt });

    // Sync to L2 Redis
    try {
      const { redis } = await import('@/lib/redis');
      const json = JSON.stringify(entry);
      const pipeline = redis.pipeline();
      pipeline.hset(REDIS_KEY, cleanDomain, json);
      if (cleanDomain.startsWith('www.')) {
        pipeline.hset(REDIS_KEY, cleanDomain.slice(4), json);
      } else {
        pipeline.hset(REDIS_KEY, `www.${cleanDomain}`, json);
      }
      if (cleanCustomDomain) {
        pipeline.hset(REDIS_KEY, cleanCustomDomain, json);
        if (cleanCustomDomain.startsWith('www.')) {
          pipeline.hset(REDIS_KEY, cleanCustomDomain.slice(4), json);
        } else {
          pipeline.hset(REDIS_KEY, `www.${cleanCustomDomain}`, json);
        }
      }
      pipeline.hset(REDIS_KEY, cleanSlug, json);
      await pipeline.exec();
    } catch (err) {
      console.error('[DomainRegistryService] Failed to sync domain to Redis:', err);
    }
  }

  /**
   * Removes domains from L1 cache and L2 Redis.
   */
  static async removeDomains(domains: string[]): Promise<void> {
    const redisFields: string[] = [];
    for (const d of domains) {
      if (!d) continue;
      const clean = d.toLowerCase().trim();
      l1Cache.delete(clean);
      redisFields.push(clean);
      if (clean.startsWith('www.')) {
        const stripped = clean.slice(4);
        l1Cache.delete(stripped);
        redisFields.push(stripped);
      } else {
        const withWww = `www.${clean}`;
        l1Cache.delete(withWww);
        redisFields.push(withWww);
      }
    }

    try {
      const { redis } = await import('@/lib/redis');
      if (redisFields.length > 0) {
        await redis.hdel(REDIS_KEY, ...redisFields);
      }
    } catch (err) {
      console.error('[DomainRegistryService] Failed to remove domain from Redis:', err);
    }
  }

  /**
   * Clears in-memory L1 cache.
   */
  static invalidateCache(host?: string): void {
    if (host) {
      const clean = host.split(':')[0].toLowerCase().trim();
      l1Cache.delete(clean);
      if (clean.startsWith('www.')) {
        l1Cache.delete(clean.slice(4));
      } else {
        l1Cache.delete(`www.${clean}`);
      }
    } else {
      l1Cache.clear();
    }
  }
}
