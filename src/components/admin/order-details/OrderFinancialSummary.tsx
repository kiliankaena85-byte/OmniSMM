'use client';

import * as React from 'react';
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { OrderModalColumn } from './types';

interface OrderFinancialSummaryProps {
  order: OrderModalColumn;
  chargeRub: number;
  costRub: number;
  marginRub: number;
  marginPercent: number;
  pricePerUnitRub: number;
  canSeeRates: boolean;
}

export function OrderFinancialSummary({
  order,
  chargeRub,
  costRub,
  marginRub,
  marginPercent,
  pricePerUnitRub,
  canSeeRates,
}: OrderFinancialSummaryProps) {
  return (
    <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          <span>Юнит-экономика</span>
        </div>

        {/* Client Price & Unit Rate */}
        <div className="bg-card border border-border/60 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Сумма заказа</span>
            <span className="text-sm font-extrabold text-foreground tabular-nums">
              {chargeRub.toFixed(2)} ₽
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Цена за 1 шт:</span>
            <span className="font-mono">{pricePerUnitRub.toFixed(4)} ₽ / шт</span>
          </div>
        </div>

        {/* PRICE DRIFT HOLD ALERT & ACTION GUIDANCE */}
        {order.error && order.error.includes('PRICE_DRIFT_HOLD') && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-extrabold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Защита от убытка (Отрицательная маржа)</span>
            </div>
            <p className="text-[11px] text-foreground/90 leading-snug">
              Поставщик поднял закупочную цену (<strong>{costRub.toFixed(2)} ₽</strong>), из-за чего выполнение заказа принесет убыток платформе (клиент оплатил <strong>{chargeRub.toFixed(2)} ₽</strong>).
            </p>
            <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
              <div className="font-bold text-foreground">Что делать сотруднику:</div>
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                1. <strong>«Сменить провайдера»</strong> — выбрать альтернативного поставщика с положительной маржой.
              </div>
              <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                2. <strong>«Отменить и вернуть»</strong> — вернуть клиенту 100% средств на баланс, если дешевых поставщиков нет.
              </div>
            </div>
          </div>
        )}

        {/* Cost & Margin */}
        <div className="bg-card border border-border/60 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Закупочная цена (себестоимость):</span>
            <span className="font-mono font-bold text-foreground tabular-nums">
              {costRub.toFixed(2)} ₽
            </span>
          </div>
          {canSeeRates ? (
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40">
              <span className="font-bold text-foreground">Чистая маржа:</span>
              <span className={`font-mono font-extrabold tabular-nums ${
                marginRub >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {marginRub >= 0 ? `+${marginRub.toFixed(2)}` : marginRub.toFixed(2)} ₽ ({marginPercent}%)
              </span>
            </div>
          ) : (
            <div className="pt-1.5 border-t border-border/40 text-right text-[10px] text-muted-foreground italic">
              🔒 Маржа доступна только Администраторам
            </div>
          )}
        </div>
      </div>

      {/* Dripfeed / Anomaly Indicator */}
      <div className="pt-2 border-t border-border/40">
        {order.isDripFeed ? (
          <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Dripfeed: {order.currentRun ?? 1} из {order.runs ?? 1} запусков</span>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>Тип заказа:</span>
            <span className="font-semibold text-foreground">Прямой запуск (Одиночный)</span>
          </div>
        )}
      </div>
    </div>
  );
}
