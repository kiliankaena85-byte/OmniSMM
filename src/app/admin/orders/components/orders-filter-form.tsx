'use client';

import * as React from 'react';
import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, RotateCcw, Loader2 } from 'lucide-react';
import { FilterDropdown, type FilterOption } from './filter-dropdown';

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface NetworkOption {
  id: string;
  name: string;
  slug: string;
  categories?: CategoryOption[];
}

interface ProviderOption {
  id: string;
  name: string;
}

const GLOBAL_ACTIVITY_TYPES: FilterOption[] = [
  { id: 'ALL', label: '📂 Все категории' },
  { id: 'subscribers', label: '👥 Подписчики' },
  { id: 'likes', label: '❤️ Лайки' },
  { id: 'views', label: '👁️ Просмотры' },
  { id: 'comments', label: '💬 Комментарии' },
  { id: 'reposts', label: '🔄 Репосты' },
  { id: 'polls', label: '🗳️ Опросы' },
  { id: 'watchtime', label: '⏳ Удержание' },
];

const DATE_PRESETS: FilterOption[] = [
  { id: 'ALL', label: '📅 Все время' },
  { id: 'today', label: '📅 Сегодня' },
  { id: 'yesterday', label: '📅 Вчера' },
  { id: '7d', label: '📅 7 дней' },
  { id: '30d', label: '📅 30 дней' },
  { id: 'this_month', label: '📅 Этот месяц' },
  { id: 'last_month', label: '📅 Прошлый месяц' },
];

const STATUS_OPTIONS: FilterOption[] = [
  { id: 'ALL', label: '⚙️ Все статусы' },
  { id: 'IN_PROGRESS', label: '⚡ В работе' },
  { id: 'PENDING', label: '⏳ В очереди' },
  { id: 'PENDING_CHECK', label: '🔍 Проверка ссылки' },
  { id: 'ERROR', label: '🔴 Ошибки' },
  { id: 'PROBLEMATIC', label: '⚠️ Проблемные (сбои/отмены)' },
  { id: 'COMPLETED', label: '🟢 Выполнен' },
  { id: 'PARTIAL', label: '🟠 Частичный' },
  { id: 'CANCELED', label: '❌ Отменён' },
  { id: 'AWAITING_PAYMENT', label: '⚪ Ожидает' },
];

const ERROR_CATEGORIES: FilterOption[] = [
  { id: 'ALL', label: '⚠️ Любой сбой' },
  { id: 'BALANCE', label: '💳 Баланс провайдера' },
  { id: 'LINK', label: '🔗 Ошибка ссылки' },
  { id: 'SERVICE', label: '⚡ Сбой услуги' },
];

const ENVIRONMENT_MODE_OPTIONS: FilterOption[] = [
  { id: 'ALL', label: '🌐 Все режимы' },
  { id: 'PRODUCTION', label: '🚀 Продакшн' },
  { id: 'SANDBOX', label: '🛡️ Песочница' },
  { id: 'HYBRID', label: '⚡ Гибрид' },
  { id: 'ACQUIRING_TEST', label: '💳 Тест эквайринга' },
];

