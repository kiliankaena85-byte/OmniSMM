import { describe, it, expect, vi } from 'vitest';
import { PREDEFINED_TAGS, NetworkItem, CategoryItem } from '@/app/admin/catalog/categories/components/sub/types';

describe('Category Manager Decomposition Contract', () => {
  it('PREDEFINED_TAGS should define all standard analyzer tags with network affinities', () => {
    expect(PREDEFINED_TAGS.length).toBeGreaterThanOrEqual(10);
    const tagIds = PREDEFINED_TAGS.map(t => t.id);
    expect(tagIds).toContain('channel');
    expect(tagIds).toContain('post');
    expect(tagIds).toContain('profile');
    expect(tagIds).toContain('video');
    expect(tagIds).toContain('reel');
    expect(tagIds).toContain('story');
    expect(tagIds).toContain('poll');
    expect(tagIds).toContain('comment');
    expect(tagIds).toContain('bot');
    expect(tagIds).toContain('chat');
  });

  it('category items should properly model multi-tenant counts and network associations', () => {
    const mockNetwork: NetworkItem = {
      id: 'net-tg',
      name: 'Telegram',
      slug: 'telegram',
      sort: 1,
      isActive: true,
    };

    const mockCategory: CategoryItem = {
      id: 'cat-1',
      name: 'Подписчики',
      slug: 'subscribers',
      networkId: 'net-tg',
      sort: 1,
      requireWarning: true,
      warningMessage: 'Канал должен быть открытым',
      analyzerTags: 'channel',
      network: mockNetwork,
      _count: { services: 5 },
      tenantServicesCount: 3,
      globalServicesCount: 8,
      otherTenantsCount: 5,
    };

    expect(mockCategory.name).toBe('Подписчики');
    expect(mockCategory.network?.slug).toBe('telegram');
    expect(mockCategory.tenantServicesCount).toBe(3);
    expect(mockCategory.globalServicesCount).toBe(8);
  });

  it('verifies subcomponent modules are importable without errors', async () => {
    const { CategoryEditModal } = await import('@/app/admin/catalog/categories/components/sub/CategoryEditModal');
    const { NetworkEditModal } = await import('@/app/admin/catalog/categories/components/sub/NetworkEditModal');
    const { CategoryMergeModal } = await import('@/app/admin/catalog/categories/components/sub/CategoryMergeModal');
    const { CategoryTable } = await import('@/app/admin/catalog/categories/components/sub/CategoryTable');
    const { CategoryManager } = await import('@/app/admin/catalog/categories/components/category-manager');

    expect(CategoryEditModal).toBeDefined();
    expect(NetworkEditModal).toBeDefined();
    expect(CategoryMergeModal).toBeDefined();
    expect(CategoryTable).toBeDefined();
    expect(CategoryManager).toBeDefined();
  });
});
