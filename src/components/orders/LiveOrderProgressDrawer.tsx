'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Loader2, 
  ShieldAlert, 
  Sparkles, 
  ArrowRight, 
  ExternalLink 
} from 'lucide-react';

export interface OrderProgressProps {
  orderId: string;
  serviceName: string;
  targetLink: string;
  quantity: number;
  remains: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'CANCELED';
  elapsedMinutes: number;
  estimatedP90Minutes: number;
  isSentinelControlled?: boolean;
}

export function LiveOrderProgressDrawer({
  orderId,
  serviceName,
  targetLink,
  quantity,
  remains,
  status,
  elapsedMinutes,
  estimatedP90Minutes,
  isSentinelControlled = true,
}: OrderProgressProps) {
  const deliveredCount = Math.max(0, quantity - remains);
  const percentComplete = quantity > 0 ? Math.min(100, Math.round((deliveredCount / quantity) * 100)) : 0;
  const isDelayed = elapsedMinutes > estimatedP90Minutes && status === 'IN_PROGRESS';

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4 max-w-lg w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <div className="text-[11px] font-mono text-muted-foreground uppercase">
            Заказ #{orderId.slice(-6)}
          </div>
          <h4 className="text-sm font-semibold text-foreground truncate max-w-[280px] min-w-0">
            {serviceName}
          </h4>
        </div>
        {isSentinelControlled && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3 shrink-0" /> Sentinel AI
          </span>
        )}
      </div>

      {/* Target Link */}
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate min-w-0">
        <span>Цель:</span>
        <a 
          href={targetLink.startsWith('http') ? targetLink : `https://${targetLink}`} 
          target="_blank" 
          rel="noreferrer"
          className="text-primary hover:underline truncate flex items-center gap-1 min-w-0"
        >
          {targetLink} <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-muted-foreground">Выполнено: {deliveredCount.toLocaleString('ru-RU')} / {quantity.toLocaleString('ru-RU')}</span>
          <span className="font-semibold text-foreground">{percentComplete}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 rounded-full ${
              status === 'COMPLETED' ? 'bg-emerald-500' : isDelayed ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${percentComplete}%` }}
          />
        </div>
      </div>

      {/* Status Alert Banner */}
      {isDelayed && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
          <Clock className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Небольшая задержка старта:</span> поставщик обрабатывает очередь. Sentinel AI удерживает резервный узел.
          </div>
        </div>
      )}

      {status === 'COMPLETED' && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">Заказ успешно завершен в полном объеме.</span>
        </div>
      )}

      {/* Footer Meta */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
        <span>Время в обработке: {elapsedMinutes} мин</span>
        <span>Ориентир (P90): ~{estimatedP90Minutes} мин</span>
      </div>
    </div>
  );
}
