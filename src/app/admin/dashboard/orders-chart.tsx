'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export type OrdersChartData = {
  dateStr: string;
  completed: number;
  inProgress?: number;
  pending?: number;
  unpaid: number;
  canceled: number;
  partial?: number;
  total?: number;
};

interface OrdersChartProps {
  data: OrdersChartData[];
  role?: string;
  periodName?: string;
}

const LAYER_CONFIG = {
  completed: {
    key: 'completed',
    label: 'Выполнены',
    color: '#10b981', // emerald-500
    fillId: 'gradCompleted',
    dotCls: 'bg-emerald-500',
    badgeCls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  inProgress: {
    key: 'inProgress',
    label: 'В работе',
    color: '#0ea5e9', // sky-500
    fillId: 'gradInProgress',
    dotCls: 'bg-sky-500',
    badgeCls: 'text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  pending: {
    key: 'pending',
    label: 'В очереди',
    color: '#f59e0b', // amber-500
    fillId: 'gradPending',
    dotCls: 'bg-warning',
    badgeCls: 'text-warning-text bg-warning/10 border-warning/20',
  },
  unpaid: {
    key: 'unpaid',
    label: 'Не оплачены',
    color: '#94a3b8', // slate-400
    fillId: 'gradUnpaid',
    dotCls: 'bg-muted-foreground',
    badgeCls: 'text-muted-foreground bg-muted border-border',
  },
  canceled: {
    key: 'canceled',
    label: 'Сбои / Отмены',
    color: '#f43f5e', // rose-500
    fillId: 'gradCanceled',
    dotCls: 'bg-destructive',
    badgeCls: 'text-destructive-text bg-destructive/10 border-destructive/20',
  },
  partial: {
    key: 'partial',
    label: 'Частично',
    color: '#8b5cf6', // violet-500
    fillId: 'gradPartial',
    dotCls: 'bg-info',
    badgeCls: 'text-info bg-info/10 border-info/20',
  },
} as const;

type LayerKey = keyof typeof LAYER_CONFIG;

export function OrdersChart({ data }: OrdersChartProps) {
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    completed: true,
    inProgress: true,
    pending: true,
    unpaid: true,
    canceled: true,
    partial: true,
  });

  const toggleLayer = (layer: LayerKey) => {
    setActiveLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Calculate totals for legend badges
  const totals = React.useMemo(() => {
    return data.reduce(
      (acc, row) => {
        acc.completed += row.completed || 0;
        acc.inProgress += row.inProgress || 0;
        acc.pending += row.pending || 0;
        acc.unpaid += row.unpaid || 0;
        acc.canceled += row.canceled || 0;
        acc.partial += row.partial || 0;
        acc.total += (row.completed || 0) + (row.inProgress || 0) + (row.pending || 0) + (row.unpaid || 0) + (row.canceled || 0) + (row.partial || 0);
        return acc;
      },
      { completed: 0, inProgress: 0, pending: 0, unpaid: 0, canceled: 0, partial: 0, total: 0 }
    );
  }, [data]);

  const failureRate = totals.total > 0 ? ((totals.canceled / totals.total) * 100).toFixed(1) : '0';

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex flex-col items-center justify-center border border-dashed border-border/60 rounded-lg p-6 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Нет данных по заказам за выбранный период</p>
        <p className="text-xs text-muted-foreground/80 mt-1">Оформите тестовый заказ для отображения волнового потока</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive Layer Filter Chips */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Слои потока:</span>
          {(Object.keys(LAYER_CONFIG) as LayerKey[]).map((key) => {
            const config = LAYER_CONFIG[key];
            const isActive = activeLayers[key];
            const count = totals[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleLayer(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer select-none ${
                  isActive
                    ? config.badgeCls
                    : 'bg-muted/40 text-muted-foreground/60 border-transparent opacity-60 hover:opacity-100'
                }`}
                title={`Нажмите, чтобы ${isActive ? 'скрыть' : 'показать'} слой "${config.label}"`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? config.dotCls : 'bg-muted-foreground/40'}`} />
                <span>{config.label}</span>
                <span className="font-mono tabular-nums text-[10px] opacity-80">({count.toLocaleString('ru-RU')})</span>
              </button>
            );
          })}
        </div>

        {/* Anomaly Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground text-[11px]">Доля сбоев:</span>
          <span className={`font-mono font-bold px-2 py-0.5 rounded-md border text-[11px] tabular-nums ${
            Number(failureRate) > 8
              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
              : Number(failureRate) > 4
              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          }`}>
            {failureRate}%
          </span>
        </div>
      </div>

      {/* Hero Wave Chart */}
      <div className="h-[280px] sm:h-[320px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradInProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradUnpaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradCanceled" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradPartial" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.08} />

            <XAxis
              dataKey="dateStr"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              dy={10}
              minTickGap={25}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11 }}
              allowDecimals={false}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                return (
                  <div className="bg-card text-card-foreground border border-border/80 rounded-lg p-3 shadow-xl text-xs space-y-1.5 min-w-[170px] select-none font-sans">
                    <div className="font-bold text-foreground border-b border-border/60 pb-1 flex items-center justify-between">
                      <span>{label}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Заказов</span>
                    </div>
                    {payload.map((item, idx) => {
                      const keyStr = String(item.dataKey || idx);
                      const conf = LAYER_CONFIG[keyStr as LayerKey];
                      if (!conf) return null;
                      return (
                        <div key={keyStr} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                            <span className={`w-1.5 h-1.5 rounded-full ${conf.dotCls}`} />
                            {conf.label}:
                          </span>
                          <span className="font-mono font-bold text-foreground tabular-nums">
                            {Number(item.value).toLocaleString('ru-RU')} шт
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />

            {/* Area Layers with Soft Gradients */}
            {activeLayers.completed && (
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradCompleted)"
              />
            )}
            {activeLayers.inProgress && (
              <Area
                type="monotone"
                dataKey="inProgress"
                stroke="#0ea5e9"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradInProgress)"
              />
            )}
            {activeLayers.pending && (
              <Area
                type="monotone"
                dataKey="pending"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradPending)"
              />
            )}
            {activeLayers.unpaid && (
              <Area
                type="monotone"
                dataKey="unpaid"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#gradUnpaid)"
              />
            )}
            {activeLayers.partial && (
              <Area
                type="monotone"
                dataKey="partial"
                stroke="#8b5cf6"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#gradPartial)"
              />
            )}
            {activeLayers.canceled && (
              <Area
                type="monotone"
                dataKey="canceled"
                stroke="#f43f5e"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradCanceled)"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
