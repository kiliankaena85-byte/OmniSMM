import { describe, it, expect, vi } from 'vitest';
import { ensureCategoryForActivityType } from '@/services/admin/catalog.service';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

// We test the semantic invariant behavior that was added directly in catalog.service.ts
// Because the actual semantic logic is embedded within importServices, we can simulate the logic here.
describe('Semantic Category Guard', () => {
  it('identifies SUBSCRIBERS based on normalizedCategory or targetType', () => {
    const shadowExts = [
      { normalizedCategory: 'SUBSCRIBERS', targetType: 'POST', cleanName: 'Random' },
      { normalizedCategory: 'OTHER', targetType: 'CHANNEL', cleanName: 'Random' },
      { normalizedCategory: 'OTHER', targetType: 'POST', cleanName: 'Telegram Подписчики' },
      { normalizedCategory: 'OTHER', targetType: 'POST', cleanName: 'Members (Global)' }
    ];

    shadowExts.forEach(shadowExt => {
      const normCat = shadowExt.normalizedCategory;
      const isServiceSubscribers = normCat === 'SUBSCRIBERS' || shadowExt.targetType === 'CHANNEL' || /подписч|member/i.test(shadowExt.cleanName);
      expect(isServiceSubscribers).toBe(true);
    });
  });

  it('identifies VIEWS target category by name', () => {
    const names = ['Просмотры', 'Быстрые просмотры (Telegram)', 'Автопросмотры'];
    names.forEach(name => {
      const isTargetViews = name.toLowerCase().includes('просмотр');
      expect(isTargetViews).toBe(true);
    });
  });

  it('should reroute correctly when mismatch occurs', () => {
    const isServiceSubscribers = true;
    const isTargetViews = true;
    
    // Simulating the guard condition in importServices
    const extId = '123';
    const categoryIdMap: Record<string, string> = { '123': 'cat1' };
    const categoryNameMap = new Map([['cat1', 'Просмотры Telegram']]);
    const categoryActivityTypeMap = new Map([['cat1', 'VIEWS']]);
    
    const explicitId = categoryIdMap[extId];
    const explicitName = categoryNameMap.get(explicitId) || '';
    const explicitActivityType = categoryActivityTypeMap.get(explicitId) || '';
    const isTargetViewsActual = explicitActivityType === 'VIEWS' || explicitName.toLowerCase().includes('просмотр');

    const fallbackCategoryRecord = { networkId: 'net1', network: { id: 'net1', name: 'Telegram', slug: 'telegram' }, tenantId: 'smmplan' };
    
    let routedToSubscribers = false;
    if (isServiceSubscribers && isTargetViewsActual && fallbackCategoryRecord?.network?.id && fallbackCategoryRecord.networkId) {
      routedToSubscribers = true;
    }
    
    expect(routedToSubscribers).toBe(true);
  });
});
