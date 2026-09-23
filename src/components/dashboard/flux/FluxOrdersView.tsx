'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { FluxOrdersList } from '@/components/dashboard/FluxOrdersList';
import { FluxOrdersKanban } from '@/components/dashboard/FluxOrdersKanban';
import { List, LayoutGrid } from 'lucide-react';
import { OrderViewData, NetworkViewData } from '@/tenants/types';

export function FluxOrdersView({
  orders,
  totalCount,
  userBalanceCents,
  search,
  status,
  network,
  networks,
  currentPage,
  totalPages,
  countsMap,
}: {
  orders: OrderViewData[];
  totalCount: number;
  userBalanceCents: number;
  search: string;
  status: string;
  network: string;
  networks: NetworkViewData[];
  currentPage: number;
  totalPages: number;
  countsMap: Record<string, number>;
}) {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const formattedOrders = orders.map((o) => ({
    id: o.id,
    numericId: o.numericId,
    status: o.status,
    charge: Number(o.charge) / 100,
    chargeCents: Number(o.charge),
    discountCents: Number(o.discountCents ?? 0),
    usdToRubRate: o.usdToRubRate ?? null,
    quantity: o.quantity,
    remains: o.remains ?? null,
    link: o.link ?? '',
    error: o.error ?? null,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : o.createdAt.toISOString(),
    isDripFeed: o.isDripFeed ?? false,
    runs: o.runs ?? null,
    interval: o.interval ?? null,
    currentRun: o.currentRun ?? 0,
    nextRunAt: o.nextRunAt ? (typeof o.nextRunAt === 'string' ? o.nextRunAt : o.nextRunAt.toISOString()) : null,
    refills: (o.refills || []).map(r => ({
      id: r.id,
      status: r.status,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : r.createdAt.toISOString()
    })),
    service: {
      id: o.service.id,
      name: o.service.name,
      categoryId: o.service.categoryId,
      isRefillEnabled: o.service.isRefillEnabled ?? false,
      network: {
        slug: o.service.category?.network?.slug || 'other',
      },
    },
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Мои заказы</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Найдено заказов: {totalCount}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/40">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'list' 
                  ? 'bg-card text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Режим списка"
            >
              <List className="w-4 h-4" />
              <span className="hidden md:inline">Список</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'kanban' 
                  ? 'bg-card text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Канбан-доска"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden md:inline">Канбан</span>
            </button>
          </div>

          <Link
            href="/dashboard/new-order"
            className="h-11 px-5 flex items-center text-sm font-bold bg-foreground text-background rounded-2xl hover:opacity-90 transition-all shadow-md shrink-0"
          >
            + Новый заказ
          </Link>
        </div>
      </div>

      <OrderFilters
        initialSearch={search}
        initialStatus={status}
        initialNetwork={network}
        availableNetworks={networks}
        currentPage={currentPage}
        totalPages={totalPages}
        statusCounts={countsMap}
      />

      {viewMode === 'list' ? (
        <FluxOrdersList orders={formattedOrders} userBalanceCents={userBalanceCents} />
      ) : (
        <FluxOrdersKanban orders={formattedOrders} userBalanceCents={userBalanceCents} />
      )}
    </div>
  );
}
