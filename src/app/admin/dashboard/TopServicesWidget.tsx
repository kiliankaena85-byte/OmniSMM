import React from 'react';
import Link from 'next/link';
import { Flame, ArrowRight, TrendingUp } from 'lucide-react';
import { formatKopecks } from '@/utils/format-kopecks';

interface TopServiceItem {
  id: string;
  name: string;
  networkName: string;
  categoryName: string;
  ordersCount: number;
  revenueKopecks: bigint;
  profitKopecks: bigint;
  marginPct: number;
}

interface Props {
  services: TopServiceItem[];
}

export function TopServicesWidget({ services }: Props) {
  return (
    <div className="bg-card text-card-foreground rounded-lg p-5 border border-border/70 shadow-sm flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
              Топ услуг-драйверов (Выручка и заказы)
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Наиболее востребованные позиции каталога с расчетом маржинальности
            </p>
          </div>
        </div>
        <Link
          href="/admin/catalog"
          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
        >
          <span>Каталог</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content List */}
      {services.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Услуги за выбранный период не найдены
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {services.map((s, idx) => (
            <div
              key={s.id}
              className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 px-2 rounded-md transition-colors"
            >
              {/* Rank & Service Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono font-bold text-muted-foreground w-4 text-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[260px]" title={s.name}>
                    {s.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <span className="px-1.5 py-0.2 rounded bg-muted font-bold text-foreground uppercase text-[9px]">
                      {s.networkName}
                    </span>
                    <span>•</span>
                    <span>{s.categoryName}</span>
                    <span>•</span>
                    <span>Заказов: <strong className="text-foreground">{s.ordersCount}</strong></span>
                  </div>
                </div>
              </div>

              {/* Revenue & Margin Badge */}
              <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                <span className="font-mono font-extrabold text-foreground tabular-nums text-xs">
                  {formatKopecks(s.revenueKopecks)}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                    s.marginPct >= 30
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                  }`}
                >
                  +{s.marginPct}% маржа
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
