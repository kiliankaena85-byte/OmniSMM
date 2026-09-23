import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Prisma, OrderStatus } from '@prisma/client';
import Link from 'next/link';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { CustomerOrdersWorkspace } from '@/components/orders/CustomerOrdersWorkspace';
import { getTenantDashboardViews } from '@/tenants/factory';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';
import { ServiceIdBadge } from '@/components/ui/service-id-badge';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Мои заказы | SMMplan',
  description: 'История всех ваших заказов на платформе SMMplan. Отслеживайте статус, количество и историю выполнения.',
};

export const dynamic = 'force-dynamic';


interface OrdersPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    search?: string;
    network?: string;
  }>;
}

import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const params = await searchParams;
  const currentPage = parseInt(params.page || '1', 10);
  const limit = 15; // 15 records per page matches SaaS data density standards
  const skip = (currentPage - 1) * limit;

  const search = params.search || '';
  const status = params.status || '';
  const network = params.network || '';

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { balance: true }
  });

  if (!user) redirect('/login');

  // Build the DB where filter dynamically
  const where: Prisma.OrderWhereInput = {
    userId: session.userId,
  };

  if (status && status !== 'ALL') {
    where.status = status as OrderStatus;
  }

  if (network && network !== 'ALL') {
    where.service = {
      category: {
        network: {
          slug: network
        }
      }
    };
  }

  if (search) {
    where.OR = [
      ...(isNaN(Number(search)) ? [] : [{ numericId: parseInt(search, 10) }]),
      {
        service: {
          name: {
            contains: search,
            mode: 'insensitive' as const
          }
        }
      },
      {
        link: {
          contains: search,
          mode: 'insensitive' as const
        }
      }
    ];
  }

  // Fetch paginated dataset concurrently
  const [orders, totalCount, networks, statusCounts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        numericId: true,
        status: true,
        charge: true,
        discountCents: true,
        usdToRubRate: true,
        quantity: true,
        remains: true,
        link: true,
        error: true,
        createdAt: true,
        isDripFeed: true,
        runs: true,
        interval: true,
        currentRun: true,
        nextRunAt: true,
        refills: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        service: { 
          select: { 
            id: true,
            numericId: true,
            categoryId: true,
            name: true,
            isRefillEnabled: true,
            category: {
              select: {
                name: true,
                network: {
                  select: {
                    name: true,
                    slug: true
                  }
                }
              }
            }
          } 
        },
      },
    }),
    db.order.count({ where }),
    db.network.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { sort: 'asc' }
    }),
    db.order.groupBy({
      by: ['status'],
      where: { userId: session.userId },
      _count: true,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const countsMap = statusCounts.reduce((acc, curr) => {
    acc[curr.status] = curr._count;
    return acc;
  }, {} as Record<string, number>);

  const { OrdersView } = await getTenantDashboardViews(tenantId);

  const serializedOrders = orders.map((o) => ({
    ...o,
    charge: Number(o.charge ?? 0),
    chargeCents: Number(o.charge ?? 0),
    discountCents: Number(o.discountCents ?? 0),
  }));

  if (OrdersView) {
    return (
      <OrdersView
        orders={serializedOrders}
        totalCount={totalCount}
        userBalanceCents={Number(user.balance)}
        search={search}
        status={status}
        network={network}
        networks={networks}
        currentPage={currentPage}
        totalPages={totalPages}
        countsMap={countsMap}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardBreadcrumbs items={[{ label: 'Мои заказы' }]} />
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Мои заказы</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-1">
            История всех заказов — всего найдено: {totalCount}
          </p>
        </div>
        <Link
          href="/dashboard/new-order"
          className="h-10 sm:h-11 px-3.5 sm:px-4 flex items-center text-xs sm:text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm animate-hover-pulse whitespace-nowrap shrink-0"
        >
          + Новый заказ
        </Link>
      </div>

      {/* ── CLIENT FILTERS PANEL ── */}
      <OrderFilters
        initialSearch={search}
        initialStatus={status}
        initialNetwork={network}
        availableNetworks={networks}
        currentPage={currentPage}
        totalPages={totalPages}
        statusCounts={countsMap}
      />

      {orders.length === 0 ? (
        <div className="bg-card border border-border/60 rounded-2xl py-16 text-center shadow-sm">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="font-extrabold text-foreground text-base">Заказов не найдено</h3>
          <p className="text-muted-foreground text-xs max-w-sm mx-auto mt-1">
            Попробуйте изменить параметры поиска или фильтры, либо создайте новый заказ.
          </p>
          <Link
            href="/dashboard/new-order"
            className="mt-4 h-11 px-5 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200"
          >
            + Создать заказ
          </Link>
        </div>
      ) : (
        <CustomerOrdersWorkspace
          orders={serializedOrders}
          totalCount={totalCount}
          user={{
            balance: Number(user.balance ?? 0),
          }}
        />
      )}
    </div>
  );
}
