import * as React from 'react';
import { adminOrderService } from '@/services/admin/order.service';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { db } from '@/lib/db';
import { OrdersFilter } from './components/orders-filter';
import { OrdersTable, OperatorOrderRow } from './components/orders-table';
import { Package } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    cursor?: string;
    userId?: string;
    networkSlug?: string;
  }>;
};

export default async function OperatorOrdersPage({ searchParams }: Props) {
  // Enforce staff/operator session
  await enforceOperatorAccess();

  const params = await searchParams;
  const query = params.q || '';
  const statusFilter = params.status || 'ALL';
  const cursor = params.cursor || undefined;
  const userId = params.userId || '';
  const networkSlug = params.networkSlug || '';

  // Fetch social networks for filters
  const networks = await db.network.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { slug: 'asc' },
  });

  // Query order list and stats from DB
  const { items: rawOrders, nextCursor, hasMore } = await adminOrderService.searchOrders({
    query: query || undefined,
    status: statusFilter,
    cursor,
    pageSize: 50,
    userId: userId || undefined,
    networkSlug: networkSlug || undefined,
  });

  const stats = await adminOrderService.getOrderStats();

  // Map database entity to type-safe frontend rows, preventing BigInt serialization errors
  const orders: OperatorOrderRow[] = rawOrders.map((o) => ({
    id: o.id,
    numericId: o.numericId,
    status: o.status,
    quantity: o.quantity,
    remains: o.remains,
    charge: Number(o.charge),
    link: o.link,
    createdAt: o.createdAt,
    user: {
      id: o.user.id,
      email: o.user.email,
    },
    service: {
      id: o.service.id,
      name: o.service.name,
      category: {
        name: o.service.category.name,
        network: o.service.category.network
          ? { name: o.service.category.network.name }
          : null,
      },
    },
  }));

  // Preserves URL parameters during pagination steps
  const buildQueryString = (extraParams: Record<string, string> = {}) => {
    const qParams = new URLSearchParams();

    Object.entries(params).forEach(([key, val]) => {
      if (val && key !== 'cursor') {
        qParams.set(key, String(val));
      }
    });

    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) {
        qParams.set(key, val);
      } else {
        qParams.delete(key);
      }
    });

    const str = qParams.toString();
    return str ? `?${str}` : '';
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-10">
      {/* Header section with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Управление заказами
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-muted-foreground font-medium text-xs">
              <span className="flex items-center gap-1">
                Всего: <span className="text-foreground font-bold">{stats.total}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-warning rounded-full"></span>
                В очереди: <span className="text-foreground font-bold">{stats.pending}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                В работе: <span className="text-foreground font-bold">{stats.inProgress}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                Ошибки: <span className="text-foreground font-bold">{stats.error}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Form */}
      <OrdersFilter networks={networks} />

      {/* Orders List Table Container */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm ring-1 ring-border/5 overflow-hidden flex flex-col">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">
              Список заказов
              <span className="text-muted-foreground ml-1.5 font-medium text-xs">
                ({orders.length}
                {hasMore ? '+' : ''})
              </span>
            </h3>
          </div>

          <OrdersTable data={orders} />

          {/* Simple Pagination Footer */}
          {(cursor || hasMore) && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/40">
              {cursor ? (
                <Link
                  href={`/operator/orders${buildQueryString({ cursor: '' })}`}
                  className="px-4 py-2 text-xs font-bold text-foreground bg-background border border-border rounded-xl hover:bg-muted/50 transition-all active:scale-95 shadow-sm"
                >
                  ← В начало
                </Link>
              ) : (
                <div />
              )}
              {hasMore && nextCursor && (
                <Link
                  href={`/operator/orders${buildQueryString({ cursor: nextCursor })}`}
                  className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-sm"
                >
                  Следующая →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
