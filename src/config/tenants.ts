import { VALID_TENANTS, registerValidTenant, registerValidTenants, unregisterValidTenant } from '@/lib/tenant-resolver-edge';

export { registerValidTenant, registerValidTenants, unregisterValidTenant, VALID_TENANTS };

export const CORE_TENANTS = ['smmplan', 'flux'] as const;
export type CoreTenantId = (typeof CORE_TENANTS)[number];
export type TenantId = string;

export interface TenantConfig {
  id: string;
  name: string;
  domain: string;
  testDomain: string;
  allowedHosts: readonly string[];
}

export const TENANTS: readonly TenantConfig[] = [
  {
    id: 'smmplan',
    name: 'SMMplan',
    domain: 'smmplan.pro',
    testDomain: 'test.smmplan.pro',
    allowedHosts: ['smmplan.pro', 'www.smmplan.pro', 'test.smmplan.pro', 'smmplan.ru', 'www.smmplan.ru'],
  },
  {
    id: 'flux',
    name: 'SMMflux',
    domain: 'smmflux.ru',
    testDomain: 'flux.smmplan.pro',
    allowedHosts: ['smmflux.ru', 'www.smmflux.ru', 'flux.smmplan.pro', 'test-flux.smmplan.pro', 'test.smmflux.ru'],
  },
] as const;

/**
 * Single source of truth for historical and dynamic tenant aliases.
 * Adding or renaming a brand requires editing ONLY this dictionary.
 */
export const TENANT_ALIASES: Record<string, string> = {
  lovable: 'flux',
  smmflux: 'flux',
  fluxsmm: 'flux',
};

export function isValidTenant(tenant: string | null | undefined): boolean {
  if (!tenant || typeof tenant !== 'string') return false;
  const clean = tenant.trim().toLowerCase();
  return VALID_TENANTS.has(clean) || TENANTS.some((t) => t.id === clean);
}

/**
 * Pure tenant ID normalizer.
 * Safely resolves aliases (e.g. lovable -> flux) and recognizes registered dynamic tenants.
 * Falls back to default 'smmplan' only if unknown.
 */
export function normalizeTenantId(tenantId: unknown): TenantId {
  if (typeof tenantId !== 'string' || !tenantId.trim()) return 'smmplan';
  const clean = tenantId.trim().toLowerCase();
  if (TENANT_ALIASES[clean]) {
    return TENANT_ALIASES[clean];
  }
  if (isValidTenant(clean)) {
    return clean;
  }
  return 'smmplan';
}

export function getTenantConfig(tenantId: string | null | undefined): TenantConfig {
  const norm = normalizeTenantId(tenantId);
  const found = TENANTS.find((t) => t.id === norm);
  if (found) return found;
  const capitalized = norm.charAt(0).toUpperCase() + norm.slice(1);
  return {
    id: norm,
    name: capitalized,
    domain: `${norm}.pro`,
    testDomain: `test.${norm}.pro`,
    allowedHosts: [`${norm}.pro`, `www.${norm}.pro`, `test.${norm}.pro`],
  };
}

export function getTenantSiteName(tenantId: string | null | undefined): string {
  return getTenantConfig(tenantId).name;
}

/**
 * Resolves the canonical host for a specific tenant and incoming host header.
 */
export function resolveCanonicalHost(tenantId: string | null | undefined, incomingHost?: string | null): string {
  const config = getTenantConfig(tenantId);
  const rawHost = (incomingHost || '').toLowerCase().trim();
  const hostWithoutPort = rawHost.replace(/:\d+$/, '');

  // 1. Environment variable override if explicitly defined
  if (process.env.PUBLIC_SITE_URL) {
    try {
      return new URL(process.env.PUBLIC_SITE_URL).host;
    } catch {
      // ignore
    }
  }
  if (process.env.APP_HOST) {
    return process.env.APP_HOST;
  }

  // 2. Resolve per-tenant whitelist matching incoming request host
  if (hostWithoutPort && (config.allowedHosts as readonly string[]).some((h) => h === hostWithoutPort || h === rawHost)) {
    return hostWithoutPort;
  }

  // 3. Dev environments & tunnels
  if (rawHost && (rawHost.includes('localhost') || rawHost.includes('127.0.0.1') || rawHost.endsWith('.ts.net'))) {
    return rawHost;
  }

  // 4. Default canonical production domain of the tenant
  return config.domain;
}

export function getTenantHost(tenantId: string | null | undefined, incomingHost?: string | null): string {
  return resolveCanonicalHost(tenantId, incomingHost);
}

export function absoluteCanonical(tenantId: string | null | undefined, path: string, incomingHost?: string | null): string {
  const host = getTenantHost(tenantId, incomingHost);
  const cleanPath = '/' + path.replace(/^\/+/, '');
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}${cleanPath}`;
}
