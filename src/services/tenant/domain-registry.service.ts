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
// In-flight promise coalescing to eliminate thundering herd attacks
const inFlightResolutions = new Map<string, Promise<DomainRegistryEntry | null>>();

export class DomainRegistryService {
  /**
   * Normalizes incoming host strings by stripping port, trailing dot, and IPv6 brackets.
   */
  static cleanHost(rawHost: string | null | undefined): string {
    if (!rawHost || typeof rawHost !== 'string') return '';
    let clean = rawHost.split(',')[0].trim().toLowerCase();
    if (clean.endsWith('.')) clean = clean.slice(0, -1);
    if (clean.startsWith('[') && clean.includes(']')) {
      const closing = clean.indexOf(']');
      clean = clean.slice(1, closing);
    } else {
      const colons = (clean.match(/:/g) || []).length;
      if (colons === 1) {
        clean = clean.split(':')[0];
      }
    }
    return clean.trim();
  }

  /**
   * Identifies built-in core brand domains (smmplan, flux) without network I/O.
   */
  static isCoreDomain(cleanHost: string): { tenantId: 'smmplan' | 'flux'; slug: string; domain: string } | null {
    if (!cleanHost) return null;
    let stripped = cleanHost;
    if (stripped.startsWith('www.')) stripped = stripped.slice(4);

    // 1. Flux Core Domains (checked first to prevent being hijacked by *.smmplan.pro / *.smmplan.ru)
    if (
      stripped === 'smmflux.ru' ||
      stripped === 'test.smmflux.ru' ||
      stripped.endsWith('.smmflux.ru') ||
      stripped === 'flux.smmplan.pro' ||
      stripped === 'test-flux.smmplan.pro' ||
      stripped === 'flux.smmplan.ru' ||
      FLUX_DOMAINS.has(cleanHost) ||
      FLUX_DOMAINS.has(stripped)
    ) {
      return {
        tenantId: 'flux',
        slug: 'flux',
        domain: 'smmflux.ru',
      };
    }

    // 2. SMMplan Core Domains (Explicit platform hostnames — dynamic subdomains fall through to L2/L3)
    const CORE_SMMPLAN_DOMAINS = new Set([
      'smmplan.pro',
      'smmplan.ru',
      'test.smmplan.pro',
      'test.smmplan.ru',
      'api.smmplan.pro',
      'admin.smmplan.pro',
    ]);

    if (CORE_SMMPLAN_DOMAINS.has(stripped)) {
      return {
        tenantId: 'smmplan',
        slug: 'smmplan',
        domain: 'smmplan.pro',
      };
    }

    return null;
  }

  /**
   * Fast synchronous check of L1 in-memory cache and built-in core domains.
   */
  static isKnownInMemory(host: string): boolean {
    if (!host) return false;
    const clean = this.cleanHost(host);
    if (this.isCoreDomain(clean)) return true;

    let stripped = clean;
    if (stripped.startsWith('www.')) stripped = stripped.slice(4);

    const now = Date.now();
    const cached = l1Cache.get(stripped) || l1Cache.get(`www.${stripped}`);
    return Boolean(cached && cached.expiresAt > now && cached.entry && cached.entry.isActive);
  }

  /**
   * Retrieves tenantId from built-in core domains or L1 in-memory cache if host is active.
   */
  static getCachedTenantId(host: string): string | null {
    if (!host) return null;
    const clean = this.cleanHost(host);
    const core = this.isCoreDomain(clean);
    if (core) return core.tenantId;

    let stripped = clean;
    if (stripped.startsWith('www.')) stripped = stripped.slice(4);

    const now = Date.now();
    const cached = l1Cache.get(stripped) || l1Cache.get(`www.${stripped}`);
    if (cached && cached.expiresAt > now && cached.entry && cached.entry.isActive) {
      return cached.entry.tenantId;
    }
    return null;
  }

