import { describe, it, expect } from 'vitest';
import { 
  resolveSettingsNavigation, 
  SETTINGS_CLUSTERS 
} from '@/components/admin/settings/settings-cluster-tabs';
import { 
  SETTINGS_SEARCH_INDEX 
} from '@/components/admin/settings/settings-search-command';

describe('Settings Cluster Navigation & Ergonomics (Smart Hybrid)', () => {
  describe('1. Backwards Compatible Tab Resolution', () => {
    it('resolves legacy "system" tab to showcase cluster', () => {
      const res = resolveSettingsNavigation('system');
      expect(res.activeCluster).toBe('showcase');
      expect(res.activeSubTab).toBe('system');
    });

    it('resolves legacy "catalog" tab to showcase cluster', () => {
      const res = resolveSettingsNavigation('catalog');
      expect(res.activeCluster).toBe('showcase');
      expect(res.activeSubTab).toBe('catalog');
    });

    it('resolves legacy "integrations" tab to integrations cluster', () => {
      const res = resolveSettingsNavigation('integrations');
      expect(res.activeCluster).toBe('integrations');
      expect(res.activeSubTab).toBe('integrations');
    });

    it('resolves legacy "telegram" tab to integrations cluster', () => {
      const res = resolveSettingsNavigation('telegram');
      expect(res.activeCluster).toBe('integrations');
      expect(res.activeSubTab).toBe('telegram');
    });

    it('resolves legacy "proxy" tab to integrations cluster', () => {
      const res = resolveSettingsNavigation('proxy');
      expect(res.activeCluster).toBe('integrations');
      expect(res.activeSubTab).toBe('proxy');
    });

    it('resolves legacy "team" tab to security cluster', () => {
      const res = resolveSettingsNavigation('team');
      expect(res.activeCluster).toBe('security');
      expect(res.activeSubTab).toBe('team');
    });

    it('resolves legacy "templates" tab to security cluster', () => {
      const res = resolveSettingsNavigation('templates');
      expect(res.activeCluster).toBe('security');
      expect(res.activeSubTab).toBe('templates');
    });

    it('resolves legacy "audit" tab to security cluster', () => {
      const res = resolveSettingsNavigation('audit');
      expect(res.activeCluster).toBe('security');
      expect(res.activeSubTab).toBe('audit');
    });

    it('falls back safely on null or invalid tab names', () => {
      expect(resolveSettingsNavigation(null)).toEqual({
        activeCluster: 'showcase',
        activeSubTab: 'system',
      });
      expect(resolveSettingsNavigation('nonexistent_tab_123')).toEqual({
        activeCluster: 'showcase',
        activeSubTab: 'system',
      });
    });
  });

  describe('2. Cluster Structure & Miller Law (3 Master Groups)', () => {
    it('groups all settings into exactly 3 master clusters', () => {
      expect(SETTINGS_CLUSTERS.length).toBe(3);
      expect(SETTINGS_CLUSTERS.map(c => c.id)).toEqual(['showcase', 'integrations', 'security']);
    });

    it('ensures each cluster has between 2 and 4 sub-tabs (No visual clutter)', () => {
      for (const cluster of SETTINGS_CLUSTERS) {
        expect(cluster.subTabs.length).toBeGreaterThanOrEqual(2);
        expect(cluster.subTabs.length).toBeLessThanOrEqual(4);
      }
    });
  });

  describe('3. Zero-Leakage & Search Index Integrity', () => {
    it('indexes at least 15 key configuration targets across all clusters', () => {
      expect(SETTINGS_SEARCH_INDEX.length).toBeGreaterThanOrEqual(15);
    });

    it('contains no runtime secrets, tokens, or raw passwords in search metadata', () => {
      const forbiddenSubstrings = ['whsec_', 'live_sec_', 'test_sec_', 'AIzaSy', 'cryptosecret', '••••••••••••••••'];
      for (const item of SETTINGS_SEARCH_INDEX) {
        const fullContent = `${item.title} ${item.description} ${item.category} ${item.tags.join(' ')}`;
        for (const forbidden of forbiddenSubstrings) {
          expect(fullContent).not.toContain(forbidden);
        }
      }
    });

    it('ensures every search item has a valid relative tabHref and tags', () => {
      for (const item of SETTINGS_SEARCH_INDEX) {
        expect(item.tabHref).toMatch(/^\?tab=[a-z]+$/);
        expect(item.tags.length).toBeGreaterThanOrEqual(3);
        expect(item.title.length).toBeGreaterThan(3);
        expect(item.description.length).toBeGreaterThan(10);
      }
    });
  });
});
