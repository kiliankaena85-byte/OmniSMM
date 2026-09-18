import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { Prisma, OrderStatus } from '@prisma/client';
import Link from 'next/link';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { RetryPaymentModal } from '@/components/orders/RetryPaymentModal';
import { MobileOrderList } from '@/components/orders/MobileOrderList';
import { ClientDate } from '@/components/ui/client-date';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { RepeatOrderButton } from '@/components/orders/RepeatOrderButton';
import { RefillRequestButton } from '@/components/orders/RefillRequestButton';
import { DripFeedProgress } from '@/components/orders/DripFeedProgress';
import { ChargeBreakdownModal } from '@/components/orders/ChargeBreakdownModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { CopyText } from '@/components/ui/CopyText';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { getTenantDashboardViews } from '@/tenants/factory';
import { formatRubles } from '@/utils/format-price';
import { getCustomerFacingOrderError } from '@/utils/order-customer-error';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';
import { Metadata } from 'next';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

export const metadata: Metadata = {
  title: 'Мои заказы | SMMplan',
  description: 'История всех ваших заказов на платформе SMMplan. Отслеживайте статус, количество и историю выполнения.',
};

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  COMPLETED:       'Выполнен',
  IN_PROGRESS:     'В работе',
  PENDING:         'Ожидание',
  PENDING_CHECK:   'На проверке',
  AWAITING_PAYMENT:'Ожидает оплаты',
  ERROR:           'Ошибка',
  CANCELED:        'Отменён',
  PARTIAL:         'Частично',
  PROVISIONING:    'Запуск',
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED:       'text-emerald-800 dark:text-success bg-success/10 border-emerald-500/20',
  IN_PROGRESS:     'text-blue-800 dark:text-blue-500    bg-blue-500/10    border-blue-500/20',
  PENDING:         'text-orange-800 dark:text-orange-500  bg-orange-500/10  border-orange-500/20',
  PENDING_CHECK:   'text-amber-800 dark:text-amber-500  bg-amber-500/10   border-amber-500/20',
  AWAITING_PAYMENT:'text-orange-800 dark:text-orange-500  bg-orange-500/10  border-orange-500/20',
  PROVISIONING:    'text-indigo-800 dark:text-indigo-500  bg-indigo-500/10  border-indigo-500/20',
  ERROR:           'text-red-800 dark:text-destructive     bg-destructive/10     border-red-500/20',
  PARTIAL:         'text-amber-800 dark:text-warning         bg-warning/10         border-amber-500/20',
  CANCELED:        'text-muted-foreground bg-muted border-border',
};

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

      {/* Desktop table */}
      <div className="hidden sm:block bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table aria-label="Список заказов">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[8%] px-3">ID</TableHead>
                <TableHead className="w-[27%] min-w-[200px] px-3">Услуга</TableHead>
                <TableHead className="w-[25%] px-3">Ссылка / Кол-во</TableHead>
                <TableHead className="w-[10%] text-right px-3">Сумма</TableHead>
                <TableHead className="w-[14%] px-3">Статус</TableHead>
                <TableHead className="w-[8%] px-3">Действия</TableHead>
                <TableHead className="w-[8%] text-right px-3">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const total = order.quantity || 1;
                let completed = 0;
                let progressPercent = 0;

                if (order.status === 'COMPLETED') {
                  completed = total;
                  progressPercent = 100;
                } else if (order.status === 'PENDING' || order.status === 'PROVISIONING' || order.status === 'AWAITING_PAYMENT') {
                  completed = 0;
                  progressPercent = 0;
                } else {
                  const remains = order.remains ?? order.quantity;
                  completed = Math.max(0, Math.min(total, total - remains));
                  progressPercent = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
                }

                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap px-3">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/dashboard/orders/${order.id}`} className="hover:text-primary font-bold transition-colors" aria-label={`Открыть заказ #${order.numericId}`}>
                          #{order.numericId}
                        </Link>
                        <CopyText text={order.numericId.toString()} iconOnly={true} tooltipText="Копировать ID заказа" />
                      </div>
                    </TableCell>
                    <TableCell className="px-3">
                      <Link href={`/dashboard/orders/${order.id}`} className="block" tabIndex={-1}>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                          {order.service.category?.network?.slug && (
                            <SocialIcon slug={order.service.category.network.slug} size={12} className="inline-block" />
                          )}
                          {order.service.category?.network?.name && (
                            <span className="text-primary">{order.service.category.network.name}</span>
                          )}
                          {order.service.category?.network?.name && order.service.category?.name && (
                            <span className="text-muted-foreground/30">•</span>
                          )}
                          {order.service.category?.name && (
                            <span className="text-muted-foreground/80">{order.service.category.name}</span>
                          )}
                        </div>
                        <div className="font-semibold text-foreground line-clamp-2 max-w-[240px] hover:text-primary transition-colors leading-tight">
                          {order.service.name}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex flex-col gap-1">
                        {order.link && (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={order.link}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-primary hover:underline text-xs max-w-[180px] truncate font-medium"
                              aria-label={`Открыть ссылку заказа #${order.numericId}`}
                            >
                              {order.link}
                            </a>
                            <CopyText text={order.link} iconOnly={true} tooltipText="Копировать целевую ссылку" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums font-medium">
                            {order.quantity.toLocaleString('ru-RU')} шт.
                          </span>
                          <DripFeedProgress
                            isDripFeed={order.isDripFeed}
                            runs={order.runs}
                            interval={order.interval}
                            currentRun={order.currentRun}
                            nextRunAt={order.nextRunAt}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-foreground tabular-nums whitespace-nowrap px-3">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-mono">
                          {formatRubles(Number(order.charge) / 100)}
                        </span>
                        <ChargeBreakdownModal
                          numericId={order.numericId}
                          chargeCents={order.charge}
                          discountCents={order.discountCents}
                          usdToRubRate={order.usdToRubRate}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex flex-col gap-1.5">
                        <OrderStatusBadge status={order.status} size="sm" />
                        {(() => {
                          const customerError = getCustomerFacingOrderError(order.status, order.error);
                          if (!customerError) return null;
                          return (
                            <div
                              className="text-[10px] text-destructive max-w-[150px] truncate font-semibold"
                              title={customerError}
                            >
                              {customerError}
                            </div>
                          );
                        })()}
                        {['IN_PROGRESS', 'PARTIAL', 'COMPLETED'].includes(order.status) && (
                          <div className="space-y-0.5 max-w-[130px]">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  order.status === 'COMPLETED' ? 'bg-emerald-500' :
                                  order.status === 'IN_PROGRESS' ? 'bg-primary animate-pulse' :
                                  'bg-purple-500'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <div className="text-[9px] text-muted-foreground tabular-nums flex justify-between font-mono">
                              <span>Доставлено:</span>
                              <span>{completed.toLocaleString('ru-RU')} / {total.toLocaleString('ru-RU')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-3">
                      <div className="flex items-center gap-1.5">
                        <RefillRequestButton
                          orderId={order.id}
                          isRefillEnabled={order.service.isRefillEnabled}
                          orderStatus={order.status}
                          createdAt={order.createdAt}
                          refills={order.refills}
                        />
                        {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
                          <div className="flex flex-col gap-1">
                            {order.status === 'AWAITING_PAYMENT' && user && (
                              <RetryPaymentModal 
                                orderId={order.id} 
                                charge={Number(order.charge)} 
                                balance={Number(user.balance)} 
                              />
                            )}
                            <CancelOrderButton orderId={order.id} createdAt={order.createdAt} status={order.status} />
                          </div>
                        ) : (
                          <RepeatOrderButton 
                            serviceId={order.service.id} 
                            categoryId={order.service.categoryId} 
                            link={order.link} 
                            quantity={order.quantity} 
                            remains={order.remains}
                            status={order.status}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap px-3">
                      <ClientDate date={order.createdAt.toISOString()} format="datetime" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile cards (Drawer + Instant touch) */}
      <div className="sm:hidden">
        <MobileOrderList orders={orders} user={user} />
      </div>

      {orders.length === 0 && (
        <div className="bg-card border border-border/60 rounded-2xl py-16 text-center shadow-sm">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-muted-foreground text-sm">Заказов не найдено</p>
          <Link
            href="/dashboard/new-order"
            className="mt-4 h-11 px-5 inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200"
          >
            + Создать заказ
          </Link>
        </div>
      )}
    </div>
  );
}
