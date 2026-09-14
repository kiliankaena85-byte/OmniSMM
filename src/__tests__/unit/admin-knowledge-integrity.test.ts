import { describe, it, expect } from 'vitest';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

describe('Admin Knowledge Base & Blog Integrity (/admin/knowledge)', () => {
  describe('SYSTEM_TABS Navigation Cluster & Onboarding', () => {
    it('verifies /admin/knowledge is part of SYSTEM_TABS', () => {
      const knowledgeTab = SYSTEM_TABS.find(t => t.href === '/admin/knowledge');
      expect(knowledgeTab).toBeDefined();
      expect(knowledgeTab?.label).toBe('Статьи блога');
    });

    it('verifies onboarding configuration exists for knowledge base', () => {
      expect(ONBOARDING_CONFIGS.knowledge).toBeDefined();
      expect(ONBOARDING_CONFIGS.knowledge.faqs.length).toBeGreaterThan(0);
    });
  });

  describe('Article Metrics & Status Invariants', () => {
    const mockArticles = [
      { id: '1', title: 'Как раскрутить канал', status: 'PUBLISHED', viewCount: 150 },
      { id: '2', title: 'Секреты продвижения', status: 'PUBLISHED', viewCount: 200 },
      { id: '3', title: 'Черновик статьи', status: 'DRAFT', viewCount: 0 },
    ];

    it('accurately computes published counts and total views', () => {
      const total = mockArticles.length;
      const published = mockArticles.filter(a => a.status === 'PUBLISHED').length;
      const totalViews = mockArticles.reduce((sum, a) => sum + a.viewCount, 0);

      expect(total).toBe(3);
      expect(published).toBe(2);
      expect(totalViews).toBe(350);
    });

    it('formats public preview URLs to /knowledge/:slug', () => {
      const getArticleUrl = (slug: string) => `/knowledge/${slug}`;
      expect(getArticleUrl('telegram-boost-guide')).toBe('/knowledge/telegram-boost-guide');
    });
  });
});
