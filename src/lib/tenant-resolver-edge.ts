/**
 * Pure Edge-Compatible Tenant Resolution & Normalization.
 * ZERO Prisma / DB dependencies. Safe for Next.js Middleware and Edge Runtime.
 */

export const FLUX_DOMAINS = new Set([
  'lovable.local',
  'lovable.smmplan.ru',
  'lovable.pro',
  'www.lovable.pro',
  'smmflux.ru',
  'www.smmflux.ru',
  'flux.local',
  'smmflux.local',
  'flux.smmplan.ru',
  'flux.smmplan.pro',
  'test-flux.smmplan.pro',
  'test.smmflux.ru',
]);

export const VALID_TENANTS = new Set(['smmplan', 'flux']);

/**
 * Dynamically registers a new tenant slug into the runtime validation set.
 */
export function registerValidTenant(slug: string): void {
  if (slug && typeof slug === 'string') {
    VALID_TENANTS.add(slug.trim().toLowerCase());
  }
}

export type ContourId = 'test' | 'prod' | 'flux';

/**
 * Pure Edge-Compatible Contour Resolver.
 * Resolves logical deployment environment:
 * - test.smmplan.pro / localhost / dev -> 'test'
 * - flux.smmplan.pro / smmflux.ru -> 'flux'
 * - smmplan.pro / www.smmplan.pro -> 'prod'
 */
export function resolveContourFromHost(host?: string | null): ContourId {
  if (!host || typeof host !== 'string') return 'test';
  const clean = host.split(':')[0].toLowerCase().trim();
  if (clean.includes('flux') || FLUX_DOMAINS.has(clean) || clean.startsWith('test-flux.')) return 'flux';
  if (
    clean.startsWith('test.') ||
    clean.includes('localhost') ||
    clean.includes('127.0.0.1') ||
    clean === '0.0.0.0' ||
    clean === 'host.docker.internal' ||
    clean === 'web' ||
    clean.endsWith('.ts.net') ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(clean) ||
    /^10\.\d+\.\d+\.\d+$/.test(clean) ||
    /^192\.168\.\d+\.\d+$/.test(clean)
  ) {
    return 'test';
  }
  if (clean === 'smmplan.pro' || clean === 'www.smmplan.pro') return 'prod';
  return 'test';
}

/**
 * Edge-compatible host resolver (without Prisma DB dependency) for Next.js Middleware.
 */
export function resolveTenantFromHostEdge(host: string): string {
  if (!host || typeof host !== 'string') return 'smmplan';
  const cleanHost = host.split(':')[0].toLowerCase().trim();
  if (cleanHost.startsWith('flux.') || cleanHost.startsWith('test-flux.') || cleanHost.includes('smmflux') || FLUX_DOMAINS.has(cleanHost)) {
    return 'flux';
  }
  return 'smmplan';
}

/**
 * Pure tenant ID normalizer and sanitizer.
 * Maps legacy 'lovable' to canonical 'flux'.
 * Rejects unknown or malicious strings and falls back to 'smmplan'.
 */
export function normalizeTenantId<T extends string | null | undefined>(tenantId: T): string | T {
  if (!tenantId) return tenantId;
  const clean = tenantId.trim().toLowerCase();
  const normalized = clean === 'lovable' || clean === 'smmflux' ? 'flux' : clean;
  if (!VALID_TENANTS.has(normalized)) {
    return 'smmplan' as T;
  }
  return normalized as T;
}

/**
 * Single Canonical View Strategy Resolver for Server Components & Actions.
 * Strategy MUST be resolved ONLY from the 'x-tenant-id' header set by Middleware.
 */
export function resolveTenantFromRequest(headersList: Headers): string {
  const headerVal = headersList.get('x-tenant-id');
  return (normalizeTenantId(headerVal) as string) || 'smmplan';
}
