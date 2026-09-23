import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ExternalServiceItem, CategoryItem, ProviderItem } from '../../types';
import type { ImportServicesResult } from '@/services/admin/catalog.service';
import { DEFAULT_FILTERS, type MixedTypeWarning } from './types';
import { detectMixedCategoryTypes } from './mixed-type-detector';
import { computeReadyAndAttention, computePlatformBreakdown, computeIncompatibleIds } from './wizard-computed-stats';
import { applyAutoMapping, loadPaginatedServices, syncProviderServices, selectAllFilteredServices, executeImportServices } from './wizard-import-handlers';

export function useImportWizardState(initialCategories: CategoryItem[], providers: ProviderItem[]) {
  const router = useRouter();
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(initialCategories);
  const [providerId, setProviderId] = useState<string>(providers[0]?.id || '');
  const [missingCategoryIds, setMissingCategoryIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>('');
  const [services, setServices] = useState<ExternalServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isEmptyCache, setIsEmptyCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [autoMappedCategories, setAutoMappedCategories] = useState<Record<string, string>>({});
  const [aiConfidence, setAiConfidence] = useState<Record<string, boolean>>({});
  const [markup, setMarkup] = useState<string>('200');
  const [targetTenant, setTargetTenant] = useState<'smmplan' | 'flux' | 'both'>('smmplan');
  const [activeTab, setActiveTab] = useState<'ready' | 'attention'>('ready');
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [localSearch, setLocalSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, pageSize: 50 });
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({});
  const [providerCategories, setProviderCategories] = useState<{ name: string; count: number }[]>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [importReport, setImportReport] = useState<ImportServicesResult | null>(null);
  const [selectingAllFiltered, setSelectingAllFiltered] = useState(false);
  const [mixedTypeWarnings, setMixedTypeWarnings] = useState<MixedTypeWarning[]>([]);
  const [showMixedTypeWarning, setShowMixedTypeWarning] = useState(false);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setErrorWithTimer = useCallback((msg: string | null) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (msg) errorTimerRef.current = setTimeout(() => setError(null), 8000);
  }, []);

  const setSuccessWithTimer = useCallback((msg: string | null) => {
    setSuccess(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (msg) successTimerRef.current = setTimeout(() => setSuccess(null), 6000);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.search || '')) setFilters((prev) => ({ ...prev, search: localSearch, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, filters.search]);

  useEffect(() => {
    applyAutoMapping(services, localCategories, setAutoMappedCategories, setAiConfidence, setSelectedCategories);
  }, [services, localCategories]);

  const loadServices = useCallback(async () => {
    await loadPaginatedServices(providerId, filters, {
      setLoading, setError, setIsEmptyCache, setServices, setPagination, setPlatformCounts, setProviderCategories, setErrorWithTimer,
    });
  }, [providerId, filters, setErrorWithTimer]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const handleProviderChange = (nextId: string | null) => {
    if (!nextId || nextId === providerId) return;
    setProviderId(nextId);
    setSelectedIds(new Set());
    setSelectedCategories({});
    setAutoMappedCategories({});
    setAiConfidence({});
    setMissingCategoryIds(new Set());
    setFilters({ ...DEFAULT_FILTERS });
    setLocalSearch('');
    setPagination({ page: 1, totalPages: 1, total: 0, pageSize: 50 });
    setPlatformCounts({});
    setProviderCategories([]);
    setIsEmptyCache(false);
    setError(null);
    setSuccess(null);
    setImportReport(null);
    setShowFilters(false);
  };

  const toggleSelection = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAll = () => {
    const importable = services.filter((s) => !s.alreadyImported);
    const allSelected = importable.every((s) => selectedIds.has(String(s.service)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) importable.forEach((s) => next.delete(String(s.service)));
      else importable.forEach((s) => next.add(String(s.service)));
      return next;
    });
  };

  const handleApplyBulkCategory = () => {
    if (!bulkCategory) return;
    if (selectedIds.size === 0) {
      setErrorWithTimer('Выберите хотя бы одну услугу для массового назначения категории.');
      return;
    }
    const targets = Array.from(selectedIds);
    setSelectedCategories((prev) => {
      const next = { ...prev };
      targets.forEach((id) => { next[id] = bulkCategory; });
      return next;
    });
    setMissingCategoryIds((prev) => {
      const next = new Set(prev);
      targets.forEach((id) => next.delete(id));
      return next;
    });
  };

  const { ready: readyServices, attention: attentionServices } = useMemo(
    () => computeReadyAndAttention(services, selectedCategories, autoMappedCategories, filters.minPrice, filters.maxPrice),
    [services, selectedCategories, autoMappedCategories, filters.minPrice, filters.maxPrice]
  );
  const platformBreakdown = useMemo(() => computePlatformBreakdown(selectedIds, services), [selectedIds, services]);
  const incompatibleIds = useMemo(
    () => computeIncompatibleIds(selectedIds, services, selectedCategories, autoMappedCategories, localCategories),
    [selectedIds, services, selectedCategories, autoMappedCategories, localCategories]
  );

  const handleStartImport = async () => {
    if (selectedIds.size === 0) return;
    const missing = new Set<string>();
    selectedIds.forEach((id) => {
      const catId = selectedCategories[id] || autoMappedCategories[id];
      if (!catId) missing.add(id);
    });
    if (missing.size > 0) {
      setMissingCategoryIds(missing);
      setErrorWithTimer(`Необходимо сопоставить категорию для ${missing.size} выбранных услуг перед импортом.`);
      return;
    }
    const warnings = detectMixedCategoryTypes(selectedIds, services, selectedCategories, autoMappedCategories, localCategories);
    if (warnings.length > 0 && !showMixedTypeWarning) {
      setMixedTypeWarnings(warnings);
      setShowMixedTypeWarning(true);
      return;
    }
    setShowMixedTypeWarning(false);
    setMixedTypeWarnings([]);
    setShowConfirmModal(true);
  };

  return {
    localCategories, setLocalCategories, handleCategoryCreated: (c: CategoryItem) => setLocalCategories((p) => (p.some((x) => x.id === c.id) ? p : [...p, c])),
    providerId, setProviderId, handleProviderChange,
    services, loading, syncing, isEmptyCache, error, success, setError, setSuccess, setSuccessWithTimer, setErrorWithTimer,
    selectedIds, setSelectedIds, toggleSelection, toggleAll,
    handleSelectAllFiltered: () => selectAllFilteredServices(providerId, filters, { setSelectingAllFiltered, setSelectedIds, setSuccessWithTimer, setErrorWithTimer }),
    selectingAllFiltered, selectedCategories, setSelectedCategories, autoMappedCategories, aiConfidence,
    bulkCategory, setBulkCategory, handleApplyBulkCategory, missingCategoryIds, setMissingCategoryIds,
    markup, setMarkup, targetTenant, setTargetTenant, activeTab, setActiveTab,
    filters, setFilters, localSearch, setLocalSearch, resetFilters: () => { setFilters({ ...DEFAULT_FILTERS }); setLocalSearch(''); setShowFilters(false); },
    pagination, platformCounts, providerCategories, importProgress,
    showConfirmModal, setShowConfirmModal, showFilters, setShowFilters, importReport, setImportReport,
    mixedTypeWarnings, setMixedTypeWarnings, showMixedTypeWarning, setShowMixedTypeWarning,
    readyServices, attentionServices, platformBreakdown, incompatibleIds,
    handleExcludeIncompatible: () => setSelectedIds((p) => { const n = new Set(p); incompatibleIds.forEach((id) => n.delete(id)); return n; }),
    handleSyncCache: () => syncProviderServices(providerId, { setSyncing, setErrorWithTimer, setSuccessWithTimer, setIsEmptyCache, loadServices }),
    handleStartImport,
    handleConfirmImport: () => executeImportServices(providerId, selectedIds, selectedCategories, autoMappedCategories, markup, targetTenant, { setShowConfirmModal, setImportProgress, setError, setImportReport, setSuccessWithTimer, setSelectedIds, loadServices, refreshRouter: () => router.refresh(), setErrorWithTimer }),
    loadServices,
  };
}
