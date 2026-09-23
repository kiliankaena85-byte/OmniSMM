/**
 * Single source of truth delegate for Multi-Tenant SEO, Hosts & Brand Names.
 * Centralized in @/config/tenants to allow instant brand additions/renaming.
 */

export {
  normalizeTenantId,
  resolveCanonicalHost,
  getTenantHost,
  getTenantSiteName,
  absoluteCanonical,
  TENANTS,
  TENANT_ALIASES,
  getTenantConfig,
  type TenantId,
} from '@/config/tenants';
