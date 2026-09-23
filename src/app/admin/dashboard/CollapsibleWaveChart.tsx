'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Activity, BarChart2, Eye, EyeOff } from 'lucide-react';
import { OrdersChart, type OrdersChartData } from './orders-chart';

interface Props {
  data: OrdersChartData[];
  step: 'hour' | 'day' | 'week' | 'month';
}

export function CollapsibleWaveChart({ data, step }: Props) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('smmplan_admin_wave_collapsed');
      if (saved === 'true') {
        setIsCollapsed(true);
      }
    } catch {
      // ignore storage errors
    }
    setIsLoaded(true);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smmplan_admin_wave_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Calculate quick summary metrics for the collapsed pill
  const totalCompleted = data.reduce((acc, d) => acc + (d.completed || 0), 0);
  const totalInProgress = data.reduce((acc, d) => acc + (d.inProgress || 0), 0);
  const totalPending = data.reduce((acc, d) => acc + (d.pending || 0), 0);
  const totalCanceled = data.reduce((acc, d) => acc + (d.canceled || 0), 0);
  const totalAll = totalCompleted + totalInProgress + totalPending + totalCanceled;

  return (
    <div className="bg-card text-card-foreground rounded-lg border border-border/70 shadow-sm transition-all duration-200 overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 flex-wrap gap-3 bg-muted/10">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title={isCollapsed ? 'Развернуть диаграмму' : 'Свернуть диаграмму'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4 text-primary" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>

          <div>
            <h3 
              onClick={toggleCollapse}
              className="font-bold text-sm text-foreground flex items-center gap-2 cursor-pointer select-none hover:text-primary transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>Поток заказов платформы (Волновая диаграмма)</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isCollapsed ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">Диаграмма скрыта</span>
                  <span>•</span>
                  <span>Всего: <strong>{totalAll} шт</strong></span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400">✓ {totalCompleted} вып.</span>
                  <span>•</span>
                  <span className="text-sky-600 dark:text-sky-400">⚡ {totalInProgress} в раб.</span>
                  <span>•</span>
                  <span className="text-amber-600 dark:text-amber-400">⏳ {totalPending} в очер.</span>
                  <span>•</span>
                  <span className="text-rose-600 dark:text-rose-400">✕ {totalCanceled} отмен</span>
                </span>
              ) : (
                'Динамика объемов по 6 статусам: Выполнены, В работе, В очереди, Не оплачены, Сбои и Частичные'
              )}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted-foreground text-[11px]">Интервал:</span>
          <span className="px-2 py-0.5 rounded-md bg-muted text-foreground font-bold border border-border/50 uppercase text-[10px]">
            {step === 'hour' ? 'По часам' : step === 'day' ? 'По дням' : step === 'week' ? 'По неделям' : 'По месяцам'}
          </span>

          <button
            type="button"
            onClick={toggleCollapse}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-background hover:bg-muted text-foreground border border-border/60 transition-all shadow-xs cursor-pointer ml-1"
          >
            {isCollapsed ? (
              <>
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span>Показать график</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Скрыть график</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chart Body */}
      {!isCollapsed && (
        <div className="p-5 pt-3 space-y-3 animate-in fade-in duration-200">
          <OrdersChart data={data} />
        </div>
      )}
    </div>
  );
}
