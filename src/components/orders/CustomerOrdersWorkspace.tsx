'use client';

import React, { useState, useEffect } from 'react';
import {
  OrderViewMode,
  OrderViewModeSwitcher,
} from '@/components/orders/OrderViewModeSwitcher';
import { DesktopOrderTable } from '@/components/orders/DesktopOrderTable';
import { DesktopOrderCards } from '@/components/orders/DesktopOrderCards';
import {
  MobileOrderList,
  MobileOrderItem,
  MobileOrderUser,
} from '@/components/orders/MobileOrderList';

const STORAGE_KEY = 'smmplan_orders_view_mode';

interface CustomerOrdersWorkspaceProps {
  orders: MobileOrderItem[];
  totalCount: number;
  user?: MobileOrderUser | null;
}

function getOrdersNoun(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'заказов';
  if (mod10 === 1) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4) return 'заказа';
  return 'заказов';
}

export function CustomerOrdersWorkspace({
  orders,
  totalCount,
  user,
}: CustomerOrdersWorkspaceProps) {
  const [viewMode, setViewMode] = useState<OrderViewMode>('table');

  // Hydrate user preference from localStorage without SSR mismatch & sync cross-tab
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'table' || saved === 'cards') {
        setViewMode(saved);
      }
    } catch {
      // Ignore localStorage availability or security errors
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'table' || e.newValue === 'cards')) {
        setViewMode(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleViewModeChange = (mode: OrderViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore localStorage errors
    }
  };

  return (
    <div className="space-y-4">
      {/* ── ORDERS LIST TOOLBAR (Counter + View Switcher) ── */}
      <div className="flex items-center justify-between gap-3 px-1 py-0.5">
        <div className="text-xs sm:text-sm text-muted-foreground font-medium flex items-center gap-2">
          <span>
            Найдено:{' '}
            <strong className="text-foreground font-bold">{totalCount}</strong>{' '}
            {getOrdersNoun(totalCount)}
          </span>
          {orders.length < totalCount && (
            <span className="hidden sm:inline text-xs text-muted-foreground/80 font-normal">
              (на странице: {orders.length})
            </span>
          )}
        </div>

        <OrderViewModeSwitcher
          viewMode={viewMode}
          onChange={handleViewModeChange}
        />
      </div>

      {/* ── DESKTOP VIEW (xl+) ── */}
      <div className="hidden xl:block">
        {viewMode === 'table' ? (
          <DesktopOrderTable orders={orders} user={user} />
        ) : (
          <DesktopOrderCards orders={orders} user={user} />
        )}
      </div>

      {/* ── MOBILE / TABLET VIEW (< xl) ── */}
      <div className="xl:hidden">
        <MobileOrderList orders={orders} user={user} viewMode={viewMode} />
      </div>
    </div>
  );
}
