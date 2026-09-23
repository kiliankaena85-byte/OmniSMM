'use client';

import * as React from 'react';
import Link from 'next/link';
import { Table } from '@/components/admin/hero-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cancelOrderAction } from '@/actions/operator/orders/cancel-order.action';
import { restartOrderAction } from '@/actions/operator/orders/restart-order.action';
import { toast } from 'sonner';
import { Copy, Check, Play, Square } from 'lucide-react';

export type OperatorOrderRow = {
  id: string;
  numericId: number;
  status: string;
  quantity: number;
  remains: number;
  charge: number;
  link: string;
  createdAt: Date;
  user: { id: string; email: string };
  service: {
    id: string;
    name: string;
    isCancelEnabled?: boolean;
    category: {
      name: string;
      network: { name: string } | null;
    };
  };
};

interface OrdersTableProps {
  data: OperatorOrderRow[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-warning/15 text-warning border-transparent',
  PROCESSING: 'bg-primary/10 text-primary border-transparent',
  COMPLETED:  'bg-success/15 text-success border-transparent',
  FAILED:     'bg-destructive/15 text-destructive border-transparent',
  CANCELLED:  'bg-muted text-muted-foreground border-transparent',
  PARTIAL:    'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-transparent',
  ERROR:      'bg-destructive/20 text-destructive border-transparent font-bold',
};

export function OrdersTable({ data }: OrdersTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Ссылка скопирована в буфер');
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    <Table.ScrollContainer>
      <Table aria-label="Таблица заказов оператора">
        <Table.Header>
          <Table.Column isRowHeader>ID</Table.Column>
          <Table.Column>Клиент</Table.Column>
          <Table.Column>Услуга / Соцсеть</Table.Column>
          <Table.Column className="text-right">Цена</Table.Column>
          <Table.Column className="text-right">Кол-во / Ост.</Table.Column>
          <Table.Column>Ссылка</Table.Column>
          <Table.Column>Статус</Table.Column>
          <Table.Column className="text-right">Действия</Table.Column>
        </Table.Header>
        <Table.Body emptyContent="Заказы не найдены">
          {data.map((order) => {
            const isPendingState = ['PENDING', 'PROCESSING', 'PENDING_CHECK'].includes(order.status);
            const canCancel = isPendingState || (order.service.isCancelEnabled === true && order.status === 'IN_PROGRESS');
            const canRestart = ['ERROR', 'PENDING_CHECK', 'CANCELED'].includes(order.status);

            return (
              <Table.Row key={order.id}>
                {/* ID */}
                <Table.Cell className="font-mono text-xs font-bold text-foreground">
                  {order.numericId}
                </Table.Cell>

                {/* Client Email Link */}
                <Table.Cell>
                  <Link
                    href={`/operator/users/${order.user.id}`}
                    className="text-primary hover:underline font-medium text-xs break-all"
                  >
                    {order.user.email}
                  </Link>
                </Table.Cell>

                {/* Service / Social Network */}
                <Table.Cell className="max-w-[220px]">
                  <span className="text-xs font-bold text-foreground block truncate" title={order.service.name}>
                    {order.service.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground block font-medium mt-0.5">
                    {order.service.category.network?.name || 'Соцсеть'} • {order.service.category.name}
                  </span>
                </Table.Cell>

                {/* Charge */}
                <Table.Cell className="text-right font-mono font-bold text-xs tabular-nums text-foreground">
                  {(order.charge / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                </Table.Cell>

                {/* Quantity / Remains */}
                <Table.Cell className="text-right font-mono text-xs tabular-nums text-foreground">
                  <div>{order.quantity.toLocaleString('ru-RU')}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    ост: {order.remains.toLocaleString('ru-RU')}
                  </div>
                </Table.Cell>

                {/* Link with Copy Button */}
                <Table.Cell className="max-w-[140px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground truncate font-mono select-all block" title={order.link}>
                      {order.link}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.id, order.link)}
                      className="p-1 hover:bg-muted/80 rounded-md transition-colors text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {copiedId === order.id ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </Table.Cell>

                {/* Status Badge */}
                <Table.Cell>
                  <Badge
                    intent="outline"
                    className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 whitespace-nowrap ${
                      STATUS_COLORS[order.status] || 'bg-muted'
                    }`}
                  >
                    {order.status}
                  </Badge>
                </Table.Cell>

                {/* Inline Actions */}
                <Table.Cell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {canCancel && (
                      <Button
                        size="sm"
                        intent="ghost"
                        disabled={isPending}
                        onClick={() => handleCancel(order.id, order.numericId)}
                        className="h-7 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg flex items-center gap-1 font-bold"
                        title="Отменить заказ"
                      >
                        <Square className="w-3 h-3 fill-current" />
                        Отмена
                      </Button>
                    )}
                    {canRestart && (
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
                    )}
                    {!canCancel && !canRestart && (
                      <span className="text-[10px] text-muted-foreground font-mono italic pr-2">нет действий</span>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </Table.ScrollContainer>
  );
}
