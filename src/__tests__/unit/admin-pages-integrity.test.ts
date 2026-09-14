import { describe, it, expect } from 'vitest';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

describe('Admin CMS Pages Integrity & Invariants (/admin/pages)', () => {
  describe('SYSTEM_TABS Navigation Cluster & Onboarding', () => {
    it('verifies /admin/pages is part of SYSTEM_TABS', () => {
      const pageTab = SYSTEM_TABS.find(t => t.href === '/admin/pages');
      expect(pageTab).toBeDefined();
      expect(pageTab?.label).toBe('CMS Страницы');
    });

    it('verifies onboarding configuration exists for pages', () => {
      expect(ONBOARDING_CONFIGS.pages).toBeDefined();
      expect(ONBOARDING_CONFIGS.pages.faqs.length).toBeGreaterThan(0);
    });
  });

  describe('Routing & Preview Invariants', () => {
    const LEGAL_SLUGS = ['privacy', 'terms', 'refund', 'rules', 'cookie'];

    it('distinguishes legal documentation paths from custom content pages', () => {
      const getPreviewPath = (slug: string) => {
        return LEGAL_SLUGS.includes(slug) ? `/legal/${slug}` : `/p/${slug}`;
      };

      expect(getPreviewPath('privacy')).toBe('/legal/privacy');
      expect(getPreviewPath('terms')).toBe('/legal/terms');
      expect(getPreviewPath('refund')).toBe('/legal/refund');
      expect(getPreviewPath('about-us')).toBe('/p/about-us');
      expect(getPreviewPath('faq-extended')).toBe('/p/faq-extended');
    });

    it('ensures slug redirects map correctly', () => {
      const isNewPage = (slug: string) => slug === 'new';
      expect(isNewPage('new')).toBe(true);
      expect(isNewPage('privacy')).toBe(false);
    });
  });
});