export function OrdersFilterForm({ 
  networks = [],
  providers = []
}: { 
  networks?: NetworkOption[];
  providers?: ProviderOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQ = searchParams.get('q') || '';
  const urlNetworkSlug = searchParams.get('networkSlug') || 'ALL';
  const urlActivityType = searchParams.get('activityType') || 'ALL';
  const urlDatePreset = searchParams.get('datePreset') || 'ALL';
  const urlStatus = searchParams.get('status') || 'ALL';
  const urlProviderId = searchParams.get('providerId') || 'ALL';
  const urlErrorCategory = searchParams.get('errorCategory') || 'ALL';
  const urlEnvironmentMode = searchParams.get('environmentMode') || 'ALL';

  // Optimistic local states for instantaneous response
  const [searchVal, setSearchVal] = useState(urlQ);
  const [networkSlug, setNetworkSlug] = useState(urlNetworkSlug);
  const [activityType, setActivityType] = useState(urlActivityType);
  const [datePreset, setDatePreset] = useState(urlDatePreset);
  const [status, setStatus] = useState(urlStatus);
  const [providerId, setProviderId] = useState(urlProviderId);
  const [errorCategory, setErrorCategory] = useState(urlErrorCategory);
  const [environmentMode, setEnvironmentMode] = useState(urlEnvironmentMode);

  // Sync if URL changes externally
  useEffect(() => {
    setSearchVal(urlQ);
    setNetworkSlug(urlNetworkSlug);
    setActivityType(urlActivityType);
    setDatePreset(urlDatePreset);
    setStatus(urlStatus);
    setProviderId(urlProviderId);
    setErrorCategory(urlErrorCategory);
    setEnvironmentMode(urlEnvironmentMode);
  }, [urlQ, urlNetworkSlug, urlActivityType, urlDatePreset, urlStatus, urlProviderId, urlErrorCategory, urlEnvironmentMode]);

  const selectedNetwork = networks.find(n => n.slug === networkSlug);
  const networkCategories = selectedNetwork?.categories || [];

  // Options mapping
  const networkOptions: FilterOption[] = useMemo(() => [
    { id: 'ALL', label: '🌐 Все сети' },
    ...networks.map(n => ({ id: n.slug, label: n.name }))
  ], [networks]);

  const categoryOptions: FilterOption[] = useMemo(() => {
    if (networkCategories.length > 0) {
      return [
        { id: 'ALL', label: '📂 Все категории' },
        ...networkCategories.map(c => ({ id: c.slug, label: c.name }))
      ];
    }
    return GLOBAL_ACTIVITY_TYPES;
  }, [networkCategories]);

  const providerOptions: FilterOption[] = useMemo(() => [
    { id: 'ALL', label: '🔌 Все поставщики' },
    ...providers.map(p => ({ id: p.id, label: p.name }))
  ], [providers]);

  const hasActiveFilters = Boolean(
    searchVal ||
    (networkSlug && networkSlug !== 'ALL') ||
    (activityType && activityType !== 'ALL') ||
    (datePreset && datePreset !== 'ALL') ||
    (status && status !== 'ALL') ||
    (providerId && providerId !== 'ALL') ||
    (errorCategory && errorCategory !== 'ALL') ||
    (environmentMode && environmentMode !== 'ALL')
  );

  const applyFilter = (key: string, value: string) => {
    // Instant local state update
    if (key === 'networkSlug') {
      setNetworkSlug(value);
      setActivityType('ALL');
    } else if (key === 'activityType') {
      setActivityType(value);
    } else if (key === 'status') {
      setStatus(value);
    } else if (key === 'providerId') {
      setProviderId(value);
    } else if (key === 'errorCategory') {
      setErrorCategory(value);
    } else if (key === 'datePreset') {
      setDatePreset(value);
    } else if (key === 'environmentMode') {
      setEnvironmentMode(value);
    } else if (key === 'q') {
      setSearchVal(value);
    }

    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'ALL') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key === 'networkSlug') {
      params.delete('activityType');
    }
    params.delete('cursor');
    params.delete('page');

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilter('q', searchVal.trim());
  };

  const handleResetAll = () => {
    setSearchVal('');
    setNetworkSlug('ALL');
    setActivityType('ALL');
    setDatePreset('ALL');
    setStatus('ALL');
    setProviderId('ALL');
    setErrorCategory('ALL');
    setEnvironmentMode('ALL');

    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  const removeFilter = (key: string) => {
    if (key === 'q') setSearchVal('');
    applyFilter(key, 'ALL');
  };

  return (
    <div className="space-y-2">
      {/* ── ULTRA-COMPACT SINGLE-ROW TOOLBAR (Height ~38px, High-Density) ── */}
      <div className="flex items-center gap-1.5 flex-wrap lg:flex-nowrap bg-card/90 backdrop-blur-sm border border-border/80 rounded-2xl p-1.5 shadow-xs">
        {/* 1. Omni-Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-[300px] relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Поиск: №, ссылка, email..."
            className="w-full h-8 pl-8 pr-7 text-xs font-medium bg-background border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
          />
          {searchVal && (
            <button
              type="button"
              onClick={() => {
                setSearchVal('');
                removeFilter('q');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm"
              title="Очистить поиск"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </form>

        {/* 2. Social Network Dropdown */}
        <FilterDropdown
          value={networkSlug}
          options={networkOptions}
          onChange={(val) => applyFilter('networkSlug', val)}
          ariaLabel="Фильтр по соцсети"
          className="max-w-[135px]"
        />

        {/* 3. Category / Activity Type Dropdown */}
        <FilterDropdown
          value={activityType}
          options={categoryOptions}
          onChange={(val) => applyFilter('activityType', val)}
          ariaLabel="Тип услуги / Категория"
          className="max-w-[145px]"
        />

        {/* 4. Status Dropdown */}
        <FilterDropdown
          value={status}
          options={STATUS_OPTIONS}
          onChange={(val) => applyFilter('status', val)}
          ariaLabel="Статус заказа"
          className="max-w-[130px]"
        />

        {/* 5. Provider Dropdown */}
        {providers.length > 0 && (
          <FilterDropdown
            value={providerId}
            options={providerOptions}
            onChange={(val) => applyFilter('providerId', val)}
            ariaLabel="Провайдер"
            className="max-w-[140px]"
          />
        )}

        {/* 6. Error Category Dropdown */}
        <FilterDropdown
          value={errorCategory}
          options={ERROR_CATEGORIES}
          onChange={(val) => applyFilter('errorCategory', val)}
          ariaLabel="Причина сбоя"
          className="max-w-[135px]"
        />

        {/* 7. Date Preset Range Dropdown */}
        <FilterDropdown
          value={datePreset}
          options={DATE_PRESETS}
          onChange={(val) => applyFilter('datePreset', val)}
          ariaLabel="Период дат"
          className="max-w-[125px]"
        />

        {/* 8. Environment Mode Dropdown */}
        <FilterDropdown
          value={environmentMode}
          options={ENVIRONMENT_MODE_OPTIONS}
          onChange={(val) => applyFilter('environmentMode', val)}
          ariaLabel="Режим окружения"
          className="max-w-[140px]"
        />

        {/* Loading Spinner Indicator */}
        {isPending && (
          <div className="flex items-center px-1.5 text-primary animate-spin" title="Обновление результатов...">
            <Loader2 className="w-3.5 h-3.5" />
          </div>
        )}

        {/* 8. Reset Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetAll}
            className="h-8 px-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95 shadow-2xs"
            title="Сбросить все фильтры"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Сброс</span>
          </button>
        )}
      </div>

      {/* ── ACTIVE FILTER CHIPS ── */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Активные фильтры:</span>
          {searchVal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium">
              Поиск: «{searchVal}»
              <button type="button" onClick={() => removeFilter('q')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {networkSlug && networkSlug !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground border border-border/60 rounded-lg text-xs font-medium">
              Сеть: {selectedNetwork?.name || networkSlug}
              <button type="button" onClick={() => removeFilter('networkSlug')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {activityType && activityType !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground border border-border/60 rounded-lg text-xs font-medium">
              Категория: {networkCategories.find(c => c.slug === activityType)?.name || activityType}
              <button type="button" onClick={() => removeFilter('activityType')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {status && status !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground border border-border/60 rounded-lg text-xs font-medium">
              Статус: {STATUS_OPTIONS.find(s => s.id === status)?.label}
              <button type="button" onClick={() => removeFilter('status')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {providerId && providerId !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground border border-border/60 rounded-lg text-xs font-medium">
              Поставщик: {providers.find(p => p.id === providerId)?.name}
              <button type="button" onClick={() => removeFilter('providerId')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {errorCategory && errorCategory !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-xs font-medium">
              Ошибка: {ERROR_CATEGORIES.find(e => e.id === errorCategory)?.label}
              <button type="button" onClick={() => removeFilter('errorCategory')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {datePreset && datePreset !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground border border-border/60 rounded-lg text-xs font-medium">
              Период: {DATE_PRESETS.find(d => d.id === datePreset)?.label}
              <button type="button" onClick={() => removeFilter('datePreset')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {environmentMode && environmentMode !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground border border-border/60 rounded-lg text-xs font-medium">
              Режим: {ENVIRONMENT_MODE_OPTIONS.find(m => m.id === environmentMode)?.label}
              <button type="button" onClick={() => removeFilter('environmentMode')} className="hover:text-destructive cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
