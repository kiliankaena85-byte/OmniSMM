'use client';

import type {
  ImportServicesResult,
  ImportSkippedItem,
} from '@/services/admin/catalog.service';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  TrendingUp,
  PackageX,
} from 'lucide-react';

const SKIP_REASON_LABELS: Record<string, string> = {
  ALREADY_EXISTS: 'Уже импортирована',
  REMOVED_BY_PROVIDER: 'Удалена провайдером',
  INVALID_RATE: 'Некорректная цена у провайдера',
  NOT_IN_SHADOW_CATALOG: 'Не найдена в теневом каталоге',
  UNKNOWN_PLATFORM: 'Не определена социальная сеть',
};

const MAX_ITEMS_PER_REASON = 8;

function formatSkippedItem(item: ImportSkippedItem): string {
  const name = item.name || `ID ${item.externalId}`;
  const tenants = item.tenantIds?.length ? ` — тенант: ${item.tenantIds.join(', ')}` : '';
  return `${name} [${item.externalId}]${tenants}`;
}

function formatMultiplier(value: number): string {
  return `×${value.toFixed(2).replace(/\.?0+$/, '') || '0'}`;
}

/**
 * AUD-04 / AUD-13: post-import transparency card.
 * Shows exactly what was imported, what was skipped (with per-item reasons),
 * which markups were raised to the safety floor, and which price source was used.
 */
export function ImportReportCard({
  report,
  onClose,
}: {
  report: ImportServicesResult;
  onClose: () => void;
}) {
  // Group skipped items by reason
  const skippedByReason = new Map<string, ImportSkippedItem[]>();
  for (const item of report.skipped) {
    const list = skippedByReason.get(item.reason) ?? [];
    list.push(item);
    skippedByReason.set(item.reason, list);
  }

  const priceSourceLabel = report.usedLivePrices
    ? 'Живые цены API провайдера'
    : `Теневой каталог${report.shadowCatalogAgeHours !== null ? ` (${report.shadowCatalogAgeHours.toFixed(1)} ч назад)` : ''}`;

  const stats = [
    {
      label: 'Запрошено',
      value: report.totalRequested,
      icon: <Info className="w-3.5 h-3.5" />,
      cls: 'text-foreground bg-muted/50',
    },
    {
      label: 'Импортировано',
      value: report.importedCount,
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: 'text-success bg-success/5',
    },
    {
      label: 'Пропущено',
      value: report.skipped.length,
      icon: <PackageX className="w-3.5 h-3.5" />,
      cls: report.skipped.length > 0 ? 'text-warning bg-warning/5' : 'text-muted-foreground bg-muted/50',
    },
    {
      label: 'Наценка скорректирована',
      value: report.markupAdjustments.length,
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      cls: report.markupAdjustments.length > 0 ? 'text-warning bg-warning/5' : 'text-muted-foreground bg-muted/50',
    },
  ];

  return (
    <div className="relative bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-5 shadow-sm space-y-4 ring-1 ring-border/5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Отчёт импорта</h3>
            <p className="text-[11px] text-muted-foreground">
              Источник цен: {priceSourceLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть отчёт импорта"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-[10px] px-3 py-2 border border-border/50 ${stat.cls.split(' ')[1] ?? ''}`}
          >
            <div className={`flex items-center gap-1.5 mb-0.5 ${stat.cls.split(' ')[0]}`}>
              {stat.icon}
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                {stat.label}
              </span>
            </div>
            <span className={`text-xl font-bold tabular-nums ${stat.cls.split(' ')[0]}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Skipped services grouped by reason */}
      {report.skipped.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-warning">
            <AlertTriangle className="w-3.5 h-3.5" />
            Пропущенные услуги ({report.skipped.length})
          </div>
          {Array.from(skippedByReason.entries()).map(([reason, items]) => (
            <div
              key={reason}
              className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2"
            >
              <div className="text-[11px] font-bold text-foreground mb-1">
                {SKIP_REASON_LABELS[reason] || reason} — {items.length}
              </div>
              <ul className="text-[11px] text-muted-foreground leading-relaxed">
                {items.slice(0, MAX_ITEMS_PER_REASON).map((item) => (
                  <li key={`${item.reason}-${item.externalId}-${item.tenantIds?.join(',') ?? ''}`}>
                    • {formatSkippedItem(item)}
                  </li>
                ))}
                {items.length > MAX_ITEMS_PER_REASON && (
                  <li>• …и ещё {items.length - MAX_ITEMS_PER_REASON}</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Safety floor markup adjustments */}
      {report.markupAdjustments.length > 0 && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2">
          <div className="text-[11px] font-bold text-foreground mb-1">
            Наценка поднята до минимума (×3.0, safety floor) — {report.markupAdjustments.length}
          </div>
          <ul className="text-[11px] text-muted-foreground leading-relaxed">
            {report.markupAdjustments.slice(0, MAX_ITEMS_PER_REASON).map((adj) => (
              <li key={`adj-${adj.externalId}`}>
                • {adj.name || `ID ${adj.externalId}`} [{adj.externalId}]:{' '}
                {formatMultiplier(adj.requestedMarkup)} → {formatMultiplier(adj.appliedMarkup)}
              </li>
            ))}
            {report.markupAdjustments.length > MAX_ITEMS_PER_REASON && (
              <li>• …и ещё {report.markupAdjustments.length - MAX_ITEMS_PER_REASON}</li>
            )}
          </ul>
        </div>
      )}

      {/* Warnings (shadow fallback, DB-level skips) */}
      {report.warnings.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 space-y-1">
          {report.warnings.map((warning, idx) => (
            <p key={idx} className="text-[11px] text-destructive font-medium leading-relaxed">
              ⚠ {warning}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
