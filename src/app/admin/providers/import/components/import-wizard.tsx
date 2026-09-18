'use client';

import { inferTargetTypeFromName, inferTargetTypeFromCategory, isTargetTypeCompatible } from '@/utils/target-type';
import { useState, useEffect, useCallback, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  fetchPaginatedExternalServices,
  importSelectedServices,
  fetchExternalServices,
} from "@/actions/admin/providers/import-cherry-pick";
import { ServicesTable } from "./services-table";
import { SummaryDashboard } from "./summary-dashboard";
import { ConfirmationModal } from "./confirmation-modal";
import { ImportReportCard } from "./import-report-card";
import { Button } from "@/components/ui/button";
import type { ImportServicesResult } from "@/services/admin/catalog.service";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Download, Search, SlidersHorizontal, RotateCcw, Package, ListChecks, CheckSquare, AlertTriangle, ChevronDown, ChevronUp, X, Layers } from "lucide-react";
import type { ExternalServiceItem, CategoryItem, ProviderItem } from "../types";

/* ── AI Auto-Mapping ── */
const autoMapCategory = (s: ExternalServiceItem, categories: CategoryItem[]): { id: string; confident: boolean } | null => {
  // Normalise platform: some providers send 'Vkontakte' or 'vk' instead of 'VK'
  const rawPlatform = (s.metrics?.platform || "").trim();
  const platform = rawPlatform.toUpperCase()
    .replace(/^VKONTAKTE$/, 'VK')
    .replace(/^VK\.COM$/, 'VK');

  const category = (s.metrics?.category || "").toUpperCase();
  const serviceName = (s.name || "").toLowerCase();
  const serviceTargetType = inferTargetTypeFromName(s.name);

  // Filter categories by platform — try both the slug AND the network name
  const platformCategories = categories.filter(c => {
    const netSlug = (c.network?.slug || "").toUpperCase()
      .replace(/^VKONTAKTE$/, 'VK')
      .replace(/^VK\.COM$/, 'VK');
    const netName = (c.network?.name || "").toUpperCase()
      .replace(/ВКОНТАКТЕ/g, 'VK')
      .replace(/ВКОНТАКТE/g, 'VK');
    return netSlug === platform || netName.includes(platform);
  });

  const targetCategories = platformCategories.length > 0 ? platformCategories : categories;

  const keywords = {
    SUBSCRIBERS: ['sub', 'member', 'channel', 'group', 'joiner', 'follower', 'подпис', 'участ', 'друг', 'фолловер', 'читател', 'инвайт', 'буст', 'boost'],
    LIKES: ['like', 'heart', 'favorite', 'upvote', 'лайк', 'нравится', 'сердеч', 'клас'],
    VIEWS: ['view', 'play', 'impression', 'reach', 'просм', 'показ', 'глаз', 'видео', 'стат'],
    REPOSTS: ['repost', 'share', 'retweet', 'репост', 'подели'],
    REACTIONS: ['react', 'emoji', 'fire', 'thumb', 'реакц', 'эмод'],
    COMMENTS: ['comment', 'reply', 'custom comment', 'коммен', 'отзыв'],
    STORIES: ['story', 'stories', 'сторис'],
    // Added: опросы/голоса
    POLLS: ['poll', 'vote', 'votes', 'опрос', 'голос', 'голоса', 'голосов'],
  };

  let bestCategory: CategoryItem | null = null;
  let maxScore = -1;

  for (const c of targetCategories) {
    const catSlug = ((c.slug || c.id) || "").toUpperCase();
    const catName = (c.name || "").toLowerCase();
    const catTargetType = inferTargetTypeFromCategory(c.name);

    if (!isTargetTypeCompatible(serviceTargetType, catTargetType)) {
      continue;
    }

    let score = 0;

    if (category && keywords[category as keyof typeof keywords]) {
      const words = keywords[category as keyof typeof keywords];
      const matchesCat = words.some(w => catSlug.includes(w.toUpperCase()) || catName.includes(w));
      if (matchesCat) {
        score += 25;
      }
    }

    for (const [, words] of Object.entries(keywords)) {
      const serviceMatches = words.some(w => serviceName.includes(w));
      if (serviceMatches) {
        const catMatches = words.some(w => catSlug.includes(w.toUpperCase()) || catName.includes(w));
        if (catMatches) {
          score += 15;
        }
        words.forEach((w: string) => {
          if (serviceName.includes(w) && (catName.includes(w) || catSlug.includes(w.toUpperCase()))) {
            score += 5;
          }
        });
      }
    }

    const nameWords = serviceName.split(/[\s_\-+.#()\/]+/);
    const catWords = catName.split(/[\s_\-+.#()\/]+/);
    nameWords.forEach((nw: string) => {
      if (nw.length > 2 && catWords.includes(nw)) {
        score += 10;
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestCategory = c;
    }
  }

  if (bestCategory && maxScore >= 10) {
    return { id: bestCategory.id, confident: true };
  }

  // Fallback: if platform matched categories exist, return the best scoring one
  // even with score < 10 (score >= 0) so user at least gets the right platform pre-selected
  if (platformCategories.length > 0 && bestCategory && maxScore >= 0) {
    return { id: bestCategory.id, confident: false };
  }

  return { id: "", confident: false };
};

/* ── Mixed-Type Category Detection ─────────────────────────────────────────
 * Detects when multiple services with DIFFERENT normalizedCategory types (e.g.
 * REACTIONS + SUBSCRIBERS + LIKES) are being imported into a SINGLE DB category.
 * This is the root cause of the "all services in one category" bug.
 * ────────────────────────────────────────────────────────────────────────── */
interface MixedTypeWarning {
  targetCategoryId: string;
  targetCategoryName: string;
  types: Array<{ normCategory: string; count: number; examples: string[] }>;
}

const detectMixedCategoryTypes = (
  selectedIds: Set<string>,
  services: ExternalServiceItem[],
  selectedCategories: Record<string, string>,
  autoMappedCategories: Record<string, string>,
  categories: CategoryItem[]
): MixedTypeWarning[] => {
  // Group selected services by their target DB category
  const byCatId: Record<string, Array<{ normCat: string; name: string }>> = {};

  selectedIds.forEach(id => {
    const svc = services.find(s => String(s.service) === id);
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
    entries.forEach(e => {
      if (!typeCounts[e.normCat]) typeCounts[e.normCat] = [];
      typeCounts[e.normCat].push(e.name);
    });

    const distinctTypes = Object.keys(typeCounts);
    if (distinctTypes.length <= 1) continue; // OK — single type

    const cat = categories.find(c => c.id === catId);
    warnings.push({
      targetCategoryId: catId,
      targetCategoryName: cat?.name || catId,
      types: distinctTypes.map(t => ({
        normCategory: t,
        count: typeCounts[t].length,
        examples: typeCounts[t].slice(0, 2),
      })),
    });
  }

  return warnings;
};

/* ── Platform Tabs ── */
const PLATFORM_TABS = [
  { id: "ALL", name: "Все", icon: "🌐" },
  { id: "telegram", name: "Telegram", icon: "✈️" },
  { id: "instagram", name: "Instagram", icon: "📸" },
  { id: "vk", name: "ВКонтакте", icon: "💙" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "tiktok", name: "TikTok", icon: "🎵" },
  { id: "other", name: "Другие", icon: "⚙️" },
];

/* ── PATCH P1-7: unified markup display helper ── */
function formatMarkupLabel(markupStr: string): string {
  const p = parseFloat(markupStr);
  if (isNaN(p) || p < 0) return '×3.0';
  if (p === 0) return 'авто';
  const multiplier = Math.round((1 + p / 100) * 100) / 100;
  return `×${multiplier.toFixed(2).replace(/\.?0+$/, '')}`;
}

function computeMarkupMultiplier(markupStr: string): number {
  const p = parseFloat(markupStr);
  if (isNaN(p) || p < 0) return 3.0;
  if (p === 0) return 0; // auto-pricing signal
  return Math.round((1 + p / 100) * 100) / 100;
}

const DEFAULT_FILTERS = {
  page: 1,
  pageSize: 50,
  platform: "ALL",
  geo: "ALL",
  velocity: "ALL",
  hasRefill: false,
  hasAnomaly: false,
  importStatus: "NOT_IMPORTED",
  search: "",
  sortBy: "none",
  category: "ALL",
  retailReady: false,
  providerCategory: "ALL",
  minPrice: "",
  maxPrice: "",
};

/* ═══════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════ */
export function ImportWizard({ categories: initialCategories, providers }: { categories: CategoryItem[]; providers: ProviderItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local categories — can be extended by on-the-fly category creation
  const [localCategories, setLocalCategories] = useState<CategoryItem[]>(initialCategories);

  // Core state
  const [providerId, setProviderId] = useState<string>(providers[0]?.id || "");
  const [missingCategoryIds, setMissingCategoryIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [services, setServices] = useState<ExternalServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isEmptyCache, setIsEmptyCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Selection & mapping
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [autoMappedCategories, setAutoMappedCategories] = useState<Record<string, string>>({});
  const [aiConfidence, setAiConfidence] = useState<Record<string, boolean>>({});
  const [markup, setMarkup] = useState<string>("200");
  const [targetTenant, setTargetTenant] = useState<'smmplan' | 'flux' | 'both'>('smmplan');

  // Handler for on-the-fly category creation from the category select
  const handleCategoryCreated = (newCategory: CategoryItem) => {
    setLocalCategories(prev => {
      // Avoid duplicates
      if (prev.some(c => c.id === newCategory.id)) return prev;
      return [...prev, newCategory];
    });
  };

  // Filters
  /* PATCH P0-2: activeTab now has a setter that is actually called from UI */
  const [activeTab, setActiveTab] = useState<"ready" | "attention">("ready");
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [localSearch, setLocalSearch] = useState("");
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, pageSize: 50 });
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>({});
  const [providerCategories, setProviderCategories] = useState<{ name: string; count: number }[]>([]);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  /* PATCH P0-1: showFilters state now has an actual panel */
  const [showFilters, setShowFilters] = useState(false);
  const [importReport, setImportReport] = useState<ImportServicesResult | null>(null);
  /* PATCH P0-3: select-all-filtered loading state */
  const [selectingAllFiltered, setSelectingAllFiltered] = useState(false);
  /* CATEGORY-FIX: mixed-type category detection state */
  const [mixedTypeWarnings, setMixedTypeWarnings] = useState<MixedTypeWarning[]>([]);
  const [showMixedTypeWarning, setShowMixedTypeWarning] = useState(false);


  // PATCH P1-6: ref for auto-dismiss
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if any filters are active (excluding page/pageSize)
  const isFiltersActive = useMemo(() => {
    return (
      filters.platform !== "ALL" ||
      filters.geo !== "ALL" ||
      filters.velocity !== "ALL" ||
      filters.hasRefill !== false ||
      filters.hasAnomaly !== false ||
      filters.importStatus !== "NOT_IMPORTED" ||
      filters.search !== "" ||
      filters.sortBy !== "none" ||
      filters.category !== "ALL" ||
      filters.retailReady !== false ||
      filters.providerCategory !== "ALL" ||
      filters.minPrice !== "" ||
      filters.maxPrice !== ""
    );
  }, [filters]);

  // PATCH P1-6: auto-dismiss notifications
  const setErrorWithTimer = useCallback((msg: string | null) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    if (msg) {
      errorTimerRef.current = setTimeout(() => setError(null), 8000);
    }
  }, []);

  const setSuccessWithTimer = useCallback((msg: string | null) => {
    setSuccess(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (msg) {
      successTimerRef.current = setTimeout(() => setSuccess(null), 6000);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.search || "")) {
        setFilters((prev) => ({ ...prev, search: localSearch, page: 1 }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, filters.search]);

  // Auto-mapping on services load
  useEffect(() => {
    if (services.length > 0) {
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
  }, [services, localCategories]);

  // Load paginated services from Redis cache
  const loadServices = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);
    setIsEmptyCache(false);

    try {
      const { page: _p, pageSize: _ps, ...restFilters } = filters;
      const res = await fetchPaginatedExternalServices(
        providerId,
        restFilters,
        filters.page,
        filters.pageSize
      );

      if (res.success && res.data) {
        setServices(res.data);
        if (res.pagination) setPagination(res.pagination);
        if (res.platformCounts) setPlatformCounts(res.platformCounts);
        if (res.providerCategories) setProviderCategories(res.providerCategories);
      } else if ('emptyCache' in res && res.emptyCache) {
        setIsEmptyCache(true);
        setServices([]);
      } else {
        setErrorWithTimer(res.error || "Не удалось загрузить услуги");
        setServices([]);
      }
    } catch {
      setErrorWithTimer("Ошибка соединения при загрузке услуг");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [providerId, filters, setErrorWithTimer]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Sync cache with provider
  const handleSyncCache = async () => {
    if (!providerId) return;
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchExternalServices(providerId);
      if (res.success) {
        setSuccessWithTimer(`Синхронизировано ${"count" in res ? res.count : 0} услуг`);
        setIsEmptyCache(false);
        await loadServices();
      } else {
        setErrorWithTimer('error' in res ? res.error : "Ошибка синхронизации");
      }
    } catch {
      setErrorWithTimer("Не удалось синхронизировать каталог провайдера");
    } finally {
      setSyncing(false);
    }
  };

  // AUD-02: switch import source provider — resets selection, mapping and filters
  const handleProviderChange = (nextId: string | null) => {
    if (!nextId || nextId === providerId) return;
    setProviderId(nextId);
    setSelectedIds(new Set());
    setSelectedCategories({});
    setAutoMappedCategories({});
    setAiConfidence({});
    setMissingCategoryIds(new Set());
    setFilters({ ...DEFAULT_FILTERS });
    setLocalSearch("");
    setPagination({ page: 1, totalPages: 1, total: 0, pageSize: 50 });
    setPlatformCounts({});
    setProviderCategories([]);
    setIsEmptyCache(false);
    setError(null);
    setSuccess(null);
    setImportReport(null);
    setShowFilters(false);
  };

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const importable = services.filter((s) => !s.alreadyImported);
    const allSelected = importable.every((s) => selectedIds.has(String(s.service)));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        importable.forEach((s) => next.delete(String(s.service)));
      } else {
        importable.forEach((s) => next.add(String(s.service)));
      }
      return next;
    });
  };

  /* PATCH P0-3: "Select all filtered" — now actually called from UI */
  const handleSelectAllFiltered = async () => {
    try {
      setSelectingAllFiltered(true);
      const { page: _p, pageSize: _ps, ...restFilters } = filters;
      const res = await fetchPaginatedExternalServices(
        providerId,
        restFilters,
        1,
        5000
      );
      if (res.success && res.data) {
        const idsToAdd = res.data
          .filter((s: ExternalServiceItem) => !s.alreadyImported)
          .map((s: ExternalServiceItem) => String(s.service));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          idsToAdd.forEach((id: string) => next.add(id));
          return next;
        });
        setSuccessWithTimer(`${idsToAdd.length} услуг выбрано по текущим фильтрам`);
      }
    } catch {
      setErrorWithTimer("Не удалось выбрать все отфильтрованные услуги");
    } finally {
      setSelectingAllFiltered(false);
    }
  };

  // AUD-15 (2.5): bulk-assign covers ALL selected services across pages
  const handleApplyBulkCategory = () => {
    if (!bulkCategory) return;
    if (selectedIds.size === 0) {
      setErrorWithTimer("Выберите хотя бы одну услугу для массового назначения категории.");
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

  // Reset filters
  const resetFilters = () => {
    setFilters({ ...DEFAULT_FILTERS });
    setLocalSearch("");
    setShowFilters(false);
  };

  // Ready vs Attention counts
  const readyServices = useMemo(() => {
    return services.filter((s) => {
      const catId = selectedCategories[String(s.service)] || autoMappedCategories[String(s.service)];
      const minPrice = parseFloat(filters.minPrice) || 0;
      const maxPrice = parseFloat(filters.maxPrice) || Infinity;
      const isPriceValid = (s.pricePerUnitProcurementRub ?? 0) >= minPrice && (s.pricePerUnitProcurementRub ?? 0) <= maxPrice;
      return !!catId && isPriceValid;
    });
  }, [services, selectedCategories, autoMappedCategories, filters.minPrice, filters.maxPrice]);

  const attentionServices = useMemo(() => {
    return services.filter((s) => {
      const catId = selectedCategories[String(s.service)] || autoMappedCategories[String(s.service)];
      const minPrice = parseFloat(filters.minPrice) || 0;
      const maxPrice = parseFloat(filters.maxPrice) || Infinity;
      const isPriceValid = (s.pricePerUnitProcurementRub ?? 0) >= minPrice && (s.pricePerUnitProcurementRub ?? 0) <= maxPrice;
      return !catId || !isPriceValid || s.metrics?.priceAnomaly;
    });
  }, [services, selectedCategories, autoMappedCategories, filters.minPrice, filters.maxPrice]);

  /* PATCH P1-1: compute platform breakdown for confirmation modal */
  const platformBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedIds.forEach(id => {
      const svc = services.find(s => String(s.service) === id);
      if (!svc) return;
      const platform = (svc.metrics?.platform || 'other').toLowerCase();
      counts[platform] = (counts[platform] || 0) + 1;
    });
    const iconMap: Record<string, string> = {
      telegram: '✈️', instagram: '📸', vk: '💙', youtube: '▶️', tiktok: '🎵',
    };
    const nameMap: Record<string, string> = {
      telegram: 'Telegram', instagram: 'Instagram', vk: 'ВКонтакте', youtube: 'YouTube', tiktok: 'TikTok',
    };
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        name: nameMap[key] || key,
        icon: iconMap[key] || '🌐',
        count,
      }));
  }, [selectedIds, services]);

  // Import Execution
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

    // CATEGORY-FIX: detect mixed activity types going into the same DB category
    const warnings = detectMixedCategoryTypes(
      selectedIds,
      services,
      selectedCategories,
      autoMappedCategories,
      localCategories
    );

    if (warnings.length > 0 && !showMixedTypeWarning) {
      // Show warning banner first — user must explicitly acknowledge and click again
      setMixedTypeWarnings(warnings);
      setShowMixedTypeWarning(true);
      return;
    }

    // Reset warning flag after user acknowledges
    setShowMixedTypeWarning(false);
    setMixedTypeWarnings([]);
    setShowConfirmModal(true);
  };


  const handleConfirmImport = async () => {
    setShowConfirmModal(false);
    setImportProgress({ current: 0, total: selectedIds.size });
    setError(null);
    setImportReport(null);

    const externalIds = Array.from(selectedIds);
    const firstCatId = selectedCategories[externalIds[0]] || autoMappedCategories[externalIds[0]] || "";
    const categoryIdMap: Record<string, string> = {};
    externalIds.forEach(id => {
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
        if ('report' in res && res.report) {
          setImportReport(res.report);
        }
        const importedCount = "imported" in res && res.imported !== undefined ? res.imported : externalIds.length;
        const skippedCount = externalIds.length - importedCount;
        setSuccessWithTimer(
          skippedCount > 0
            ? `Импортировано ${importedCount} из ${externalIds.length} услуг. ${skippedCount} пропущено.`
            : `Успешно импортировано ${importedCount} услуг!`
        );
        setSelectedIds(new Set());
        await loadServices();
        router.refresh();
      } else {
        setErrorWithTimer(res.error || "Ошибка при импорте услуг");
      }
    } catch {
      setErrorWithTimer("Не удалось выполнить импорт");
    } finally {
      setImportProgress(null);
    }
  };

  // Incompatible services computation
  const incompatibleIds = useMemo(() => {
    const set = new Set<string>();
    selectedIds.forEach((id) => {
      const svc = services.find((s) => String(s.service) === id);
      const catId = selectedCategories[id] || autoMappedCategories[id];
      if (svc && catId) {
        const cat = localCategories.find((c) => c.id === catId);
        if (cat) {
          const serviceType = inferTargetTypeFromName(svc.name);
          const catType = inferTargetTypeFromCategory(cat.name);
          if (!isTargetTypeCompatible(serviceType, catType)) {
            set.add(id);
          }
        }
      }
    });
    return set;
  }, [selectedIds, services, selectedCategories, autoMappedCategories, localCategories]);

  const handleExcludeIncompatible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      incompatibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  /* PATCH P1-4: categories grouped by network for Select */
  const categoriesByNetwork = useMemo(() => {
    const groups: Record<string, CategoryItem[]> = {};
    const ordered: string[] = [];
    for (const cat of localCategories) {
      const netName = cat.network?.name || 'Без сети';
      if (!groups[netName]) {
        groups[netName] = [];
        ordered.push(netName);
      }
      groups[netName].push(cat);
    }
    return ordered.map(name => ({ network: name, items: groups[name] }));
  }, [localCategories]);

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-6">
      {/* ── Provider Selector ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Источник импорта</div>
            <div className="text-xs text-muted-foreground truncate">
              Каталог загружается с выбранной панели{providers.length > 0 ? ` (доступно: ${providers.length})` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={providerId} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-[260px] h-10 text-sm font-semibold" aria-label="Выбор провайдера для импорта">
              <SelectValue placeholder="Выберите провайдера...">
                {(val: string) => {
                  const provider = providers.find((p) => p.id === val);
                  return provider ? provider.name : val || "Выберите провайдера...";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id} value={p.id} label={p.name} className="text-sm cursor-pointer">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Top Controls & Summary ── */}
      <SummaryDashboard
        totalInCache={pagination.total}
        newServices={services.filter(s => !s.alreadyImported).length}
        aiReady={readyServices.length}
        needsAttention={attentionServices.length}
        alreadyImported={services.filter(s => s.alreadyImported).length}
        selectedCount={selectedIds.size}
        markup={markup}
        onMarkupChange={setMarkup}
        onImport={handleStartImport}
        onResync={handleSyncCache}
        importDisabled={selectedIds.size === 0 || syncing}
        syncing={syncing}
        importProgress={importProgress}
        providerName={providers.find(p => p.id === providerId)?.name || "Провайдер"}
        /* PATCH P0-2: clickable tab switches */
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* ── Notifications (with auto-dismiss) ── */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-destructive/20 rounded-lg transition-colors cursor-pointer" title="Закрыть">
              <X className="w-3.5 h-3.5" />
            </button>
            {missingCategoryIds.size > 0 && bulkCategory && (
              <button
                type="button"
                onClick={() => {
                  const ids = Array.from(missingCategoryIds);
                  const catName = localCategories.find((c: CategoryItem) => c.id === bulkCategory)?.name || 'выбранная категория';
                  setSelectedCategories((prev) => {
                    const next = { ...prev };
                    ids.forEach((id) => { next[id] = bulkCategory; });
                    return next;
                  });
                  setMissingCategoryIds(new Set());
                  setError(null);
                  setSuccessWithTimer(`Категория «${catName}» назначена ${ids.length} нераспределённым услугам.`);
                }}
                className="px-3 py-1.5 rounded-lg bg-destructive text-white text-xs font-bold hover:opacity-90 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
              >
                Назначить всем нераспределённым ({missingCategoryIds.size})
              </button>
            )}
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center justify-between gap-3">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="p-1 hover:bg-emerald-500/20 rounded-lg transition-colors cursor-pointer" title="Закрыть">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Post-import report ── */}
      {importReport && (
        <ImportReportCard report={importReport} onClose={() => setImportReport(null)} />
      )}

      {/* ── CATEGORY-FIX: Mixed Activity Types Warning Banner ── */}
      {showMixedTypeWarning && mixedTypeWarnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                ⚠️ Обнаружено смешение типов услуг в одной категории
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70 mt-1">
                Вы импортируете услуги разных типов (подписчики, реакции, лайки и т.д.) в одну категорию.
                Это приведёт к тому, что в визарде заказа пользователь увидит всё вперемешку.
              </p>
              <div className="mt-3 space-y-2">
                {mixedTypeWarnings.map((w, wi) => (
                  <div key={wi} className="bg-amber-500/10 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
                      Категория: «{w.targetCategoryName}»
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {w.types.map((t, ti) => (
                        <span
                          key={ti}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          title={`Примеры: ${t.examples.join(', ')}`}
                        >
                          {t.normCategory} ({t.count} шт)
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60 mt-1.5">
                      💡 Рекомендация: создайте отдельные категории (Подписчики {w.targetCategoryName.split(' ').pop()}, Реакции {w.targetCategoryName.split(' ').pop()}) или запустите скрипт исправления данных.
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => { setShowMixedTypeWarning(false); setMixedTypeWarnings([]); handleStartImport(); }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
                >
                  Всё равно импортировать
                </button>
                <button
                  onClick={() => { setShowMixedTypeWarning(false); setMixedTypeWarnings([]); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                >
                  Отмена — исправить категории
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Table Container ── */}
      <div className="flex flex-col gap-4">
        {/* Search, Filters Toggle, & Bulk Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Поиск по названию услуги..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {/* PATCH P0-1: filter toggle button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
                isFiltersActive ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
              }`}
              aria-expanded={showFilters}
              aria-controls="import-filters-panel"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Фильтры</span>
            </button>
            {isFiltersActive && (
              <button
                onClick={resetFilters}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Сбросить все фильтры"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            {incompatibleIds.size > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                ⚠️ {incompatibleIds.size} конфликт типов
              </span>
            )}
          </div>

          {/* Bulk Category Assigner + Select All Filtered */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* PATCH P0-3: Select all filtered button */}
            <button
              onClick={handleSelectAllFiltered}
              disabled={selectingAllFiltered || loading}
              title="Выбрать все услуги, соответствующие текущим фильтрам (до 5000)"
              className="px-3 py-2 bg-card border border-border hover:bg-muted disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {selectingAllFiltered ? (
                <span className="animate-spin text-xs">⏳</span>
              ) : (
                <ListChecks className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Выбрать все по фильтрам</span>
              <span className="sm:hidden">Все</span>
            </button>
            <Select value={bulkCategory} onValueChange={(val) => setBulkCategory(val || "")}>
              <SelectTrigger className="w-[200px] h-9 text-xs">
                <SelectValue placeholder="Массовая категория...">
                  {(val: string) => {
                    const cat = localCategories.find((c) => c.id === val);
                    return cat ? `${(cat.network?.name || '')} • ${cat.name}` : val || "Массовая категория...";
                  }}
                </SelectValue>
              </SelectTrigger>
              {/* PATCH P1-4: grouped categories */}
              <SelectContent>
                {categoriesByNetwork.map(group => (
                  <SelectGroup key={group.network}>
                    <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                      {group.network}
                    </SelectLabel>
                    {group.items.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} label={cat.name} className="text-xs cursor-pointer">
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handleApplyBulkCategory}
              disabled={!bulkCategory}
              title="Категория будет назначена всем выбранным услугам (включая выбранные на других страницах)"
              className="px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Назначить ({selectedIds.size || services.length})
            </button>
            <a
              href="/admin/catalog/categories"
              target="_blank"
              rel="noopener noreferrer"
              title="Открыть управление категориями и соцсетями в новой вкладке"
              className="px-2.5 py-2 bg-card border border-border hover:bg-muted text-muted-foreground hover:text-primary text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ Категории</span>
            </a>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PATCH P0-1: Extended Filters Panel (was missing entirely)
           ═══════════════════════════════════════════════════════════════ */}
        {showFilters && (
          <div
            id="import-filters-panel"
            className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Расширенные фильтры</span>
              <button
                onClick={() => setShowFilters(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Закрыть фильтры"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Row 1: Provider Category + Import Status + Velocity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Provider Category filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Категория провайдера</label>
                <Select
                  value={filters.providerCategory}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, providerCategory: val || 'ALL', page: 1 }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Все категории" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="ALL" className="text-xs">Все категории</SelectItem>
                    {providerCategories.map(pc => (
                      <SelectItem key={pc.name} value={pc.name} className="text-xs">
                        {pc.name} ({pc.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Import Status filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Статус импорта</label>
                <Select
                  value={filters.importStatus}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, importStatus: val || 'NOT_IMPORTED', page: 1 }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_IMPORTED" className="text-xs">Не импортированы</SelectItem>
                    <SelectItem value="IMPORTED" className="text-xs">Уже импортированы</SelectItem>
                    <SelectItem value="ALL" className="text-xs">Все</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Velocity filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Скорость выполнения</label>
                <Select
                  value={filters.velocity}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, velocity: val || 'ALL', page: 1 }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">Любая</SelectItem>
                    <SelectItem value="FAST" className="text-xs">Быстрая (50+ шт/ч)</SelectItem>
                    <SelectItem value="MEDIUM" className="text-xs">Средняя (10–50 шт/ч)</SelectItem>
                    <SelectItem value="SLOW" className="text-xs">Медленная (до 10 шт/ч)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: GEO + Price Range + Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* GEO filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">ГЕО</label>
                <Select
                  value={filters.geo}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, geo: val || 'ALL', page: 1 }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Любое" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="ALL" className="text-xs">Любое ГЕО</SelectItem>
                    <SelectItem value="RU" className="text-xs">🇷🇺 Россия</SelectItem>
                    <SelectItem value="UA" className="text-xs">🇺🇦 Украина</SelectItem>
                    <SelectItem value="KZ" className="text-xs">🇰🇿 Казахстан</SelectItem>
                    <SelectItem value="BY" className="text-xs">🇧🇾 Беларусь</SelectItem>
                    <SelectItem value="WORLDWIDE" className="text-xs">🌍 Весь мир</SelectItem>
                    <SelectItem value="REAL" className="text-xs">👤 Реальные</SelectItem>
                    <SelectItem value="MIXED" className="text-xs">🔄 Смешанное</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Price Range */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Цена закупки (₽/шт)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="от"
                    value={filters.minPrice}
                    onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value, page: 1 }))}
                    className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
                  />
                  <span className="text-muted-foreground text-xs">—</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="до"
                    value={filters.maxPrice}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value, page: 1 }))}
                    className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
                  />
                </div>
              </div>

              {/* Boolean toggles */}
              <div className="space-y-2 pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.hasRefill}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasRefill: e.target.checked, page: 1 }))}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-foreground">С гарантией / рефиллом</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.hasAnomaly}
                    onChange={(e) => setFilters(prev => ({ ...prev, hasAnomaly: e.target.checked, page: 1 }))}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-foreground">С аномалией цены</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filters.retailReady}
                    onChange={(e) => setFilters(prev => ({ ...prev, retailReady: e.target.checked, page: 1 }))}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-foreground">Мин. заказ ≤ 100 шт</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Platform Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
          {PLATFORM_TABS.map((tab) => {
            const count = platformCounts[tab.id.toLowerCase()] || 0;
            const isActive = filters.platform.toLowerCase() === tab.id.toLowerCase();
            return (
              <button
                key={tab.id}
                onClick={() => setFilters((prev) => ({ ...prev, platform: tab.id, page: 1 }))}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Services Table */}
        {isEmptyCache ? (
          <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-foreground">Каталог провайдера пуст</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Теневой каталог выбранного провайдера ещё не загружен в базу. Нажмите «Загрузить каталог»,
                чтобы синхронизироваться с API панели — после этого здесь появится список услуг для выбора.
              </p>
            </div>
            <Button
              intent="primary"
              onClick={handleSyncCache}
              disabled={syncing}
              className="h-10 px-6 font-semibold text-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {syncing ? "Загрузка каталога..." : "Загрузить каталог"}
            </Button>
          </div>
        ) : (
          <ServicesTable
            services={activeTab === "ready" ? readyServices : attentionServices}
            selectedIds={selectedIds}
            toggleSelection={toggleSelection}
            toggleAll={toggleAll}
            loading={loading}
            filters={filters}
            setFilters={setFilters}
            pagination={pagination}
            /* PATCH P1-2: when markup=0, send 0 (auto) instead of 3.0 */
            markup={computeMarkupMultiplier(markup)}
            isAutoMarkup={parseFloat(markup) === 0}
            categories={localCategories}
            categoriesByNetwork={categoriesByNetwork}
            selectedCategories={selectedCategories}
            onCategoryCreated={handleCategoryCreated}
            onCategoryChange={(svcId, catId) => {
              setSelectedCategories((prev) => ({ ...prev, [svcId]: catId }));
              setMissingCategoryIds((prev) => {
                const next = new Set(prev);
                next.delete(svcId);
                return next;
              });
            }}
            autoMappedCategories={autoMappedCategories}
            aiConfidence={aiConfidence}
            showCategoryColumn={true}
            validationErrors={missingCategoryIds}
          />
        )}
      </div>

      {/* Confirmation Modal — PATCH P1-1: real platformBreakdown */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmImport}
        selectedCount={selectedIds.size}
        /* PATCH P1-7: pass raw percentage, modal formats it */
        markup={parseFloat(markup) ?? 0}
        platformBreakdown={platformBreakdown}
        isPending={isPending}
        targetTenant={targetTenant}
        onTargetTenantChange={setTargetTenant}
        incompatibleCount={incompatibleIds.size}
        onExcludeIncompatible={handleExcludeIncompatible}
      />
    </div>
  );
}
