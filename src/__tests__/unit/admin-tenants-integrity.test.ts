import { describe, it, expect } from 'vitest';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';
import { VALID_TENANTS, normalizeTenantId, resolveContourFromHost, resolveTenantFromHostEdge } from '@/lib/tenant-resolver-edge';

describe('Admin Tenants & Multi-Brand Invariants (/admin/tenants)', () => {
  describe('SYSTEM_TABS Navigation Cluster', () => {
    it('verifies /admin/tenants is part of SYSTEM_TABS', () => {
      const tenantTab = SYSTEM_TABS.find(t => t.href === '/admin/tenants');
      expect(tenantTab).toBeDefined();
      expect(tenantTab?.label).toBe('Бренды & Домены');
    });
  });

  describe('Core System Tenants & Immutability', () => {
    it('ensures core system tenants are protected and present in VALID_TENANTS', () => {
      expect(VALID_TENANTS.has('smmplan')).toBe(true);
      expect(VALID_TENANTS.has('flux')).toBe(true);
    });

    it('prohibits deactivation or deletion of base system tenants', () => {
      const isSystemTenant = (id: string) => id === 'smmplan' || id === 'flux';
      expect(isSystemTenant('smmplan')).toBe(true);
      expect(isSystemTenant('flux')).toBe(true);
      expect(isSystemTenant('custom-partner')).toBe(false);
    });
  });

  describe('Edge Tenant Resolution & Aliases', () => {
    it('normalizes legacy aliases properly', () => {
      expect(normalizeTenantId('lovable')).toBe('flux');
      expect(normalizeTenantId('smmflux')).toBe('flux');
      expect(normalizeTenantId('smmplan')).toBe('smmplan');
      expect(normalizeTenantId('unknown-tenant')).toBe('smmplan');
    });

    it('resolves hosts to correct tenant and contour', () => {
      expect(resolveTenantFromHostEdge('smmflux.ru')).toBe('flux');
      expect(resolveTenantFromHostEdge('flux.smmplan.pro')).toBe('flux');
      expect(resolveTenantFromHostEdge('smmplan.pro')).toBe('smmplan');

      expect(resolveContourFromHost('smmplan.pro')).toBe('prod');
      expect(resolveContourFromHost('smmflux.ru')).toBe('flux');
      expect(resolveContourFromHost('localhost:3000')).toBe('test');
    });
  });
});
