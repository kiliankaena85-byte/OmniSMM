'use client';

import * as React from 'react';
import { RefreshCw, Zap, RotateCcw, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrderModalColumn } from './types';

interface OrderBottomActionsProps {
  order: OrderModalColumn;
  userRole: string;
  isPending: boolean;
  isFailoverOpen: boolean;
  onSyncStatus: () => void;
  onToggleFailover: () => void;
  onTriggerConfirm: (action: 'cancel' | 'restart' | 'force_complete') => void;
}

export function OrderBottomActions({
  order,
  userRole,
  isPending,
  isFailoverOpen,
  onSyncStatus,
  onToggleFailover,
  onTriggerConfirm,
}: OrderBottomActionsProps) {
  const isPendingState = ['PENDING', 'PENDING_CHECK', 'AWAITING_PAYMENT'].includes(order.status);
  const isCancelAllowed = userRole !== 'SUPPORT' || isPendingState || order.service?.isCancelEnabled === true;
  const canCancel = isCancelAllowed && !['CANCELED'].includes(order.status);

  const isMissingExternalId = Boolean(order.providerName) && !order.externalId;
  const disableComplete = isPending || order.status === 'COMPLETED' || isMissingExternalId;

  return (
    <div className="px-6 py-4 border-t border-border/70 bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
        <span className="font-semibold text-foreground">Действия с заказом #{order.numericId}:</span>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
        {/* Sync status with provider button */}
        {Boolean(order.externalId) && (
          <button
            type="button"
            onClick={onSyncStatus}
            disabled={isPending}
            className="px-3.5 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Запросить актуальный статус напрямую у провайдера"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isPending && "animate-spin")} />
            <span>Сверить статус</span>
          </button>
        )}

        {/* Failover Button */}
        <button
          type="button"
          onClick={onToggleFailover}
          disabled={isPending}
          className="px-3.5 py-2 rounded-xl border border-warning/30 bg-warning/10 hover:bg-warning/20 text-warning font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          title="Перевести заказ на резервного провайдера (Alt+M)"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isFailoverOpen ? 'Скрыть резервы' : 'Сменить провайдера'}</span>
        </button>

        {/* Restart Order */}
        <button
          type="button"
          onClick={() => onTriggerConfirm('restart')}
          disabled={isPending}
          className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted font-bold text-xs text-foreground transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          title="Повторить отправку заказа провайдеру (Alt+R)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Перезапустить</span>
        </button>

        {/* Force Complete */}
        <button
          type="button"
          onClick={() => onTriggerConfirm('force_complete')}
          disabled={disableComplete}
          title={isMissingExternalId ? 'Запрещено: нет ID провайдера' : 'Завершить заказ принудительно'}
          className="px-3.5 py-2 rounded-xl border border-success/30 bg-success/10 hover:bg-success/20 text-success font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Завершить</span>
        </button>

        {/* Cancel & Refund */}
        {canCancel && (
          <button
            type="button"
            onClick={() => onTriggerConfirm('cancel')}
            disabled={isPending}
            className="px-3.5 py-2 rounded-xl bg-destructive hover:bg-destructive/90 disabled:opacity-40 text-destructive-foreground font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
            title="Отменить заказ и вернуть средства на баланс (Alt+C)"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Отменить и вернуть</span>
          </button>
        )}
      </div>
    </div>
  );
}
