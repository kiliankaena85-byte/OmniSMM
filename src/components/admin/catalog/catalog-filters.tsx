'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, RotateCcw, EyeOff, Eye } from 'lucide-react';
import { SocialIcon } from '@/components/ui/SocialIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FilterCategoryItem {
  id: string;
  name: string;
  serviceCount?: number;
  _count?: { services: number };
  network?: {
    id?: string;
    name: string;
    slug?: string;
  } | null;
}

export interface FilterProviderItem {
  id: string;
  name: string;
}

export interface FilterNetworkItem {
  id: string;
  name: string;
  slug: string;
}

export function formatCleanCategoryName(categoryName?: string, networkName?: string): string {
  if (!categoryName) return '—';
  let clean = categoryName.trim();
  if (networkName) {
    const netPattern = new RegExp(`^${networkName.trim()}\\s*[-–—:]?\\s*`, 'i');
    clean = clean.replace(netPattern, '');
  }
  clean = clean.replace(/^(Telegram|ВКонтакте|VK|Instagram|YouTube|TikTok|Rutube|Discord|Facebook|Twitter|Twitch|TenChat|Яндекс|OK|Threads)\\s*[-–—:]?\\s*/i, '');
  return clean.trim() || categoryName;
}

export const formatCleanActivityName = formatCleanCategoryName;

interface CatalogFiltersProps {
  categories: FilterCategoryItem[];
  providers: FilterProviderItem[];
  networks?: FilterNetworkItem[];
  selectedTenant?: string;
}

