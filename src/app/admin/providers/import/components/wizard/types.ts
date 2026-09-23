import type { CategoryItem } from '../../types';

export interface MixedTypeWarning {
  targetCategoryId: string;
  targetCategoryName: string;
  types: Array<{ normCategory: string; count: number; examples: string[] }>;
}

export const PLATFORM_TABS = [
  { id: 'ALL', name: 'Все', icon: '🌐' },
  { id: 'telegram', name: 'Telegram', icon: '✈️' },
  { id: 'instagram', name: 'Instagram', icon: '📸' },
  { id: 'vk', name: 'ВКонтакте', icon: '💙' },
  { id: 'youtube', name: 'YouTube', icon: '▶️' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵' },
  { id: 'other', name: 'Другие', icon: '⚙️' },
];

export const DEFAULT_FILTERS = {
  page: 1,
  pageSize: 50,
  platform: 'ALL',
  geo: 'ALL',
  velocity: 'ALL',
  hasRefill: false,
  hasAnomaly: false,
  importStatus: 'NOT_IMPORTED',
  search: '',
  sortBy: 'none',
  category: 'ALL',
  retailReady: false,
  providerCategory: 'ALL',
  minPrice: '',
  maxPrice: '',
};

export function formatMarkupLabel(markupStr: string): string {
  const p = parseFloat(markupStr);
  if (isNaN(p) || p < 0) return '×3.0';
  if (p === 0) return 'авто';
  const multiplier = Math.round((1 + p / 100) * 100) / 100;
  return `×${multiplier.toFixed(2).replace(/\.?0+$/, '')}`;
}

export function computeMarkupMultiplier(markupStr: string): number {
  const p = parseFloat(markupStr);
  if (isNaN(p) || p < 0) return 3.0;
  if (p === 0) return 0; // auto-pricing signal
  return Math.round((1 + p / 100) * 100) / 100;
}

export function checkIsFiltersActive(filters: typeof DEFAULT_FILTERS): boolean {
  return (
    filters.platform !== 'ALL' ||
    filters.geo !== 'ALL' ||
    filters.velocity !== 'ALL' ||
    filters.hasRefill !== false ||
    filters.hasAnomaly !== false ||
    filters.importStatus !== 'NOT_IMPORTED' ||
    filters.search !== '' ||
    filters.sortBy !== 'none' ||
    filters.category !== 'ALL' ||
    filters.retailReady !== false ||
    filters.providerCategory !== 'ALL' ||
    filters.minPrice !== '' ||
    filters.maxPrice !== ''
  );
}

export function groupCategoriesByNetwork(categories: CategoryItem[]): Array<{ network: string; items: CategoryItem[] }> {
  const groups: Record<string, CategoryItem[]> = {};
  const ordered: string[] = [];
  for (const cat of categories) {
    const netName = cat.network?.name || 'Без сети';
    if (!groups[netName]) {
      groups[netName] = [];
      ordered.push(netName);
    }
    groups[netName].push(cat);
  }
  return ordered.map((name) => ({ network: name, items: groups[name] }));
}
