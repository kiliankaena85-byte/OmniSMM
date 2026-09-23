'use client';

import * as React from 'react';
import Link from 'next/link';
import { Package, ArrowRight, Square, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cancelOrderAction } from '@/actions/operator/orders/cancel-order.action';
import { restartOrderAction } from '@/actions/operator/orders/restart-order.action';
import { toast } from 'sonner';

interface FailedOrder {
  id: string;
  numericId: number;
  error: string | null;
}

interface FailedOrdersProps {
  orders: FailedOrder[];
}

export function FailedOrders({ orders }: FailedOrdersProps) {
  const [isPending, startTransition] = React.useTransition();

  const handleCancel = (orderId: string, orderNum: number) => {
    if (!confirm(`Вы действительно хотите отменить заказ #${orderNum} и вернуть средства?`)) {
      return;
    }

    startTransition(async () => {
      const res = await cancelOrderAction(orderId);
      if (res.success) {
        toast.success(`Заказ #${orderNum} успешно отменен`);
      } else {
        toast.error(res.error || 'Не удалось отменить заказ');
      }
    });
  };

  const handleRestart = (orderId: string, orderNum: number) => {
    startTransition(async () => {
      const res = await restartOrderAction(orderId);
      if (res.success) {
        toast.success(`Заказ #${orderNum} успешно перезапущен`);
      } else {
        toast.error(res.error || 'Не удалось перезапустить заказ');
      }
    });
  };

  return (
    <div className="bg-card border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          Сбои провайдеров (Ошибки)
        </h3>
        <Link
          href="/operator/orders?status=ERROR"
          className="text-xs font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 hover:underline"
        >
          Все ошибки <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {orders.length > 0 ? (
        <div className="divide-y divide-border/30">
          {orders.map((order) => (
            <div key={order.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs first:pt-0 last:pb-0">
              <div className="space-y-1 min-w-0 flex-1">
                <span className="font-mono font-bold text-foreground block">
                  Заказ #{order.numericId}
                </span>
                <span className="text-[11px] text-destructive font-medium block truncate max-w-md" title={order.error || 'Неизвестная ошибка'}>
                  {order.error || 'Неизвестная ошибка API провайдера'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  intent="ghost"
                  disabled={isPending}
                  onClick={() => handleCancel(order.id, order.numericId)}
                  className="h-7 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg flex items-center gap-1 font-bold"
                  title="Отменить и вернуть средства"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Отмена
                </Button>
                <Button
                  size="sm"
                  intent="ghost"
                  disabled={isPending}
                  onClick={() => handleRestart(order.id, order.numericId)}
                  className="h-7 text-[10px] text-success hover:bg-success/10 hover:text-success rounded-lg flex items-center gap-1 font-bold"
                  title="Перезапустить заказ"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Старт
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Заказов со сбоями в системе нет.
          </p>
        </div>
      )}
    </div>
  );
}
