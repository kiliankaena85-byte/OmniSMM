/**
 * Server & Dynamic Tenant Resolution (with DB fallback).
 */
export * from './tenant-resolver-edge';
import { db } from './db';
import { FLUX_DOMAINS } from './tenant-resolver-edge';

let tenantCache: Map<string, string> | null = null;
let cacheExpiry = 0;
let inflightTenantFetch: Promise<Map<string, string>> | null = null;

async function fetchTenantsFromDb(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const tenants = await db.tenant.findMany({
      where: { isActive: true },
      select: { slug: true, domain: true, customDomain: true },
    });
    for (const t of tenants) {
      map.set(t.domain.toLowerCase(), t.slug);
      if (t.customDomain) {
        map.set(t.customDomain.toLowerCase(), t.slug);
      }
    }
    cacheExpiry = Date.now() + 5 * 60 * 1000;
  } catch (err) {
    console.warn('[TenantResolver] Failed to fetch tenants from DB, applying negative cache (30s):', err);
    cacheExpiry = Date.now() + 30 * 1000; // Negative cache 30 seconds
  }
  return map;
}

/**
 * Resolves tenantId from HTTP Host header using exact domain match.
 */
export async function resolveTenantFromHost(host: string): Promise<string> {
  const now = Date.now();
  if (!tenantCache || now > cacheExpiry) {
    if (!inflightTenantFetch) {
      inflightTenantFetch = fetchTenantsFromDb().finally(() => {
        inflightTenantFetch = null;
      });
    }
    tenantCache = await inflightTenantFetch;
  }

  const cleanHost = host.split(':')[0].toLowerCase();
  
  if (tenantCache.has(cleanHost)) {
    return tenantCache.get(cleanHost)!;
  }

  // Exact fallback matching using canonical FLUX_DOMAINS set
  return FLUX_DOMAINS.has(cleanHost) ? 'flux' : 'smmplan';
}
