'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Table } from '@/components/admin/hero-ui';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Plus,
  Pencil,
  ShoppingCart,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { CatalogServiceDTO } from '@/types/catalog.dto';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { UniversalIcon } from '@/components/ui/UniversalIcon';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  toggleServiceActiveAction,
  updateServiceMarkupAction,
} from '@/actions/admin/catalog/batch';
import {
  applyBeautifulRounding,
  SAFETY_FLOOR_MARKUP,
  TOTAL_MANDATORY_DEDUCTIONS,
} from '@/lib/financial-constants';
import { BatchActionBar } from './catalog/batch-action-bar';
import {
  CatalogFilters,
  type FilterCategoryItem,
  type FilterProviderItem,
  type FilterNetworkItem,
  formatCleanCategoryName,
  formatCleanActivityName,
} from './catalog/catalog-filters';

const SAFETY_MULTIPLIER = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);

export type { FilterCategoryItem as CatalogTableCategory, FilterProviderItem as CatalogTableProvider, FilterNetworkItem as CatalogTableNetwork };
export { formatCleanCategoryName, formatCleanActivityName };

export function calcDisplayPrice(rate: number, markup: number, usdToRub: number, curr: 'RUB' | 'USD', vol: 'UNIT' | '1K') {
  if (vol === '1K') {
    const rawPrice = curr === 'USD' ? rate * markup : rate * markup * usdToRub;
    return curr === 'RUB' ? applyBeautifulRounding(rawPrice) : parseFloat(rawPrice.toFixed(4));
  } else {
    const rawPrice = curr === 'USD' ? (rate * markup) / 1000 : (rate * markup * usdToRub) / 1000;
    return curr === 'RUB' 
      ? applyBeautifulRounding(rawPrice * 1000) / 1000 
      : parseFloat(rawPrice.toFixed(6));
  }
}

export function calcDisplayCost(rate: number, usdToRub: number, curr: 'RUB' | 'USD', vol: 'UNIT' | '1K') {
  if (vol === '1K') {
    return curr === 'USD' ? rate : rate * usdToRub;
  } else {
    return curr === 'USD' ? rate / 1000 : (rate * usdToRub) / 1000;
  }
}

export function CreateServiceButton() {
  return (
    <Link
      href="/admin/providers/import"
      className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/95 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 text-xs"
    >
      <Plus className="w-4 h-4" />
      Добавить услугу
    </Link>
  );
}

