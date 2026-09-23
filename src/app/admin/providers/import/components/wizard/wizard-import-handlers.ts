import type { CategoryItem, ExternalServiceItem } from '../../types';
import type { ImportServicesResult } from '@/services/admin/catalog.service';
import {
  fetchPaginatedExternalServices,
  importSelectedServices,
  fetchExternalServices,
} from '@/actions/admin/providers/import-cherry-pick';
import { computeMarkupMultiplier } from './types';
import { autoMapCategory } from './category-auto-mapper';

export function applyAutoMapping(
  services: ExternalServiceItem[],
  localCategories: CategoryItem[],
  setAutoMappedCategories: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  setAiConfidence: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  setSelectedCategories: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  if (services.length === 0) return;
  const aiMap: Record<string, string> = {};
  const confidence: Record<string, boolean> = {};
  services.forEach((s) => {
    const idStr = String(s.service);
    const result = autoMapCategory(s, localCategories);
    if (result) {
      aiMap[idStr] = result.id;
      confidence[idStr] = result.confident;
    }
  });
  setAutoMappedCategories((prev) => ({ ...prev, ...aiMap }));
  setAiConfidence((prev) => ({ ...prev, ...confidence }));
  setSelectedCategories((prev) => {
    const next = { ...prev };
    services.forEach((s) => {
      const idStr = String(s.service);
      if (!next[idStr]) next[idStr] = aiMap[idStr];
    });
    return next;
  });
}

export interface LoadServicesCallbacks {
  setLoading: (b: boolean) => void; setError: (e: string | null) => void; setIsEmptyCache: (b: boolean) => void;
  setServices: (s: ExternalServiceItem[]) => void; setPagination: (p: any) => void;
  setPlatformCounts: (c: Record<string, number>) => void; setProviderCategories: (c: any[]) => void;
  setErrorWithTimer: (msg: string | null) => void;
}

export async function loadPaginatedServices(providerId: string, filters: any, cb: LoadServicesCallbacks) {
  if (!providerId) return;
  cb.setLoading(true);
  cb.setError(null);
  cb.setIsEmptyCache(false);
  try {
    const { page: _p, pageSize: _ps, ...restFilters } = filters;
    const res = await fetchPaginatedExternalServices(providerId, restFilters, filters.page, filters.pageSize);
    if (res.success && res.data) {
      cb.setServices(res.data);
      if (res.pagination) cb.setPagination(res.pagination);
      if (res.platformCounts) cb.setPlatformCounts(res.platformCounts);
      if (res.providerCategories) cb.setProviderCategories(res.providerCategories);
    } else if ('emptyCache' in res && res.emptyCache) {
      cb.setIsEmptyCache(true);
      cb.setServices([]);
    } else {
      cb.setErrorWithTimer(res.error || 'Не удалось загрузить услуги');
      cb.setServices([]);
    }
  } catch {
    cb.setErrorWithTimer('Ошибка соединения при загрузке услуг');
    cb.setServices([]);
  } finally {
    cb.setLoading(false);
  }
}

export interface SyncProviderCallbacks {
  setSyncing: (b: boolean) => void;
  setErrorWithTimer: (msg: string | null) => void;
  setSuccessWithTimer: (msg: string | null) => void;
  setIsEmptyCache: (b: boolean) => void;
  loadServices: () => Promise<void>;
}

export async function syncProviderServices(providerId: string, cb: SyncProviderCallbacks) {
  if (!providerId) return;
  cb.setSyncing(true);
  cb.setErrorWithTimer(null);
  cb.setSuccessWithTimer(null);
  try {
    const res = await fetchExternalServices(providerId);
    if (res.success) {
      cb.setSuccessWithTimer(`Синхронизировано ${'count' in res ? res.count : 0} услуг`);
      cb.setIsEmptyCache(false);
      await cb.loadServices();
    } else {
      cb.setErrorWithTimer('error' in res ? res.error : 'Ошибка синхронизации');
    }
  } catch {
    cb.setErrorWithTimer('Не удалось синхронизировать каталог провайдера');
  } finally {
    cb.setSyncing(false);
  }
}

export interface SelectAllFilteredCallbacks {
  setSelectingAllFiltered: (b: boolean) => void;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSuccessWithTimer: (msg: string | null) => void;
  setErrorWithTimer: (msg: string | null) => void;
}

export async function selectAllFilteredServices(providerId: string, filters: any, cb: SelectAllFilteredCallbacks) {
  try {
    cb.setSelectingAllFiltered(true);
    const { page: _p, pageSize: _ps, ...restFilters } = filters;
    const res = await fetchPaginatedExternalServices(providerId, restFilters, 1, 5000);
    if (res.success && res.data) {
      const idsToAdd = res.data
        .filter((s: ExternalServiceItem) => !s.alreadyImported)
        .map((s: ExternalServiceItem) => String(s.service));
      cb.setSelectedIds((prev) => {
        const next = new Set(prev);
        idsToAdd.forEach((id: string) => next.add(id));
        return next;
      });
      cb.setSuccessWithTimer(`${idsToAdd.length} услуг выбрано по текущим фильтрам`);
    }
  } catch {
    cb.setErrorWithTimer('Не удалось выбрать все отфильтрованные услуги');
  } finally {
    cb.setSelectingAllFiltered(false);
  }
}

export interface ExecuteImportCallbacks {
  setShowConfirmModal: (b: boolean) => void;
  setImportProgress: (p: { current: number; total: number } | null) => void;
  setError: (e: string | null) => void; setImportReport: (r: ImportServicesResult | null) => void;
  setSuccessWithTimer: (msg: string | null) => void; setSelectedIds: (s: Set<string>) => void;
  loadServices: () => Promise<void>; refreshRouter: () => void; setErrorWithTimer: (msg: string | null) => void;
}

export async function executeImportServices(
  providerId: string,
  selectedIds: Set<string>,
  selectedCategories: Record<string, string>,
  autoMappedCategories: Record<string, string>,
  markup: string,
  targetTenant: 'smmplan' | 'flux' | 'both',
  cb: ExecuteImportCallbacks
) {
  cb.setShowConfirmModal(false);
  cb.setImportProgress({ current: 0, total: selectedIds.size });
  cb.setError(null);
  cb.setImportReport(null);

  const externalIds = Array.from(selectedIds);
  const firstCatId = selectedCategories[externalIds[0]] || autoMappedCategories[externalIds[0]] || '';
  const categoryIdMap: Record<string, string> = {};
  externalIds.forEach((id) => {
    categoryIdMap[id] = selectedCategories[id] || autoMappedCategories[id];
  });

  try {
    const res = await importSelectedServices(
      externalIds,
      firstCatId,
      computeMarkupMultiplier(markup),
      providerId,
      categoryIdMap,
      targetTenant
    );

    if (res.success) {
      if ('report' in res && res.report) cb.setImportReport(res.report);
      const importedCount = 'imported' in res && res.imported !== undefined ? res.imported : externalIds.length;
      const skippedCount = externalIds.length - importedCount;
      cb.setSuccessWithTimer(
        skippedCount > 0
          ? `Импортировано ${importedCount} из ${externalIds.length} услуг. ${skippedCount} пропущено.`
          : `Успешно импортировано ${importedCount} услуг!`
      );
      cb.setSelectedIds(new Set());
      await cb.loadServices();
      cb.refreshRouter();
    } else {
      cb.setErrorWithTimer(res.error || 'Ошибка при импорте услуг');
    }
  } catch {
    cb.setErrorWithTimer('Не удалось выполнить импорт');
  } finally {
    cb.setImportProgress(null);
  }
}
