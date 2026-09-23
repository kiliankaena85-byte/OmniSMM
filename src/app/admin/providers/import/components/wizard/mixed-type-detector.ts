import type { ExternalServiceItem, CategoryItem } from '../../types';
import type { MixedTypeWarning } from './types';

export const detectMixedCategoryTypes = (
  selectedIds: Set<string>,
  services: ExternalServiceItem[],
  selectedCategories: Record<string, string>,
  autoMappedCategories: Record<string, string>,
  categories: CategoryItem[]
): MixedTypeWarning[] => {
  // Group selected services by their target DB category
  const byCatId: Record<string, Array<{ normCat: string; name: string }>> = {};

  selectedIds.forEach((id) => {
    const svc = services.find((s) => String(s.service) === id);
    if (!svc) return;
    const catId = selectedCategories[id] || autoMappedCategories[id];
    if (!catId) return;
    const normCat = (svc.metrics?.category || 'OTHER').toUpperCase();
    if (!byCatId[catId]) byCatId[catId] = [];
    byCatId[catId].push({ normCat, name: svc.name });
  });

  const warnings: MixedTypeWarning[] = [];

  for (const [catId, entries] of Object.entries(byCatId)) {
    // Count by normalizedCategory
    const typeCounts: Record<string, string[]> = {};
    entries.forEach((e) => {
      if (!typeCounts[e.normCat]) typeCounts[e.normCat] = [];
      typeCounts[e.normCat].push(e.name);
    });

    const distinctTypes = Object.keys(typeCounts);
    if (distinctTypes.length <= 1) continue; // OK — single type

    const cat = categories.find((c) => c.id === catId);
    warnings.push({
      targetCategoryId: catId,
      targetCategoryName: cat?.name || catId,
      types: distinctTypes.map((t) => ({
        normCategory: t,
        count: typeCounts[t].length,
        examples: typeCounts[t].slice(0, 2),
      })),
    });
  }

  return warnings;
};
