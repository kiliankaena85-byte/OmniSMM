'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGlobalProviderLiquidityAction } from '@/actions/admin/providers/balance';
import { GlobalLiquiditySummary } from '@/services/admin/provider-balance.service';
import { Loader2, TrendingDown, TrendingUp, AlertTriangle, Activity, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export function ProviderLiquidityWidget() {
  const [data, setData] = useState<GlobalLiquiditySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLiquidity = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const res = await getGlobalProviderLiquidityAction(forceRefresh);
      if (res.success) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error || 'Не удалось загрузить данные');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Сетевая ошибка';
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiquidity(false);
  }, [fetchLiquidity]);

  if (isLoading) {
    return (
      <div className="bg-card text-card-foreground rounded-lg p-5 shadow-sm border border-border/70 transition-all hover:shadow-md animate-pulse flex flex-col justify-between h-[280px]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Ликвидность у поставщиков</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-card text-card-foreground rounded-lg p-5 shadow-sm border border-destructive/30 transition-all hover:shadow-md h-[280px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Ликвидность у поставщиков</span>
          <AlertTriangle className="w-4 h-4 text-destructive" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-destructive mb-3">{error || 'Ошибка загрузки данных'}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchLiquidity(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground border border-border transition-all duration-200 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Повторить
            </button>
            <Link href="/admin/providers" className="text-xs font-semibold text-primary hover:underline">
              Проверить провайдеров →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalStr = data.totalRub.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const totalUsdStr = data.totalUsd.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const burnStr = data.burnRate24hRub.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const isDanger = data.totalRub < 5000 || data.criticalCount > 0;
  const runwayDays = data.runwayDays;

  return (
    <div className="bg-card text-card-foreground rounded-lg p-5 shadow-sm border border-border/70 flex flex-col justify-between h-full min-h-[260px] space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Ликвидность у поставщиков</span>
            <button
              type="button"
              onClick={() => fetchLiquidity(true)}
              disabled={isRefreshing}
              aria-label="Обновить показатели ликвидности"
              title="Обновить данные"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded-md border border-border/50 text-[10px] font-bold text-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>Провайдеры ({data.activeCount})</span>
          </div>
        </div>

        <div className="flex items-baseline gap-2.5">
          <div className="text-2xl lg:text-3xl font-extrabold text-foreground tabular-nums tracking-tight font-mono">
            {totalStr} ₽
          </div>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums font-mono">
            (~${totalUsdStr})
          </span>
          <div className="ml-auto">
            {isDanger ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                <TrendingDown className="w-3 h-3" /> Требует пополнения
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <TrendingUp className="w-3 h-3" /> В норме
              </span>
            )}
          </div>
        </div>

        {/* 3-Tier Status Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <span
            title="Провайдеры с достаточным балансом"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 select-none text-[11px]"
          >
            <CheckCircle2 className="w-3 h-3" />
            <span className="tabular-nums font-mono font-bold">{data.healthyCount}</span> в норме
          </span>

          {data.warningCount > 0 && (
            <span
              title="Провайдеры с низким балансом"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 select-none text-[11px]"
            >
              <AlertTriangle className="w-3 h-3" />
              <span className="tabular-nums font-mono font-bold">{data.warningCount}</span> мало
            </span>
          )}

          {data.criticalCount > 0 && (
            <span
              title="Критический остаток. Срочно требуется пополнение!"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 animate-pulse select-none text-[11px]"
            >
              <AlertCircle className="w-3 h-3" />
              <span className="tabular-nums font-mono font-bold">{data.criticalCount}</span> критично
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-medium bg-muted/20 p-2.5 rounded-md border border-border/40 mb-2">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span>Расход за 24ч:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground tabular-nums font-mono text-[11px]">{burnStr} ₽</span>
            {runwayDays !== null && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  runwayDays < 3
                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    : runwayDays < 7
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}
              >
                Запас: ~{runwayDays} дн.
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-auto w-full pt-2">
        <Link href="/admin/providers" className="w-full block">
          <button
            type="button"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md text-xs h-9 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Управление провайдерами ({data.activeCount})</span>
            {data.criticalCount + data.errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-destructive text-destructive-foreground">
                {data.criticalCount + data.errorCount}
              </span>
            )}
          </button>
        </Link>
      </div>
    </div>
  );
}
