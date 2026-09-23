import { describe, it, expect } from 'vitest';
import { CATALOG_TABS } from '@/components/admin/navigation-data';

describe('Admin Catalog Integrity & Contracts Suite (SIL-2026 Step 3)', () => {
  describe('Provider Status Filter & Cooldown Parity', () => {
    it('defines the complete set of providerStatus options including cooldown', () => {
      const providerStatuses = ['all', 'active', 'zombie', 'cooldown', 'manual'];

      expect(providerStatuses).toContain('active');
      expect(providerStatuses).toContain('zombie');
      expect(providerStatuses).toContain('cooldown');
      expect(providerStatuses).toContain('manual');
    });

    it('builds the correct cooldown where condition for prisma query', () => {
      const now = new Date();
      const buildProviderStatusCondition = (status?: string) => {
        if (status === 'active') {
          return { providerId: { not: null }, cooldownReason: null };
        }
        if (status === 'zombie') {
          return { cooldownReason: { in: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] } };
        }
        if (status === 'cooldown') {
          return {
            cooldownUntil: { gt: now },
            cooldownReason: { notIn: ['ZOMBIE_AUTO_DISABLED', 'ZOMBIE_ARCHIVED'] },
          };
        }
        if (status === 'manual') {
          return { providerId: null };
        }
        return null;
      };

      const cooldownCondition = buildProviderStatusCondition('cooldown');
      expect(cooldownCondition).toBeDefined();
      expect(cooldownCondition?.cooldownUntil).toHaveProperty('gt');
      expect(cooldownCondition?.cooldownReason).toHaveProperty('notIn');
      expect(cooldownCondition?.cooldownReason?.notIn).toContain('ZOMBIE_AUTO_DISABLED');
      expect(cooldownCondition?.cooldownReason?.notIn).toContain('ZOMBIE_ARCHIVED');
    });

    it('generates the correct URL for the cooldown button', () => {
      const getCooldownUrl = (tenant: string) => `/admin/catalog?providerStatus=cooldown&tenant=${tenant}`;

      expect(getCooldownUrl('smmplan')).toBe('/admin/catalog?providerStatus=cooldown&tenant=smmplan');
      expect(getCooldownUrl('flux')).toBe('/admin/catalog?providerStatus=cooldown&tenant=flux');
    });
  });

  describe('Catalog Navigation Tabs & Routing Parity', () => {
    it('contains all canonical catalog tabs in CATALOG_TABS (strictly catalog scoped)', () => {
      const expectedHrefs = [
        '/admin/catalog',
        '/admin/catalog/categories',
        '/admin/catalog/patterns',
        '/admin/catalog/quarantine',
      ];

      const tabHrefs = CATALOG_TABS.map(t => t.href);
      expect(tabHrefs).toEqual(expectedHrefs);
      expect(tabHrefs).not.toContain('/admin/providers');
      expect(tabHrefs).not.toContain('/admin/providers/import');
    });

    it('ensures catalog base route is the first tab', () => {
      expect(CATALOG_TABS[0].href).toBe('/admin/catalog');
      expect(CATALOG_TABS[0].label).toBe('Каталог услуг');
    });
  });
});
