'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { TrendingUp, RotateCcw } from 'lucide-react';
import {
  getDePinMiniAppAnalyticsAction,
  type DePinAnalyticsData,
} from '@/actions/admin/depin/depin-analytics-actions';
import { DePinAnalyticsKpiCards } from './depin-analytics-kpi-cards';
import { DePinAnalyticsFunnelView } from './depin-analytics-funnel-view';
import { DePinAnalyticsLeaderboardView } from './depin-analytics-leaderboard-view';

interface DePinAnalyticsTabProps {
  tenantId?: string;
}

export function DePinAnalyticsTab({ tenantId = 'smmplan' }: DePinAnalyticsTabProps) {
  const [timeframe, setTimeframe] = React.useState<'7d' | '30d' | 'all'>('7d');
  const [data, setData] = React.useState<DePinAnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [, startTransition] = React.useTransition();

  const loadAnalytics = React.useCallback((tf: '7d' | '30d' | 'all') => {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await getDePinMiniAppAnalyticsAction(tf);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          toast.error(res.error || 'Ошибка загрузки аналитики');
        }
      } catch (err) {
        toast.error(String(err));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  React.useEffect(() => {
    loadAnalytics(timeframe);
  }, [loadAnalytics, timeframe]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── 1. ВЕРХНЯЯ ПАНЕЛЬ С ВЫБОРОМ ПЕРИОДА ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div>
          <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Продуктовая аналитика Mini App</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Сквозная воронка вовлечения: посещаемость (DAU/WAU), тап-активность, выполнение заданий и конверсии.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-muted/40 rounded-xl border border-border/60 text-xs">
            {(['7d', '30d', 'all'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tf === '7d' ? '7 дней' : tf === '30d' ? '30 дней' : 'Все время'}
              </button>
            ))}
          </div>

          <Button
            type="button"
            intent="secondary"
            size="sm"
            onClick={() => loadAnalytics(timeframe)}
            disabled={loading}
            className="h-8 px-2.5 cursor-pointer text-xs"
            title="Обновить данные"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── 2. KPI СТАТИСТИКА ── */}
      <DePinAnalyticsKpiCards kpis={data?.kpis} />

      {/* ── 3. ВОРОНКА КОНВЕРСИИ И РАСПРЕДЕЛЕНИЕ ЗАДАНИЙ ── */}
      <DePinAnalyticsFunnelView funnel={data?.funnel} taskBreakdown={data?.taskBreakdown} />

      {/* ── 4. ТУРНИРНЫЕ ТАБЛИЦЫ (LEADERBOARDS) ── */}
      <DePinAnalyticsLeaderboardView leaderboards={data?.leaderboards} />
    </div>
  );
}
