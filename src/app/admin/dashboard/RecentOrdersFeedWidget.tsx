import React from 'react';
import Link from 'next/link';
import { Package, ArrowRight, Clock } from 'lucide-react';
import { formatKopecks } from '@/utils/format-kopecks';
import { TenantBrandBadge } from '@/app/admin/orders/components/columns';

interface RecentOrder {
  id: string;
  numericId: number;
  charge: bigint;
  status: string;
  createdAt: Date;
  tenantId: string;
  user: { email: string };
  service: {
    name: string;
    category: {
      name: string;
      network: { name: string; slug: string } | null;
    } | null;
  };
}

interface Props {
  orders: RecentOrder[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  COMPLETED:        { label: 'Выполнен',  cls: 'bg-success/10 text-success-text border-success/20' },
  IN_PROGRESS:      { label: 'В работе',  cls: 'bg-primary/10 text-primary border-primary/20' },
  PENDING:          { label: 'В очереди', cls: 'bg-warning/10 text-warning-text border-warning/20' },
  AWAITING_PAYMENT: { label: 'Ожидает',   cls: 'bg-muted text-muted-foreground border-border' },
  PARTIAL:          { label: 'Частично',  cls: 'bg-warning/10 text-warning-text border-warning/20' },
  CANCELED:         { label: 'Отменён',   cls: 'bg-destructive/10 text-destructive-text border-destructive/20' },
  ERROR:            { label: 'Ошибка',    cls: 'bg-destructive/10 text-destructive-text border-destructive/20' },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins}м назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  return `${Math.floor(hours / 24)}д назад`;
}

export function RecentOrdersFeedWidget({ orders }: Props) {
  return (
    <div className="bg-card text-card-foreground rounded-lg p-5 border border-border/70 shadow-sm flex flex-col justify-between space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
              Лента последних заказов (Live Feed)
            </h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Оперативный поток поступающих задач в реальном времени
            </p>
          </div>
        </div>
        <Link
          href="/admin/orders"
          className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
        >
          <span>Все заказы</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Content List */}
      {orders.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Заказов за выбранный период не найдено
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {orders.map((o) => {
            const statusConfig = STATUS_BADGE[o.status] || {
              label: o.status,
              cls: 'bg-muted text-muted-foreground border-border/50',
            };

            return (
              <div
                key={o.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 px-2 rounded-md transition-colors"
              >
                {/* Order & Service Info */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex flex-col shrink-0 min-w-[70px]">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/orders?edit_order_id=${o.id}`}
                        className="font-mono font-bold text-primary hover:underline"
                      >
                        #{o.numericId}
                      </Link>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {timeAgo(o.createdAt)}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-[240px]" title={o.service?.name}>
                      {o.service?.name || 'Услуга'}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <span className="font-medium text-foreground/80">
                        {o.service?.category?.network?.name || '—'}
                      </span>
                      <span>•</span>
                      <span className="truncate">{o.user.email}</span>
                    </div>
                  </div>
                </div>

                {/* Amount & Status Badge */}
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <span className="font-mono font-bold text-foreground tabular-nums text-xs">
                    {formatKopecks(o.charge)}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusConfig.cls}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
