export function normalizeTenantId(tenantId: string | null | undefined): string {
  if (!tenantId) return 'smmplan';
  const tid = tenantId.toLowerCase().trim();
  if (tid === 'flux' || tid === 'lovable' || tid === 'smmflux') return 'flux';
  return tid;
}

/**
 * Resolves the canonical host for a specific tenant and incoming host header.
 * Matrix:
 * - Tenant 'flux' on flux.smmplan.pro -> flux.smmplan.pro
 * - Tenant 'flux' on smmflux.ru -> smmflux.ru
 * - Tenant 'smmplan' on test.smmplan.pro -> test.smmplan.pro
 * - Tenant 'smmplan' on smmplan.pro -> smmplan.pro
 */
export function resolveCanonicalHost(tenantId: string, incomingHost?: string | null): string {
  const normTenant = normalizeTenantId(tenantId);
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
  if (normTenant === 'flux') {
    if (hostWithoutPort === 'flux.smmplan.pro' || rawHost === 'flux.smmplan.pro') return 'flux.smmplan.pro';
    if (hostWithoutPort === 'smmflux.ru' || rawHost === 'smmflux.ru') return 'smmflux.ru';
    if (rawHost.includes('localhost') || rawHost.includes('127.0.0.1') || rawHost.endsWith('.ts.net')) return rawHost;
    // Default fallback for flux on test vs prod
    return process.env.NODE_ENV === 'production' && !process.env.APP_URL?.includes('test.')
      ? 'smmflux.ru'
      : 'flux.smmplan.pro';
  } else {
    // smmplan tenant
    if (hostWithoutPort === 'test.smmplan.pro' || rawHost === 'test.smmplan.pro') return 'test.smmplan.pro';
    if (hostWithoutPort === 'smmplan.pro' || rawHost === 'smmplan.pro') return 'smmplan.pro';
    if (rawHost.includes('localhost') || rawHost.includes('127.0.0.1') || rawHost.endsWith('.ts.net')) return rawHost;
    // Default fallback for smmplan on test vs prod
    return process.env.NODE_ENV === 'production' && !process.env.APP_URL?.includes('test.')
      ? 'smmplan.pro'
      : 'test.smmplan.pro';
  }
}

export function getTenantHost(tenantId: string, incomingHost?: string | null): string {
  return resolveCanonicalHost(tenantId, incomingHost);
}

export function getTenantSiteName(tenantId: string): string {
  switch (normalizeTenantId(tenantId)) {
    case 'flux':
    case 'smmflux': return 'SMMflux';
    default: return 'SMMplan';
  }
}

export function absoluteCanonical(tenantId: string, path: string, incomingHost?: string | null): string {
  const host = getTenantHost(tenantId, incomingHost);
  const cleanPath = '/' + path.replace(/^\/+/, '');
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}${cleanPath}`;
}

