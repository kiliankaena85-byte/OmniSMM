'use client';

import * as React from 'react';
import { ExternalLink, Copy, Check, X } from 'lucide-react';
import { OrderModalColumn, STATUS_CONFIG } from './types';
import { OrderEnvironmentBadge } from '../OrderEnvironmentBadge';
import { resolveOrderEnvironmentMode } from '@/utils/order-environment';

interface OrderDetailsHeaderProps {
  order: OrderModalColumn;
  copiedId: boolean;
  onCopyId: () => void;
  onClose: () => void;
}

export function OrderDetailsHeader({
  order,
  copiedId,
  onCopyId,
  onClose,
}: OrderDetailsHeaderProps) {
  const statusInfo = STATUS_CONFIG[order.status] || {
    label: order.status,
    cls: 'bg-muted text-muted-foreground',
    borderCls: 'border-border',
  };

  return (
    <div className="px-6 py-4 border-b border-border/70 bg-muted/30 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-mono font-black text-sm shrink-0">
          #{order.numericId}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-extrabold text-foreground tracking-tight truncate">
              Заказ #{order.numericId}
            </h2>
            <button
              type="button"
              onClick={onCopyId}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Скопировать номер заказа"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {/* Brand Badge */}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
              order.tenantId === 'flux'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
            }`}>
              {order.tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}
            </span>
            {/* Environment Mode Badge */}
            <OrderEnvironmentBadge 
              mode={order.resolvedEnvironmentMode || resolveOrderEnvironmentMode(order)} 
              size="sm" 
            />
            {/* Status Badge */}
            <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold border ${statusInfo.cls} ${statusInfo.borderCls}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground truncate mt-0.5">
            {order.service?.category.network?.name ? `${order.service.category.network.name} · ` : ''}
            {order.service?.category.name} → <span className="text-foreground">{order.service?.name}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={`/admin/orders/${order.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all text-xs font-bold border border-border/40 cursor-pointer"
          title="Открыть заказ в новом окне / отдельной вкладке"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">В новом окне</span>
        </a>
        <span className="hidden sm:inline-flex text-[11px] text-muted-foreground font-mono bg-muted/60 px-2 py-1 rounded-lg border border-border/40">
          ESC
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
          title="Закрыть окно (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
