'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2 } from 'lucide-react';
import { FailoverPreviewData } from './types';

interface OrderFailoverSectionProps {
  isOpen: boolean;
  onClose: () => void;
  failoverPreview: FailoverPreviewData;
  selectedRouteId: string;
  onSelectRouteId: (id: string) => void;
  acknowledgeBlindReroute: boolean;
  onAcknowledgeChange: (val: boolean) => void;
  isPending: boolean;
  onConfirmFailover: () => void;
}

export function OrderFailoverSection({
  isOpen,
  onClose,
  failoverPreview,
  selectedRouteId,
  onSelectRouteId,
  acknowledgeBlindReroute,
  onAcknowledgeChange,
  isPending,
  onConfirmFailover,
}: OrderFailoverSectionProps) {
  if (!isOpen) return null;

  const selectedRoute = failoverPreview.routes.find(r => r.routeId === selectedRouteId);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <h3 className="font-extrabold text-sm text-foreground">
            Резервные маршруты (Failover Provider Switch)
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground font-bold cursor-pointer"
        >
          Скрыть ✕
        </button>
      </div>

      {failoverPreview.routes.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Для данной услуги нет настроенных резервных маршрутов в каталоге.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {failoverPreview.routes.map((route) => {
              const isSelected = selectedRouteId === route.routeId;
              return (
                <div
                  key={route.routeId}
                  onClick={() => onSelectRouteId(route.routeId)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-foreground ring-1 ring-amber-500 shadow-sm'
                      : 'bg-card border-border/60 hover:border-amber-500/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-foreground">{route.providerName}</span>
                    <span className={route.isMarginPositive ? 'text-emerald-500' : 'text-rose-500'}>
                      {route.marginPercent !== null ? `${route.marginPercent}%` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>Новая закупка:</span>
                    <span className="font-mono font-bold">
                      {route.newCostCents !== null ? `${(route.newCostCents / 100).toFixed(2)} ₽` : 'Неизвестно'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedRoute && !selectedRoute.isMarginPositive && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs space-y-2">
              <p className="text-rose-600 dark:text-rose-400 font-bold">
                ⚠️ Внимание: Выбранный провайдер сделает маржу отрицательной (убыток).
              </p>
              <label className="flex items-center gap-2 cursor-pointer font-semibold select-none">
                <input
                  type="checkbox"
                  checked={acknowledgeBlindReroute}
                  onChange={(e) => onAcknowledgeChange(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Я осознаю финансовый риск и подтверждаю перевод заказа</span>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onConfirmFailover}
              disabled={isPending || (!selectedRoute?.isMarginPositive && !acknowledgeBlindReroute)}
              className="px-4 py-2 bg-warning hover:bg-warning/90 disabled:opacity-40 text-warning-foreground font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Перевести заказ на {selectedRoute?.providerName || 'маршрут'}</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
