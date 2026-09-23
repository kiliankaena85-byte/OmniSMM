import React from 'react';
import { Info } from 'lucide-react';
import type { FluxTransactionsSummary } from './types';

interface FluxTransactionsSummaryBannerProps {
  summary: FluxTransactionsSummary;
  currentBalanceRub: number;
}

export function FluxTransactionsSummaryBanner({
  summary,
  currentBalanceRub,
}: FluxTransactionsSummaryBannerProps) {
  return (
    <div className="p-6 sm:p-7 rounded-[2.5rem] bg-card/85 backdrop-blur-2xl border border-border/60 shadow-lg shadow-black/5 relative overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Формула вашего баланса</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">
              100% Прозрачно
            </span>
          </div>
          <h2 className="text-xl font-black text-foreground">
            Чистые расходы на продвижение: {summary.totalSpentNet.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </h2>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Рассчитывается как: <strong>Пополнено ({summary.totalDeposited.toFixed(0)} ₽)</strong> минус <strong>Фактически выполненные заказы ({summary.totalSpentNet.toFixed(0)} ₽)</strong> = <strong>Текущий остаток ({currentBalanceRub.toFixed(2)} ₽)</strong>.
          </p>
        </div>

        {/* Balance Breakdown Pills */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
          <div className="flex-1 sm:flex-initial p-3.5 rounded-2xl bg-muted/40 border border-border/30 text-center min-w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground block uppercase">Пополнено</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{summary.totalDeposited.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
            </span>
          </div>

          <div className="text-muted-foreground font-bold text-lg hidden sm:block">-</div>

          <div className="flex-1 sm:flex-initial p-3.5 rounded-2xl bg-muted/40 border border-border/30 text-center min-w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground block uppercase">Чистые траты</span>
            <span className="text-base font-black text-rose-500 tabular-nums">
              -{summary.totalSpentNet.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
            </span>
          </div>

          <div className="text-muted-foreground font-bold text-lg hidden sm:block">=</div>

          <div className="flex-1 sm:flex-initial p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-center min-w-[120px]">
            <span className="text-[10px] font-black text-primary block uppercase">На счете</span>
            <span className="text-base font-black text-primary tabular-nums">
              {currentBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </span>
          </div>
        </div>
      </div>

      {summary.totalRefunded > 0 && (
        <div className="mt-5 pt-4 border-t border-border/40 flex items-center gap-3 text-xs text-muted-foreground font-medium">
          <div className="w-6 h-6 rounded-full bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5" />
          </div>
          <span>
            Вам возвращено <strong>+{summary.totalRefunded.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</strong> за отмененные остатки. Эти средства уже зачислены на баланс и готовы к повторным заказам.
          </span>
        </div>
      )}
    </div>
  );
}
