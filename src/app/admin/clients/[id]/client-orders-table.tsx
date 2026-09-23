'use client';

import { Table } from '@/components/admin/hero-ui';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  PENDING:     'bg-warning/15 text-warning-700 border border-warning/20',
  IN_PROGRESS: 'bg-primary/15 text-primary-700 border border-primary/20',
  COMPLETED:   'bg-success/15 text-success-700 border border-success/20',
  ERROR:       'bg-destructive/15 text-destructive-700 border border-destructive/20',
  CANCELED:    'bg-muted/50 text-muted-foreground border border-border/60',
  PARTIAL:     'bg-warning/15 text-warning-700 border border-warning/20',
};

type OrderType = {
  id: string;
  numericId: number;
  status: string;
  quantity: number;
  charge: bigint;
  createdAt: Date;
  service: { name: string };
};

export function ClientOrdersTable({ orders }: { orders: OrderType[] }) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table aria-label="Таблица заказов клиента">
          <Table.ScrollContainer>
            <Table.Content aria-label="Заказы клиента">
              <Table.Header>
                <Table.Column isRowHeader>#</Table.Column>
                <Table.Column>УСЛУГА</Table.Column>
                <Table.Column className="text-right">КОЛ-ВО</Table.Column>
                <Table.Column className="text-right">СУММА</Table.Column>
                <Table.Column>СТАТУС</Table.Column>
                <Table.Column>ДАТА</Table.Column>
              </Table.Header>
              <Table.Body>
                {orders.length === 0 ? (
                  <Table.Row key="empty">
                    <Table.Cell>Нет заказов</Table.Cell>
                    <Table.Cell>{' '}</Table.Cell>
                    <Table.Cell>{' '}</Table.Cell>
                    <Table.Cell>{' '}</Table.Cell>
                    <Table.Cell>{' '}</Table.Cell>
                    <Table.Cell>{' '}</Table.Cell>
                  </Table.Row>
                ) : orders.map(o => (
                  <Table.Row key={o.id}>
                    <Table.Cell>
                      <Link href={`/admin/orders?q=${o.numericId}`} className="font-mono text-xs text-primary hover:underline">
                        #{o.numericId}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs text-foreground truncate max-w-48 block" title={o.service.name}>
                        {o.service.name}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="text-[13px] tracking-tight tabular-nums font-mono text-muted-foreground">{o.quantity.toLocaleString('ru-RU')}</span>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <span className="text-[13px] font-bold tracking-tight tabular-nums font-mono text-foreground">{(Number(o.charge) / 100).toFixed(2)} ₽</span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shadow-sm ${STATUS_COLORS[o.status] ?? 'bg-muted/50 text-muted-foreground border border-border/60'}`}>
                        {o.status}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-xs text-muted-foreground tabular-nums tracking-tight font-mono">
                        {new Date(o.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      {/* Mobile Card Feed View */}
      <div className="block md:hidden divide-y divide-border/30 bg-card/30">
        {orders.length === 0 ? (
          <p className="text-center py-8 text-xs text-muted-foreground italic">Нет заказов</p>
        ) : orders.map(o => {
          const statusClass = STATUS_COLORS[o.status] ?? 'bg-muted/50 text-muted-foreground border border-border/60';
          return (
            <div key={o.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/orders?q=${o.numericId}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    #{o.numericId}
                  </Link>
                  <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]" title={o.service.name}>
                    {o.service.name}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold font-mono text-foreground">
                    {(Number(o.charge) / 100).toFixed(2)} ₽
                  </span>
                  <span className="text-[10px] text-muted-foreground block font-mono">
                    {o.quantity.toLocaleString('ru-RU')} шт.
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] pt-1">
                <span className="text-muted-foreground font-mono">
                  {new Date(o.createdAt).toLocaleDateString('ru-RU')}
                </span>
                <span className={`font-bold tracking-wider uppercase px-2 py-0.5 rounded-full shadow-sm text-[9px] ${statusClass}`}>
                  {o.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
