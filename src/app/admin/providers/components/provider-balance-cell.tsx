'use client';

import { useState, useEffect, useCallback } from 'react';
import { getProviderBalanceAction } from '@/actions/admin/providers/balance';
import { CachedProviderBalance } from '@/services/admin/provider-balance.service';
import { Loader2, AlertCircle, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ProviderBalanceCellProps {
  providerId: string;
  initialData?: CachedProviderBalance;
}

export function ProviderBalanceCell({ providerId, initialData }: ProviderBalanceCellProps) {
  const [data, setData] = useState<CachedProviderBalance | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalance = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else if (!data) {
      setLoading(true);
    }

    try {
      const res = await getProviderBalanceAction(providerId, forceRefresh);
      if (res.success) {
        setData(res.data);
        setError(null);

        // If manual refresh and balance is healthy, trigger Smart Auto-Flush for pending orders
        if (forceRefresh && res.data.balanceRub >= 50) {
          const { syncAndFlushProviderOrdersAction } = await import('@/actions/admin/providers/balance');
          const flushRes = await syncAndFlushProviderOrdersAction(providerId);
          if (flushRes.success && flushRes.data && flushRes.data.flushedCount > 0) {
            const { toast } = await import('sonner');
            toast.success(`Баланс обновлен! Отправлено в очередь: ${flushRes.data.flushedCount} отложенных заказов.`);
          }
        }
      } else {
        setError(res.error || 'Не удалось получить баланс');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Ошибка подключения';
      setError(errMsg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [providerId, data]);

  useEffect(() => {
    if (!initialData) {
      fetchBalance(false);
    }
  }, [fetchBalance, initialData]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground select-none">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Синхронизация...</span>
      </div>
    );
  }

  if (error || !data || data.status === 'error') {
    const errorMsg = data?.error || error || 'Ошибка API';
    const fixNote = data?.suggestedFix ? ` — ${data.suggestedFix}` : '';
    const fullTooltip = `${errorMsg}${fixNote}`;

    return (
      <div className="flex items-center gap-1.5">
        <div
          title={fullTooltip}
          className="flex items-center gap-1.5 text-destructive bg-destructive/10 px-2.5 py-1 rounded-md border border-destructive/30 cursor-help w-fit select-none"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-bold">Сбой API</span>
        </div>
        <button
          type="button"
          onClick={() => fetchBalance(true)}
          disabled={isRefreshing}
          aria-label="Повторить запрос баланса"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - data.cachedAt) / 1000));
  const ageTooltip = `Кэш: ${ageSeconds}с назад (TTL 60с) | ${data.latencyMs}мс | USD: $${data.balanceUsd.toFixed(2)} | RUB: ${data.balanceRub.toLocaleString('ru-RU')} ₽`;

  const getStatusStyles = () => {
    switch (data.status) {
      case 'healthy':
        return {
          container: 'bg-success/10 border-success/30 text-success',
          icon: <CheckCircle2 className="w-3 h-3 text-success shrink-0" />,
        };
      case 'warning':
        return {
          container: 'bg-warning/10 border-warning/30 text-warning',
          icon: <AlertTriangle className="w-3 h-3 text-warning shrink-0" />,
        };
      case 'critical':
        return {
          container: 'bg-destructive/10 border-destructive/30 text-destructive animate-pulse',
          icon: <AlertCircle className="w-3 h-3 text-destructive shrink-0" />,
        };
      default:
        return {
          container: 'bg-muted border-border text-foreground',
          icon: null,
        };
    }
  };

  const statusStyles = getStatusStyles();

  return (
    <div className="flex items-center gap-1.5 group">
      <div
        title={ageTooltip}
        className={`flex items-baseline gap-1.5 px-2.5 py-1 rounded-md border w-fit cursor-help select-none transition-all duration-200 ${statusStyles.container}`}
      >
        <span className="font-mono font-bold text-sm tracking-tight tabular-nums">
          {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(data.balance)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-80 font-mono">
          {data.currency}
        </span>
      </div>

      <button
        type="button"
        onClick={() => fetchBalance(true)}
        disabled={isRefreshing}
        aria-label="Обновить баланс провайдера"
        title="Принудительно обновить баланс"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-200 active:scale-95 disabled:opacity-50 opacity-60 group-hover:opacity-100"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}
