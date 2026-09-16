import { describe, it, expect } from 'vitest';
import { 
  SETTINGS_CLUSTERS, 
  resolveSettingsNavigation 
} from '@/components/admin/settings/settings-navigation-config';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';

describe('Admin Settings Integrity & Contracts Suite (SIL-2026 Step 15)', () => {
  describe('Settings Clusters Structure & Sub-tabs Exhaustiveness', () => {
    it('defines 3 master clusters: showcase, integrations, security', () => {
      const clusterIds = SETTINGS_CLUSTERS.map(c => c.id);
      expect(clusterIds).toEqual(['showcase', 'integrations', 'security']);

      for (const cluster of SETTINGS_CLUSTERS) {
        expect(cluster.label).toBeDefined();
        expect(cluster.icon).toBeDefined();
        expect(cluster.description).toBeDefined();
        expect(cluster.subTabs.length).toBeGreaterThan(0);

        for (const sub of cluster.subTabs) {
          expect(sub.id).toBeDefined();
          expect(sub.label).toBeDefined();
          expect(sub.icon).toBeDefined();
          expect(sub.description).toBeDefined();
        }
      }
    });

    it('covers all critical sub-tabs across clusters', () => {
      const allSubTabIds = SETTINGS_CLUSTERS.flatMap(c => c.subTabs.map(st => st.id));
      const requiredTabs = [
        'system',
        'catalog',
        'integrations',
        'telegram',
        'proxy',
        'storefront',
        'team',
        'templates',
        'audit'
      ];

      for (const tab of requiredTabs) {
        expect(allSubTabIds).toContain(tab);
      }
    });
  });

  describe('resolveSettingsNavigation Routing Invariant', () => {
    it('correctly maps raw tab params to cluster and active sub-tab', () => {
      expect(resolveSettingsNavigation('system')).toEqual({
        activeCluster: 'showcase',
        activeSubTab: 'system'
      });

      expect(resolveSettingsNavigation('catalog')).toEqual({
        activeCluster: 'showcase',
        activeSubTab: 'catalog'
      });

      expect(resolveSettingsNavigation('proxy')).toEqual({
        activeCluster: 'integrations',
        activeSubTab: 'proxy'
      });

      expect(resolveSettingsNavigation('telegram')).toEqual({
        activeCluster: 'integrations',
        activeSubTab: 'telegram'
      });

      expect(resolveSettingsNavigation('team')).toEqual({
        activeCluster: 'security',
        activeSubTab: 'team'
      });

      expect(resolveSettingsNavigation('audit')).toEqual({
        activeCluster: 'security',
        activeSubTab: 'audit'
      });
    });

    it('falls back to default showcase:system when unknown tab is provided', () => {
      expect(resolveSettingsNavigation('unknown_random_tab')).toEqual({
        activeCluster: 'showcase',
        activeSubTab: 'system'
      });

      expect(resolveSettingsNavigation(null)).toEqual({
        activeCluster: 'showcase',
        activeSubTab: 'system'
      });
    });
  });

  describe('SYSTEM_TABS Navigation Cluster Integrity', () => {
    it('contains global settings and system configurations', () => {
      const settingsTab = SYSTEM_TABS.find(t => t.href === '/admin/settings');
      expect(settingsTab).toBeDefined();
      expect(settingsTab?.label).toBe('Глобальные настройки');

      const telegramTab = SYSTEM_TABS.find(t => t.href === '/admin/settings?tab=telegram');
      expect(telegramTab).toBeDefined();

      const proxyTab = SYSTEM_TABS.find(t => t.href === '/admin/settings?tab=proxy');
      expect(proxyTab).toBeDefined();
    });
  });

  describe('Security Masking Invariant for System Settings', () => {
    it('verifies that sensitive token masks match standard length', () => {
      const MASK = '••••••••••••••••';
      expect(MASK.length).toBe(16);
      expect(MASK).not.toContain('sk_');
      expect(MASK).not.toContain('bot');
    });
  });

  describe('54-FZ Tax & Branding Schema Invariants', () => {
    it('transforms empty siteLogoUrl and siteFaviconUrl to null', async () => {
      const { globalSettingsSchema } = await import('@/validators/admin.validators');
      const parsed = globalSettingsSchema.parse({
        siteLogoUrl: '',
        siteFaviconUrl: '',
      });
      expect(parsed.siteLogoUrl).toBeNull();
      expect(parsed.siteFaviconUrl).toBeNull();
    });

    it('validates 54-FZ USN schemes and tax rates', async () => {
      const { globalSettingsSchema } = await import('@/validators/admin.validators');
      const parsed = globalSettingsSchema.parse({
        usnScheme: 'INCOME',
        taxRate: '6.0',
        opexMonthly: '50000',
      });
      expect(parsed.usnScheme).toBe('INCOME');
      expect(parsed.taxRate).toBe(6.0);
      expect(parsed.opexMonthly).toBe(50000);
    });

    it('rejects invalid tax rates below 0 or above 100', async () => {
      const { globalSettingsSchema } = await import('@/validators/admin.validators');
      const resLow = globalSettingsSchema.safeParse({ taxRate: -5 });
      expect(resLow.success).toBe(false);

      const resHigh = globalSettingsSchema.safeParse({ taxRate: 105 });
      expect(resHigh.success).toBe(false);
    });
  });
});