// ─── Archive / Delete Button with Optimistic UI & Rollback ───────────────────
export function ArchiveButton({
  service,
  onDeleted,
}: {
  service: CatalogServiceDTO;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleArchive() {
    setConfirmOpen(true);
  }

  function executeArchive() {
    setConfirmOpen(false);
    
    // ⚡ Optimistic UI: Notify parent to hide row immediately
    if (onDeleted) {
      onDeleted(service.id);
    }

    startTransition(async () => {
      try {
        const { deleteOrArchiveServiceAction } = await import('@/actions/admin/catalog/services');
        const r = await deleteOrArchiveServiceAction(service.id);
        if (r.success) {
          toast.success(r.message);
          router.refresh();
        } else {
          toast.error(r.error || 'Ошибка удаления услуги');
          router.refresh();
        }
      } catch {
        toast.error('Сетевой сбой при удалении');
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleArchive}
        disabled={isPending}
        title="Удалить или архивировать услугу"
        aria-label={`Удалить услугу ${service.name}`}
        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 disabled:opacity-40 cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeArchive}
        title="Удаление / Архивация услуги"
        isDanger={true}
        confirmText="Удалить / В архив"
        cancelText="Отмена"
      >
        Удалить услугу «{service.name}»? Если по ней нет заказов, она будет удалена навсегда. Если есть заказы — перенесена в архив.
      </ConfirmModal>
    </>
  );
}

export function EditServiceModal({
  service,
}: {
  service: CatalogServiceDTO;
  categories?: unknown[];
  providers?: unknown[];
  onSuccess?: () => void;
  usdToRub?: number;
}) {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const editHref = qs
    ? `/admin/catalog/${service.id}?returnUrl=${encodeURIComponent(`/admin/catalog?${qs}`)}`
    : `/admin/catalog/${service.id}`;

  return (
    <div className="flex items-center gap-1">
      <Link
        href={editHref}
        aria-label={`Редактировать услугу ${service.name}`}
        className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 cursor-pointer"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

interface CatalogTableProps {
  services: CatalogServiceDTO[];
  usdToRub: number;
  canEdit: boolean;
  canEditFinance: boolean;
  canSeeRates: boolean;
  categories: FilterCategoryItem[];
  providers: FilterProviderItem[];
  networks?: FilterNetworkItem[];
  selectedTenant?: string;
}

export function CatalogTable({
  services,
  usdToRub,
  canEdit,
  canEditFinance,
  canSeeRates,
  categories,
  providers,
  networks,
  selectedTenant,
}: CatalogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Currency & Volume state
  const [currency, setCurrency] = useState<'RUB' | 'USD'>('RUB');
  const [volume, setVolume] = useState<'UNIT' | '1K'>('1K');

  // Selected checkboxes for batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // ⚡ Optimistic deletion state (instantly hides deleted IDs)
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // Local state maps for inline edits
  const [rowMarkups, setRowMarkups] = useState<Record<string, number>>({});
  const [rowPrices, setRowPrices] = useState<Record<string, string>>({});
  const [rowActive, setRowActive] = useState<Record<string, boolean>>({});

  // Sorting from URL
  const currentSortBy = searchParams.get('sortBy');
  const currentSortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

  const handleSort = (column: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('cursor');
    params.delete('page'); // Reset to page 1 on sort

    if (currentSortBy === column) {
      if (currentSortOrder === 'asc') {
        params.set('sortOrder', 'desc');
      } else if (currentSortOrder === 'desc') {
        params.delete('sortBy');
        params.delete('sortOrder');
      }
    } else {
      params.set('sortBy', column);
      params.set('sortOrder', 'asc');
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const renderSortableHeader = (column: string, label: string) => {
    const isActive = currentSortBy === column;
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 hover:text-foreground transition-colors group cursor-pointer"
      >
        <span>{label}</span>
        {isActive ? (
          currentSortOrder === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-primary" />
          ) : (
            <ArrowDown className="w-3 h-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
    );
  };

  const visibleServices = services.filter(s => !deletedIds.includes(s.id));
  const isAllSelected = visibleServices.length > 0 && visibleServices.every(s => selectedIds.includes(s.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleServices.map(s => s.id));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleServiceDeleted = (deletedId: string) => {
    setDeletedIds(prev => [...prev, deletedId]);
    setSelectedIds(prev => prev.filter(id => id !== deletedId));
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    const next = rowActive[id] !== undefined ? !rowActive[id] : !currentStatus;
    setRowActive(prev => ({ ...prev, [id]: next }));

    startTransition(async () => {
      const res = await toggleServiceActiveAction(id, next);
      if (!res.success) {
        setRowActive(prev => ({ ...prev, [id]: !next }));
        toast.error(res.error || 'Ошибка смены статуса');
      } else {
        toast.success('Статус услуги обновлен');
      }
    });
  };

  const handlePercentChange = (s: CatalogServiceDTO, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const newMultiplier = 1 + num / 100;
      setRowMarkups(prev => ({ ...prev, [s.id]: newMultiplier }));
      setRowPrices(prev => ({ ...prev, [s.id]: String(calcDisplayPrice(s.rate, newMultiplier, usdToRub, currency, volume)) }));
    }
  };

  const handlePriceChange = (s: CatalogServiceDTO, val: string) => {
    setRowPrices(prev => ({ ...prev, [s.id]: val }));
    const p = parseFloat(val);
    if (!isNaN(p) && p > 0 && s.rate > 0) {
      // Обратная функция к calcDisplayPrice:
      // vol='1K',  curr='RUB'  → markup = price / (rate * usdToRub)
      // vol='1K',  curr='USD'  → markup = price / rate
      // vol='UNIT', curr='RUB' → markup = (price * 1000) / (rate * usdToRub)
      // vol='UNIT', curr='USD' → markup = (price * 1000) / rate
      const effectivePrice = volume === 'UNIT' ? p * 1000 : p;
      const effectiveRate = currency === 'RUB' ? s.rate * usdToRub : s.rate;
      const newMarkup = effectivePrice / effectiveRate;
      setRowMarkups(prev => ({ ...prev, [s.id]: newMarkup }));
    }
  };

  const saveMarkup = (s: CatalogServiceDTO) => {
    const currentMarkup = rowMarkups[s.id] ?? s.markup;
    if (currentMarkup === s.markup) return;

    startTransition(async () => {
      const res = await updateServiceMarkupAction(s.id, currentMarkup);
      if (res.success) {
        toast.success('Наценка обновлена');
        router.refresh();
      } else {
        setRowMarkups(prev => ({ ...prev, [s.id]: s.markup }));
        toast.error(res.error || 'Ошибка обновления наценки');
      }
    });
  };

  return (
    <div className="space-y-3.5 w-full">
      {/* ─── FILTERS 2X4 (DEBOUNCED & MODULAR) ─── */}
      <CatalogFilters
        categories={categories}
        providers={providers}
        networks={networks}
        selectedTenant={selectedTenant}
      />

      {/* ─── TOP CONTROLS & BATCH ACTION BAR ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card/60 backdrop-blur-md border border-border p-2.5 sm:p-3 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && canEdit && (
            <BatchActionBar
              selectedIds={selectedIds}
              categories={categories}
              canEditFinance={canEditFinance}
              onClear={() => setSelectedIds([])}
            />
          )}
          {selectedIds.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Показано: <strong className="text-foreground">{visibleServices.length}</strong> услуг</span>
            </div>
          )}
        </div>

        {/* Currency & Unit switches */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Unit / 1K Switch */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setVolume('UNIT')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                volume === 'UNIT' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              За 1 шт
            </button>
            <button
              type="button"
              onClick={() => setVolume('1K')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                volume === '1K' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              За 1000 шт
            </button>
          </div>

          {/* Currency Switch */}
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setCurrency('RUB')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                currency === 'RUB' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              RUB (₽)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                currency === 'USD' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              USD ($)
            </button>
          </div>
        </div>
      </div>

      {/* ─── DATA TABLE ─── */}
      <div className="bg-card/70 backdrop-blur-md border border-border rounded-xl shadow-2xs overflow-hidden w-full">
        <Table.ScrollContainer>
          <Table aria-label="Таблица услуг каталога" className="w-full">
            <Table.Header className="bg-muted/40 border-b border-border">
              {/* 1. Checkbox */}
              <Table.Column className={canEdit ? "w-8 px-2 py-2 text-center" : "hidden"}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  aria-label="Выбрать все услуги"
                  className="rounded border-border text-primary focus:ring-primary cursor-pointer w-4 h-4"
                  disabled={!canEdit || visibleServices.length === 0}
                />
              </Table.Column>

              {/* 2. ID */}
              <Table.Column isRowHeader className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 w-12">
                {renderSortableHeader('numericId', 'ID')}
              </Table.Column>

              {/* 3. Name */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 max-w-[180px]">
                {renderSortableHeader('name', 'УСЛУГА / ТАРИФ')}
              </Table.Column>

              {/* 4. Network */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2">
                СОЦСЕТЬ
              </Table.Column>

              {/* 5. Category */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2">
                КАТЕГОРИЯ
              </Table.Column>

              {/* 6. Provider */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 max-w-[160px]">
                ПРОВАЙДЕР
              </Table.Column>

              {/* 7. Status */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 text-center">
                СТАТУС
              </Table.Column>

              {/* 8. Provider Status */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 text-center">
                ПОСТАВЩИК
              </Table.Column>

              {/* 9. Markup */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 text-center w-20">
                {renderSortableHeader('markup', 'НАЦЕНКА')}
              </Table.Column>

              {/* 10. Price */}
              <Table.Column className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider px-2 py-2 text-right w-24">
                {renderSortableHeader('price', 'ЦЕНА')}
              </Table.Column>

              {/* 11. Actions */}
              <Table.Column className={canEdit ? "w-16 px-2 py-2 text-right" : "hidden"}>
                ДЕЙСТВИЯ
              </Table.Column>
            </Table.Header>

            <Table.Body renderEmptyState={() => (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ShoppingCart className="w-8 h-8 opacity-20" />
                <p className="text-sm">Услуги по выбранным критериям не найдены</p>
              </div>
            )}>
              {visibleServices.map(s => {
                const isChecked = selectedIds.includes(s.id);
                const currentIsActive = rowActive[s.id] !== undefined ? rowActive[s.id] : s.isActive;
                const currentMarkup = rowMarkups[s.id] !== undefined ? rowMarkups[s.id] : s.markup;
                const currentPrice = rowPrices[s.id] !== undefined 
                  ? rowPrices[s.id] 
                  : String(calcDisplayPrice(s.rate, currentMarkup, usdToRub, currency, volume));

                const categoryObj = categories.find(c => c.id === s.categoryId);
                const networkName = categoryObj?.network?.name || s.networkName;
                const networkSlug = categoryObj?.network?.slug || s.networkSlug || 'telegram';
                const cleanCategoryName = formatCleanCategoryName(categoryObj?.name || s.categoryName, networkName || undefined);
                const providerObj = providers.find(p => p.id === s.providerId);
                const providerName = providerObj?.name || (s.providerId ? 'Провайдер' : '—');

                const isBelowSafety = currentMarkup < SAFETY_MULTIPLIER;
                const isZombie = Boolean(s.cooldownReason && s.cooldownReason.includes('ZOMBIE'));

                return (
                  <Table.Row
                    key={s.id}
                    className={`border-b border-border/40 hover:bg-muted/40 transition-colors ${
                      isChecked ? 'bg-primary/5' : ''
                    } ${!currentIsActive ? 'opacity-60' : ''}`}
                  >
                    {/* 1. CHECKBOX */}
                    <Table.Cell className={canEdit ? "py-2 px-2 text-center" : "hidden"}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRow(s.id)}
                        aria-label={`Выбрать ${s.name}`}
                        className="rounded border-border text-primary focus:ring-primary cursor-pointer w-4 h-4"
                      />
                    </Table.Cell>

                    {/* 2. ID */}
                    <Table.Cell className="py-2 px-2 font-mono text-xs font-bold text-muted-foreground tabular-nums">
                      #{s.numericId || s.id.slice(-4)}
                    </Table.Cell>

                    {/* 3. НАЗВАНИЕ */}
                    <Table.Cell className="py-2 px-2 max-w-[180px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <UniversalIcon icon={s.icon || s.categoryIcon || (networkSlug ? `brand:${networkSlug}` : null)} size={14} className="shrink-0 text-primary" />
                          <span className="font-semibold text-xs text-foreground truncate block" title={s.name}>
                            {s.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 pl-5">
                          {s.qualityTier && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground font-bold">
                              {s.qualityTier}
                            </span>
                          )}
                          {s.ordersCount > 0 && (
                            <span className="text-[9px] font-mono text-muted-foreground">
                              {s.ordersCount} зак.
                            </span>
                          )}
                        </div>
                      </div>
                    </Table.Cell>

                    {/* 4. СОЦСЕТЬ */}
                    <Table.Cell className="py-2 px-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        {networkSlug && <UniversalIcon icon={networkSlug ? `brand:${networkSlug}` : null} size={14} />}
                        <span className="truncate max-w-[80px]">{networkName || '—'}</span>
                      </div>
                    </Table.Cell>

                    {/* 5. КАТЕГОРИЯ */}
                    <Table.Cell className="py-2 px-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium truncate max-w-[120px]" title={cleanCategoryName}>
                        {s.categoryIcon && <UniversalIcon icon={s.categoryIcon} size={12} className="shrink-0" />}
                        <span className="truncate">{cleanCategoryName}</span>
                      </div>
                    </Table.Cell>

                    {/* 6. ПРОВАЙДЕР */}
                    <Table.Cell className="py-2 px-2 max-w-[160px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground truncate" title={providerName}>
                          {providerName}
                        </span>
                        {s.externalId && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ID: {s.externalId}
                          </span>
                        )}
                      </div>
                    </Table.Cell>

                    {/* 7. СТАТУС УСЛУГИ */}
                    <Table.Cell className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s.id, s.isActive)}
                        disabled={!canEdit || isPending}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full transition-all cursor-pointer ${
                          currentIsActive 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 border border-border'
                        }`}
                      >
                        {currentIsActive ? 'Активна' : 'Откл.'}
                      </button>
                    </Table.Cell>

                    {/* 8. СТАТУС ПРОВАЙДЕРА */}
                    <Table.Cell className="py-2 px-2 text-center">
                      {isZombie ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20" title="Удалена у провайдера">
                          <AlertCircle className="w-2.5 h-2.5" /> Zombie
                        </span>
                      ) : s.providerId ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Manual
                        </span>
                      )}
                    </Table.Cell>

                    {/* 9. НАЦЕНКА */}
                    <Table.Cell className="py-2 px-2 text-center">
                      {canEditFinance && s.providerId ? (
                        <div className="relative inline-flex items-center justify-center">
                          <span className="absolute left-1 text-[10px] text-muted-foreground pointer-events-none font-bold">+</span>
                          <input
                            type="number"
                            value={currentMarkup > 0 ? ((currentMarkup - 1) * 100).toFixed(0) : "0"}
                            onChange={e => handlePercentChange(s, e.target.value)}
                            onBlur={() => saveMarkup(s)}
                            onKeyDown={e => e.key === 'Enter' && saveMarkup(s)}
                            disabled={isPending || !canEditFinance}
                            className={`w-14 pl-2.5 pr-1 py-0.5 text-xs font-mono font-bold rounded-lg border outline-none transition-all tabular-nums text-center ${
                              isBelowSafety
                                ? 'border-rose-400 bg-destructive/10 text-rose-700 focus:ring-2 focus:ring-rose-500/20'
                                : 'border-border/80 bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
                            } disabled:opacity-50`}
                          />
                          <span className="ml-0.5 text-[10px] text-muted-foreground font-black">%</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          {s.providerId ? `+${((currentMarkup - 1) * 100).toFixed(0)}%` : '—'}
                        </span>
                      )}
                    </Table.Cell>

                    {/* 10. ЦЕНА */}
                    <Table.Cell className="py-2 px-2 text-right">
                      {canEdit ? (
                        <div className="inline-flex items-center justify-end">
                          <input
                            type="number"
                            step={volume === '1K' ? '1' : '0.0001'}
                            value={currentPrice}
                            onChange={e => handlePriceChange(s, e.target.value)}
                            onBlur={() => saveMarkup(s)}
                            onKeyDown={e => e.key === 'Enter' && saveMarkup(s)}
                            disabled={isPending || !canEditFinance}
                            className={`w-18 px-1.5 py-0.5 text-xs font-mono font-black rounded-lg border outline-none transition-all tabular-nums text-right ${
                              isBelowSafety
                                ? 'border-rose-400 bg-destructive/10 text-rose-700 focus:ring-2 focus:ring-rose-500/20'
                                : 'border-border/80 bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
                            } disabled:opacity-50`}
                          />
                          <span className="ml-0.5 text-xs text-muted-foreground font-bold">{currency === 'RUB' ? '₽' : '$'}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono font-black text-foreground tabular-nums">
                          {currentPrice} {currency === 'RUB' ? '₽' : '$'}
                        </span>
                      )}
                    </Table.Cell>

                    {/* 11. ДЕЙСТВИЯ */}
                    <Table.Cell className={canEdit ? "py-2 px-2 text-right" : "hidden"}>
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={searchParams.toString() ? `/admin/catalog/${s.id}?returnUrl=${encodeURIComponent(`/admin/catalog?${searchParams.toString()}`)}` : `/admin/catalog/${s.id}`}
                          title="Редактировать услугу"
                          aria-label={`Редактировать услугу ${s.name}`}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>

                        <ArchiveButton service={s} onDeleted={handleServiceDeleted} />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </Table.ScrollContainer>
      </div>
    </div>
  );
}
