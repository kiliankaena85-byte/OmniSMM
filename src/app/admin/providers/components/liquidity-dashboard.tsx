'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { TrendingDown, Wallet, Clock, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import type { GlobalLiquiditySummary } from '@/services/admin/provider-balance.service';
import { getGlobalProviderLiquidityAction } from '@/actions/admin/providers/balance';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface LiquidityDashboardProps {
  data?: GlobalLiquiditySummary | null;
}

export function LiquidityDashboard({ data: initialData }: LiquidityDashboardProps) {
  const [data, setData] = useState<GlobalLiquiditySummary | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!initialData) {
      setIsLoading(true);
      getGlobalProviderLiquidityAction(false)
        .then((res) => {
          if (res.success && res.data) {
            setData(res.data);
          }
        })
        .catch((err) => {
          console.warn('[LiquidityDashboard] Failed to fetch liquidity:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [initialData]);

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const res = await getGlobalProviderLiquidityAction(true);
        if (res.success && res.data) {
          setData(res.data);
          toast.success('Ликвидность обновлена');
          router.refresh();
        } else {
          toast.error('Не удалось обновить ликвидность');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Ошибка обновления';
        toast.error(msg);
      }
    });
  };

  if (isLoading || !data) {
    return (
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-[24px] shadow-sm p-5 sm:p-6 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-4 w-36 bg-muted rounded-md" />
            <div className="h-3 w-48 bg-muted/60 rounded-md" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Загрузка балансов...</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-20 bg-muted/40 rounded-[14px]" />
          <div className="h-20 bg-muted/40 rounded-[14px]" />
          <div className="h-20 bg-muted/40 rounded-[14px]" />
        </div>
      </div>
    );
  }

  const runwayText =
    data.runwayDays === null
      ? '∞'
      : data.runwayDays > 30
      ? `${data.runwayDays} дн.`
      : data.runwayDays > 7
      ? `${data.runwayDays} дн.`
      : `⚠️ ${data.runwayDays} дн.`;

  const runwayColor =
    data.runwayDays === null
      ? 'text-foreground'
      : data.runwayDays > 14
      ? 'text-success'
      : data.runwayDays > 3
      ? 'text-warning'
      : 'text-destructive animate-pulse';

  const stats = [
    {
      label: 'Общий баланс',
      value: `$${data.totalUsd.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`,
      sub: `${data.totalRub.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`,
      icon: <Wallet className="w-4 h-4" />,
      color: 'text-primary',
      bg: 'bg-primary/5 border-primary/20',
    },
    {
      label: 'Расход за 24ч',
      value: `${data.burnRate24hRub.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`,
      sub: 'по закрытым заказам',
      icon: <TrendingDown className="w-4 h-4" />,
      color: 'text-foreground',
      bg: 'bg-muted/50 border-border/50',
    },
    {
      label: 'Запас хода',
      value: runwayText,
      sub: 'при текущем расходе',
      icon: <Clock className="w-4 h-4" />,
      color: runwayColor,
      bg: 'bg-muted/50 border-border/50',
    },
  ];

  const statusCounts = [
    { label: 'Норма', count: data.healthyCount, icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-success bg-success/10 border-success/20' },
    { label: 'Внимание', count: data.warningCount, icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-warning bg-warning/10 border-warning/20' },
    { label: 'Критично', count: data.criticalCount, icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'text-destructive bg-destructive/10 border-destructive/20' },
    { label: 'Недоступен', count: data.errorCount, icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-muted-foreground bg-muted border-border' },
  ];

  const ageSeconds = Math.max(0, Math.floor((Date.now() - data.cachedAt) / 1000));

  return (
    <div className="bg-card/60 backdrop-blur-xs border border-border/70 rounded-lg shadow-xs p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Глобальная Ликвидность</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {data.activeCount} активных провайдеров · кэш {ageSeconds}с назад
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/70 bg-card/60 hover:bg-muted text-xs font-bold text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer disabled:opacity-50 w-fit active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
          <span>{isPending ? 'Обновление...' : 'Обновить балансы'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-lg px-4 py-3 border ${stat.bg} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs`}>
            <div className={`flex items-center gap-1.5 mb-1 ${stat.color}`}>
              {stat.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
        {statusCounts.map((s) => (
          <div key={s.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${s.color}`}>
            {s.icon}
            {s.count} {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}