  /**
   * Resolves a domain via tiered cache:
   * 1. Built-in Core Domains (smmplan, flux)
   * 2. L1 In-memory Cache (60s TTL)
   * 3. In-flight Promise Coalescing (Thundering Herd Protection)
   * 4. L2 Redis Cache (HGET domain:registry <host>)
   * 5. L3 PostgreSQL Fallback (Tenant lookup)
   */
  static async resolveDomain(rawHost: string): Promise<DomainRegistryEntry | null> {
    const cleanHost = this.cleanHost(rawHost);
    if (!cleanHost) return null;

    // 1. Built-in Core Brand Domains
    const core = this.isCoreDomain(cleanHost);
    if (core) {
      return {
        tenantId: core.tenantId,
        slug: core.slug,
        domain: core.domain,
        isActive: true,
        isVerified: true,
      };
    }

    let stripped = cleanHost;
    if (stripped.startsWith('www.')) stripped = stripped.slice(4);
    const altHost = stripped === cleanHost ? `www.${cleanHost}` : stripped;

    const now = Date.now();

    // 2. L1 In-Memory Cache
    const cached = l1Cache.get(cleanHost) || l1Cache.get(altHost);
    if (cached && cached.expiresAt > now) {
      if (cached.entry && cached.entry.isActive) {
        registerValidTenant(cached.entry.tenantId);
      }
      return cached.entry;
    }

    // 3. In-flight coalescing check
    const inFlight = inFlightResolutions.get(stripped);
    if (inFlight) {
      return inFlight;
    }

    const resolutionPromise = (async (): Promise<DomainRegistryEntry | null> => {
      const setL1 = (entry: DomainRegistryEntry | null, ttlMs: number) => {
        const item: CacheItem = { entry, expiresAt: Date.now() + ttlMs };
        l1Cache.set(cleanHost, item);
        l1Cache.set(altHost, item);
      };

      // 4. L2 Redis Cache
      try {
        const { redis } = await import('@/lib/redis');
        let raw = await redis.hget(REDIS_KEY, cleanHost);
        if (!raw && cleanHost !== altHost) {
          raw = await redis.hget(REDIS_KEY, altHost);
        }
        if (raw) {
          const entry = JSON.parse(raw) as DomainRegistryEntry;
          if (entry) {
            if (entry.isActive) {
              registerValidTenant(entry.tenantId);
              setL1(entry, L1_TTL_MS);
              return entry;
            } else {
              setL1(null, L1_NEGATIVE_TTL_MS);
              return null;
            }
          }
        }
      } catch (err) {
        // Graceful fallback to PostgreSQL if Redis is temporarily unreachable
        console.warn('[DomainRegistryService] Redis lookup failed, falling back to PostgreSQL:', err);
      }

      // 5. L3 PostgreSQL Fallback
      try {
        const { db } = await import('@/lib/db');
        const searchDomains = [cleanHost];
        if (!searchDomains.includes(altHost)) {
          searchDomains.push(altHost);
        }

        const tenant = await db.tenant.findFirst({
          where: {
            OR: [
              { domain: { in: searchDomains } },
              { customDomain: { in: searchDomains } },
              { slug: cleanHost },
              { slug: stripped },
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
          setL1(entry, L1_TTL_MS);

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
      setL1(null, L1_NEGATIVE_TTL_MS);
      return null;
    })();

    inFlightResolutions.set(stripped, resolutionPromise);
    try {
      return await resolutionPromise;
    } finally {
      inFlightResolutions.delete(stripped);
    }
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
   * Clears in-memory L1 cache and in-flight resolutions.
   */
  static invalidateCache(host?: string): void {
    if (host) {
      const clean = this.cleanHost(host);
      let stripped = clean;
      if (stripped.startsWith('www.')) stripped = stripped.slice(4);
      l1Cache.delete(stripped);
      l1Cache.delete(`www.${stripped}`);
      inFlightResolutions.delete(stripped);
    } else {
      l1Cache.clear();
      inFlightResolutions.clear();
    }
  }
}

