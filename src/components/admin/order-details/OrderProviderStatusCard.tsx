'use client';

import * as React from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { OrderModalColumn } from './types';

interface OrderProviderStatusCardProps {
  order: OrderModalColumn;
  selectedStatus: string;
  onSelectedStatusChange: (status: string) => void;
  remains: number;
  onRemainsChange: (val: number) => void;
  quantity: number;
  isPending: boolean;
  onSetStatus: () => void;
}

export function OrderProviderStatusCard({
  order,
  selectedStatus,
  onSelectedStatusChange,
  remains,
  onRemainsChange,
  quantity,
  isPending,
  onSetStatus,
}: OrderProviderStatusCardProps) {
  return (
    <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          <Layers className="w-3.5 h-3.5 text-sky-500" />
          <span>Исполнение</span>
        </div>

        {/* Provider Info */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-card border border-border/60 rounded-xl p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">Провайдер</div>
            <div className="text-xs font-bold text-foreground truncate mt-0.5">
              {order.providerName || 'Не назначен'}
            </div>
          </div>
          <div className="bg-card border border-border/60 rounded-xl p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">ID провайдера</div>
            <div className="text-xs font-mono font-bold text-foreground truncate mt-0.5">
              {order.externalId ? `#${order.externalId}` : '—'}
            </div>
          </div>
        </div>

        {/* Status Changer Input */}
        <div className="bg-card border border-border/60 rounded-xl p-2.5 space-y-2">
          <div className="text-[10px] text-muted-foreground uppercase font-bold">Управление статусом</div>
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => onSelectedStatusChange(e.target.value)}
              className="flex-1 bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground outline-none cursor-pointer"
            >
              <option value="PENDING">⏳ В очереди</option>
              <option value="IN_PROGRESS">⚡ В работе</option>
              <option value="COMPLETED">🟢 Выполнен</option>
              <option value="PARTIAL">🟠 Частично выполнен</option>
              <option value="CANCELED">❌ Отменён</option>
              <option value="ERROR">🔴 Ошибка</option>
              <option value="AWAITING_PAYMENT">⚪ Ожидает оплаты</option>
            </select>
            <button
              type="button"
              onClick={onSetStatus}
              disabled={isPending || selectedStatus === order.status}
              className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-all cursor-pointer shrink-0"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
            </button>
          </div>

          {/* Remains input if PARTIAL */}
          {selectedStatus === 'PARTIAL' && (
            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground font-semibold">Остаток для возврата:</span>
              <input
                type="number"
                min="0"
                max={quantity}
                value={remains}
                onChange={(e) => onRemainsChange(Number(e.target.value))}
                className="w-24 bg-muted/60 border border-border rounded px-2 py-1 text-xs font-mono font-bold text-right outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Timestamps */}
      <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Создан:</span>
          <span className="font-mono text-foreground">
            {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU') : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Обновлен:</span>
          <span className="font-mono text-foreground">
            {order.updatedAt ? new Date(order.updatedAt).toLocaleString('ru-RU') : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
