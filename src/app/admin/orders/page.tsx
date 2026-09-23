import { adminOrderService } from '@/services/admin/order.service';
import { Package, Download, BookOpen, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { OPERATIONS_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { OrderClient } from './components/order-client';
import { OrdersFilterForm } from './components/orders-filter-form';
import { NumberedPagination } from '@/components/admin/ui/numbered-pagination';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { resolveOrderEnvironmentMode } from '@/utils/order-environment';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    activityType?: string;
    datePreset?: string;
    cursor?: string;
    page?: string;
    pageSize?: string;
    userId?: string;
    edit_order_id?: string;
    clientEmail?: string;
    orderId?: string;
    externalId?: string;
    serviceName?: string;
    networkSlug?: string;
    link?: string;
    minPrice?: string;
    maxPrice?: string;
    minQuantity?: string;
    maxQuantity?: string;
    isDripFeed?: string;
    noProvider?: string;
    stale?: string;
    sort?: string;
    order?: string;
    sortBy?: string;
    sortOrder?: string;
    tenant?: string;
    providerId?: string;
    errorCategory?: string;
    dateFrom?: string;
    dateTo?: string;
    environmentMode?: string;
  }>;
};

import { enforceSectionAccess } from '@/lib/server/rbac';

import { unstable_cache } from 'next/cache';

const getCachedNetworks = unstable_cache(
  async () => {
    return db.network.findMany({
      select: { 
        id: true, 
        name: true, 
        slug: true,
        categories: {
          select: { id: true, name: true, slug: true },
          orderBy: { sort: 'asc' }
        }
      },
      orderBy: { sort: 'asc' }
    });
  },
  ['admin_orders_networks_list'],
  { revalidate: 60, tags: ['catalog', 'networks'] }
);

const getCachedProviders = unstable_cache(
  async () => {
    return db.provider.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
  },
  ['admin_orders_providers_list'],
  { revalidate: 60, tags: ['providers'] }
);

