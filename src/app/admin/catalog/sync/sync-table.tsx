'use client';

import { useState, useMemo, useTransition } from 'react';
import { toast } from 'sonner';
import { Copy, Scale, Loader2 } from 'lucide-react';
import {
  type GapRow,
  copyServicesToTenantAction,
  alignPricesAction,
} from '@/actions/admin/catalog/sync';
import { formatPricePerUnit } from '@/utils/format-price';

interface SyncTableProps {
  rows: GapRow[];
  stats: {
    smmplan: number;
    flux: number;
    gap: number;
    both: number;
  };
}

type FilterType = 'all' | 'gap' | 'both' | 'smmplan-only' | 'flux-only';

export function SyncTable({ rows, stats }: SyncTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [markupMultiplier, setMarkupMultiplier] = useState<number>(1.0);
  const [isPending, startTransition] = useTransition();

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Search text
      if (search.trim()) {
        const query = search.toLowerCase().trim();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesSlug = r.slug.toLowerCase().includes(query);
        const matchesCategory = r.categoryName.toLowerCase().includes(query);
        const matchesNetwork = r.networkName.toLowerCase().includes(query);
        if (!matchesName && !matchesSlug && !matchesCategory && !matchesNetwork) {
          return false;
        }
      }

      // Filter tab
      switch (filter) {
        case 'gap':
          return !r.smmplan.exists || !r.flux.exists;
        case 'both':
          return r.smmplan.exists && r.flux.exists;
        case 'smmplan-only':
          return r.smmplan.exists && !r.flux.exists;
        case 'flux-only':
          return !r.smmplan.exists && r.flux.exists;
        case 'all':
        default:
          return true;
      }
    });
  }, [rows, filter, search]);

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedSlugs.has(r.slug));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(filteredRows.map((r) => r.slug)));
    }
  };

  const toggleRow = (slug: string) => {
    const next = new Set(selectedSlugs);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    setSelectedSlugs(next);
  };

  const selectedRows = useMemo(() => {
    return rows.filter((r) => selectedSlugs.has(r.slug));
  }, [rows, selectedSlugs]);

  // Copy services handler
  const handleCopy = (sourceTenantId: 'smmplan' | 'flux', targetTenantId: 'smmplan' | 'flux') => {
    const targetServiceIds = selectedRows
      .map((r) => r[sourceTenantId].serviceId)
      .filter((id): id is string => Boolean(id));

    if (targetServiceIds.length === 0) {
      toast.error(`Нет услуг для копирования из ${sourceTenantId}`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await copyServicesToTenantAction({
          serviceIds: targetServiceIds,
          sourceTenantId,
          targetTenantId,
          markupMultiplier,
        });

        if (!res.success) {
          toast.error(res.error || 'Ошибка при копировании');
          return;
        }

        if (res.errors && res.errors.length > 0) {
          toast.warning(`Скопировано: ${res.copied}, Пропущено: ${res.skipped}. Ошибок: ${res.errors.length}`);
        } else {
          toast.success(`Успешно скопировано ${res.copied} услуг в ${targetTenantId} (пропущено: ${res.skipped})`);
        }
        setSelectedSlugs(new Set());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Ошибка при копировании: ${msg}`);
      }
    });
  };

  // Align prices handler
  const handleAlign = (sourceTenantId: 'smmplan' | 'flux', targetTenantId: 'smmplan' | 'flux') => {
    const slugs = selectedRows.map((r) => r.slug);
    if (slugs.length === 0) {
      toast.error('Выберите хотя бы одну услугу для выравнивания цен');
      return;
    }

    startTransition(async () => {
      try {
        const res = await alignPricesAction({
          slugs,
          sourceTenantId,
          targetTenantId,
          markupMultiplier,
        });

        if (!res.success) {
          toast.error(res.error || 'Ошибка при выравнивании цен');
          return;
        }

        toast.success(`Успешно обновлены цены для ${res.updated} услуг в ${targetTenantId}`);
        setSelectedSlugs(new Set());
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Ошибка при выравнивании цен: ${msg}`);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium text-muted-foreground">Всего уникальных (slug)</div>
          <div className="text-2xl font-bold text-foreground mt-1">{rows.length}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium text-muted-foreground">На SMMplan</div>
          <div className="text-2xl font-bold text-primary mt-1">{stats.smmplan}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium text-muted-foreground">На SMMflux</div>
          <div className="text-2xl font-bold text-success mt-1">{stats.flux}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-sm font-medium text-muted-foreground">Расхождения (Gap)</div>
          <div className="text-2xl font-bold text-warning mt-1">{stats.gap}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-card overflow-x-auto max-w-full">
          {(
            [
              { id: 'all', label: `Все (${rows.length})` },
              { id: 'gap', label: `Расхождения (${stats.gap})` },
              { id: 'both', label: `На обоих (${stats.both})` },
              { id: 'smmplan-only', label: `Только SMMplan (${stats.smmplan - stats.both})` },
              { id: 'flux-only', label: `Только SMMflux (${stats.flux - stats.both})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                filter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Поиск по названию, slug, сети..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 px-3 py-1.5 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Batch Action Bar */}
      {selectedSlugs.size > 0 && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {selectedSlugs.size}
            </span>
            <span>выбрано услуг</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium">Множитель наценки:</label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="5.0"
                value={markupMultiplier}
                onChange={(e) => setMarkupMultiplier(parseFloat(e.target.value) || 1.0)}
                className="w-20 px-2 py-1 text-xs rounded border border-border bg-background text-foreground text-center"
              />
            </div>

            <button
              disabled={isPending}
              onClick={() => handleCopy('smmplan', 'flux')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-primary-foreground disabled:opacity-50 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Скопировать SMMplan → SMMflux
            </button>

            <button
              disabled={isPending}
              onClick={() => handleCopy('flux', 'smmplan')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
              Скопировать SMMflux → SMMplan
            </button>

            <button
              disabled={isPending}
              onClick={() => handleAlign('smmplan', 'flux')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-accent text-foreground disabled:opacity-50 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5" />}
              Выровнять цены (SMMplan → Flux)
            </button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-medium border-b border-border">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th className="p-3">Услуга / Slug</th>
                <th className="p-3">Сеть</th>
                <th className="p-3">Категория</th>
                <th className="p-3 text-right">SMMplan (1000 шт)</th>
                <th className="p-3 text-right">SMMflux (1000 шт)</th>
                <th className="p-3 text-center">Δ Разница</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Услуги не найдены
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const isSelected = selectedSlugs.has(r.slug);
                  const pricePlan = r.smmplan.pricePer1000Cents
                    ? r.smmplan.pricePer1000Cents / 100
                    : null;
                  const priceFlux = r.flux.pricePer1000Cents
                    ? r.flux.pricePer1000Cents / 100
                    : null;

                  let diffPercentStr = '—';
                  let diffColor = 'text-muted-foreground';

                  if (pricePlan && priceFlux) {
                    const diff = ((priceFlux - pricePlan) / pricePlan) * 100;
                    if (Math.abs(diff) < 0.1) {
                      diffPercentStr = '0%';
                    } else {
                      diffPercentStr = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                      diffColor = diff > 0 ? 'text-success font-semibold' : 'text-warning font-semibold';
                    }
                  }

                  return (
                    <tr
                      key={r.slug}
                      onClick={() => toggleRow(r.slug)}
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(r.slug)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.slug}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.networkName || '—'}</td>
                      <td className="p-3 text-muted-foreground">{r.categoryName || '—'}</td>
                      <td className="p-3 text-right">
                        {r.smmplan.exists ? (
                          <span className="font-semibold text-foreground">
                            {pricePlan !== null ? `${formatPricePerUnit(pricePlan)} ₽` : '—'}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-xs rounded bg-destructive/10 text-destructive font-medium">
                            —
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {r.flux.exists ? (
                          <span className="font-semibold text-foreground">
                            {priceFlux !== null ? `${formatPricePerUnit(priceFlux)} ₽` : '—'}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-xs rounded bg-destructive/10 text-destructive font-medium">
                            —
                          </span>
                        )}
                      </td>
                      <td className={`p-3 text-center ${diffColor}`}>{diffPercentStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
