import { describe, it, expect } from 'vitest';
import { normalizeTenantId, isValidTenant, getTenantConfig, getTenantSiteName, CORE_TENANTS } from '@/config/tenants';
import { registerValidTenant, VALID_TENANTS } from '@/lib/tenant-resolver-edge';
import { getTenantFallbackBranding } from '@/lib/settings';

describe('Dynamic N-Tenants Scaling Architecture', () => {
  it('retains CORE_TENANTS array with smmplan and flux', () => {
    expect(CORE_TENANTS).toEqual(['smmplan', 'flux']);
  });

  it('normalizes legacy aliases properly', () => {
    expect(normalizeTenantId('lovable')).toBe('flux');
    expect(normalizeTenantId('smmflux')).toBe('flux');
    expect(normalizeTenantId('fluxsmm')).toBe('flux');
    expect(normalizeTenantId('smmplan')).toBe('smmplan');
  });

  it('falls back to smmplan for unregistered arbitrary strings', () => {
    expect(normalizeTenantId('unregistered_tenant_xyz')).toBe('smmplan');
    expect(isValidTenant('unregistered_tenant_xyz')).toBe(false);
  });

  it('recognizes dynamically registered tenant without modifying hardcoded sets', () => {
    const slug = 'investor_beta_42';
    expect(isValidTenant(slug)).toBe(false);
    expect(normalizeTenantId(slug)).toBe('smmplan');

    registerValidTenant(slug);

    expect(VALID_TENANTS.has(slug)).toBe(true);
    expect(isValidTenant(slug)).toBe(true);
    expect(normalizeTenantId(slug)).toBe(slug);
  });

  it('generates dynamic TenantConfig for dynamically registered tenants', () => {
    const slug = 'partner_brand';
    registerValidTenant(slug);

    const config = getTenantConfig(slug);
    expect(config.id).toBe(slug);
    expect(config.name).toBe('Partner_brand');
    expect(config.domain).toBe('partner_brand.pro');
    expect(config.allowedHosts).toContain('partner_brand.pro');
    expect(getTenantSiteName(slug)).toBe('Partner_brand');
  });

  it('generates dynamic safe branding fallbacks without binary ternary bleeding', () => {
    const smmplanBranding = getTenantFallbackBranding('smmplan');
    expect(smmplanBranding.name).toBe('SMMplan');
    expect(smmplanBranding.domain).toBe('smmplan.pro');
    expect(smmplanBranding.supportEmail).toBe('support@smmplan.pro');

    const fluxBranding = getTenantFallbackBranding('flux');
    expect(fluxBranding.name).toBe('SMMflux');
    expect(fluxBranding.domain).toBe('smmflux.ru');
    expect(fluxBranding.supportEmail).toBe('support@smmflux.ru');

    const dynamicBranding = getTenantFallbackBranding('turbosmm');
    expect(dynamicBranding.name).toBe('Turbosmm');
    expect(dynamicBranding.domain).toBe('turbosmm.pro');
    expect(dynamicBranding.supportEmail).toBe('support@turbosmm.pro');
    expect(dynamicBranding.privacyEmail).toBe('privacy@turbosmm.pro');
    expect(dynamicBranding.bot).toBe('turbosmm_support_bot');
  });
});
