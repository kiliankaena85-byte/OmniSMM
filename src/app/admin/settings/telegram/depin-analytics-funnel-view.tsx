'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Sparkles, Flame } from 'lucide-react';
import type { DePinAnalyticsData } from '@/actions/admin/depin/depin-analytics-actions';

interface DePinAnalyticsFunnelViewProps {
  funnel?: DePinAnalyticsData['funnel'];
  taskBreakdown?: DePinAnalyticsData['taskBreakdown'];
}

export function DePinAnalyticsFunnelView({ funnel, taskBreakdown }: DePinAnalyticsFunnelViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Воронка (7 колонок) */}
      <Card className="lg:col-span-7 p-5 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Воронка вовлечения пользователей Mini App</span>
          </h4>
          <span className="text-[11px] text-muted-foreground">Сквозной конверсионный путь</span>
        </div>

        <div className="space-y-3.5 pt-1 text-xs">
          {/* Шаг 1: Зашли */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-medium">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">1</span>
                Запустили Mini App (Визиты)
              </span>
              <span className="font-mono font-bold text-foreground">
                {funnel?.visitors ?? 0} чел. (100%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full w-full" />
            </div>
          </div>

          {/* Шаг 2: Тапали экран */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-medium">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px]">2</span>
                Кликали экран (Таперы)
              </span>
              <span className="font-mono font-bold text-amber-400">
                {funnel?.tappers ?? 0} чел. ({funnel?.tappersPercent ?? 0}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, funnel?.tappersPercent ?? 0)}%` }}
              />
            </div>
          </div>

          {/* Шаг 3: Выполнили задания */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-medium">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">3</span>
                Выполнили микро-задачи (Активация)
              </span>
              <span className="font-mono font-bold text-emerald-400">
                {funnel?.performers ?? 0} чел. ({funnel?.performersPercent ?? 0}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, funnel?.performersPercent ?? 0)}%` }}
              />
            </div>
          </div>

          {/* Шаг 4: Пригласили друзей */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-medium">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-[10px]">4</span>
                Пригласили рефералов (Виральность)
              </span>
              <span className="font-mono font-bold text-purple-400">
                {funnel?.referrers ?? 0} чел. ({funnel?.referrersPercent ?? 0}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, funnel?.referrersPercent ?? 0)}%` }}
              />
            </div>
          </div>

          {/* Шаг 5: Вывели рубли */}
          <div className="space-y-1">
            <div className="flex justify-between items-center font-medium">
              <span className="flex items-center gap-2 text-foreground">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-[10px]">5</span>
                Конвертировали в рубли (Монетизация)
              </span>
              <span className="font-mono font-bold text-rose-400">
                {funnel?.converters ?? 0} транзакций ({funnel?.convertersPercent ?? 0}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, funnel?.convertersPercent ?? 0)}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Структура задач (5 колонок) */}
      <Card className="lg:col-span-5 p-5 rounded-2xl bg-card/80 border border-border/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Распределение типов задач</span>
          </h4>
          <span className="text-[11px] text-muted-foreground">Доля в общем объеме</span>
        </div>

        <div className="space-y-3 pt-1 text-xs">
          {taskBreakdown?.map((item) => (
            <div key={item.type} className="space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="font-mono font-bold text-foreground">
                  {item.count} шт. ({item.percent}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 p-3 rounded-xl bg-muted/20 border border-border/60 text-[11px] text-muted-foreground">
          💡 Просмотры постов — базовый драйвер (5–10 PTS). Реакции (+10 PTS) и комментарии (+35 PTS) создают максимальное вовлечение.
        </div>
      </Card>
    </div>
  );
}
