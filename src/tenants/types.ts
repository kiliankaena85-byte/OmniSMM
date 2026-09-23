import React from 'react';

export interface BaseUserProps {
  id?: string;
  email: string;
  balance?: bigint | number;
  balanceCents?: number;
  totalSpent?: bigint | number;
  referralCode?: string | null;
  tenantId: string;
  role?: string;
  unreadTicketsCount?: number;
  createdAt?: Date | string;
}

export interface OrderViewData {
  id: string;
  numericId: number;
  status: string;
  charge: bigint | number;
  discountCents?: bigint | number;
  usdToRubRate?: number | null;
  quantity: number;
  remains?: number | null;
  link?: string | null;
  error?: string | null;
  createdAt: Date | string;
  isDripFeed?: boolean;
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  nextRunAt?: Date | string | null;
  refills?: Array<{
    id: string;
    status: string;
    createdAt: Date | string;
  }>;
  service: {
    id?: string;
    categoryId?: string;
    name: string;
    isRefillEnabled?: boolean;
    category?: {
      name?: string;
      network?: {
        name?: string;
        slug?: string;
      } | null;
    } | null;
  };
}

export interface NetworkViewData {
  slug: string;
  name: string;
}

export interface ITenantDashboardStrategy<TUser = BaseUserProps, TOrder = unknown> {
  ShellLayout: React.ComponentType<{ user: TUser; children: React.ReactNode }>;
  HomeView: React.ComponentType<{
    user: TUser;
    orders: TOrder[];
    referralCount: number;
    activeOrders: number;
    hasPendingPayments: boolean;
    origin: string;
    initialCatalog?: unknown[];
  }>;
  NewOrderView?: React.ComponentType<{
    userEmail: string;
    userBalanceCents: number;
    initialReorderData: unknown;
  }>;
  OrdersView?: React.ComponentType<{
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
  }>;
  TransactionsView?: React.ComponentType<{
    initialEntries: unknown[];
    userEmail: string;
    currentBalanceRub?: number;
  }>;
}
