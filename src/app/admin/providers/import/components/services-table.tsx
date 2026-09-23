'use client';

import { inferTargetTypeFromName, inferTargetTypeFromCategory, isTargetTypeCompatible } from '@/utils/target-type';
import type { ExternalServiceItem, CategoryItem, FilterState } from '../types';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatPricePerUnit } from '@/utils/format-price';
import { SearchableCategorySelect } from './searchable-category-select';

interface ServicesTableProps {
  services: ExternalServiceItem[];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleAll: () => void;
  loading: boolean;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>> | ((f: FilterState) => void);
  pagination: { page: number; totalPages: number; total: number; pageSize: number };
  markup?: number;
  isAutoMarkup?: boolean;
  categories?: CategoryItem[];
  categoriesByNetwork?: { network: string; items: CategoryItem[] }[];
  selectedCategories?: Record<string, string>;
  onCategoryChange?: (serviceId: string, categoryId: string) => void;
  onCategoryCreated?: (newCategory: CategoryItem) => void;
  autoMappedCategories?: Record<string, string>;
  aiConfidence?: Record<string, boolean>;
  showCategoryColumn?: boolean;
  validationErrors?: Set<string>;
}

const platformMap: Record<string, { name: string; color: string; icon: string }> = {
  INSTAGRAM: { name: 'Instagram', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20', icon: '📸' },
  IN: { name: 'Instagram', color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20', icon: '📸' },
  TELEGRAM: { name: 'Telegram', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', icon: '✈️' },
  TG: { name: 'Telegram', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20', icon: '✈️' },
  VK: { name: 'ВКонтакте', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: '💙' },
  YOUTUBE: { name: 'YouTube', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: '▶️' },
  YT: { name: 'YouTube', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: '▶️' },
  TIKTOK: { name: 'TikTok', color: 'bg-muted text-foreground border-border', icon: '🎵' },
  TT: { name: 'TikTok', color: 'bg-muted text-foreground border-border', icon: '🎵' },
  TWITTER: { name: 'Twitter (X)', color: 'bg-muted text-foreground border-border', icon: '𝕏' },
  X: { name: 'Twitter (X)', color: 'bg-muted text-foreground border-border', icon: '𝕏' },
};

const getPlatformDisplay = (code: string) => {
  const map = platformMap[code.toUpperCase()];
  if (map) return map;
  return { name: code, color: 'bg-muted text-foreground border-border', icon: '🌐' };
};

const targetTypeBadges: Record<string, { label: string; color: string; icon: string }> = {
  POST: { label: 'Пост', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', icon: '📝' },
  CHANNEL: { label: 'Канал', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', icon: '📢' },
  PROFILE: { label: 'Профиль', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20', icon: '👤' },
  VIDEO: { label: 'Видео', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', icon: '🎬' },
  STORY: { label: 'Сториз', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: '⏱️' },
  CHANNEL_POSTS: { label: 'Авто-посты', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20', icon: '🤖' },
  POLL: { label: 'Опрос', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: '📊' },
  COMMENTS: { label: 'Отзывы', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20', icon: '💬' },
  BOT: { label: 'Бот', color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', icon: '🤖' },
  CUSTOM: { label: 'Свой', color: 'bg-muted text-foreground border-border', icon: '⚙️' },
};

export function TargetTypeBadge({ name }: { name: string }) {
  const targetType = inferTargetTypeFromName(name);
  const badge = targetTypeBadges[targetType] || targetTypeBadges.CUSTOM;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.color}`}>
      <span>{badge.icon}</span>
      <span>{badge.label}</span>
    </span>
  );
}

/* PATCH P1-2: helper for price display */
function RetailPrice({ procurement, markup, isAuto }: { procurement: number; markup: number; isAuto?: boolean }) {
  if (isAuto || markup === 0) {
    return (
      <span className="text-foreground font-bold text-xs truncate block w-full tabular-nums tracking-tight">
        авто
        <span className="text-[10px] text-muted-foreground font-sans ml-1 font-medium select-none tracking-normal">розн.</span>
      </span>
    );
  }
  const retail = procurement * (1 + markup / 100);
  return (
    <span className="text-foreground font-bold text-xs truncate block w-full tabular-nums tracking-tight">
      {formatPricePerUnit(retail)} ₽
      <span className="text-[10px] text-muted-foreground font-sans ml-1 font-medium select-none tracking-normal">розн.</span>
    </span>
  );
}

export function ServicesTable({
  services,
  selectedIds,
  toggleSelection,
  toggleAll,
  loading,
  filters,
  setFilters,
  pagination,
  markup = 0,
  isAutoMarkup = false,
  categories = [],
  categoriesByNetwork = [],
  selectedCategories = {},
  onCategoryChange,
  onCategoryCreated,
  autoMappedCategories = {},
  aiConfidence = {},
  showCategoryColumn = false,
  validationErrors = new Set<string>(),
}: ServicesTableProps) {
  const handleSort = (field: string) => {
    let newSort = 'none';
    if (filters.sortBy !== `${field}_asc` && filters.sortBy !== `${field}_desc`) {
      newSort = `${field}_asc`;
    } else if (filters.sortBy === `${field}_asc`) {
      newSort = `${field}_desc`;
    }
    setFilters({ ...filters, sortBy: newSort, page: 1 });
  };

  const getSortIcon = (field: string) => {
    if (filters.sortBy === `${field}_asc`) return <ArrowUp className="w-3.5 h-3.5 text-primary animate-in fade-in zoom-in-75 duration-200" />;
    if (filters.sortBy === `${field}_desc`) return <ArrowDown className="w-3.5 h-3.5 text-primary animate-in fade-in zoom-in-75 duration-200" />;
    return <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/80 transition-colors" />;
  };

  const importableServices = services.filter((s) => !s.alreadyImported && (s.pricePerUnitProcurementRub || 0) > 0);
  const importableIds = importableServices.map((s) => String(s.service));
  const isAllPageSelected = importableIds.length > 0 && importableIds.every((id) => selectedIds.has(id));
  const isCheckboxDisabled = importableIds.length === 0;

  const gridTemplate = showCategoryColumn
    ? 'grid-cols-[40px_minmax(0,1.5fr)_minmax(0,1.5fr)_150px_200px_80px]'
    : 'grid-cols-[40px_minmax(0,1.5fr)_minmax(0,1.5fr)_150px_80px]';

  /* Render searchable category select with create capability */
  const renderCategorySelect = (svcId: string, isMobile: boolean, suggestedPlatform?: string | null) => {
    return (
      <SearchableCategorySelect
        value={selectedCategories[svcId] || ''}
        onChange={(val) => onCategoryChange?.(svcId, val)}
        categories={categories}
        categoriesByNetwork={categoriesByNetwork}
        onCategoryCreated={onCategoryCreated}
        suggestedPlatform={suggestedPlatform}
        isMobile={isMobile}
        hasError={validationErrors.has(svcId)}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-card border border-border/60 ring-1 ring-border/5 rounded-xl shadow-sm overflow-hidden">
      <div className="flex-1 w-full overflow-hidden">
        {/* Desktop Header */}
        <div className={`hidden lg:grid ${gridTemplate} gap-4 bg-muted/30 border-b border-border/60 sticky top-0 z-10 select-none items-center backdrop-blur-sm`}>
          <div className="px-4 py-3 pl-6">
            <input
              type="checkbox"
              onChange={toggleAll}
              checked={isAllPageSelected}
              disabled={isCheckboxDisabled}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Выбрать все на странице"
            />
          </div>
          <div
            className="py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:text-foreground transition-all duration-200"
            onClick={() => handleSort('name')}
          >
            <div className="flex items-center gap-1.5">
              <span>Услуга</span>
              {getSortIcon('name')}
            </div>
          </div>
          <div
            className="py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:text-foreground transition-all duration-200"
            onClick={() => handleSort('platform')}
          >
            <div className="flex items-center gap-1.5">
              <span>Соцсеть и теги</span>
              {getSortIcon('platform')}
            </div>
          </div>
          <div
            className="py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:text-foreground transition-all duration-200"
            onClick={() => handleSort('price')}
          >
            <div className="flex items-center gap-1.5">
              <span>Стоимость</span>
              {getSortIcon('price')}
            </div>
          </div>
          {showCategoryColumn && (
            <div className="py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Категория
            </div>
          )}
          <div className="py-3 pr-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Статус
          </div>
        </div>

        {/* Mobile Select All */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              onChange={toggleAll}
              checked={isAllPageSelected}
              disabled={isCheckboxDisabled}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              aria-label="Выбрать все на странице"
            />
            <span className="text-sm font-semibold text-foreground">Выбрать все на странице</span>
          </label>
        </div>

        <div className="bg-card flex flex-col divide-y divide-border">
          {loading ? (
            <div className="p-16 text-center text-sm text-muted-foreground">
              <div className="flex justify-center items-center gap-2">
                <span className="animate-spin text-xl">⏳</span> Загрузка каталога...
              </div>
            </div>
          ) : services.length === 0 ? (
            <div className="p-16 text-center text-sm text-muted-foreground">
              Услуги по заданным критериям не найдены.
            </div>
          ) : (
            services.map((s) => {
              const metrics = s.metrics || {};
              const hasAnomaly = Number(metrics.anomalyScore || 0) > 0;
              const pricePerUnitProcurement = s.pricePerUnitProcurementRub || 0;
              const isFreeProcurement = pricePerUnitProcurement <= 0;
              const isDisabled = s.alreadyImported || isFreeProcurement;
              const isSelected = selectedIds.has(String(s.service));

              const handleRowClick = (e: React.MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('select') || target.closest('a') || target.closest('[role="combobox"]') || target.closest('input')) return;
                if (!isDisabled) toggleSelection(String(s.service));
              };

              return (
                <div
                  key={s.service}
                  onClick={handleRowClick}
                  className={`transition-colors duration-200 cursor-pointer p-4 lg:p-0 border-b border-border/40 last:border-0 ${
                    s.alreadyImported
                      ? 'bg-muted/40 opacity-75 cursor-not-allowed'
                      : isFreeProcurement
                      ? 'bg-destructive/5 hover:bg-destructive/10'
                      : isSelected
                      ? 'bg-primary/5 hover:bg-primary/10'
                      : 'hover:bg-muted/30 even:bg-muted/10'
                  }`}
                >
                  {/* Desktop Layout */}
                  <div className={`hidden lg:grid ${gridTemplate} gap-4 items-center min-h-[72px]`}>
                    <div className="px-4 pl-6">
                      <input type="checkbox" disabled={isDisabled} checked={isSelected} onChange={() => toggleSelection(String(s.service))} className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" aria-label={`Выбрать ${s.cleanName || s.name}`} />
                    </div>
                    <div className="flex flex-col gap-0.5 py-3 pr-2 min-w-0">
                      <span className="text-sm font-semibold text-foreground truncate block w-full" title={s.cleanName || s.name}>{s.cleanName || s.name}</span>
                      <span className="text-[10px] text-muted-foreground font-medium truncate block w-full" title={`#${s.service} • ${s.name}`}>#{s.service} • {s.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 py-3 pr-2 items-center">
                      <TargetTypeBadge name={s.name} />
                      {metrics.platform && (() => {
                        const pData = getPlatformDisplay(metrics.platform);
                        return (
                          <span className={`${pData.color} px-2 py-0.5 rounded-[6px] text-[10px] font-semibold border flex items-center gap-1 select-none whitespace-nowrap`}>
                            <span>{pData.icon}</span><span>{pData.name}</span>
                          </span>
                        );
                      })()}
                      {(() => {
                        const selectedCatId = selectedCategories[String(s.service)] || autoMappedCategories[String(s.service)];
                        if (!selectedCatId) return null;
                        const cat = categories.find(c => c.id === selectedCatId);
                        if (!cat) return null;
                        const serviceType = inferTargetTypeFromName(s.name);
                        const catType = inferTargetTypeFromCategory(cat.name);
                        if (!isTargetTypeCompatible(serviceType, catType)) {
                          return (
                            <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold select-none whitespace-nowrap" title={`Конфликт: тип услуги (${serviceType}) не подходит к категории «${cat.name}» (${catType})`}>
                              ⚠️ Конфликт
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {metrics.geo && <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none whitespace-nowrap">{metrics.geo}</span>}
                      {(s.refill || (metrics.warranty !== undefined && metrics.warranty > 0)) && <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none whitespace-nowrap" title="Гарантия">♻️ {metrics.warranty || 30}D</span>}
                      {hasAnomaly && <span className="bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none whitespace-nowrap">⚠️ {metrics.anomalyScore}</span>}
                      {parseInt(String(s.min || '0'), 10) > 0 && <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none whitespace-nowrap">от {s.min} шт</span>}
                    </div>
                    <div className="flex flex-col gap-0.5 py-3 pr-2 font-mono min-w-0">
                      {/* PATCH P1-2: show "auto" when markup=0 */}
                      <RetailPrice procurement={pricePerUnitProcurement} markup={markup} isAuto={isAutoMarkup} />
                      <span className="text-muted-foreground font-medium text-[10px] truncate block w-full tabular-nums tracking-tight">
                        {formatPricePerUnit(pricePerUnitProcurement)} ₽
                        <span className="font-sans ml-0.5 select-none tracking-normal">закуп.</span>
                      </span>
                      {isFreeProcurement && (
                        <span className="text-[10px] text-destructive font-bold bg-destructive/10 border border-destructive/20 px-1.5 py-0.5 rounded-[4px] w-fit mt-1">
                          ОШИБКА: 0 ₽
                        </span>
                      )}
                    </div>
                    {showCategoryColumn && (
                      <div className="py-3 pr-2 min-w-0">
                        {s.alreadyImported ? (
                          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 select-none bg-muted px-2 py-1.5 rounded-[8px] border border-border w-fit max-w-full truncate">📦 Импортировано</span>
                        ) : (
                          <div className="flex flex-col gap-1 w-full min-w-0">
                            {renderCategorySelect(String(s.service), false, metrics.platform)}
                            {aiConfidence[String(s.service)] ? (
                              <span className="text-[10px] font-semibold text-success mt-1 block select-none">🦄 Автоопределение ИИ</span>
                            ) : validationErrors.has(String(s.service)) ? (
                              <span className="text-[10px] font-bold text-destructive mt-1 block select-none">❌ Необходима категория</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-warning mt-1 block select-none">⚠️ Выберите вручную</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="py-3 pr-4">
                      {s.alreadyImported ? (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-[6px] border border-border font-semibold select-none">📦</span>
                      ) : isFreeProcurement ? (
                        <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-1 rounded-[6px] border border-destructive/20 font-bold select-none">❌</span>
                      ) : (
                        <span className="text-[10px] text-success bg-success/10 px-2 py-1 rounded-[6px] border border-success/20 font-bold select-none">✅</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="lg:hidden flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" disabled={isDisabled} checked={isSelected} onChange={() => toggleSelection(String(s.service))} className="mt-1 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0" aria-label={`Выбрать ${s.cleanName || s.name}`} />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-foreground line-clamp-2">{s.cleanName || s.name}</span>
                          <span className="text-[10px] text-muted-foreground font-medium line-clamp-1">#{s.service} • {s.name}</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {s.alreadyImported ? (
                          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-[6px] border border-border font-semibold select-none">📦</span>
                        ) : isFreeProcurement ? (
                          <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-1 rounded-[6px] border border-destructive/20 font-bold select-none">❌</span>
                        ) : (
                          <span className="text-[10px] text-success bg-success/10 px-2 py-1 rounded-[6px] border border-success/20 font-bold select-none">✅</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-7">
                      {metrics.platform && (() => {
                        const pData = getPlatformDisplay(metrics.platform);
                        return (
                          <span className={`${pData.color} px-2 py-0.5 rounded-[6px] text-[10px] font-semibold border flex items-center gap-1 select-none`}><span>{pData.icon}</span><span>{pData.name}</span></span>
                        );
                      })()}
                      {metrics.geo && <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none">{metrics.geo}</span>}
                      {(s.refill || (metrics.warranty !== undefined && metrics.warranty > 0)) && <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none">♻️ {metrics.warranty || 30}D</span>}
                      {hasAnomaly && <span className="bg-warning/10 text-warning border border-warning/20 px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none">⚠️ {metrics.anomalyScore}</span>}
                      {parseInt(String(s.min || '0'), 10) > 0 && <span className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-[6px] text-[10px] font-semibold select-none">от {s.min} шт</span>}
                    </div>
                    <div className="flex justify-between items-end ml-7 pt-2 border-t border-border/40 mt-2">
                      <div className="flex flex-col font-mono">
                        <RetailPrice procurement={pricePerUnitProcurement} markup={markup} isAuto={isAutoMarkup} />
                        <span className="text-muted-foreground font-medium text-[11px] tabular-nums tracking-tight">
                          {formatPricePerUnit(pricePerUnitProcurement)} ₽
                          <span className="font-sans ml-0.5 tracking-normal">закупка</span>
                        </span>
                      </div>
                    </div>
                    {showCategoryColumn && (
                      <div className="ml-7 pt-2">
                        {s.alreadyImported ? (
                          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 select-none bg-muted px-2 py-1.5 rounded-[8px] border border-border w-fit">📦 Уже импортировано</span>
                        ) : (
                          <div className="flex flex-col gap-1 w-full">
                            {renderCategorySelect(String(s.service), true, metrics.platform)}
                            {aiConfidence[String(s.service)] ? (
                              <span className="text-[10px] font-semibold text-success mt-1">🦄 Автоопределение ИИ</span>
                            ) : validationErrors.has(String(s.service)) ? (
                              <span className="text-[10px] font-bold text-destructive mt-1">❌ Ошибка: Выберите категорию</span>
                            ) : (
                              <span className="text-[10px] font-semibold text-warning mt-1">⚠️ Выберите вручную</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PATCH P1-3: Mobile-visible pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="bg-muted/30 border-t border-border px-4 py-3.5 flex items-center justify-between">
          {/* Desktop: full info */}
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-muted-foreground">
              Показано{' '}
              <span className="font-bold text-foreground">{(pagination.page - 1) * pagination.pageSize + 1}</span> -{' '}
              <span className="font-bold text-foreground">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> из{' '}
              <span className="font-bold text-foreground">{pagination.total}</span>
            </p>
            <nav className="relative z-0 inline-flex rounded-[8px] shadow-sm -space-x-px border border-border overflow-hidden" aria-label="Пагинация">
              <button onClick={() => setFilters({ ...filters, page: Math.max(1, pagination.page - 1) })} disabled={pagination.page === 1} className="relative inline-flex items-center px-3 py-2 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-all duration-200 select-none border-r border-border/60 cursor-pointer active:scale-95">← Пред.</button>
              <span className="relative inline-flex items-center px-4 py-2 bg-card text-xs font-bold text-foreground select-none border-r border-border/60 tabular-nums">{pagination.page} / {pagination.totalPages}</span>
              <button onClick={() => setFilters({ ...filters, page: Math.min(pagination.totalPages, pagination.page + 1) })} disabled={pagination.page === pagination.totalPages} className="relative inline-flex items-center px-3 py-2 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50 transition-all duration-200 select-none cursor-pointer active:scale-95">След. →</button>
            </nav>
          </div>
          {/* PATCH P1-3: Mobile: compact pagination */}
          <div className="flex sm:hidden items-center justify-between w-full">
            <span className="text-[11px] text-muted-foreground font-semibold tabular-nums">{pagination.page}/{pagination.totalPages}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setFilters({ ...filters, page: Math.max(1, pagination.page - 1) })} disabled={pagination.page === 1} className="px-3 py-2 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 border border-border rounded-lg transition-colors cursor-pointer active:scale-95">←</button>
              <button onClick={() => setFilters({ ...filters, page: Math.min(pagination.totalPages, pagination.page + 1) })} disabled={pagination.page === pagination.totalPages} className="px-3 py-2 bg-card text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 border border-border rounded-lg transition-colors cursor-pointer active:scale-95">→</button>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">{pagination.total} усл.</span>
          </div>
        </div>
      )}
    </div>
  );
}
