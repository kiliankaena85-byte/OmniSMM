'use client';

import * as React from 'react';
import { User, Copy, Check, ExternalLink } from 'lucide-react';
import { OrderModalColumn } from './types';

interface OrderServiceDetailsProps {
  order: OrderModalColumn;
  copiedLink: boolean;
  onCopyLink: () => void;
  quantity: number;
  progressPercent: number;
}

export function OrderServiceDetails({
  order,
  copiedLink,
  onCopyLink,
  quantity,
  progressPercent,
}: OrderServiceDetailsProps) {
  return (
    <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          <User className="w-3.5 h-3.5 text-primary" />
          <span>Клиент & Ссылка</span>
        </div>

        {/* Client Email */}
        <div className="bg-card border border-border/60 rounded-xl p-2.5">
          <div className="text-[10px] text-muted-foreground uppercase font-bold">Email клиента</div>
          <div className="text-xs font-bold text-foreground truncate mt-0.5">
            {order.user?.email || 'Гостевой заказ (без email)'}
          </div>
        </div>

        {/* Target Link */}
        <div className="bg-card border border-border/60 rounded-xl p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold">
            <span>Ссылка на цель</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onCopyLink}
                className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                title="Скопировать ссылку"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
              {order.link && (
                <a
                  href={order.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-primary hover:text-primary/80"
                  title="Открыть в новой вкладке"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
          <div className="text-xs font-mono text-primary font-semibold truncate break-all">
            {order.link || '—'}
          </div>
        </div>
      </div>

      {/* Volume & Progress */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-muted-foreground">Количество:</span>
          <span className="font-bold tabular-nums">{quantity.toLocaleString('ru-RU')} шт</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-muted-foreground">Остаток:</span>
          <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {(order.remains ?? 0).toLocaleString('ru-RU')} шт
          </span>
        </div>
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
            <span>Прогресс</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
