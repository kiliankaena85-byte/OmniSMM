import { describe, it, expect } from 'vitest';
import {
  TENANTS,
  TENANT_ALIASES,
  isValidTenant,
  normalizeTenantId,
  getTenantConfig,
  getTenantSiteName,
} from '@/config/tenants';

describe('CFG-01: Multi-Tenant Brand Integrity & Forbidden Brands Prevention', () => {
  it('strictly registers only authorized platforms in TENANTS (smmplan and flux)', () => {
    const tenantIds = TENANTS.map((t) => t.id);
    expect(tenantIds).toEqual(['smmplan', 'flux']);
    expect(TENANTS).toHaveLength(2);
  });

  it('ensures banned brands boost / smmboost are completely absent from TENANTS and aliases', () => {
    const tenantIds = TENANTS.map((t) => t.id);
    expect(tenantIds).not.toContain('boost');
    expect(tenantIds).not.toContain('smmboost');

    expect(TENANT_ALIASES['boost']).toBeUndefined();
    expect(TENANT_ALIASES['smmboost']).toBeUndefined();
  });

  it('keeps lovable strictly as a backward-compatibility alias mapped to flux', () => {
    expect(TENANT_ALIASES['lovable']).toBe('flux');
    expect(isValidTenant('lovable')).toBe(false);
    expect(normalizeTenantId('lovable')).toBe('flux');
    expect(getTenantConfig('lovable').id).toBe('flux');
    expect(getTenantSiteName('lovable')).toBe('SMMflux');
  });

  it('falls back safely to smmplan for unknown or malicious tenant identifiers', () => {
    expect(normalizeTenantId('unknown_brand')).toBe('smmplan');
    expect(normalizeTenantId(null)).toBe('smmplan');
    expect(normalizeTenantId(undefined)).toBe('smmplan');
    expect(normalizeTenantId('')).toBe('smmplan');
    expect(normalizeTenantId('../../etc/passwd')).toBe('smmplan');
  });
});