export default async function AdminOrdersPage({ searchParams }: Props) {
  await enforceSectionAccess('orders');
  const session = await verifySession();
  const user = session ? await db.user.findUnique({ 
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  }) : null;

  const isSuperAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  // Table-level cost/margin visibility is strictly reserved for OWNER and ADMIN.
  // SUPPORT sees only retail prices in the main table list to avoid confusion and distraction.
  const canSeeRatesInTable = isSuperAdmin;

  const params = await searchParams;
  const query = params.q || '';
  const statusFilter = params.status || 'ALL';
  const cursor = params.cursor || undefined;
  const userId = params.userId || '';
  const editOrderId = params.edit_order_id || '';
  const networkSlug = params.networkSlug || '';
  const { resolveAdminTenantContext } = await import('@/utils/admin-tenant');
  const resolvedTenant = resolveAdminTenantContext(user, params.tenant);
  const tenantFilter = resolvedTenant !== 'all' ? resolvedTenant : undefined;

  const networks = await getCachedNetworks();
  const providers = await getCachedProviders();

  const isDripFeed = params.isDripFeed === 'true';
  const noProvider = params.noProvider === 'true';
  const staleMinutes = params.stale ? parseInt(params.stale, 10) : undefined;
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const pageSize = Math.max(10, Math.min(200, parseInt(params.pageSize || '50', 10) || 50));

  const { items: orders, totalCount, totalPages, currentPage } = await adminOrderService.searchOrders({
    query: query || undefined,
    status: statusFilter,
    activityType: params.activityType || undefined,
    datePreset: params.datePreset || undefined,
    cursor,
    page,
    pageSize,
    userId: userId || undefined,
    clientEmail: params.clientEmail || undefined,
    orderId: params.orderId ? parseInt(params.orderId, 10) : undefined,
    externalId: params.externalId || undefined,
    serviceName: params.serviceName || undefined,
    networkSlug: networkSlug || undefined,
    link: params.link || undefined,
    minPrice: params.minPrice ? parseFloat(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
    minQuantity: params.minQuantity ? parseInt(params.minQuantity, 10) : undefined,
    maxQuantity: params.maxQuantity ? parseInt(params.maxQuantity, 10) : undefined,
    tenantId: tenantFilter,
    isDripFeed: params.isDripFeed ? isDripFeed : undefined,
    noProvider: params.noProvider ? noProvider : undefined,
    providerId: params.providerId || undefined,
    errorCategory: params.errorCategory || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    environmentMode: params.environmentMode || undefined,
    staleMinutes: !isNaN(staleMinutes || NaN) ? staleMinutes : undefined,
    sortField: params.sort || params.sortBy || undefined,
    sortOrder: (params.order === 'asc' || params.order === 'desc' || params.sortOrder === 'asc' || params.sortOrder === 'desc')
      ? ((params.order || params.sortOrder) as 'asc' | 'desc')
      : undefined,
  });

  // Если передан edit_order_id, гарантируем, что этот заказ есть на первой странице (в начале списка)
  if (editOrderId) {
    const hasEditOrder = orders.some(o => o.id === editOrderId);
    if (!hasEditOrder) {
      const extraOrder = await db.order.findUnique({
        where: { id: editOrderId },
        include: {
          user: { select: { id: true, email: true } },
          provider: { select: { name: true, ticketUrl: true } },
          payment: { select: { id: true, gatewayId: true, gateway: true } },
          service: { 
            select: { 
              id: true, 
              name: true, 
              numericId: true,
              etaP50Seconds: true,
              etaP90Seconds: true,
              etaSampleCount: true,
              etaSpeedClass: true,
              etaUpdatedAt: true,
              category: { select: { name: true, network: { select: { name: true } } } }
            } 
          },
        }
      });
      if (extraOrder) {
        orders.unshift(extraOrder as unknown as (typeof orders)[number]);
      }
    }
  }

  const stats = await adminOrderService.getOrderStats(undefined, undefined, tenantFilter);

  // Helper to build the query string for pagination preserving all filters
  const buildQueryString = (extraParams: Record<string, string> = {}) => {
    const qParams = new URLSearchParams();
    
    // Add all active params from searchParams
    Object.entries(params).forEach(([key, val]) => {
      if (val && key !== 'cursor') {
        qParams.set(key, String(val));
      }
    });

    // Merge in extra params (like next cursor)
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
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={Package}
        title="Заказы"
        description={`Всего: ${stats.total} • В очереди: ${stats.pending} • В работе: ${stats.inProgress} • Ошибки: ${stats.error}`}
        currentTenant={tenantFilter}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/docs/order-statuses"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground bg-card border border-border/70 shadow-2xs rounded-lg hover:bg-muted hover:text-primary transition-colors h-8"
              title="Открыть технический регламент и описание всех статусов"
            >
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              <span>Справка по статусам</span>
            </Link>

            {isSuperAdmin && (
              <a
                href={`/api/admin/export${buildQueryString({ type: 'orders' })}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-foreground bg-card border border-border/70 shadow-2xs rounded-lg hover:bg-muted hover:text-primary transition-colors h-8"
              >
                <Download className="w-3.5 h-3.5" /> Экспорт CSV
              </a>
            )}
          </div>
        }
        tabs={OPERATIONS_TABS}
        onboardingKey="orders"
        onboarding={ONBOARDING_CONFIGS.orders}
      />

      {/* Search + Filters & Orders Table Container */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-xl shadow-sm ring-1 ring-border/5 overflow-hidden flex flex-col">
        {/* Top Ultra-Compact Filters Section */}
        <div className="p-3 sm:p-4 border-b border-border/40 bg-muted/10">
          <OrdersFilterForm networks={networks} providers={providers} />
        </div>

        {/* Table Section */}
        <div className="flex-1 p-4 sm:p-5 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-border/40">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Заказы</span>
              {query && <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md">«{query}»</span>}
              <span className="text-muted-foreground font-medium text-xs">({orders.length} из {totalCount.toLocaleString('ru-RU')})</span>
            </h3>

            {/* Top Quick Compact Pagination */}
            {totalPages > 1 && (
              <NumberedPagination
                totalCount={totalCount}
                globalTotalCount={stats.total}
                currentPage={currentPage || page}
                totalPages={totalPages || 1}
                pageSize={pageSize}
                itemLabel="заказов"
                selectedTenant={tenantFilter}
                variant="compact"
              />
            )}
          </div>
          <OrderClient 
            canSeeRates={canSeeRatesInTable}
            userRole={user?.role}
            data={orders.map(o => ({
              id: o.id,
              numericId: o.numericId,
              externalId: o.externalId ?? null,
              link: o.link,
              quantity: o.quantity,
              remains: o.remains,
              status: o.status,
              charge: o.charge.toString(),
              providerCost: (o.providerCost ?? BigInt(0)).toString(),
              createdAt: o.createdAt,
              updatedAt: o.updatedAt,
              isDripFeed: o.isDripFeed,
              dripExternalIds: o.dripExternalIds,
              runs: o.runs ?? null,
              interval: o.interval ?? null,
              currentRun: o.currentRun,
              error: o.error ?? null,
              tenantId: o.tenantId,
              environmentMode: o.environmentMode,
              isTest: o.isTest,
              payment: o.payment ? {
                id: o.payment.id,
                gatewayId: o.payment.gatewayId ?? null,
                gateway: o.payment.gateway,
              } : null,
              resolvedEnvironmentMode: resolveOrderEnvironmentMode(o),
              user: { email: o.user.email },
              providerName: o.provider?.name ?? null,
              providerTicketUrl: o.provider?.ticketUrl ?? null,
              service: {
                name: o.service.name,
                etaP50Seconds: o.service.etaP50Seconds,
                etaP90Seconds: o.service.etaP90Seconds,
                etaSampleCount: o.service.etaSampleCount,
                etaSpeedClass: o.service.etaSpeedClass,
                etaUpdatedAt: o.service.etaUpdatedAt?.toISOString() ?? null,
                category: {
                  name: o.service.category.name,
                  network: o.service.category.network ?? null,
                },
              },
            }))} 
          />

          {/* Modular Bottom Numbered Pagination */}
          <NumberedPagination
            totalCount={totalCount}
            globalTotalCount={stats.total}
            currentPage={currentPage || page}
            totalPages={totalPages || 1}
            pageSize={pageSize}
            itemLabel="заказов"
            selectedTenant={tenantFilter}
            variant="full"
          />
        </div>
      </div>
    </div>
  );
}
