import React from 'react';
import Link from 'next/link';
import { AlertOctagon, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatKopecks } from '@/utils/format-kopecks';

interface FailingService {
  name: string;
  network: string;
  count: number;
}

interface RefundStats {
  totalOrders: number;
  canceledOrders: number;
  partialOrders: number;
  errorOrders: number;
  problematicCount: number;
  failureRate: string;
  totalRefundsKopecks: bigint;
  topFailingServices: FailingService[];
}

interface Props {
  stats: RefundStats;
}

export function RefundMonitorWidget({ stats }: Props) {
  const isHealthy = Number(stats.failureRate) < 5;

  return (
    <div className="bg-card text-card-foreground rounded-xl p-4 sm:p-5 border border-border/70 shadow-sm flex flex-col justify-between space-y-4">
      {/* ── 1. Header with Status Badge & Link ── */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {isHealthy ? (
              <AlertOctagon className="w-4 h-4" />
            ) : (
              <ShieldAlert className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-xs uppercase tracking-wider text-foreground truncate">
              Монитор возвратов и отказов провайдеров
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              Контроль качества поставщиков, отмен заказов и частичных возвратов на баланс
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono ${
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            {stats.failureRate}% сбоев / отмен
          </span>
          <Link
            href="/admin/orders?status=PROBLEMATIC"
            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Проблемные заказы</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* ── 2. Summary KPI Cards (3 Equal Grid Columns) ── */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-xs">
        {/* Отменено */}
        <div className="p-3 rounded-lg bg-muted/25 border border-border/50 flex flex-col justify-between min-w-0">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate">
            Отменено
          </span>
          <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-lg sm:text-xl mt-1 tabular-nums">
            {stats.canceledOrders}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">заказов</span>
        </div>

        {/* Частично */}
        <div className="p-3 rounded-lg bg-muted/25 border border-border/50 flex flex-col justify-between min-w-0">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate">
            Частично
          </span>
          <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-lg sm:text-xl mt-1 tabular-nums">
            {stats.partialOrders}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">с остатком</span>
        </div>

        {/* Возвращено */}
        <div className="p-3 rounded-lg bg-muted/25 border border-border/50 flex flex-col justify-between min-w-0">
          <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate">
            Возвращено
          </span>
          <span className="font-mono font-extrabold text-foreground text-sm sm:text-base mt-1 tabular-nums truncate">
            {formatKopecks(stats.totalRefundsKopecks)}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">на балансы</span>
        </div>
      </div>

      {/* ── 3. Top Failing Services Section ── */}
      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
          <span>Услуги с наибольшим числом сбоев:</span>
          {stats.topFailingServices.length > 0 && (
            <span className="text-muted-foreground font-normal lowercase">
              Топ-{stats.topFailingServices.length}
            </span>
          )}
        </div>

        {stats.topFailingServices.length === 0 ? (
          <div className="p-3 rounded-lg bg-muted/15 border border-border/40 text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[11px] font-medium text-foreground/80">
              Сбоев и отмен по услугам не зафиксировано
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stats.topFailingServices.map((fs, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-muted/25 border border-border/40 flex items-center justify-between text-xs min-w-0 gap-2 hover:bg-muted/40 transition-colors"
              >
                <div className="truncate pr-1 min-w-0">
                  <span className="font-semibold text-foreground truncate block text-[11px]" title={fs.name}>
                    {fs.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                    {fs.network}
                  </span>
                </div>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[10px] shrink-0 border border-rose-500/20">
                  {fs.count} шт
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