export function CatalogFilters({ categories, providers, selectedTenant }: CatalogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL state
  const selectedPlatform = searchParams.get('platform') || 'ALL';
  const currentCategory = searchParams.get('category') || 'all';
  const currentSearch = searchParams.get('q') || '';
  const currentProviderId = searchParams.get('providerId') || 'all';
  const currentIsActive = searchParams.get('isActive') || 'all';
  const currentProviderStatus = searchParams.get('providerStatus') || 'all';
  const currentExternalId = searchParams.get('externalId') || '';
  const currentHideDeleted = searchParams.get('hideDeleted') === 'true';

  // Local state for fast typing
  const [localSearch, setLocalSearch] = useState(currentSearch);
  const [localExternalId, setLocalExternalId] = useState(currentExternalId);
  const [localPlatform, setLocalPlatform] = useState(selectedPlatform);
  const [localCategory, setLocalCategory] = useState(currentCategory);
  const [localProviderId, setLocalProviderId] = useState(currentProviderId);
  const [localIsActive, setLocalIsActive] = useState(currentIsActive);
  const [localProviderStatus, setLocalProviderStatus] = useState(currentProviderStatus);
  const [localHideDeleted, setLocalHideDeleted] = useState(currentHideDeleted);

  // Sync with URL when external navigation happens
  useEffect(() => {
    setLocalSearch(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    setLocalExternalId(currentExternalId);
  }, [currentExternalId]);

  useEffect(() => {
    setLocalPlatform(selectedPlatform);
  }, [selectedPlatform]);

  useEffect(() => {
    setLocalCategory(currentCategory);
  }, [currentCategory]);

  useEffect(() => {
    setLocalProviderId(currentProviderId);
  }, [currentProviderId]);

  useEffect(() => {
    setLocalIsActive(currentIsActive);
  }, [currentIsActive]);

  useEffect(() => {
    setLocalProviderStatus(currentProviderStatus);
  }, [currentProviderStatus]);

  useEffect(() => {
    setLocalHideDeleted(currentHideDeleted);
  }, [currentHideDeleted]);

  // Extract unique networks from categories
  const networksList = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    categories.forEach(c => {
      if (c.network?.slug) {
        map.set(c.network.slug, { slug: c.network.slug, name: c.network.name });
      }
    });
    return Array.from(map.values());
  }, [categories]);

  // Cascading categories for selected platform
  const filteredCategories = useMemo(() => {
    let list = categories;
    if (localPlatform !== 'ALL') {
      list = categories.filter(c => c.network?.slug === localPlatform);
    }
    return [...list].sort((a, b) => {
      const countA = a.serviceCount ?? a._count?.services ?? 0;
      const countB = b.serviceCount ?? b._count?.services ?? 0;
      if ((countA > 0) !== (countB > 0)) {
        return countB - countA;
      }
      const netA = a.network?.name || '';
      const netB = b.network?.name || '';
      if (netA !== netB) return netA.localeCompare(netB);
      return a.name.localeCompare(b.name);
    });
  }, [categories, localPlatform]);

  // Unified filter applicator
  const pushFilters = (overrides?: {
    search?: string;
    extId?: string;
    platform?: string;
    category?: string;
    provider?: string;
    active?: string;
    providerStat?: string;
    hideDel?: boolean;
  }) => {
    const params = new URLSearchParams();
    const currentTenant = searchParams.get('tenant') || selectedTenant;
    if (currentTenant) params.set('tenant', currentTenant);

    const s = overrides?.search !== undefined ? overrides.search : localSearch;
    const ext = overrides?.extId !== undefined ? overrides.extId : localExternalId;
    const plat = overrides?.platform !== undefined ? overrides.platform : localPlatform;
    const cat = overrides?.category !== undefined ? overrides.category : localCategory;
    const prov = overrides?.provider !== undefined ? overrides.provider : localProviderId;
    const act = overrides?.active !== undefined ? overrides.active : localIsActive;
    const pStat = overrides?.providerStat !== undefined ? overrides.providerStat : localProviderStatus;
    const hDel = overrides?.hideDel !== undefined ? overrides.hideDel : localHideDeleted;

    if (s.trim()) params.set('q', s.trim());
    if (ext.trim()) params.set('externalId', ext.trim());
    if (plat !== 'ALL') params.set('platform', plat);
    if (cat !== 'all') params.set('category', cat);
    if (prov !== 'all') params.set('providerId', prov);
    if (act !== 'all') params.set('isActive', act);
    if (pStat !== 'all') params.set('providerStatus', pStat);
    if (hDel) params.set('hideDeleted', 'true');

    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder');
    const pageSize = searchParams.get('pageSize');
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    if (pageSize) params.set('pageSize', pageSize);

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Debounce ref for text inputs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      pushFilters({ search: val });
    }, 350);
  };

  const handleExternalIdChange = (val: string) => {
    setLocalExternalId(val);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      pushFilters({ extId: val });
    }, 350);
  };

  const handlePlatformChange = (plat: string) => {
    setLocalPlatform(plat);
    let nextCat = localCategory;
    if (plat !== 'ALL') {
      const stillValid = categories.some(c => c.id === localCategory && c.network?.slug === plat);
      if (!stillValid) {
        nextCat = 'all';
        setLocalCategory('all');
      }
    }
    pushFilters({ platform: plat, category: nextCat });
  };

  const handleCategoryChange = (cat: string) => {
    setLocalCategory(cat);
    pushFilters({ category: cat });
  };

  const handleProviderChange = (prov: string) => {
    setLocalProviderId(prov);
    pushFilters({ provider: prov });
  };

  const handleIsActiveChange = (act: string) => {
    setLocalIsActive(act);
    pushFilters({ active: act });
  };

  const handleProviderStatusChange = (pStat: string) => {
    setLocalProviderStatus(pStat);
    pushFilters({ providerStat: pStat });
  };

  const handleToggleHideDeleted = () => {
    const nextVal = !localHideDeleted;
    setLocalHideDeleted(nextVal);
    pushFilters({ hideDel: nextVal });
  };

  const resetAllFilters = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setLocalSearch('');
    setLocalExternalId('');
    setLocalPlatform('ALL');
    setLocalCategory('all');
    setLocalProviderId('all');
    setLocalIsActive('all');
    setLocalProviderStatus('all');
    setLocalHideDeleted(false);
    const currentTenant = searchParams.get('tenant');
    const currentPageSize = searchParams.get('pageSize');
    const params = new URLSearchParams();
    if (currentTenant) params.set('tenant', currentTenant);
    if (currentPageSize) params.set('pageSize', currentPageSize);
    const resetUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(resetUrl, { scroll: false });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (localSearch) count++;
    if (localExternalId) count++;
    if (localPlatform !== 'ALL') count++;
    if (localCategory !== 'all') count++;
    if (localProviderId !== 'all') count++;
    if (localIsActive !== 'all') count++;
    if (localProviderStatus !== 'all') count++;
    if (localHideDeleted) count++;
    return count;
  }, [localSearch, localExternalId, localPlatform, localCategory, localProviderId, localIsActive, localProviderStatus, localHideDeleted]);

  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <div className="bg-card/70 backdrop-blur-md border border-border p-3.5 sm:p-4 rounded-xl shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider">
            Фильтр услуг
          </h3>
          
          {/* Quick Toggle: Hide Deleted / Archived */}
          <button
            type="button"
            onClick={handleToggleHideDeleted}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              localHideDeleted
                ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 shadow-2xs'
                : 'bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/80'
            }`}
          >
            {localHideDeleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            <span>{localHideDeleted ? 'Удаленные скрыты' : 'Скрыть удаленные / архив'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 animate-in fade-in duration-200">
              Активно фильтров: {activeFiltersCount}
            </span>
          )}
          <button 
            type="button"
            onClick={resetAllFilters} 
            disabled={!hasActiveFilters}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border ${
              hasActiveFilters
                ? 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20 hover:border-destructive/30 shadow-2xs active:scale-95'
                : 'bg-muted/30 text-muted-foreground/40 border-border/40 cursor-not-allowed opacity-50'
            }`}
            title={hasActiveFilters ? 'Сбросить все выбранные фильтры и поиск' : 'Фильтры не применены'}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-destructive' : ''}`} />
            <span>Сбросить фильтры</span>
          </button>
        </div>
      </div>
      
      {/* ROW 1: Поиск | Внешний ID | Соцсеть | Категория */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* 1. Поиск по названию или ID */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Поиск (ID / Название)</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="ID, название или тариф..."
              value={localSearch}
              onChange={e => handleSearchChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                  pushFilters();
                }
              }}
              className="w-full h-8.5 pl-8 pr-2.5 text-xs rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* 2. Внешний ID услуги провайдера */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Внешний ID (Provider ID)</label>
          <input
            type="text"
            placeholder="Например: 1045..."
            value={localExternalId}
            onChange={e => handleExternalIdChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                pushFilters();
              }
            }}
            className="w-full h-8.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {/* 3. Соцсеть */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Соцсеть</label>
          <Select value={localPlatform} onValueChange={val => handlePlatformChange(val || 'ALL')}>
            <SelectTrigger className="w-full h-8.5 border border-border bg-background text-foreground text-xs rounded-lg cursor-pointer px-2.5">
              <SelectValue placeholder="Все соцсети">
                {(value: string) => {
                  if (value === 'ALL') return 'Все соцсети';
                  return networksList.find(n => n.slug === value)?.name ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" label="Все соцсети" className="text-xs cursor-pointer">
                Все соцсети
              </SelectItem>
              {networksList.map((n: { slug: string; name: string }) => (
                <SelectItem key={n.slug} value={n.slug} label={n.name} className="text-xs cursor-pointer">
                  <span className="flex items-center gap-2">
                    <SocialIcon slug={n.slug} size={14} />
                    {n.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 4. Категория */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Категория</label>
          <Select value={localCategory} onValueChange={val => handleCategoryChange(val || 'all')}>
            <SelectTrigger className="w-full h-8.5 border border-border bg-background text-foreground text-xs rounded-lg cursor-pointer px-2.5">
              <SelectValue placeholder="Все категории">
                {(value: string) => {
                  if (value === 'all') return 'Все категории';
                  const c = categories.find(cat => cat.id === value);
                  if (!c) return value;
                  const cleanName = formatCleanCategoryName(c.name, c.network?.name);
                  return localPlatform === 'ALL' && c.network?.name 
                    ? `${c.network.name} → ${cleanName}` 
                    : cleanName;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[350px]">
              <SelectItem value="all" label="Все категории" className="text-xs cursor-pointer">
                Все категории ({categories.reduce((acc, cat) => acc + (cat.serviceCount ?? cat._count?.services ?? 0), 0)})
              </SelectItem>
              {filteredCategories.map(c => {
                const count = c.serviceCount ?? c._count?.services ?? 0;
                const cleanName = formatCleanCategoryName(c.name, c.network?.name);
                const label = localPlatform === 'ALL' && c.network?.name 
                  ? `${c.network.name} → ${cleanName}` 
                  : cleanName;
                return (
                  <SelectItem key={c.id} value={c.id} label={`${label} (${count})`} className="text-xs cursor-pointer">
                    <span className="flex items-center justify-between w-full gap-2">
                      <span>{label}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${count > 0 ? 'bg-muted text-muted-foreground' : 'text-muted-foreground/40'}`}>
                        {count}
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ROW 2: Провайдер | Статус услуги | Статус провайдера */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {/* 5. Провайдер */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Провайдер</label>
          <Select value={localProviderId} onValueChange={val => handleProviderChange(val || 'all')}>
            <SelectTrigger className="w-full h-8.5 border border-border bg-background text-foreground text-xs rounded-lg cursor-pointer px-2.5">
              <SelectValue placeholder="Все провайдеры">
                {(value: string) => {
                  if (value === 'all') return 'Все провайдеры';
                  if (value === 'none') return 'Без провайдера (вручную)';
                  return providers.find(p => p.id === value)?.name ?? value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Все провайдеры" className="text-xs cursor-pointer">Все провайдеры</SelectItem>
              <SelectItem value="none" label="Без провайдера (вручную)" className="text-xs cursor-pointer">Без провайдера (вручную)</SelectItem>
              {providers.map(p => (
                <SelectItem key={p.id} value={p.id} label={p.name} className="text-xs cursor-pointer">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 6. Статус услуги */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Статус услуги</label>
          <Select value={localIsActive} onValueChange={val => handleIsActiveChange(val || 'all')}>
            <SelectTrigger className="w-full h-8.5 border border-border bg-background text-foreground text-xs rounded-lg cursor-pointer px-2.5">
              <SelectValue placeholder="Все статусы">
                {(value: string) => {
                  if (value === 'all') return 'Все статусы';
                  if (value === 'true') return 'Активна';
                  if (value === 'false') return 'Деактивирована / В архиве';
                  return value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Все статусы" className="text-xs cursor-pointer">Все статусы</SelectItem>
              <SelectItem value="true" label="Активна" className="text-xs cursor-pointer">Активна</SelectItem>
              <SelectItem value="false" label="Деактивирована / В архиве" className="text-xs cursor-pointer">Деактивирована / В архиве</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 7. Статус провайдера */}
        <div className="space-y-1 flex flex-col justify-end">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Статус провайдера</label>
          <Select value={localProviderStatus} onValueChange={val => handleProviderStatusChange(val || 'all')}>
            <SelectTrigger className="w-full h-8.5 border border-border bg-background text-foreground text-xs rounded-lg cursor-pointer px-2.5">
              <SelectValue placeholder="Все статусы провайдера">
                {(value: string) => {
                  if (value === 'all') return 'Все статусы провайдера';
                  if (value === 'active') return 'Активна у поставщика';
                  if (value === 'zombie') return 'Удалена у поставщика (Zombie)';
                  if (value === 'cooldown') return 'Временный отстой (Cooldown)';
                  if (value === 'manual') return 'Ручная услуга';
                  return value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="Все статусы провайдера" className="text-xs cursor-pointer">Все статусы провайдера</SelectItem>
              <SelectItem value="active" label="Активна у поставщика" className="text-xs cursor-pointer">Активна у поставщика</SelectItem>
              <SelectItem value="zombie" label="Удалена у поставщика (Zombie)" className="text-xs cursor-pointer">Удалена у поставщика (Zombie)</SelectItem>
              <SelectItem value="cooldown" label="Временный отстой (Cooldown)" className="text-xs cursor-pointer">Временный отстой (Cooldown)</SelectItem>
              <SelectItem value="manual" label="Ручная услуга" className="text-xs cursor-pointer">Ручная услуга</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
