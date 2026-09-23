# СБОРКА ИСХОДНОГО КОДА ПРОЕКТА SMMplan / Flux / Lovable
## ЧАСТЬ 2 из 5: Панель управления (Dashboard Shell, Order Wizard, Dock, Views)

**Дата сборки:** 28 июля 2026  
**Файл:** `PROJECT_FILES_PART_2_2026-07-28.md`  
**Количество файлов в части:** 49  
**Принцип:** Доказательность 100%. Чтение файлов ВСЕГДА выполнено НАПРЯМУЮ С ДИСКА (`fs.readFileSync`). Нет сокращений (`...`), нет моков, нет заглушек.

---

### 📄 Файл 1 из 49: `src/hooks/useOrderWizard.ts`

```ts
import { useState } from 'react';
import { checkoutAction } from '@/actions/order/checkout';
import { FluxCategory } from '@/types/flux';

export const MAX_DRIP_FEED_DURATION_MINUTES = 43200; // 30 days
export const DRIP_FEED_MAX_ERROR_MESSAGE = "Слишком большая длительность drip-feed (максимально 30 дней)";

export function validateDripFeedDuration(runs: number, interval: number): boolean {
  return runs * interval <= MAX_DRIP_FEED_DURATION_MINUTES;
}

export interface CatalogNetworkItem {
  id: string;
  name: string;
  slug: string;
  categories?: FluxCategory[];
}

export interface OrderWizardServiceItem {
  id: string;
  name: string;
  pricePerUnitRub: number;
  minQty: number;
  maxQty: number;
  customDataType?: string | null;
  customDataLabel?: string | null;
  clientRequirement?: string | null;
  clientConfirmation?: boolean;
  requireWarning?: boolean;
}

export interface UseOrderWizardOptions {
  initialCatalog?: CatalogNetworkItem[];
  initialEmail?: string;
}

export function detectNetworkByUrl<T extends { slug: string; name: string }>(url: string, catalog: T[]): T | null {
  try {
    const host = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`)
      .hostname.toLowerCase().replace(/^www\./, '');
    const rules: Array<[string[], string]> = [
      [['t.me', 'telegram.org', 'telegram.me'], 'telegram'],
      [['instagram.com', 'instagr.am'], 'instagram'],
      [['vk.com', 'vk.ru', 'm.vk.com'], 'vk'],
      [['youtube.com', 'youtu.be'], 'youtube'],
      [['tiktok.com'], 'tiktok'],
      [['x.com', 'twitter.com'], 'twitter'],
    ];
    for (const [hosts, key] of rules) {
      if (hosts.some(h => host === h || host.endsWith('.' + h))) {
        return catalog.find(n => (n.slug || n.name).toLowerCase().includes(key)) ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function useOrderWizard(options: UseOrderWizardOptions = {}) {
  const { initialCatalog = [], initialEmail = '' } = options;

  const [link, setLink] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [quantity, setQuantity] = useState<number>(100);
  const [gateway, setGateway] = useState<'yookassa' | 'cryptobot' | 'balance'>('yookassa');
  const [selectedService, setSelectedService] = useState<OrderWizardServiceItem | null>(null);

  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);

  const [customData, setCustomData] = useState('');
  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);

  // Validate drip-feed duration (P2-4 constraint: runs * interval <= 43200 min = 30 days)
  const dripFeedDurationMinutes = dripRuns * dripInterval;
  const isDripFeedValid = !isDripFeedEnabled || dripFeedDurationMinutes <= 43200;

  const numericQuantity = typeof quantity === 'string' ? (parseInt(quantity) || 0) : quantity;
  const effectiveQuantity = isDripFeedEnabled ? numericQuantity * dripRuns : numericQuantity;
  const priceRub = selectedService ? (selectedService.pricePerUnitRub * effectiveQuantity).toFixed(2) : '0.00';

  const analyzeLink = (url: string) => {
    return detectNetworkByUrl(url, initialCatalog);
  };

  return {
    link, setLink,
    email, setEmail,
    quantity, setQuantity,
    gateway, setGateway,
    selectedService, setSelectedService,
    isDripFeedEnabled, setIsDripFeedEnabled,
    dripRuns, setDripRuns,
    dripInterval, setDripInterval,
    customData, setCustomData,
    isRequirementsConfirmed, setIsRequirementsConfirmed,
    isDripFeedValid,
    dripFeedDurationMinutes,
    effectiveQuantity,
    priceRub,
    analyzeLink,
    checkoutAction,
  };
}

```

---

### 📄 Файл 2 из 49: `src/app/dashboard/layout.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { headers } from 'next/headers';
import { getTenantDashboardViews } from '@/tenants/factory';
import { TenantErrorBoundary } from '@/tenants/TenantErrorBoundary';

import { resolveTenantFromRequest } from '@/lib/tenant-resolver';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true, balance: true, tenantId: true },
  });

  if (!user) redirect('/login');

  const userForClient = {
    email: user.email,
    tenantId: user.tenantId,
    balanceCents: Number(user.balance),
  };

  const { ShellLayout } = await getTenantDashboardViews(tenantId);

  return (
    <TenantErrorBoundary tenantId={tenantId}>
      <ShellLayout user={userForClient}>{children}</ShellLayout>
    </TenantErrorBoundary>
  );
}

```

---

### 📄 Файл 3 из 49: `src/app/dashboard/new-order/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import ClientPage from "./client-page";
import type { Metadata } from 'next';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { getTenantDashboardViews } from '@/tenants/factory';

import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver';

export const metadata: Metadata = {
  title: 'Новый заказ',
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await verifySession();
  const sp = await searchParams;
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  let userEmail = "";
  let userBalanceCents = 0;

  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, balance: true }
    });
    userEmail = user?.email || "";
    userBalanceCents = user?.balance ? Number(user.balance) : 0;
  }

  let initialReorderData = null;
  if (sp.reorderServiceId && sp.reorderCategoryId && sp.reorderQty) {
    initialReorderData = {
      serviceId: sp.reorderServiceId as string,
      categoryId: sp.reorderCategoryId as string,
      link: (sp.reorderLink as string) || "",
      quantity: parseInt(sp.reorderQty as string, 10) || 100
    };
  }

  const { NewOrderView } = await getTenantDashboardViews(tenantId);
  const ActiveNewOrderView = NewOrderView || ClientPage;

  return (
    <ActiveNewOrderView
      userEmail={userEmail}
      userBalanceCents={userBalanceCents}
      initialReorderData={initialReorderData}
    />
  );
}


```

---

### 📄 Файл 4 из 49: `src/app/dashboard/orders/page.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
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
import { CopyText } from '@/components/ui/CopyText';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { getTenantDashboardViews } from '@/tenants/factory';
import { getTenantScopedDb } from '@/lib/prisma-tenant-scope';
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
import { resolveTenantFromRequest } from '@/lib/tenant-resolver';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId: session.userId,
  };

  if (status && status !== 'ALL') {
    where.status = status;
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

  if (OrdersView) {
    return (
      <OrdersView
        orders={orders}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Мои заказы</h1>
          <p className="text-muted-foreground text-sm mt-1">
            История всех заказов — всего найдено: {totalCount}
          </p>
        </div>
        <Link
          href="/dashboard/new-order"
          className="h-11 px-4 flex items-center text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm animate-hover-pulse whitespace-nowrap shrink-0"
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

      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
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
                const color = STATUS_COLOR[order.status] || STATUS_COLOR.CANCELED;
                const label = STATUS_LABEL[order.status] || order.status;
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
                        <span>
                          {(Number(order.charge) / 100).toLocaleString('ru-RU', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          ₽
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
                        <span
                          className={`inline-flex items-center self-start px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded-md border ${color}`}
                        >
                          {label}
                        </span>
                        {order.error && (
                          <div
                            className="text-[10px] text-destructive max-w-[150px] truncate"
                            title={order.error}
                          >
                            {order.error}
                          </div>
                        )}
                        {order.status === 'IN_PROGRESS' && order.remains != null && (
                          <div className="space-y-0.5 max-w-[120px]">
                            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full animate-pulse"
                                style={{ width: `${Math.min(100, Math.max(0, Math.round(((order.quantity - order.remains) / order.quantity) * 100)))}%` }}
                              />
                            </div>
                            <div className="text-[9px] text-muted-foreground tabular-nums flex justify-between">
                              <span>Выполнено:</span>
                              <span>{Math.min(100, Math.max(0, Math.round(((order.quantity - order.remains) / order.quantity) * 100)))}%</span>
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

        {/* Mobile cards (Virtualized + Drawer) */}
        <MobileOrderList orders={orders} user={user} />

        {orders.length === 0 && (
          <div className="py-16 text-center">
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
    </div>
  );
}

```

---

### 📄 Файл 5 из 49: `src/app/dashboard/page.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getBaseUrlAsync } from '@/utils/get-base-url';

import { headers } from 'next/headers';

import { getPublicCatalogAction } from '@/actions/order/catalog';
import { getTenantDashboardViews } from '@/tenants/factory';

export const dynamic = 'force-dynamic';

import { resolveTenantFromRequest } from '@/lib/tenant-resolver';

export default async function DashboardPage(props: { searchParams?: Promise<{ tenant?: string }> }) {
  const searchParams = await props.searchParams;
  const session = await verifySession();
  if (!session) redirect('/login');

  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const [user, orders, referralCount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        balance: true,
        totalSpent: true,
        referralCode: true,
        createdAt: true,
        tenantId: true,
      },
    }),
    db.order.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        numericId: true,
        status: true,
        charge: true,
        quantity: true,
        createdAt: true,
        service: { select: { name: true } },
      },
    }),
    db.user.count({ where: { referredById: session.userId } }),
  ]);

  if (!user) redirect('/login');

  // P3.4: Use server-side headers() — no hydration mismatch
  const origin = await getBaseUrlAsync();

  const activeOrders = await db.order.count({
    where: { userId: session.userId, status: { in: ['IN_PROGRESS', 'PENDING', 'PROVISIONING'] } },
  });

  const hasPendingPayments = await db.payment.count({
    where: { userId: session.userId, status: 'PENDING', gateway: 'yookassa' }
  }) > 0;

  const { HomeView } = await getTenantDashboardViews(tenantId);

  const catalogResult = await getPublicCatalogAction();
  const catalog = catalogResult.success && catalogResult.data ? catalogResult.data : [];

  return (
    <HomeView
      user={user}
      orders={orders}
      referralCount={referralCount}
      activeOrders={activeOrders}
      hasPendingPayments={hasPendingPayments}
      origin={origin}
      initialCatalog={catalog}
    />
  );
}

```

---

### 📄 Файл 6 из 49: `src/components/dashboard/order-wizard/WizardStepIndicator.tsx`

```tsx
'use client';

import React from 'react';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

interface WizardStepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepClick: (step: 1 | 2 | 3 | 4) => void;
  selectedNetworkName?: string;
  selectedCategoryName?: string;
  selectedServiceName?: string;
}

export function WizardStepIndicator({
  currentStep,
  onStepClick,
  selectedNetworkName,
  selectedCategoryName,
  selectedServiceName,
}: WizardStepIndicatorProps) {
  const steps = [
    { number: 1, label: selectedNetworkName || 'Соцсеть' },
    { number: 2, label: selectedCategoryName || 'Категория' },
    { number: 3, label: selectedServiceName ? 'Тариф' : 'Услуга' },
    { number: 4, label: 'Оформление' },
  ] as const;

  return (
    <div className="w-full bg-card/60 backdrop-blur-xl border border-border/30 rounded-2xl p-2.5 sm:p-3 shadow-sm mb-6 flex items-center justify-between overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1 sm:gap-2 min-w-max mx-auto">
        {steps.map((step, idx) => {
          const isDone = currentStep > step.number;
          const isActive = currentStep === step.number;
          const isClickable = isDone;

          return (
            <React.Fragment key={step.number}>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(step.number)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                    : isDone
                    ? 'bg-muted/80 text-foreground hover:bg-muted cursor-pointer'
                    : 'text-muted-foreground/60 cursor-not-allowed opacity-60'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                    isActive
                      ? 'bg-primary-foreground text-primary'
                      : isDone
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted-foreground/20 text-muted-foreground'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : step.number}
                </div>
                <span className="truncate max-w-[110px] sm:max-w-[140px]">{step.label}</span>
              </button>

              {idx < steps.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mx-0.5" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

```

---

### 📄 Файл 7 из 49: `src/components/dashboard/order-wizard/WizardNetworkStep.tsx`

```tsx
'use client';

import React from 'react';
import { PublicNetwork } from '@/actions/order/catalog';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { Link2, Sparkles } from 'lucide-react';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';

interface WizardNetworkStepProps {
  catalog: PublicNetwork[];
  selectedNetwork: PublicNetwork | null;
  onSelectNetwork: (net: PublicNetwork) => void;
  link: string;
  onLinkChange: (val: string) => void;
  detectedPlatform: IntelligencePlatform;
  linkRef: React.RefObject<HTMLInputElement | null>;
  error?: string;
  validationTimestamp?: number;
}

export function WizardNetworkStep({
  catalog,
  selectedNetwork,
  onSelectNetwork,
  link,
  onLinkChange,
  detectedPlatform,
  linkRef,
  error,
  validationTimestamp,
}: WizardNetworkStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Target Link Quick Input */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-foreground flex items-center justify-between">
          <span>Ссылка на канал / видео / пост</span>
          {detectedPlatform !== IntelligencePlatform.OTHER && (
            <span className="text-[10px] text-primary font-mono flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Автоопределение: {detectedPlatform}
            </span>
          )}
        </label>
        <div className="relative">
          <input
            ref={linkRef}
            type="url"
            value={link}
            onChange={(e) => onLinkChange(e.target.value)}
            placeholder="https://t.me/your_channel или https://vk.com/wall..."
            className={`w-full h-12 pl-10 pr-4 bg-background border ${
              error ? 'border-destructive animate-shake' : 'border-border/60 hover:border-primary/40'
            } rounded-2xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
            key={error ? `link-${validationTimestamp}` : 'link-normal'}
          />
          <Link2 className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4" />
        </div>
        {error && <p className="text-xs text-destructive font-semibold mt-1">{error}</p>}
      </div>

      {/* Grid of Available Social Networks */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-muted-foreground">Или выберите платформу вручную:</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {catalog.map((net) => {
            const isSelected = selectedNetwork?.id === net.id;
            return (
              <button
                key={net.id}
                type="button"
                onClick={() => onSelectNetwork(net)}
                className={`p-4 rounded-2xl border text-left flex flex-col items-center justify-center gap-2.5 transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-md scale-[1.02]'
                    : 'bg-card/75 border-border/30 hover:border-primary/30 hover:bg-card text-foreground'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center border border-border/40 shadow-xs">
                  <SocialIcon slug={net.slug} size={22} />
                </div>
                <span className="font-extrabold text-xs truncate max-w-full">{net.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 8 из 49: `src/components/dashboard/order-wizard/WizardCategoryStep.tsx`

```tsx
'use client';

import React from 'react';
import { PublicCategory } from '@/actions/order/catalog';
import { Layers, ChevronLeft } from 'lucide-react';

interface WizardCategoryStepProps {
  categories: PublicCategory[];
  selectedCategory: PublicCategory | null;
  onSelectCategory: (cat: PublicCategory) => void;
  onBack: () => void;
  networkName: string;
}

export function WizardCategoryStep({
  categories,
  selectedCategory,
  onSelectCategory,
  onBack,
  networkName,
}: WizardCategoryStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Назад к выбору соцсети
        </button>
        <span className="text-xs font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full">
          {networkName}
        </span>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Выберите категорию продвижения:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.map((cat) => {
            const isSelected = selectedCategory?.id === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-all duration-200 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-md'
                    : 'bg-card/75 border-border/30 hover:border-primary/30 hover:bg-card text-foreground'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center shrink-0 border border-border/40 text-primary">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs block truncate">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground font-medium block">
                    Доступно для заказа
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 9 из 49: `src/components/dashboard/order-wizard/WizardServiceStep.tsx`

```tsx
'use client';

import React from 'react';
import { PublicService } from '@/actions/order/catalog';
import { ChevronLeft, Zap, ShieldCheck } from 'lucide-react';
import { formatEtaSpeedBadge } from '@/utils/format-eta';

interface WizardServiceStepProps {
  services: PublicService[];
  isLoadingServices: boolean;
  selectedService: PublicService | null;
  onSelectService: (srv: PublicService) => void;
  onBack: () => void;
  categoryName: string;
}

export function WizardServiceStep({
  services,
  isLoadingServices,
  selectedService,
  onSelectService,
  onBack,
  categoryName,
}: WizardServiceStepProps) {
  if (isLoadingServices) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-muted-foreground">Загрузка доступных тарифов...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Назад к выбору категории
        </button>
        <span className="text-xs font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-full">
          {categoryName}
        </span>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">Выберите нужный тариф:</h3>
        <div className="space-y-3">
          {services.map((srv) => {
            const isSelected = selectedService?.id === srv.id;
            const pricePerUnit = srv.pricePerUnitRub || 0;
            const speedInfo = formatEtaSpeedBadge(srv);

            return (
              <div
                key={srv.id}
                onClick={() => onSelectService(srv)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 space-y-3 ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-card/75 border-border/30 hover:border-primary/30 hover:bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-extrabold text-xs text-foreground leading-snug">{srv.name}</h4>
                    {srv.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{srv.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-black text-foreground">
                      {pricePerUnit.toFixed(4)} ₽ <span className="text-[10px] font-normal text-muted-foreground">/ шт</span>
                    </div>
                    <span className="text-[9px] font-semibold text-muted-foreground">
                      Мин: {srv.minQty} • Макс: {srv.maxQty}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/10 text-[10px] font-semibold">
                  <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-0.5 rounded-lg text-muted-foreground">
                    <Zap className="w-3 h-3 text-amber-500" /> {speedInfo}
                  </span>
                  {srv.isRefillEnabled ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" /> Автодокрутка
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-muted px-2.5 py-0.5 rounded-lg text-muted-foreground">
                      Быстрый старт
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 10 из 49: `src/components/dashboard/LovableNewOrderWorkspace.tsx`

```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertCircle, 
  Gauge, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  Coins,
  ChevronLeft
} from 'lucide-react';
import { 
  getPublicCatalogAction, 
  getServicesByCategoryAction, 
  PublicNetwork, 
  PublicCategory, 
  PublicService 
} from '@/actions/order/catalog';
import { checkoutAction } from '@/actions/order/checkout';
import { formatEtaSpeedBadge } from '@/utils/format-eta';
import { detectPlatformLite } from '@/utils/link-extractor';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { WizardStepIndicator } from './order-wizard/WizardStepIndicator';
import { WizardNetworkStep } from './order-wizard/WizardNetworkStep';
import { WizardCategoryStep } from './order-wizard/WizardCategoryStep';
import { WizardServiceStep } from './order-wizard/WizardServiceStep';
import { formatRub } from '@/lib/money';
import { validateDripFeedDuration, DRIP_FEED_MAX_ERROR_MESSAGE } from '@/hooks/useOrderWizard';

export const MAX_DRIP_FEED_MINUTES = 43200; // 30 days = 43200 minutes max drip-feed limit

export function LovableNewOrderWorkspace({
  userBalanceCents = 0,
  userEmail = "",
  initialReorderData = null
}: {
  userBalanceCents?: number;
  userEmail?: string;
  initialReorderData?: { serviceId: string; categoryId: string; link: string; quantity: number } | null;
}) {
  const [catalog, setCatalog] = useState<PublicNetwork[]>([]);
  const [link, setLink] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<IntelligencePlatform>(IntelligencePlatform.OTHER);
  
  // Wizard Steps (1: Platform/Link, 2: Category, 3: Service, 4: Checkout)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  
  // Selection States
  const [selectedNetwork, setSelectedNetwork] = useState<PublicNetwork | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PublicCategory | null>(null);
  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  
  const [quantity, setQuantity] = useState(100);
  const [email, setEmail] = useState(userEmail);
  const [gateway, setGateway] = useState<'yookassa' | 'cryptobot' | 'balance'>('yookassa');
  
  // Drip-Feed & Custom Data & Requirement states
  const [isDripFeedEnabled, setIsDripFeedEnabled] = useState(false);
  const [dripRuns, setDripRuns] = useState(5);
  const [dripInterval, setDripInterval] = useState(60);
  const [customData, setCustomData] = useState("");
  const [isRequirementsConfirmed, setIsRequirementsConfirmed] = useState(false);

  // Validation / Error states
  const [isPending, setIsPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationTimestamp, setValidationTimestamp] = useState(0);
  const [success, setSuccess] = useState(false);

  // Refs for auto-scroll on validation error
  const linkRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const customDataRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const requirementRef = useRef<HTMLDivElement>(null);

  // Load catalog
  useEffect(() => {
    getPublicCatalogAction().then(res => {
      if (res.success && res.data) {
        setCatalog(res.data);
      }
    });
  }, []);

  // Preload reorder data
  useEffect(() => {
    if (initialReorderData && catalog.length > 0) {
      const { serviceId, categoryId, link: initialLink, quantity: initialQty } = initialReorderData;
      setLink(initialLink);
      setQuantity(initialQty);

      const network = catalog.find(net => net.categories.some(cat => cat.id === categoryId));
      if (network) {
        setSelectedNetwork(network);
        const category = network.categories.find(cat => cat.id === categoryId);
        if (category) {
          setSelectedCategory(category);
          setIsLoadingServices(true);
          getServicesByCategoryAction(categoryId).then(res => {
            const srvList = res || [];
            setServices(srvList);
            const service = srvList.find(s => s.id === serviceId);
            if (service) {
              setSelectedService(service);
            }
            setIsLoadingServices(false);
          });
        }
      }
      setCurrentStep(4);
    }
  }, [initialReorderData, catalog]);

  // Detect platform on link change
  useEffect(() => {
    if (!link) {
      setDetectedPlatform(IntelligencePlatform.OTHER);
      return;
    }
    const plat = detectPlatformLite(link);
    setDetectedPlatform(plat);

    // Auto-select network based on link detection
    if (plat !== IntelligencePlatform.OTHER) {
      const matchedNet = catalog.find(n => n.slug.toLowerCase().includes(plat.toLowerCase()));
      if (matchedNet) {
        setSelectedNetwork(matchedNet);
        // Clear child states if network changes
        if (selectedNetwork?.id !== matchedNet.id) {
          setSelectedCategory(null);
          setSelectedService(null);
          setServices([]);
        }
      }
    }
  }, [link, catalog, selectedNetwork]);

  // Load services when category changes
  useEffect(() => {
    if (!selectedCategory) {
      setServices([]);
      setSelectedService(null);
      return;
    }
    setIsLoadingServices(true);
    getServicesByCategoryAction(selectedCategory.id).then(res => {
      const srvList = res || [];
      setServices(srvList);
      if (srvList.length > 0) {
        setSelectedService(srvList[0]);
        setQuantity(srvList[0].minQty || 100);
      } else {
        setSelectedService(null);
      }
      setIsLoadingServices(false);
    });
  }, [selectedCategory]);

  const handleNetworkSelect = (net: PublicNetwork) => {
    setSelectedNetwork(net);
    setSelectedCategory(null);
    setSelectedService(null);
    setServices([]);
    
    // Auto-advance to Step 2
    setCurrentStep(2);
  };

  const handleCategorySelect = (cat: PublicCategory) => {
    setSelectedCategory(cat);
    
    // Auto-advance to Step 3
    setCurrentStep(3);
  };

  const handleServiceSelect = (srv: PublicService) => {
    setSelectedService(srv);
    setQuantity(srv.minQty || 100);
    setIsDripFeedEnabled(false);
    setDripRuns(5);
    setDripInterval(60);
    setCustomData("");
    setIsRequirementsConfirmed(false);
    
    // Auto-advance to Step 4
    setCurrentStep(4);
  };

  // Prices
  const pricePerUnit = selectedService ? (selectedService.pricePerUnitRub || 0) : 0;
  const effectiveQuantity = isDripFeedEnabled ? quantity * dripRuns : quantity;
  const totalPrice = (pricePerUnit * effectiveQuantity).toFixed(2);

  // Zod & Custom Validations
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // 1. Link validation
    if (!link) {
      newErrors.link = "Укажите ссылку для продвижения";
    } else if (selectedService && selectedNetwork) {
      try {
        const catName = selectedCategory?.name || '';
        const targetType = selectedService.targetType === 'POST' ? 'POST' : (selectedService.targetType || inferTargetTypeFromCategory(catName));
        const normalizedLink = mutateLink(link, selectedNetwork.slug, targetType);
        const validator = getLinkValidator(selectedNetwork.slug, targetType);
        const parsed = validator.safeParse(normalizedLink);
        
        if (!parsed.success) {
          newErrors.link = parsed.error.errors[0].message;
        }
      } catch {
        // Fallback standard URL match if validator is missing
        if (!link.startsWith('http://') && !link.startsWith('https://')) {
          newErrors.link = "Ссылка должна начинаться с https://";
        }
      }
    }

    // 2. Quantity validation
    if (selectedService) {
      if (quantity < selectedService.minQty) {
        newErrors.quantity = `Минимальный заказ: ${selectedService.minQty} шт.`;
      } else if (quantity > selectedService.maxQty) {
        newErrors.quantity = `Максимальный заказ: ${selectedService.maxQty} шт.`;
      }
    }

    // 3. Custom Data validation
    if (selectedService?.customDataType && selectedService.customDataType !== 'NONE') {
      if (!customData.trim()) {
        newErrors.customData = selectedService.customDataLabel || "Пожалуйста, заполните пользовательские данные";
      }
    }

    // 4. Requirement confirmation check (JIT)
    const hasReq = selectedService?.clientRequirement || selectedService?.clientConfirmation || selectedService?.requireWarning;
    if (hasReq && !isRequirementsConfirmed) {
      newErrors.requirement = "Необходимо подтвердить выполнение условий для старта услуги";
    }

    // 5. Email validation
    if (!email) {
      newErrors.email = "Укажите Email адрес";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Введите корректный адрес электронной почты";
    }

    // 6. Drip-feed duration (макс 30 дней = 43200 минут)
    if (isDripFeedEnabled && !validateDripFeedDuration(dripRuns, dripInterval)) {
      newErrors.drip = DRIP_FEED_MAX_ERROR_MESSAGE;
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      // Re-trigger shake animations using timestamp
      setValidationTimestamp(Date.now());
      
      // Auto scroll to first error field
      setTimeout(() => {
        if (newErrors.link && linkRef.current) {
          linkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          linkRef.current.focus();
        } else if (newErrors.customData && customDataRef.current) {
          customDataRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          customDataRef.current.focus();
        } else if (newErrors.quantity && qtyRef.current) {
          qtyRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          qtyRef.current.focus();
        } else if (newErrors.requirement && requirementRef.current) {
          requirementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (newErrors.email && emailRef.current) {
          emailRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          emailRef.current.focus();
        } else if (newErrors.drip && qtyRef.current) {
          qtyRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);

      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Always validate first, intercept submit if not valid
    if (!validateForm()) {
      return;
    }

    if (!selectedService || !link) return;
    
    setIsPending(true);
    setErrors({});
    setSuccess(false);

    try {
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: link.trim(),
        quantity: effectiveQuantity,
        email: email,
        gateway: gateway,
        runs: isDripFeedEnabled ? dripRuns : undefined,
        interval: isDripFeedEnabled ? dripInterval : undefined,
        customData: selectedService.customDataType !== 'NONE' ? customData : undefined,
        isRequirementsConfirmed: isRequirementsConfirmed
      });

      if (res && res.success) {
        if (res.data?.paymentUrl) {
          // external gateway redirect (server-validated)
          window.location.href = res.data.paymentUrl;
        } else {
          setSuccess(true);
          setLink('');
          setCurrentStep(1);
        }
      } else {
        setErrors({ general: res?.error || "Произошла ошибка при оформлении заказа" });
        setValidationTimestamp(Date.now());
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Не удалось создать заказ";
      setErrors({ general: errMsg });
      setValidationTimestamp(Date.now());
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-8 items-start">
      
      {/* LEFT COLUMN: 4-STEP WIZARD (7 COLS) */}
      <div className="col-span-12 lg:col-span-7 space-y-6">
        
        {success ? (
          <div className="bg-card border border-success/20 rounded-[2rem] p-8 text-center space-y-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Заказ успешно оформлен!</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Запуск произойдет в течение нескольких минут. Вы можете отслеживать статус заказа в разделе активности на главной.
            </p>
            <button
              type="button"
              onClick={() => setSuccess(false)}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-2xl transition-all"
            >
              Создать новый заказ
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Step Navigation Tabs indicator */}
            <WizardStepIndicator
              currentStep={currentStep}
              onStepClick={(step) => setCurrentStep(step)}
              selectedNetworkName={selectedNetwork?.name}
              selectedCategoryName={selectedCategory?.name}
              selectedServiceName={selectedService?.name}
            />

            {/* STEP 1: Platform & Target Link */}
            {currentStep === 1 && (
              <WizardNetworkStep
                catalog={catalog}
                selectedNetwork={selectedNetwork}
                onSelectNetwork={handleNetworkSelect}
                link={link}
                onLinkChange={setLink}
                detectedPlatform={detectedPlatform}
                linkRef={linkRef}
                error={errors.link}
                validationTimestamp={validationTimestamp}
              />
            )}

            {/* STEP 2: Category Selection */}
            {currentStep === 2 && selectedNetwork && (
              <WizardCategoryStep
                categories={selectedNetwork.categories}
                selectedCategory={selectedCategory}
                onSelectCategory={handleCategorySelect}
                onBack={() => setCurrentStep(1)}
                networkName={selectedNetwork.name}
              />
            )}

            {/* STEP 3: Service Selection */}
            {currentStep === 3 && selectedCategory && (
              <WizardServiceStep
                services={services}
                isLoadingServices={isLoadingServices}
                selectedService={selectedService}
                onSelectService={handleServiceSelect}
                onBack={() => setCurrentStep(2)}
                categoryName={selectedCategory.name}
              />
            )}

            {/* STEP 4: Checkout configuration */}
            {currentStep === 4 && selectedService && (
              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Quantity config */}
                <div 
                  key={`step4-qty-${validationTimestamp}`}
                  className={`bg-card border border-border/30 rounded-[2rem] p-6 space-y-4 transition-all duration-300 ${errors.quantity ? 'animate-shake border-destructive/40 shadow-[0_0_20px_rgba(244,63,94,0.05)]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-foreground">Количество</h3>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      Минимум: {selectedService.minQty} - Максимум: {selectedService.maxQty} шт
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-background/50 p-4 rounded-2xl border border-border/20">
                      <span className="text-xs font-bold text-muted-foreground">Заказать:</span>
                      <input
                        ref={qtyRef}
                        type="number"
                        min={selectedService.minQty || 10}
                        max={selectedService.maxQty || 100000}
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                        className={`w-32 text-right font-mono font-extrabold text-lg bg-transparent border-none p-0 focus:ring-0 ${errors.quantity ? 'text-destructive' : 'text-foreground'}`}
                      />
                    </div>
                    
                    {errors.quantity && (
                      <p className="text-xs font-bold text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.quantity}
                      </p>
                    )}

                    <input
                      type="range"
                      min={selectedService.minQty || 10}
                      max={Math.min(10000, selectedService.maxQty || 100000)}
                      step={10}
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value))}
                      className="w-full accent-primary bg-muted rounded-lg h-2 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Custom Data Config */}
                {selectedService.customDataType && selectedService.customDataType !== 'NONE' && (
                  <div 
                    key={`step4-customData-${validationTimestamp}`}
                    className={`bg-card border border-border/30 rounded-[2rem] p-6 space-y-3 transition-all duration-300 ${errors.customData ? 'animate-shake border-destructive/40 shadow-[0_0_20px_rgba(244,63,94,0.05)]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-foreground">
                        {selectedService.customDataLabel || (selectedService.customDataType === 'TEXTAREA' ? 'Ваши комментарии / текст (по 1 строке)' : 'Параметры заказа')}
                      </h3>
                    </div>
                    {selectedService.customDataType === 'TEXTAREA' ? (
                      <textarea
                        ref={customDataRef as React.RefObject<HTMLTextAreaElement>}
                        rows={3}
                        value={customData}
                        onChange={(e) => setCustomData(e.target.value)}
                        placeholder="Введите каждый комментарий с новой строки..."
                        className={`w-full bg-background border border-border/40 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.customData ? 'border-destructive/60' : ''}`}
                      />
                    ) : (
                      <input
                        ref={customDataRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={customData}
                        onChange={(e) => setCustomData(e.target.value)}
                        placeholder="Введите вариант ответа / числовое значение..."
                        className={`w-full bg-background border border-border/40 rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.customData ? 'border-destructive/60' : ''}`}
                      />
                    )}
                    {errors.customData && (
                      <p className="text-xs font-bold text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.customData}
                      </p>
                    )}
                  </div>
                )}

                {/* Drip-Feed Config */}
                {selectedService.isDripFeedEnabled && (
                  <div className="bg-card border border-border/30 rounded-[2rem] p-6 space-y-4 transition-all duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h3 className="font-extrabold text-sm text-foreground">Запускать частями (Drip-Feed)</h3>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isDripFeedEnabled} 
                          onChange={(e) => setIsDripFeedEnabled(e.target.checked)} 
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>

                    {isDripFeedEnabled && (
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/10">
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Количество запусков (runs)</label>
                          <input
                            type="number"
                            min={2}
                            max={100}
                            value={dripRuns}
                            onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value) || 2))}
                            className="w-full bg-background border border-border/40 rounded-xl p-2.5 text-sm font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Интервал (мин)</label>
                          <input
                            type="number"
                            min={5}
                            max={1440}
                            value={dripInterval}
                            onChange={(e) => setDripInterval(Math.max(1, parseInt(e.target.value) || 5))}
                            className="w-full bg-background border border-border/40 rounded-xl p-2.5 text-sm font-bold outline-none"
                          />
                        </div>
                        <p className="col-span-2 text-[11px] text-muted-foreground font-semibold">
                          Всего запусков: {dripRuns} по {quantity} шт. Итоговый объём: <strong className="text-foreground">{effectiveQuantity} шт.</strong>
                        </p>
                        {errors.drip && (
                          <p className="col-span-2 text-xs font-bold text-destructive flex items-center gap-1 pt-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.drip}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Requirement Checkbox (JIT Warning) */}
                {(selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning) && (
                  <div 
                    ref={requirementRef}
                    key={`step4-req-${validationTimestamp}`}
                    className={`bg-card border rounded-[2rem] p-6 space-y-3 transition-all duration-300 ${
                      isRequirementsConfirmed 
                        ? 'border-green-500/30 bg-green-500/5' 
                        : errors.requirement 
                          ? 'animate-shake border-destructive/40 shadow-[0_0_20px_rgba(244,63,94,0.05)] bg-destructive/5' 
                          : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" /> Чек-лист для старта
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedService.clientRequirement || selectedService.warningMessage || "Перед запуском убедитесь, что ваш объект продвижения доступен."}
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer group pt-1">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={isRequirementsConfirmed}
                          onChange={(e) => setIsRequirementsConfirmed(e.target.checked)}
                        />
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isRequirementsConfirmed ? 'bg-green-500 border-green-500 text-foreground' : errors.requirement ? 'border-destructive bg-destructive/10' : 'border-muted-foreground/30 bg-background group-hover:border-primary/50'}`}>
                          <svg className={`w-3.5 h-3.5 pointer-events-none transition-transform duration-200 ${isRequirementsConfirmed ? 'scale-100' : 'scale-0'}`} viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </div>
                      <span className={`text-xs font-bold transition-colors ${isRequirementsConfirmed ? 'text-green-600' : errors.requirement ? 'text-destructive' : 'text-foreground'}`}>
                        {selectedService.clientConfirmation || "Я всё проверил, можно запускать"}
                      </span>
                    </label>
                    {errors.requirement && (
                      <p className="text-xs font-bold text-destructive flex items-center gap-1 pt-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.requirement}
                      </p>
                    )}
                  </div>
                )}

                {/* Email and Gateway config */}
                <div 
                  key={`step4-checkout-${validationTimestamp}`}
                  className={`bg-card border border-border/30 rounded-[2rem] p-6 space-y-4 transition-all duration-300 ${errors.email ? 'animate-shake border-destructive/40 shadow-[0_0_20px_rgba(244,63,94,0.05)]' : ''}`}
                >
                  <h3 className="font-extrabold text-sm text-foreground">Детали оплаты</h3>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {['yookassa', 'cryptobot', 'balance'].map((gatewayOpt) => {
                      const isActive = gateway === gatewayOpt;
                      return (
                        <button
                          key={gatewayOpt}
                          type="button"
                          onClick={() => setGateway(gatewayOpt as 'yookassa' | 'cryptobot' | 'balance')}
                          className={`py-2 text-center rounded-xl border text-xs font-bold transition-all ${
                            isActive ? 'bg-primary/10 border-primary text-foreground shadow-sm' : 'bg-background/40 border-border/30 text-muted-foreground hover:border-primary/20'
                          }`}
                        >
                          {gatewayOpt === 'yookassa' ? 'YooKassa' : gatewayOpt === 'cryptobot' ? 'CryptoBot' : 'Баланс'}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <input
                      ref={emailRef}
                      type="email"
                      placeholder="Ваш Email для отправки чеков"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full focus:ring-0 focus:outline-none ${errors.email ? 'border-destructive/60' : ''}`}
                      required
                    />
                    {errors.email && (
                      <p className="text-xs font-bold text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.email}
                      </p>
                    )}
                  </div>

                  {errors.general && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold rounded-2xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errors.general}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-border/10">
                    <span className="text-xs font-bold text-muted-foreground">Итого к оплате:</span>
                    <span className="text-xl font-black text-foreground font-mono">{totalPrice} ₽</span>
                  </div>
                </div>

                <div className="flex justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-5 py-4 border border-border/40 text-muted-foreground hover:text-foreground font-bold rounded-2xl flex items-center gap-1 hover:bg-background transition-all shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" /> Назад
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2"
                  >
                    {isPending ? 'Оформление заказа...' : 'Оплатить заказ'}
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

      </div>

      {/* RIGHT COLUMN: PREVIEW SCREEN (5 COLS) */}
      <div className="col-span-12 lg:col-span-5 lg:sticky lg:top-24">
        <div className="bg-card/85 backdrop-blur-3xl border border-border/30 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/20 transition-all duration-300 min-h-[480px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-sm text-foreground">Анализ цели</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Preview Engine</span>
            </div>

            {/* Target Card Visual representation */}
            <div className="p-6 bg-background/50 border border-border/20 rounded-3xl flex flex-col items-center text-center space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-2 right-2 flex gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <div className="w-2 h-2 rounded-full bg-green-500 absolute" />
              </div>

              {/* Avatar placeholder with visual design */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center text-primary text-3xl font-black shadow-inner">
                {selectedNetwork ? selectedNetwork.name.substring(0, 1) : '?'}
              </div>

              <div className="space-y-1 w-full min-w-0">
                <h4 className="font-bold text-sm text-foreground truncate">
                  {link ? (link.includes('t.me/') ? `@${link.split('t.me/')[1].split('/')[0]}` : 'Аккаунт продвижения') : 'Ожидание ссылки...'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px] mx-auto">
                  {link || 'ссылка не указана'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full pt-3 border-t border-border/10">
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/10 text-center">
                  <span className="block text-[9px] text-muted-foreground font-bold uppercase">Канал</span>
                  <span className="text-xs font-bold text-foreground truncate block mt-0.5">
                    {selectedNetwork ? selectedNetwork.name : '—'}
                  </span>
                </div>
                <div className="bg-background/80 p-2.5 rounded-xl border border-border/10 text-center">
                  <span className="block text-[9px] text-muted-foreground font-bold uppercase">Объем</span>
                  <span className="text-xs font-bold text-foreground block mt-0.5">
                    {isDripFeedEnabled ? `${quantity * dripRuns} шт (${quantity} × ${dripRuns} зап.)` : `${quantity} шт`}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform rules / Warnings */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground">Характеристики запуска:</h4>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3 bg-background/40 border border-border/20 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-muted-foreground font-bold">Скорость старта</span>
                    <span className="text-xs font-bold text-foreground">{selectedService ? formatEtaSpeedBadge(selectedService) : "Стандартно"}</span>
                  </div>
                </div>

                <div className="p-3 bg-background/40 border border-border/20 rounded-2xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[9px] text-muted-foreground font-bold">Гарантия на списания</span>
                    <span className="text-xs font-bold text-foreground">
                      {selectedService?.isRefillEnabled ? "30 дней (автопополнение)" : "Без гарантии"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-8 pt-4 border-t border-border/10 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Coins className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>Ваш баланс: <strong className="text-foreground">{formatRub(userBalanceCents)} ₽</strong></span>
          </div>

        </div>
      </div>

    </div>
  );
}

```

---

### 📄 Файл 11 из 49: `src/components/dashboard/LovableDock.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { DOCK_NAV_ITEMS } from '@/lib/navigation';

export function LovableDock({ email, className }: { email?: string; className?: string }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  return (
    <div className={`hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl bg-card/80 backdrop-blur-2xl border border-border/45 rounded-3xl py-3 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] items-center justify-between transition-all duration-300 ${className || ''}`}>
      <nav className="flex-1 flex items-center justify-around gap-1">
        {DOCK_NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={`relative flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-3.5 py-2.5 sm:px-3 sm:py-2 text-xs font-semibold rounded-2xl transition-all duration-300 ${
                active
                  ? 'bg-primary text-primary-foreground shadow-[0_0_15px_var(--color-blob-sky)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="w-4.5 h-4.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="h-6 w-px bg-border/60 mx-4" />

      {/* User / Logout */}
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
            {(email || '').substring(0, 2)}
          </div>
          <span className="text-xs text-muted-foreground font-semibold max-w-[100px] truncate">{email}</span>
        </div>
        <form method="POST" action="/api/auth/logout">
          <button
            type="submit"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-2xl transition-colors cursor-pointer"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 12 из 49: `src/components/dashboard/LovableOrdersKanban.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { 
  Clock, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink 
} from 'lucide-react';
import { getStatusBadgeClass, getStatusLabel } from '@/utils/status-helpers';
import { FluxOrder } from '@/types/flux';

export function LovableOrdersKanban({ orders }: { orders: FluxOrder[] }) {
  const [activeTab, setActiveTab] = useState<'queue' | 'in_progress' | 'done'>('queue');
  
  // Categorize orders into kanban columns
  const queueOrders = orders.filter(o => 
    ['PENDING', 'PROVISIONING', 'AWAITING_PAYMENT'].includes(o.status)
  );
  
  const inProgressOrders = orders.filter(o => 
    ['IN_PROGRESS', 'PARTIAL'].includes(o.status)
  );
  
  const doneOrders = orders.filter(o => 
    ['COMPLETED', 'CANCELED', 'ERROR'].includes(o.status)
  );

  const renderCard = (order: FluxOrder) => {
    const remains = order.remains ?? order.quantity;
    const total = order.quantity || 1;
    const completed = Math.max(0, total - remains);
    const progressPercent = Math.min(100, Math.round((completed / total) * 100));

    return (
      <div 
        key={order.id} 
        className="p-5 bg-card/75 backdrop-blur-md border border-border/30 rounded-[1.75rem] shadow-sm hover:border-primary/30 hover:shadow-lg transition-all duration-300 space-y-4 group"
      >
        <div className="flex justify-between items-start gap-2">
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-lg bg-muted text-muted-foreground">
            #{order.numericId}
          </span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${getStatusBadgeClass(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
        </div>

        <div className="space-y-1.5">
          <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {order.service.name}
          </h4>
          <a 
            href={order.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1 truncate max-w-full"
          >
            {order.link} <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>

        {/* Progress representation */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] font-semibold text-muted-foreground">
            <span>Прогресс: {progressPercent}%</span>
            <span>{completed} / {total} шт</span>
          </div>
          <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden border border-border/10">
            <div 
              className="bg-primary h-full rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>

        <div className="pt-3 border-t border-border/10 flex justify-between items-center text-[10px] font-bold text-muted-foreground">
          <span>Сумма:</span>
          <span className="font-mono text-foreground">{order.charge.toFixed(2)} ₽</span>
        </div>

        {order.error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive text-[9px] font-semibold rounded-xl flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{order.error}</span>
          </div>
        )}
      </div>
    );
  };

  const renderColumnContent = (title: string, icon: React.ReactNode, dotColor: string, columnOrders: FluxOrder[], emptyText: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
          {icon} {title} ({columnOrders.length})
        </h3>
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
      </div>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 pb-4 scrollbar-thin">
        {columnOrders.length === 0 ? (
          <div className="p-8 border border-dashed border-border/40 rounded-[2rem] text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          columnOrders.map(renderCard)
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Mobile Tab Selector (block md:hidden) */}
      <div className="md:hidden flex items-center gap-1 p-1 bg-muted/50 rounded-2xl mb-6 border border-border/30">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'queue' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          В очереди ({queueOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'in_progress' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          В работе ({inProgressOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('done')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'done' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Завершено ({doneOrders.length})
        </button>
      </div>

      {/* Mobile View: Single active column */}
      <div className="md:hidden">
        {activeTab === 'queue' && renderColumnContent("В очереди", <Clock className="w-4 h-4 text-amber-500" />, "bg-amber-500", queueOrders, "Нет заказов в очереди")}
        {activeTab === 'in_progress' && renderColumnContent("Выполняется", <Play className="w-4 h-4 text-blue-500" />, "bg-blue-500", inProgressOrders, "Нет выполняющихся заказов")}
        {activeTab === 'done' && renderColumnContent("Завершено", <CheckCircle2 className="w-4 h-4 text-emerald-500" />, "bg-emerald-500", doneOrders, "История пуста")}
      </div>

      {/* Desktop View: 3-column grid (hidden md:grid) */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {renderColumnContent("В очереди", <Clock className="w-4 h-4 text-amber-500" />, "bg-amber-500", queueOrders, "Нет заказов в очереди")}
        {renderColumnContent("Выполняется", <Play className="w-4 h-4 text-blue-500" />, "bg-blue-500", inProgressOrders, "Нет выполняющихся заказов")}
        {renderColumnContent("Завершено", <CheckCircle2 className="w-4 h-4 text-emerald-500" />, "bg-emerald-500", doneOrders, "История пуста")}
      </div>
    </div>
  );
}

```

---

### 📄 Файл 13 из 49: `src/components/dashboard/LovableOrdersList.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { CopyText } from '@/components/ui/CopyText';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { ClientDate } from '@/components/ui/client-date';
import { RetryPaymentModal } from '@/components/orders/RetryPaymentModal';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { RepeatOrderButton } from '@/components/orders/RepeatOrderButton';
import { RefillRequestButton } from '@/components/orders/RefillRequestButton';
import { DripFeedProgress } from '@/components/orders/DripFeedProgress';
import { ChargeBreakdownModal } from '@/components/orders/ChargeBreakdownModal';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { getStatusBadgeClass, getStatusLabel } from '@/utils/status-helpers';
import { formatRub } from '@/lib/money';

export interface LovableOrder {
  id: string;
  numericId: number;
  status: string;
  chargeCents: number;
  discountCents?: number;
  usdToRubRate?: number | null;
  quantity: number;
  remains: number | null;
  link?: string | null;
  error: string | null;
  createdAt: string;
  isDripFeed?: boolean;
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  nextRunAt?: string | null;
  refills?: Array<{
    id: string;
    status: string;
    createdAt: string;
  }>;
  service: {
    id?: string;
    name: string;
    categoryId?: string;
    isRefillEnabled?: boolean;
    network: {
      slug: string;
    };
  };
}

export function LovableOrdersList({
  orders,
  userBalanceCents = 0
}: {
  orders: LovableOrder[];
  userBalanceCents?: number;
}) {
  if (orders.length === 0) {
    return (
      <div className="bg-card/50 border border-border/30 rounded-[2rem] p-12 text-center space-y-4 hover:border-primary/20 transition-all">
        <div className="text-4xl">📭</div>
        <h3 className="font-extrabold text-foreground text-sm">Активных кампаний не обнаружено</h3>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Запустите свою первую рекламную кампанию прямо сейчас, указав ссылку на соцсеть.
        </p>
        <Link
          href="/dashboard/new-order"
          className="inline-flex h-11 px-6 items-center text-xs font-bold bg-primary text-primary-foreground rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-sm"
        >
          Запустить рекламу
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const color = getStatusBadgeClass(order.status);
        const label = getStatusLabel(order.status);
        const remains = order.remains ?? order.quantity;
        const total = order.quantity || 1;
        const completed = Math.max(0, total - remains);
        const percent = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));

        return (
          <div
            key={order.id}
            className="p-6 bg-card/60 backdrop-blur-md border border-border/30 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary/20 transition-all duration-200"
          >
            {/* Column 1: Platform & Service Details */}
            <div className="flex items-start gap-4 min-w-[280px] max-w-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <SocialIcon slug={order.service.network.slug} size={20} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                  <span className="font-bold text-primary">#{order.numericId}</span>
                  <CopyText text={order.numericId.toString()} iconOnly={true} tooltipText="Копировать ID" />
                  <span>•</span>
                  <ClientDate date={order.createdAt} format="datetime" />
                </div>
                <h4 className="font-extrabold text-sm text-foreground leading-tight hover:text-primary transition-colors truncate" title={order.service.name}>
                  {order.service.name}
                </h4>
              </div>
            </div>

            {/* Column 2: Link target & amount */}
            <div className="flex-1 min-w-[180px] space-y-1">
              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block">Целевая ссылка</span>
              <div className="flex items-center gap-2">
                {order.link ? (
                  <>
                    <a
                      href={order.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary font-bold hover:underline truncate max-w-[220px]"
                    >
                      {order.link}
                    </a>
                    <a href={order.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/60 hover:text-primary">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">—</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-semibold tabular-nums block">
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

            {/* Column 3: Live progress metrics */}
            <div className="w-full md:w-44 shrink-0 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                <span>Выполнено: {percent}%</span>
                <span className="font-mono">{completed} / {order.quantity}</span>
              </div>
              
              <div className="h-2 w-full bg-muted/60 border border-border/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${order.status === 'IN_PROGRESS' ? 'bg-primary animate-pulse' : 'bg-success'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {order.error && (
                <p className="text-[9px] text-destructive font-semibold flex items-center gap-0.5 truncate" title={order.error}>
                  <AlertCircle className="w-3 h-3 shrink-0" /> {order.error}
                </p>
              )}
            </div>

            {/* Column 4: Cost & Status info */}
            <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 md:pl-2">
              <div className="text-right">
                <span className="block text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Стоимость</span>
                <div className="flex items-center justify-end gap-1">
                  <span className="font-mono font-black text-sm text-foreground tabular-nums">
                    {formatRub(order.chargeCents)} ₽
                  </span>
                  <ChargeBreakdownModal
                    numericId={order.numericId}
                    chargeCents={order.chargeCents}
                    discountCents={order.discountCents}
                    usdToRubRate={order.usdToRubRate}
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`inline-flex items-center px-3 py-1 text-[9px] uppercase tracking-wider font-extrabold rounded-xl border ${color}`}>
                  {label}
                </span>

                {/* Actions Panel */}
                <div className="flex items-center gap-1.5">
                  <RefillRequestButton
                    orderId={order.id}
                    isRefillEnabled={order.service.isRefillEnabled}
                    orderStatus={order.status}
                    refills={order.refills}
                  />
                  {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
                    <div className="flex items-center gap-1.5">
                      {order.status === 'AWAITING_PAYMENT' && (
                        <RetryPaymentModal 
                          orderId={order.id} 
                          charge={order.chargeCents}
                          balance={userBalanceCents} // expects cents
                          trigger={
                            <button className="h-7 px-2.5 bg-primary/15 text-primary text-[10px] font-bold rounded-lg border border-primary/20 hover:bg-primary/20 transition-all flex items-center gap-1">
                              Оплатить
                            </button>
                          }
                        />
                      )}
                      <CancelOrderButton 
                        orderId={order.id} 
                        createdAt={new Date(order.createdAt)} 
                        status={order.status} 
                      />
                    </div>
                  ) : (
                    <RepeatOrderButton 
                      serviceId={order.service.id || ''} 
                      categoryId={order.service.categoryId || ''} 
                      link={order.link ?? null} 
                      quantity={order.quantity} 
                    />
                  )}
                </div>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}

```

---

### 📄 Файл 14 из 49: `src/components/dashboard/lovable/LovableDashboardShell.tsx`

```tsx
'use client';

import React from 'react';
import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';
import { formatBalance } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Wallet, 
  LogOut 
} from 'lucide-react';

import { MAIN_NAV_ITEMS } from '@/lib/navigation';

export function LovableDashboardShell({
  user,
  children,
}: {
  user: { email: string; balanceCents: number; tenantId: string };
  children: React.ReactNode;
}) {
  const balanceRub = formatBalance(user.balanceCents);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col relative overflow-x-clip">
      {/* ── LOVABLE VIBRANT HERO BACKGROUND (Full Bleed - GPU Optimized Static Layer) ── */}
      <div className="absolute top-0 inset-x-0 h-[2500px] z-0 pointer-events-none overflow-hidden select-none bg-white dark:bg-default-50">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(60% 50% at 10% 0%, rgba(59, 130, 246, 0.25), transparent 60%), ' +
              'radial-gradient(50% 50% at 90% 10%, rgba(56, 189, 248, 0.20), transparent 60%), ' +
              'radial-gradient(60% 50% at 15% 50%, rgba(244, 63, 94, 0.18), transparent 60%), ' +
              'radial-gradient(50% 50% at 85% 60%, rgba(249, 115, 22, 0.18), transparent 60%), ' +
              'radial-gradient(60% 60% at 50% 30%, rgba(217, 70, 239, 0.18), transparent 60%)',
          }}
        />
        <div className="absolute bottom-0 inset-x-0 h-[400px] bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* ── Top Navigation Bar ── */}
      <header className="relative z-40 w-full px-4 sm:px-8 py-3.5 flex items-center justify-between backdrop-blur-2xl bg-white/60 dark:bg-black/60 border-b border-border/30 shadow-sm sticky top-0">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-black text-xl text-foreground tracking-tight hover:opacity-90 transition-opacity">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-lg shadow-blue-500/25">
              F
            </div>
            <span className="truncate tracking-tight font-black">SMMflux</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {MAIN_NAV_ITEMS.map((item) => {
              const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-foreground text-background shadow-sm font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <BalanceDisplay initialBalance={balanceRub} variant="mobile-header" />
          <Link
            href="/dashboard/add-funds"
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-1.5"
          >
            <Wallet className="w-4 h-4" />
            <span>+ Пополнить</span>
          </Link>

          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-border/40">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold uppercase">
              {user.email.substring(0, 2)}
            </div>
            <span className="text-xs font-medium text-muted-foreground max-w-[120px] truncate">{user.email}</span>
            <form method="POST" action="/api/auth/logout">
              <button
                type="submit"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-lg transition-colors ml-1 cursor-pointer"
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Mobile Navigation Bar (Bottom Sticky) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-2xl border-t border-border/40 px-1 pt-1 pb-[calc(0.25rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 py-1 rounded-xl text-[10px] font-medium transition-all ${
                active ? 'text-primary font-bold bg-primary/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Main Content Area ── */}
      <main className="relative z-10 w-full flex-1 max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-12">
        {children}
      </main>
    </div>
  );
}



```

---

### 📄 Файл 15 из 49: `src/components/dashboard/lovable/LovableDashboardHome.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Wallet, ArrowRight, RefreshCw, TrendingUp, Users, Copy, Check } from 'lucide-react';
import { formatBalance } from '@/lib/utils';
import { PaymentAutoSync } from '@/components/orders/PaymentAutoSync';
import { LovableOrderClient } from '@/components/ab-test/LovableOrderClient';

import { getStatusBadgeClass, getStatusLabel } from '@/utils/status-helpers';
import { formatRub, toCents } from '@/lib/money';
import { FluxOrder, FluxNetwork } from '@/types/flux';

export function LovableDashboardHome({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
  initialCatalog = [],
}: {
  user: { email: string; balanceCents: number; referralCode?: string | null; totalSpent?: number };
  orders: FluxOrder[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
  initialCatalog?: FluxNetwork[];
}) {
  const [copied, setCopied] = React.useState(false);
  const refCode = user.referralCode ?? '';
  const refLink = refCode ? `${origin}?ref=${encodeURIComponent(refCode)}` : origin;
  const isRefLinkAvailable = Boolean(refCode);

  const copyTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyRefLink = () => {
    if (!isRefLinkAvailable) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(refLink).then(() => {
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {hasPendingPayments && <PaymentAutoSync />}
      
      {/* ── HERO ORDER WIZARD SECTION ── */}
      <section className="w-full">
        <LovableOrderClient 
          initialCatalog={initialCatalog} 
          initialEmail={user.email} 
        />
      </section>

      {/* ── METRICS & RECENT ORDERS GRID ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Balance & Active Orders */}
        <div className="space-y-6 lg:col-span-1">
          {/* Balance Card */}
          <div className="relative overflow-hidden rounded-[2rem] p-6 bg-card/80 backdrop-blur-2xl border border-border/40 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-500" />
                </div>
                <span className="font-bold text-foreground text-base">Ваш баланс</span>
              </div>
              <Link
                href="/dashboard/add-funds"
                className="text-xs font-bold px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
              >
                + Пополнить
              </Link>
            </div>
            
            <div className="text-3xl font-black tabular-nums tracking-tight mb-2 text-foreground">
              {formatBalance(user.balanceCents)}
            </div>
            
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Потрачено всего: {formatRub(Number(user.totalSpent || 0))} ₽</span>
            </div>
          </div>

          {/* Active Orders Card */}
          <div className="relative overflow-hidden rounded-[2rem] p-6 bg-card/80 backdrop-blur-2xl border border-border/40 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-purple-500 animate-spin-slow" />
                </div>
                <span className="font-bold text-foreground text-base">Активные заказы</span>
              </div>
              <Link href="/dashboard/orders" className="text-xs font-bold text-purple-500 flex items-center gap-1 hover:underline">
                Все <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="text-3xl font-black tabular-nums tracking-tight mb-1 text-foreground">
              {activeOrders}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Кампаний выполняется прямо сейчас</div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="relative overflow-hidden rounded-[2rem] p-6 bg-card/80 backdrop-blur-2xl border border-border/40 shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <span className="font-bold text-foreground text-lg">Последняя активность</span>
              <Link href="/dashboard/orders" className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                История <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-10 opacity-60">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium text-sm text-muted-foreground">Заказов пока нет</p>
                </div>
              ) : (
                orders.map(order => {
                  const color = getStatusBadgeClass(order.status);
                  const label = getStatusLabel(order.status);
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/30 border border-border/20 hover:bg-muted/60 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${color}`}>
                          {label}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground text-sm truncate">{order.service.name}</div>
                          <div className="text-xs text-muted-foreground font-medium">{order.quantity.toLocaleString('ru-RU')} шт.</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-foreground">{formatRub(order.chargeCents ?? toCents(order.charge))} ₽</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </section>

      {/* ── REFERRAL PROGRAM BANNER ── */}
      <section className="relative overflow-hidden rounded-[2rem] p-6 sm:p-8 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 shadow-xl text-white">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-blue-200">
              <Users className="w-3.5 h-3.5" />
              Партнёрская программа
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight">Приглашайте друзей и зарабатывайте</h3>
            <p className="text-sm text-white/80 max-w-xl font-medium">
              Делитесь персональной ссылкой и получайте % от каждого пополнения баланса вашими рефералами.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center flex-1 sm:flex-none">
              <span className="text-xs text-white/70 font-semibold block">Приглашено</span>
              <span className="text-xl font-black">{referralCount} чел.</span>
            </div>

            <button
              onClick={copyRefLink}
              disabled={!isRefLinkAvailable}
              title={!isRefLinkAvailable ? "Код скоро появится" : undefined}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white text-blue-600 font-bold text-sm shadow-md hover:bg-white/90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? "Ссылка скопирована!" : !isRefLinkAvailable ? "Код скоро появится" : "Скопировать ссылку"}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}


```

---

### 📄 Файл 16 из 49: `src/components/dashboard/lovable/LovableOrdersView.tsx`

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { LovableOrdersList } from '@/components/dashboard/LovableOrdersList';

import { OrderViewData, NetworkViewData } from '@/tenants/types';



export function LovableOrdersView({
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
  const formattedOrders = orders.map((o) => ({
    id: o.id,
    numericId: o.numericId,
    status: o.status,
    chargeCents: Number(o.charge),
    discountCents: Number(o.discountCents ?? 0),
    usdToRubRate: o.usdToRubRate ?? null,
    quantity: o.quantity,
    remains: o.remains ?? null,
    link: o.link ?? null,
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Мои заказы</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Найдено заказов: {totalCount}
          </p>
        </div>
        <Link
          href="/dashboard/new-order"
          className="h-11 px-5 flex items-center text-sm font-bold bg-foreground text-background rounded-2xl hover:opacity-90 transition-all shadow-md shrink-0"
        >
          + Новый заказ
        </Link>
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

      <LovableOrdersList orders={formattedOrders} userBalanceCents={userBalanceCents} />
    </div>
  );
}

```

---

### 📄 Файл 17 из 49: `src/app/client-demo/components/dashboards.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import '../dashboards.css';
import { 
  Send, 
  Instagram, 
  Youtube, 
  Video, 
  Share2, 
  CreditCard, 
  Zap, 
  Sparkles, 
  ShieldCheck, 
  ArrowUpRight,
  Menu,
  X,
  Copy,
  Award
} from 'lucide-react';

/* ==========================================================================
   SHARED DATA DICTIONARY (Per prompt spec §4)
   ========================================================================== */
export const DASHBOARD_DATA = {
  balance: '12 480 ₽',
  spent: '84 210 ₽',
  ordersCount: 312,
  savings: '5 940 ₽',
  refCode: 'ART-7F2K',
  refBalance: '1 240 ₽',
  supportHours: '09:00 – 21:00 МСК',
  chatHistory: [
    {
      id: 'msg-1',
      sender: 'operator',
      operatorName: 'Александр (Служба поддержки)',
      avatar: 'АА',
      text: 'Здравствуйте! Я дежурный инженер службы поддержки. Чем могу вам помочь?',
      time: '13:00',
      read: true
    },
    {
      id: 'msg-2',
      sender: 'user',
      text: 'Привет! Подскажите по заказу #381920, как скоро завершится накрутка подписчиков?',
      time: '13:05',
      read: true
    },
    {
      id: 'msg-3',
      sender: 'operator',
      operatorName: 'Александр (Служба поддержки)',
      avatar: 'АА',
      text: 'Заказ #381920 находится в фазе безопасной подачи (скорость ~500 под/час, чтобы избежать фильтров соцсети). Выполнено уже 420 из 1000. Всё идёт строго по графику!',
      time: '13:07',
      read: true
    }
  ],
  transactionsSummary: {
    totalCredited: '96 690.00 ₽',
    totalDebited: '84 210.00 ₽',
    totalRefunded: '5 940.00 ₽',
    refEarned: '1 240.00 ₽'
  },
  transactions: [
    {
      id: 'TX-90425',
      date: '26 июля, 13:14',
      type: 'DEBIT',
      category: 'ORDER',
      title: 'Списание: Заказ #381920 (TG Подписчики)',
      amount: '-3.38 ₽',
      rawAmount: -3.38,
      status: 'SUCCESS',
      statusText: 'Списано',
      orderId: '#381920'
    },
    {
      id: 'TX-90412',
      date: '26 июля, 12:00',
      type: 'CREDIT',
      category: 'DEPOSIT',
      title: 'Пополнение баланса (ЮKassa / СБП)',
      amount: '+10 000.00 ₽',
      rawAmount: 10000.00,
      status: 'SUCCESS',
      statusText: 'Зачислено'
    },
    {
      id: 'TX-90381',
      date: '22 июля, 16:06',
      type: 'CREDIT',
      category: 'REFUND',
      title: 'Авто-возврат за отменённый заказ #381750 (YT Просмотры)',
      amount: '+24.00 ₽',
      rawAmount: 24.00,
      status: 'REFUNDED',
      statusText: 'Возвращено на баланс',
      orderId: '#381750',
      isRefund: true
    },
    {
      id: 'TX-90380',
      date: '22 июля, 16:05',
      type: 'DEBIT',
      category: 'ORDER',
      title: 'Списание: Заказ #381750 (YT Просмотры)',
      amount: '-24.00 ₽',
      rawAmount: -24.00,
      status: 'CANCELED',
      statusText: 'Отменён (Списание отменено)',
      orderId: '#381750'
    },
    {
      id: 'TX-90310',
      date: '20 июля, 11:30',
      type: 'CREDIT',
      category: 'REFERRAL',
      title: 'Реферальное вознаграждение 10% (Партнёрство)',
      amount: '+124.00 ₽',
      rawAmount: 124.00,
      status: 'SUCCESS',
      statusText: 'Зачислено'
    },
    {
      id: 'TX-90200',
      date: '15 июля, 09:15',
      type: 'CREDIT',
      category: 'REFUND',
      title: 'Частичный возврат за остаток заказа #381200 (IG Лайки)',
      amount: '+1 500.00 ₽',
      rawAmount: 1500.00,
      status: 'REFUNDED',
      statusText: 'Возвращено на баланс',
      orderId: '#381200',
      isRefund: true
    }
  ],
  recentOrders: [
    {
      id: '#381920',
      network: 'Telegram',
      service: 'Подписчики (Канал / Группа)',
      status: 'IN_PROGRESS',
      statusText: 'В работе',
      link: 'https://t.me/my_awesome_channel',
      amount: '3.38 ₽',
      date: 'Сегодня, 13:14',
      icon: Send,
      color: '#1f9bf0'
    },
    {
      id: '#381919',
      network: 'Telegram',
      service: 'Реакции (🔥👍🎉 на пост)',
      status: 'COMPLETED',
      statusText: 'Выполнен',
      link: 'https://t.me/my_awesome_channel/142',
      amount: '3.38 ₽',
      date: 'Вчера, 18:40',
      icon: Send,
      color: '#1f9bf0'
    },
    {
      id: '#381890',
      network: 'Instagram',
      service: 'Лайки (Быстрый старт)',
      status: 'COMPLETED',
      statusText: 'Выполнен',
      link: 'https://instagram.com/p/C9xL2pQo8Mn',
      amount: '11.20 ₽',
      date: '24 июля, 09:12',
      icon: Instagram,
      color: '#e0218a'
    },
    {
      id: '#381750',
      network: 'YouTube',
      service: 'Просмотры (Удержание 3+ мин)',
      status: 'ERROR',
      statusText: 'Ошибка',
      link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      amount: '24.00 ₽',
      date: '22 июля, 16:05',
      icon: Youtube,
      color: '#ff0000'
    }
  ],
  tariffs: [
    { id: 'econ', name: 'Эконом', price: '0.01 ₽/шт', min: 10, speed: '~500 / день', badge: 'ЭКОНОМ', badgeBg: 'bg-emerald-500/10 text-emerald-600' },
    { id: 'std', name: 'Стандарт', price: '0.03 ₽/шт', min: 10, speed: '~5 000 / день', badge: 'СТАНДАРТ', badgeBg: 'bg-sky-500/10 text-sky-600', popular: true },
    { id: 'prem', name: 'Премиум', price: '0.05 ₽/шт', min: 10, speed: 'Мгновенно', badge: 'ПРЕМИУМ', badgeBg: 'bg-purple-500/10 text-purple-600' }
  ]
};

/* ==========================================================================
   SMMPLAN DASHBOARD COMPONENT (SaaS Terminal Professional)
   ========================================================================== */
export function SmmPlanDashboard({ isPreviewMode = false }: { isPreviewMode?: boolean }) {
  const [selectedNetwork, setSelectedNetwork] = useState('tg');
  const [selectedCategory, setSelectedCategory] = useState('subs');
  const [selectedTariff, setSelectedTariff] = useState('std');
  const [quantity, setQuantity] = useState('1000');
  const [targetLink, setTargetLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(`https://smmplan.ru/ref/${DASHBOARD_DATA.refCode}`);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="smmplan-scope w-full min-h-screen pb-16">
      {/* ── 1. TOP HEADER NAVIGATION ── */}
      <header className="bg-white border-b border-[#e2e8f0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Brand Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-[#1f9bf0] flex items-center justify-center text-white font-black text-lg shadow-sm">
                P
              </div>
              <span className="font-heading text-xl text-[#0e131a] tracking-tight font-extrabold">
                SMMplan
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold bg-[#e7f2fe] text-[#1f9bf0] rounded-full uppercase tracking-wider">
                Terminal
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              <a href="#dashboard" className="px-3 py-2 rounded-lg text-sm font-semibold text-[#1f9bf0] bg-[#e7f2fe]">
                Дашборд
              </a>
              <a href="#orders" className="px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2] transition-colors">
                Мои заказы
              </a>
              <a href="#deposit" className="px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2] transition-colors">
                Пополнение
              </a>
              <a href="#referrals" className="px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2] transition-colors">
                Рефералы
              </a>
              <a href="#support" className="px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2] transition-colors">
                Поддержка
              </a>
            </nav>

            {/* Right Quick Controls & Balance */}
            <div className="flex items-center gap-3">
              <div className="bg-[#e9edf2] px-3.5 py-1.5 rounded-full border border-[#d3dce8] flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8b94a3] uppercase hidden sm:inline">Баланс:</span>
                <span className="font-mono-data font-bold text-[#0e131a] text-sm sm:text-base">{DASHBOARD_DATA.balance}</span>
              </div>
              <button className="hidden sm:flex items-center gap-1.5 bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Пополнить</span>
              </button>

              {/* Mobile Burger Trigger */}
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-[#414a59] hover:bg-[#e9edf2] rounded-lg"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-[#e2e8f0] py-3 space-y-1 animate-in slide-in-from-top duration-200">
              <a href="#dashboard" className="block px-3 py-2 rounded-lg text-sm font-semibold text-[#1f9bf0] bg-[#e7f2fe]">
                Дашборд
              </a>
              <a href="#orders" className="block px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2]">
                Мои заказы
              </a>
              <a href="#deposit" className="block px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2]">
                Пополнение
              </a>
              <a href="#referrals" className="block px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2]">
                Рефералы
              </a>
              <a href="#support" className="block px-3 py-2 rounded-lg text-sm font-medium text-[#414a59] hover:bg-[#e9edf2]">
                Поддержка (09–21 МСК)
              </a>
            </div>
          )}
        </div>
      </header>

      {/* ── 2. SINGLE-LINE TICKER CAPSULE BAR ── */}
      <div className="bg-[#0e131a] text-white py-2 overflow-hidden border-b border-[#e2e8f0]">
        <div className="ticker-track text-xs font-semibold space-x-8 px-4">
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1f9d6b] animate-pulse" />
            <span>Платформа работает в штатном режиме</span>
          </span>
          <span>⚡ 15+ соцсетей</span>
          <span>• 500+ услуг</span>
          <span>• Авто-выполнение 24/7</span>
          <span>• 9–21 Поддержка МСК</span>
          <span>• Сберегли клиентам 5 940 ₽</span>
          <span>• Выполнено заказов: 1 420 000+</span>
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1f9d6b]" />
            <span>Платформа работает в штатном режиме</span>
          </span>
          <span>⚡ 15+ соцсетей</span>
          <span>• 500+ услуг</span>
          <span>• Авто-выполнение 24/7</span>
        </div>
      </div>

      {/* ── 3. MAIN DASHBOARD WORKSPACE ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* TOP ROW: BALANCE HERO + QUICK STATS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Balance Hero Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] border-l-4 border-l-[#1f9bf0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] flex flex-col justify-between min-w-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8b94a3]">Текущий баланс</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e6f7f0] text-[#1f9d6b] text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1f9d6b]" />
                  Активен
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-mono-data text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0e131a] tracking-tight">
                  {DASHBOARD_DATA.balance}
                </h1>
                <span className="text-xs font-semibold text-[#8b94a3]">ID счёта: #USR-8491</span>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div>
                  <span className="text-[11px] font-semibold text-[#8b94a3] block">Всего потрачено</span>
                  <span className="font-mono-data text-sm sm:text-base font-bold text-[#0e131a]">{DASHBOARD_DATA.spent}</span>
                </div>
                <div className="w-px h-8 bg-[#e2e8f0] hidden sm:block" />
                <div>
                  <span className="text-[11px] font-semibold text-[#8b94a3] block">Сэкономлено</span>
                  <span className="font-mono-data text-sm sm:text-base font-bold text-[#1f9d6b]">+{DASHBOARD_DATA.savings}</span>
                </div>
                <div className="w-px h-8 bg-[#e2e8f0] hidden sm:block" />
                <div>
                  <span className="text-[11px] font-semibold text-[#8b94a3] block">Заказов</span>
                  <span className="font-mono-data text-sm sm:text-base font-bold text-[#0e131a]">{DASHBOARD_DATA.ordersCount} шт</span>
                </div>
              </div>

              <button className="w-full sm:w-auto bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span>Пополнить баланс</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Side Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] flex flex-col justify-between space-y-4 min-w-0">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <h3 className="font-heading text-sm font-bold text-[#0e131a] flex items-center gap-2">
                <Award className="w-4 h-4 text-[#1f9bf0]" />
                Ваш статус: <span className="text-[#1f9bf0]">PRO Клиент</span>
              </h3>
              <span className="text-xs font-mono-data text-[#8b94a3]">Скидка 5%</span>
            </div>

            <div className="space-y-3">
              <div className="bg-[#e9edf2] p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-[#414a59]">Реферальный баланс:</span>
                <span className="font-mono-data font-bold text-[#0e131a]">{DASHBOARD_DATA.refBalance}</span>
              </div>
              <div className="bg-[#e9edf2] p-3 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-[#414a59]">Скорость обработки:</span>
                <span className="font-semibold text-[#1f9d6b] flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Приоритетный очередь
                </span>
              </div>
            </div>

            <div className="pt-2">
              <a href="#support" className="w-full text-center block text-xs font-bold text-[#1f9bf0] hover:underline">
                Связаться с личным менеджером (09–21 МСК) →
              </a>
            </div>
          </div>

        </div>

        {/* ORDER WIDGET SECTION */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e2e8f0] pb-4 gap-2">
            <div>
              <h2 className="font-heading text-lg sm:text-xl font-bold text-[#0e131a]">
                Быстрый заказ услуги
              </h2>
              <p className="text-xs text-[#8b94a3]">Выберите параметры и оформите заказ за 30 секунд</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#414a59] bg-[#e9edf2] px-3 py-1.5 rounded-lg w-max">
              <ShieldCheck className="w-4 h-4 text-[#1f9d6b]" />
              <span>Гарантия авто-докрутки</span>
            </div>
          </div>

          {/* STEP 1: Select Social Network */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
              Шаг 1. Выберите социальную сеть
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { id: 'tg', name: 'Telegram', icon: Send, color: 'text-[#1f9bf0]' },
                { id: 'ig', name: 'Instagram', icon: Instagram, color: 'text-pink-600' },
                { id: 'yt', name: 'YouTube', icon: Youtube, color: 'text-red-600' },
                { id: 'tt', name: 'TikTok', icon: Video, color: 'text-slate-900' },
                { id: 'vk', name: 'VK', icon: Share2, color: 'text-blue-600' },
                { id: 'rt', name: 'Rutube', icon: Zap, color: 'text-emerald-600' },
              ].map((net) => {
                const IconComp = net.icon;
                const isSelected = selectedNetwork === net.id;
                return (
                  <button
                    key={net.id}
                    onClick={() => setSelectedNetwork(net.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      isSelected 
                        ? 'border-[#1f9bf0] bg-[#e7f2fe] ring-2 ring-[#1f9bf0]/20' 
                        : 'border-[#e2e8f0] bg-white hover:border-[#d3dce8] hover:bg-[#e9edf2]/50'
                    }`}
                  >
                    <IconComp className={`w-5 h-5 ${net.color}`} />
                    <span className="text-xs font-bold text-[#0e131a]">{net.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Select Category */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
              Шаг 2. Выберите категорию
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'subs', name: 'Подписчики' },
                { id: 'views', name: 'Просмотры' },
                { id: 'likes', name: 'Лайки' },
                { id: 'react', name: 'Реакции' },
                { id: 'comments', name: 'Комментарии' },
                { id: 'stars', name: 'Звёзды / Бусты' },
              ].map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#0e131a] text-white shadow-sm'
                        : 'bg-[#e9edf2] text-[#414a59] hover:bg-[#d3dce8]'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Select Tariff */}
          <div className="space-y-4 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#8b94a3] block">
              Шаг 3. Выберите тарифный план
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DASHBOARD_DATA.tariffs.map((t) => {
                const isSelected = selectedTariff === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTariff(t.id)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                      isSelected 
                        ? 'border-[#1f9bf0] bg-white ring-2 ring-[#1f9bf0]/20 shadow-md' 
                        : 'border-[#e2e8f0] bg-white hover:border-[#d3dce8]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${t.badgeBg}`}>
                          {t.badge}
                        </span>
                        {t.popular && (
                          <span className="text-[10px] font-bold text-[#1f9bf0] bg-[#e7f2fe] px-2 py-0.5 rounded-md">
                            ХИТ ПОПУЛЯРНОСТИ
                          </span>
                        )}
                      </div>
                      <h4 className="font-heading text-base font-bold text-[#0e131a]">{t.name}</h4>
                      <p className="text-xs text-[#8b94a3]">Скорость: {t.speed}</p>
                    </div>

                    <div className="pt-2 border-t border-[#e2e8f0] flex items-baseline justify-between">
                      <span className="text-xs text-[#414a59]">Цена за 1 шт:</span>
                      <span className="font-mono-data text-lg font-extrabold text-[#0e131a]">{t.price}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inputs & Summary Row */}
            <div className="bg-[#e9edf2]/60 p-4 sm:p-6 rounded-2xl border border-[#e2e8f0] grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-6 space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-[#414a59] block">Ссылка на объект (канал / пост / профиль)</label>
                <input
                  type="url"
                  placeholder="https://t.me/my_channel"
                  value={targetLink}
                  onChange={(e) => setTargetLink(e.target.value)}
                  className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs text-[#0e131a] focus:outline-none focus:border-[#1f9bf0] font-mono-data truncate"
                />
              </div>

              <div className="md:col-span-3 space-y-1.5 min-w-0">
                <label className="text-xs font-bold text-[#414a59] block">Количество (мин. 10)</label>
                <input
                  type="number"
                  min="10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2.5 text-xs text-[#0e131a] focus:outline-none focus:border-[#1f9bf0] font-mono-data"
                />
              </div>

              <div className="md:col-span-3 min-w-0">
                <button className="w-full bg-[#1f9bf0] hover:bg-[#0b7fd4] text-white py-3 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2">
                  <span>Оплатить заказ (30.00 ₽)</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RECENT ORDERS TABLE SECTION */}
        <section className="bg-white rounded-2xl p-6 sm:p-8 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-[#0e131a]">Последние заказы</h2>
              <p className="text-xs text-[#8b94a3]">Выписка по вашим операциям в реальном времени</p>
            </div>
            <a href="#all-orders" className="text-xs font-bold text-[#1f9bf0] hover:underline">
              Все 312 заказов →
            </a>
          </div>

          {/* TABLE view for Plan */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-[11px] font-bold text-[#8b94a3] uppercase tracking-wider">
                  <th className="py-3 px-4">ID заказа</th>
                  <th className="py-3 px-4">Услуга</th>
                  <th className="py-3 px-4">Ссылка</th>
                  <th className="py-3 px-4">Статус</th>
                  <th className="py-3 px-4 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] text-xs">
                {DASHBOARD_DATA.recentOrders.map((ord) => {
                  return (
                    <tr key={ord.id} className="hover:bg-[#e9edf2]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono-data font-bold text-[#0e131a]">
                        {ord.id}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#0e131a]">
                        <div className="flex items-center gap-2">
                          <ord.icon className="w-4 h-4 shrink-0" style={{ color: ord.color }} />
                          <span className="truncate max-w-[200px]">{ord.service}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono-data text-[#8b94a3] max-w-[180px]">
                        <div className="truncate" title={ord.link}>{ord.link}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                          ord.status === 'COMPLETED'
                            ? 'bg-[#e6f7f0] text-[#1f9d6b] border-[#1f9d6b]/20'
                            : ord.status === 'IN_PROGRESS'
                            ? 'bg-[#e7f2fe] text-[#1f9bf0] border-[#1f9bf0]/20'
                            : 'bg-[#fdeeee] text-[#d6453d] border-[#d6453d]/20'
                        }`}>
                          {ord.statusText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-data font-extrabold text-[#0e131a]">
                        {ord.amount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* BOTTOM ROW: REFERRALS & SUPPORT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-[#0e131a]">Реферальная программа</h3>
              <span className="text-xs font-mono-data font-bold text-[#1f9d6b] bg-[#e6f7f0] px-2.5 py-1 rounded-full">
                10% начисления
              </span>
            </div>
            <p className="text-xs text-[#414a59]">
              Приглашайте коллег и получайте процент от каждого пополнения баланса.
            </p>
            <div className="bg-[#e9edf2] p-3 rounded-xl flex items-center justify-between gap-2 min-w-0">
              <span className="font-mono-data text-xs font-bold text-[#0e131a] truncate">
                https://smmplan.ru/ref/{DASHBOARD_DATA.refCode}
              </span>
              <button
                onClick={handleCopyRef}
                className="bg-[#1f9bf0] text-white p-2 rounded-lg text-xs font-bold shrink-0 hover:bg-[#0b7fd4]"
              >
                {isCopied ? 'Скопировано' : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_16px_40px_rgba(23,43,77,0.07)] space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-[#0e131a]">Служба поддержки</h3>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1f9d6b]">
                <span className="w-2 h-2 rounded-full bg-[#1f9d6b] animate-ping" />
                Онлайн 09–21 МСК
              </span>
            </div>
            <p className="text-xs text-[#414a59]">
              Есть вопросы по заказу? Отвечаем в течение 5 минут в Telegram и тикетах.
            </p>
            <button className="w-full bg-[#0e131a] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              <span>Написать оператору в Telegram</span>
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

/* ==========================================================================
   SMMFLUX DASHBOARD COMPONENT (Aurora Consumer App)
   ========================================================================== */
export function SmmFluxDashboard({ isPreviewMode = false }: { isPreviewMode?: boolean }) {
  const [selectedNetwork, setSelectedNetwork] = useState('tg');
  const [selectedCategory, setSelectedCategory] = useState('subs');
  const [selectedTariff, setSelectedTariff] = useState('std');

  return (
    <div className="smmflux-scope w-full min-h-screen bg-white text-[#100d18] flex flex-col md:flex-row pb-20 md:pb-0">
      
      {/* ── 1. LEFT SIDEBAR NAVIGATION ── */}
      <aside className="hidden md:flex flex-col justify-between w-64 border-r border-[#ece9f5] p-6 shrink-0 bg-[#ffffff]">
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#3b82f6] via-[#7c3aed] to-[#e0218a] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#7c3aed]/30">
              F
            </div>
            <div>
              <span className="font-heading text-2xl font-extrabold text-[#100d18] tracking-tight block leading-none">
                SMMflux
              </span>
              <span className="text-[10px] font-bold text-[#e0218a] uppercase tracking-wider">
                Aurora App
              </span>
            </div>
          </div>

          <nav className="space-y-2">
            <a href="#flux-home" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#14121d] text-white font-bold text-sm shadow-md shadow-black/10">
              <div className="w-7 h-7 rounded-xl bg-[#e0218a] flex items-center justify-center text-white text-xs">
                ⚡
              </div>
              <span>Дашборд</span>
            </a>
            <a href="#flux-orders" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#423f54] hover:bg-[#f6f5fb] font-semibold text-sm transition-all">
              <div className="w-7 h-7 rounded-xl bg-[#ece9f5] flex items-center justify-center text-[#7c3aed] text-xs">
                📦
              </div>
              <span>Заказы</span>
            </a>
            <a href="#flux-wallet" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#423f54] hover:bg-[#f6f5fb] font-semibold text-sm transition-all">
              <div className="w-7 h-7 rounded-xl bg-[#ece9f5] flex items-center justify-center text-[#06b6a4] text-xs">
                💎
              </div>
              <span>Баланс</span>
            </a>
            <a href="#flux-refs" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#423f54] hover:bg-[#f6f5fb] font-semibold text-sm transition-all">
              <div className="w-7 h-7 rounded-xl bg-[#ece9f5] flex items-center justify-center text-[#e0218a] text-xs">
                🎁
              </div>
              <span>Рефералы</span>
            </a>
            <a href="#flux-help" className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[#423f54] hover:bg-[#f6f5fb] font-semibold text-sm transition-all">
              <div className="w-7 h-7 rounded-xl bg-[#ece9f5] flex items-center justify-center text-[#7c3aed] text-xs">
                💬
              </div>
              <span>Поддержка</span>
            </a>
          </nav>
        </div>

        <div className="bg-[#f6f5fb] p-4 rounded-2xl border border-[#ece9f5] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#423f54]">Клиент:</span>
            <span className="font-mono text-[#79748c]">ART-7F2K</span>
          </div>
          <div className="text-xs font-bold text-[#100d18] truncate">
            client@smmflux.ru
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#14121d]/95 backdrop-blur-lg border-t border-white/10 px-4 py-2 flex items-center justify-around text-white">
        <a href="#flux-home" className="flex flex-col items-center gap-1 text-[#e0218a]">
          <span className="text-lg">⚡</span>
          <span className="text-[10px] font-bold">Главная</span>
        </a>
        <a href="#flux-orders" className="flex flex-col items-center gap-1 text-white/70">
          <span className="text-lg">📦</span>
          <span className="text-[10px] font-bold">Заказы</span>
        </a>
        <a href="#flux-wallet" className="flex flex-col items-center gap-1 text-white/70">
          <span className="text-lg">💎</span>
          <span className="text-[10px] font-bold">Баланс</span>
        </a>
        <a href="#flux-refs" className="flex flex-col items-center gap-1 text-white/70">
          <span className="text-lg">🎁</span>
          <span className="text-[10px] font-bold">Бонусы</span>
        </a>
        <a href="#flux-help" className="flex flex-col items-center gap-1 text-white/70">
          <span className="text-lg">💬</span>
          <span className="text-[10px] font-bold">Чат</span>
        </a>
      </div>

      {/* ── 2. MAIN APP CONTENT AREA ── */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-x-hidden min-w-0">
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden flex items-center justify-between border-b border-[#ece9f5] pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#3b82f6] to-[#e0218a] flex items-center justify-center text-white font-bold text-sm">
              F
            </div>
            <span className="font-heading text-lg font-extrabold">SMMflux</span>
          </div>
          <span className="bg-[#14121d] text-white px-3 py-1 rounded-full text-xs font-bold">
            {DASHBOARD_DATA.balance}
          </span>
        </div>

        {/* GREETING HEADER WITH BLACK ROTATED MARKER HIGHLIGHT */}
        <div className="space-y-2">
          <h1 className="font-heading text-2xl sm:text-4xl lg:text-5xl font-extrabold text-[#100d18] tracking-tight leading-tight">
            Что хотите <span className="marker-highlight">продвигать</span> сегодня?
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-[#79748c]">
            Заряжаем социальные сети максимальной активностью за считанные минуты
          </p>
        </div>

        {/* AURORA BALANCE HERO CARD */}
        <div className="relative rounded-3xl p-6 sm:p-8 text-white overflow-hidden shadow-[0_20px_46px_rgba(124,58,237,0.30)] min-w-0"
             style={{ background: 'radial-gradient(120% 130% at 12% 0%, #3b82f6 0%, #7c3aed 38%, #d6249f 66%, #f59e6b 100%)' }}>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl aurora-blob-1 pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-pink-500/30 rounded-full blur-2xl aurora-blob-2 pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-widest bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white">
                Баланс аккаунта
              </span>
              <span className="text-xs font-bold text-white/90 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-300" /> PRO План
              </span>
            </div>

            <div className="space-y-1">
              <div className="font-heading text-4xl sm:text-6xl font-black tracking-tight">
                {DASHBOARD_DATA.balance}
              </div>
              <p className="text-xs text-white/80 font-medium">Сберегли {DASHBOARD_DATA.savings} благодаря персональному тарифу</p>
            </div>

            <div className="pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="bg-black/20 backdrop-blur-md px-3.5 py-2 rounded-2xl">
                  <span className="text-white/70 block text-[10px]">Потрачено</span>
                  <span className="font-bold text-white text-sm">{DASHBOARD_DATA.spent}</span>
                </div>
                <div className="bg-black/20 backdrop-blur-md px-3.5 py-2 rounded-2xl">
                  <span className="text-white/70 block text-[10px]">Выполнено заказов</span>
                  <span className="font-bold text-white text-sm">{DASHBOARD_DATA.ordersCount}</span>
                </div>
              </div>

              <button className="bg-[#14121d] hover:bg-black text-white px-6 py-3 rounded-full font-extrabold text-xs transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2">
                <span>Мгновенное пополнение</span>
                <ArrowUpRight className="w-4 h-4 text-[#e0218a]" />
              </button>
            </div>
          </div>
        </div>

        {/* NEON ORDER WIDGET */}
        <section className="bg-[#f6f5fb] rounded-3xl p-6 sm:p-8 border border-[#ece9f5] space-y-6 shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-[#100d18]">
                Быстрый переход к запуску
              </h2>
              <p className="text-xs text-[#79748c]">Вставьте ссылку или выберите услугу в один клик</p>
            </div>
          </div>

          {/* Neon Link Input with Round Black Button */}
          <div className="relative flex items-center min-w-0">
            <input
              type="url"
              placeholder="Вставьте ссылку на пост / канал (например: t.me/channel)..."
              className="w-full bg-white border-2 border-[#e0218a]/40 focus:border-[#e0218a] rounded-full px-6 py-4 pr-16 text-xs sm:text-sm font-semibold text-[#100d18] placeholder-[#79748c] outline-none shadow-lg shadow-[#e0218a]/5 transition-all truncate"
            />
            <button className="absolute right-2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#14121d] text-white flex items-center justify-center hover:bg-[#e0218a] transition-all shadow-md active:scale-90 shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* Social Chips */}
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#79748c] block">
              Социальная сеть:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
              {[
                { id: 'tg', label: 'Telegram', icon: '✈️' },
                { id: 'ig', label: 'Instagram', icon: '📸' },
                { id: 'yt', label: 'YouTube', icon: '▶️' },
                { id: 'tt', label: 'TikTok', icon: '🎵' },
                { id: 'vk', label: 'VKontakte', icon: '🟦' },
              ].map((chip) => {
                const isSelected = selectedNetwork === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setSelectedNetwork(chip.id)}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 shrink-0 transition-all ${
                      isSelected
                        ? 'bg-[#14121d] text-white shadow-lg shadow-black/20 scale-105'
                        : 'bg-white text-[#423f54] hover:bg-white/80 border border-[#ece9f5]'
                    }`}
                  >
                    <span>{chip.icon}</span>
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horizontal Sliding Tariffs */}
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#79748c] block">
              Выберите скорость и качество:
            </span>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-3">
              {DASHBOARD_DATA.tariffs.map((t) => {
                const isSelected = selectedTariff === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTariff(t.id)}
                    className={`w-64 sm:w-72 shrink-0 p-5 rounded-3xl bg-white border-2 cursor-pointer transition-all flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'border-[#e0218a] shadow-xl shadow-[#e0218a]/10 scale-[1.02]'
                        : 'border-[#ece9f5] hover:border-[#7c3aed]/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#f6f5fb] text-[#7c3aed]">
                          {t.badge}
                        </span>
                        <span className="text-xs text-[#06b6a4] font-bold">Мин. 10 шт</span>
                      </div>
                      <h4 className="font-heading text-lg font-extrabold text-[#100d18]">{t.name}</h4>
                      <p className="text-xs text-[#79748c]">Запуск: {t.speed}</p>
                    </div>

                    <div className="pt-3 border-t border-[#ece9f5] flex items-center justify-between">
                      <span className="font-heading text-xl font-extrabold text-[#e0218a]">{t.price}</span>
                      <button className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isSelected ? 'bg-[#e0218a] text-white' : 'bg-[#f6f5fb] text-[#100d18]'
                      }`}>
                        ✓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* RECENT ORDERS STRIP CARDS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-extrabold text-[#100d18]">Последняя активность</h2>
            <a href="#flux-all" className="text-xs font-bold text-[#e0218a] hover:underline">
              Смотреть историю →
            </a>
          </div>

          <div className="space-y-3">
            {DASHBOARD_DATA.recentOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-[#ece9f5] shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#f6f5fb] flex items-center justify-center shrink-0 text-lg">
                    {ord.network === 'Telegram' ? '✈️' : ord.network === 'Instagram' ? '📸' : '▶️'}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-bold text-[#100d18] truncate">
                        {ord.service}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#79748c]">{ord.id}</span>
                    </div>
                    <p className="text-xs text-[#79748c] truncate">{ord.link}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#ece9f5]">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    ord.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : ord.status === 'IN_PROGRESS'
                      ? 'bg-sky-500/10 text-sky-600'
                      : 'bg-rose-500/10 text-rose-600'
                  }`}>
                    {ord.statusText}
                  </span>
                  <span className="font-heading text-base font-extrabold text-[#100d18]">
                    {ord.amount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTTOM CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-[#14121d] to-[#252136] text-white p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#e0218a]">
                Партнёрская сеть
              </span>
              <span className="text-xs font-bold bg-white/10 px-2.5 py-1 rounded-full">
                +10% вам
              </span>
            </div>
            <h3 className="font-heading text-xl font-bold">Делитесь Flux с друзьями</h3>
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl flex items-center justify-between text-xs">
              <span className="font-mono font-bold truncate">ART-7F2K</span>
              <button className="bg-[#e0218a] text-white px-3 py-1.5 rounded-xl font-bold hover:bg-pink-600">
                Копировать
              </button>
            </div>
          </div>

          <div className="bg-[#f6f5fb] p-6 rounded-3xl border border-[#ece9f5] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-[#100d18]">Поддержка 24/7</h3>
              <span className="text-xs font-bold text-[#06b6a4]">Ответ за 3 мин</span>
            </div>
            <p className="text-xs text-[#79748c]">
              Наша команда онлайн каждый день с 09:00 до 21:00 МСК. Решаем любые вопросы мгновенно.
            </p>
            <button className="w-full bg-[#14121d] text-white py-3 rounded-2xl text-xs font-bold hover:bg-black transition-colors">
              Открыть чат с поддержкой
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}

```

---

### 📄 Файл 18 из 49: `src/app/dashboard/add-funds/client-page.tsx`

```tsx
'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { createTopUpPaymentAction } from '@/actions/user/top-up.action';
import { activatePromoCodeAction } from '@/actions/user/promo';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CreditCard, Banknote, Wallet, Gift, CheckCircle2, CheckSquare, Square } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const PRESETS = [10, 50, 100, 300, 500, 1000];

const METHODS = [
  { id: 'yookassa', label: 'Банковская карта', icon: CreditCard, note: 'Visa / MC / МИР / СБП (ЮKassa)' },
  { id: 'robokassa', label: 'Робокасса', icon: CreditCard, note: 'Карты РФ/СНГ, СБП, Электронные деньги' },
  { id: 'cryptobot',  label: 'Криптовалюта (CryptoBot)', icon: Wallet, note: 'USDT, TON, BTC, ETH' },
] as const;

export default function AddFundsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get('success') === '1';
  const [amount, setAmount]     = useState<number>(50);
  const [method, setMethod]     = useState<'yookassa' | 'cryptobot' | 'robokassa'>('yookassa');
  const [error,  setError]      = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Автофокус при загрузке страницы работает только на десктопных экранах (>= 1024px)
    // чтобы избежать автоматического вызова экранной клавиатуры на телефонах,
    // которая перекрывает методы оплаты, и нежелательного масштабирования (зума) в iOS Safari
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      inputRef.current?.focus();
    }
  }, []);

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [isPromoPending, startPromoTransition] = useTransition();

  function handlePreset(val: number) {
    setAmount(val);
    setError(null);
  }

  function handleSubmit() {
    if (amount < 10) {
      setError('Минимальная сумма — 10 ₽');
      return;
    }
    if (isPending) return; // F5: double-submit guard
    setError(null);
    startTransition(async () => {
      try {
        const res = await createTopUpPaymentAction(amount, method);
        window.location.href = res.paymentUrl;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      }
    });
  }

  function handlePromoSubmit() {
    if (!promoCode.trim()) {
      setPromoError('Введите промокод');
      return;
    }
    setPromoError(null);
    setPromoSuccess(null);
    startPromoTransition(async () => {
      try {
        const res = await activatePromoCodeAction(promoCode);
        if (!res) throw new Error('Неизвестная ошибка при активации');
        setPromoSuccess(`Промокод активирован! Начислено ${(res.amount / 100).toFixed(2)} ₽`);
        setPromoCode('');
        router.refresh(); // Refresh balance in header
      } catch (e: unknown) {
        setPromoError(e instanceof Error ? e.message : 'Ошибка активации');
      }
    });
  }

  return (
    <div className="max-w-lg space-y-6 animate-in fade-in duration-500">
      {isSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm">Баланс успешно пополнен!</h3>
            <p className="text-xs opacity-90 mt-0.5">Средства мгновенно зачислены на ваш счёт. Спасибо за доверие!</p>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Пополнение баланса</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Средства поступают мгновенно после подтверждения платежа
        </p>
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-5 shadow-sm">

        {/* Amount presets */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Сумма пополнения (₽)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {PRESETS.map(val => (
              <button
                key={val}
                type="button"
                onClick={() => handlePreset(val)}
                className={`relative min-h-[44px] md:min-h-[36px] rounded-xl text-sm font-semibold border transition-all duration-200
                  flex items-center justify-center
                  focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
                  amount === val
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted'
                }`}
                aria-label={`Пополнить на ${val} рублей`}
                aria-pressed={amount === val}
              >
                {val === 1000 && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                    Популярный
                  </span>
                )}
                {val.toLocaleString('ru-RU')} ₽
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              id="top-up-amount"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              min={10}
              max={500000}
              placeholder="Другая сумма"
              aria-label="Введите сумму пополнения"
              className="w-full border border-border rounded-xl px-4 py-3 text-lg font-mono text-foreground bg-background outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
              ₽
            </span>
          </div>
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">
            Способ оплаты
          </label>
          <div className="space-y-2">
            {METHODS.map(({ id, label, icon: Icon, note }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate(20);
                  setMethod(id);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 min-h-[72px] rounded-xl border text-left transition-all duration-200 ${
                  method === id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted'
                } focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none`}
                aria-pressed={method === id}
                aria-label={`Оплатить через ${label}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${method === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 min-h-[38px] flex flex-col justify-center py-0.5">
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground leading-snug">{note}</div>
                </div>
                <div className={`ml-auto w-4 h-4 rounded-full border-2 shrink-0 ${method === id ? 'border-primary bg-primary' : 'border-border'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5" role="alert">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || amount < 10}
          aria-label={`Перейти к оплате ${amount} рублей`}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50
            font-semibold min-h-[44px] md:min-h-[36px] py-3.5 rounded-xl transition-all duration-200 shadow-sm text-base
            focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          {isPending
            ? '⟳ Создаём платёж...'
            : `Оплатить ${amount.toLocaleString('ru-RU')} ₽`}
        </button>

        {/* Legal notice instead of checkbox for seamless UX */}
        <p className="text-[10px] leading-relaxed text-muted-foreground text-center px-2">
          Нажимая «Оплатить», вы принимаете{' '}
          <Link
            href="/legal/terms"
            target="_blank"
            className="text-primary hover:underline font-semibold"
          >
            Договор оферты
          </Link>{' '}
          и{' '}
          <Link
            href="/legal/refund"
            target="_blank"
            className="text-primary hover:underline font-semibold"
          >
            Политику возврата (Refund Policy)
          </Link>.
        </p>

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Wallet className="w-3 h-3" />
          Минимум 10 ₽ · Безопасная оплата через {method === 'yookassa' ? 'ЮKassa' : method === 'robokassa' ? 'Робокассу' : 'CryptoBot'} · Мгновенное зачисление
        </p>
      </div>

      {/* Promo Code Section */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Подарочный код</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Активируйте купон для получения бонуса на баланс</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={e => setPromoCode(e.target.value.toUpperCase())}
            placeholder="PROMOCODE"
            className="w-full sm:flex-1 border border-border rounded-xl px-4 py-3 text-sm font-mono uppercase text-foreground bg-background outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
          />
          <button
            onClick={handlePromoSubmit}
            disabled={isPromoPending || !promoCode.trim()}
            className="w-full sm:w-auto px-6 py-3 min-h-[44px] md:min-h-[36px] bg-foreground text-background hover:opacity-90 disabled:opacity-50 font-bold rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none shrink-0"
          >
            {isPromoPending ? '...' : 'Применить'}
          </button>
        </div>

        {promoError && (
          <p className="text-xs text-rose-600 font-semibold">{promoError}</p>
        )}
        {promoSuccess && (
          <p className="text-xs text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            {promoSuccess}
          </p>
        )}
      </div>
    </div>
  );
}

```

---

### 📄 Файл 19 из 49: `src/app/dashboard/add-funds/loading.tsx`

```tsx
export default function AddFundsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-2xl" />
    </div>
  );
}

```

---

### 📄 Файл 20 из 49: `src/app/dashboard/add-funds/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import ClientPage from "./client-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Пополнение баланса | SMMplan",
  description: "Пополните баланс личного кабинета SMMplan для быстрой оплаты заказов и услуг продвижения.",
};

export default function Page() {
  return (
    <Suspense fallback={
      <div className="max-w-lg animate-pulse text-muted-foreground">Загрузка...</div>
    }>
      <ClientPage />
    </Suspense>
  );
}

```

---

### 📄 Файл 21 из 49: `src/app/dashboard/error.tsx`

```tsx
'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Что-то пошло не так
        </h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Не удалось загрузить личный кабинет. Попробуйте обновить страницу.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90"
      >
        Обновить
      </button>
    </div>
  );
}

```

---

### 📄 Файл 22 из 49: `src/app/dashboard/loading.tsx`

```tsx
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-2xl" />
        ))}
      </div>
      {/* Quick actions */}
      <div className="h-24 bg-muted rounded-2xl" />
      {/* Recent orders */}
      <div className="bg-muted rounded-2xl h-48" />
    </div>
  );
}

```

---

### 📄 Файл 23 из 49: `src/app/dashboard/new-order/client-page.tsx`

```tsx
'use client';

import { SmmplanOrderWizard } from '@/components/orders/SmmplanOrderWizard';

export default function NewOrderPage({ 
  userEmail, 
  userBalanceCents = 0,
  initialReorderData
}: { 
  userEmail?: string; 
  userBalanceCents?: number;
  initialReorderData?: { serviceId: string; categoryId: string; link: string; quantity: number } | null;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <SmmplanOrderWizard 
        userBalanceCents={userBalanceCents} 
        userEmail={userEmail} 
        initialReorderData={initialReorderData} 
      />
    </div>
  );
}

```

---

### 📄 Файл 24 из 49: `src/app/dashboard/orders/loading.tsx`

```tsx
export default function OrdersLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-40 bg-muted rounded-xl" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 border-b border-border last:border-0 bg-muted/30 mx-4 my-2 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

```

---

### 📄 Файл 25 из 49: `src/app/dashboard/orders/[id]/page.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Clock, LayoutDashboard, Receipt } from 'lucide-react';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { RetryPaymentModal } from '@/components/orders/RetryPaymentModal';
import { OrderProgressBar } from '@/components/orders/OrderProgressBar';
import { PaymentAutoSync } from '@/components/orders/PaymentAutoSync';
import { RepeatOrderButton } from '@/components/orders/RepeatOrderButton';
import { RefillRequestButton } from '@/components/orders/RefillRequestButton';
import { DripFeedProgress } from '@/components/orders/DripFeedProgress';
import { ChargeBreakdownModal } from '@/components/orders/ChargeBreakdownModal';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  COMPLETED:       'Выполнен',
  IN_PROGRESS:     'В работе',
  PENDING:         'Ожидание',
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
  AWAITING_PAYMENT:'text-orange-800 dark:text-orange-500  bg-orange-500/10  border-orange-500/20',
  PROVISIONING:    'text-indigo-800 dark:text-indigo-500  bg-indigo-500/10  border-indigo-500/20',
  ERROR:           'text-red-800 dark:text-destructive     bg-destructive/10     border-red-500/20',
  PARTIAL:         'text-amber-800 dark:text-warning         bg-warning/10         border-amber-500/20',
  CANCELED:        'text-muted-foreground bg-muted border-border',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const { id } = await params;

  // CRITICAL SECURITY: IDOR Protection via userId check
  const order = await db.order.findFirst({
    where: { 
      id: id,
      userId: session.userId 
    },
    include: {
      user: { select: { balance: true } },
      service: {
        include: { category: true }
      },
      payment: true,
      refills: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    }
  });

  if (!order) {
    redirect('/dashboard/orders');
  }

  const color = STATUS_COLOR[order.status] || STATUS_COLOR.CANCELED;
  const label = STATUS_LABEL[order.status] || order.status;

  const needsSync = order.status === 'AWAITING_PAYMENT' && order.payment?.gateway === 'yookassa' && order.payment?.status === 'PENDING';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      {needsSync && <PaymentAutoSync />}
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard/orders"
          className="w-11 h-11 flex items-center justify-center rounded-xl bg-card border border-border hover:bg-muted transition-all duration-200"
          aria-label="Назад к заказам"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Заказ #{order.numericId}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3.5 h-3.5" /> 
            {new Date(order.createdAt).toLocaleString('ru-RU', { 
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            })}
          </p>
        </div>
      </div>

      {/* Main Details Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Top Status Bar */}
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${color}`}>
              {label}
            </span>
            <RefillRequestButton
              orderId={order.id}
              isRefillEnabled={order.service.isRefillEnabled}
              orderStatus={order.status}
              refills={order.refills}
            />
            {order.remains > 0 && order.status === 'IN_PROGRESS' && (
              <span className="text-sm font-semibold text-muted-foreground">
                Осталось: {order.remains.toLocaleString('ru-RU')}
              </span>
            )}
            {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) && (
               <CancelOrderButton orderId={order.id} createdAt={order.createdAt} status={order.status} />
            )}
            {order.status === 'AWAITING_PAYMENT' && (
              <RetryPaymentModal 
                orderId={order.id} 
                charge={Number(order.charge)} 
                balance={Number(order.user.balance)} 
              />
            )}
            {!['PENDING', 'AWAITING_PAYMENT'].includes(order.status) && (
               <RepeatOrderButton 
                 serviceId={order.service.id} 
                 categoryId={order.service.categoryId} 
                 link={order.link} 
                 quantity={order.quantity} 
               />
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Сумма</div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-xl font-black text-foreground font-mono tabular-nums">
                {(Number(order.charge) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
              </span>
              <ChargeBreakdownModal
                numericId={order.numericId}
                chargeCents={order.charge}
                discountCents={order.discountCents}
                usdToRubRate={order.usdToRubRate}
              />
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <OrderProgressBar 
          status={order.status} 
          quantity={order.quantity} 
          remains={order.remains} 
        />

        {/* Info Grid */}
        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Услуга
            </label>
            <div className="text-base font-semibold text-foreground">
              {order.service.name}
            </div>
            <div className="text-sm font-medium text-muted-foreground/80 mt-1 flex items-center gap-1">
               <LayoutDashboard className="w-3.5 h-3.5" /> {order.service.category?.name || 'Без категории'}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Целевая ссылка
            </label>
            <a 
              href={order.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline break-all"
            >
              {order.link}
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Заказано
              </label>
              <div className="text-lg font-black text-foreground font-mono tabular-nums">
                {order.quantity.toLocaleString('ru-RU')}
              </div>
            </div>
            {order.customData && (
              <div className="bg-muted/50 rounded-xl p-4 border border-border/50 col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Дополнительные данные (Комментарии/Формат)
                </label>
                <div className="text-sm font-medium text-foreground whitespace-pre-wrap font-mono bg-background border border-border p-3 rounded-md">
                  {order.customData}
                </div>
              </div>
            )}
          </div>
          
          {order.status === 'ERROR' && order.error && (
            <div className="mt-4 bg-destructive/10 border border-rose-500/20 text-destructive p-4 rounded-xl">
              <label className="text-xs font-bold uppercase tracking-wider block mb-1">
                Системная ошибка
              </label>
               <p className="text-sm font-semibold">{order.error}</p>
            </div>
          )}

          {(order.isDripFeed || (order.runs && order.runs > 1)) && (
            <div className="mt-4">
              <DripFeedProgress
                isDripFeed={order.isDripFeed}
                runs={order.runs}
                interval={order.interval}
                currentRun={order.currentRun}
                nextRunAt={order.nextRunAt}
                showNextRunCountdown={true}
              />
            </div>
          )}

          {/* Financial Breakdown Card */}
          <div className="bg-muted/40 rounded-2xl p-5 border border-border/60 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-primary" /> Финансовая детализация
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-background rounded-xl p-3 border border-border/40">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Оплачено</div>
                <div className="text-base font-black text-foreground font-mono tabular-nums mt-0.5">
                  {(Number(order.charge) / 100).toFixed(2)} ₽
                </div>
              </div>
              {Number(order.discountCents || 0) > 0 && (
                <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Скидка</div>
                  <div className="text-base font-black text-emerald-800 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                    - {(Number(order.discountCents) / 100).toFixed(2)} ₽
                  </div>
                </div>
              )}
              <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Курс ЦБ РФ при оплате</div>
                <div className="text-base font-bold text-foreground font-mono tabular-nums mt-0.5">
                  {order.usdToRubRate ? `${order.usdToRubRate.toFixed(2)} ₽ / $` : '90.00 ₽ / $'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


```

---

### 📄 Файл 26 из 49: `src/app/dashboard/referrals/page.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { getBaseUrlAsync } from '@/utils/get-base-url';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ReferralUi } from './referral-ui';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Реферальная программа | SMMplan',
};

export default async function ReferralsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  let user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      referralCode: true,
      referralBalance: true,
      _count: { select: { referrals: true } },
    },
  });

  if (!user) redirect('/login');

  // Auto-generate referral code if missing
  if (!user.referralCode) {
    const newCode = Array.from(
      Array(8),
      () => Math.floor(Math.random() * 36).toString(36)
    ).join('').toUpperCase();

    user = await db.user.update({
      where: { id: user.id },
      data: { referralCode: newCode },
      select: {
        id: true,
        referralCode: true,
        referralBalance: true,
        _count: { select: { referrals: true } },
      },
    });
  }

  // Build referral link server-side using request headers (no hydration mismatch)
  const origin = await getBaseUrlAsync();
  const referralLink = `${origin}/?ref=${user.referralCode}`;

  const earnedRub = (user.referralBalance ?? 0) / 100;
  const referralsCount = user._count?.referrals ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Реферальная программа</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Приглашайте друзей и получайте до 15% с каждого их заказа
        </p>
      </div>

      <ReferralUi
        referralLink={referralLink}
        referralsCount={referralsCount}
        earnedRub={earnedRub}
      />
    </div>
  );
}

```

---

### 📄 Файл 27 из 49: `src/app/dashboard/referrals/referral-ui.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Copy, Gift, Users, CreditCard, CheckCheck, AlertTriangle } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { generateApiKey, revokeApiKey } from '@/actions/auth/api-key';
import { transferReferralBalanceAction } from '@/actions/user/referral.action';
import { useRouter } from 'next/navigation';

export function ReferralUi({
  referralLink,
  referralsCount,
  earnedRub,
}: {
  referralLink: string;
  referralsCount: number;
  earnedRub: number;
}) {
  const [copied, setCopied] = useState(false);
  const [isTransferring, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleTransfer = () => {
    if (earnedRub <= 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await transferReferralBalanceAction();
        router.refresh();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setError(e.message || 'Ошибка перевода');
      }
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Users,
            label: 'Приглашено',
            value: referralsCount,
            suffix: 'чел.',
            color: 'text-primary bg-primary/10',
          },
          {
            icon: CreditCard,
            label: 'Заработано',
            value: earnedRub.toFixed(0),
            suffix: '₽',
            color: 'text-success bg-success/10',
          },
          {
            icon: Gift,
            label: 'Ваш бонус',
            value: '15',
            suffix: '%',
            color: 'text-warning bg-warning/10',
          },
        ].map(({ icon: Icon, label, value, suffix, color }) => (
          <div
            key={label}
            className="bg-card border border-border/60 rounded-2xl p-6 flex items-center gap-4 shadow-sm"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </div>
              <div className="text-2xl font-black text-foreground tabular-nums">
                {value}
                <span className="text-base font-semibold text-muted-foreground ml-1">
                  {suffix}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Transfer Action */}
      {earnedRub > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-foreground">Перевод на баланс</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Моментальный перевод доступного бонуса ({earnedRub.toFixed(2)} ₽) на основной счет
            </div>
            {error && <div className="text-xs text-destructive mt-1">{error}</div>}
          </div>
          <button
            onClick={handleTransfer}
            disabled={isTransferring || earnedRub <= 0}
            className="shrink-0 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {isTransferring ? 'Перевод...' : 'Перевести на баланс'}
          </button>
        </div>
      )}

      {/* Referral link */}
      <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 space-y-3">
        <div>
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
            Ваша реферальная ссылка
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 bg-muted rounded-xl px-4 py-3 text-sm font-mono text-foreground truncate border border-border">
              {referralLink}
            </div>
            <button
              type="button"
              onClick={copyToClipboard}
              aria-label="Скопировать реферальную ссылку"
              className={`shrink-0 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              }`}
            >
              {copied ? (
                <>
                  <CheckCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Скопировано</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">Копировать</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-6 space-y-4">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Как это работает
        </div>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Поделитесь реферальной ссылкой с друзьями и коллегами' },
            { step: '2', text: 'Друг регистрируется и делает первый заказ на платформе' },
            { step: '3', text: 'Вы получаете 15% от суммы каждого его заказа навсегда' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {step}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 28 из 49: `src/app/dashboard/settings/api/ApiKeyManager.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { generateApiKey, revokeApiKey } from '@/actions/auth/api-key';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Copy, RefreshCw, Trash2, CheckCheck, ShieldAlert } from 'lucide-react';

export default function ApiKeyManager({ 
  hasKey, 
  onKeyGenerated 
}: { 
  hasKey: boolean; 
  onKeyGenerated?: (key: string | null) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const handleGenerate = () => {
    setError('');
    setNewKey(null);
    if (onKeyGenerated) onKeyGenerated(null);
    startTransition(async () => {
      const res = await generateApiKey();
      if (!res.success) {
        setError(res.error || 'Ошибка при генерации ключа');
      } else {
        setNewKey(res.apiKey || null);
        if (onKeyGenerated && res.apiKey) {
          onKeyGenerated(res.apiKey);
        }
      }
    });
  };

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      setTimeout(() => setConfirmRevoke(false), 5000);
      return;
    }
    setConfirmRevoke(false);
    setError('');
    if (onKeyGenerated) onKeyGenerated(null);
    startTransition(async () => {
      const res = await revokeApiKey();
      if (!res.success) {
        setError(res.error || 'Ошибка при отзыве ключа');
      } else {
        setNewKey(null);
      }
    });
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="space-y-5">
      {hasKey || newKey ? (
        <div className="space-y-4">
          {/* Key display */}
          {newKey ? (
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCheck className="w-5 h-5" />
                <span className="font-semibold text-sm">Новый API-ключ сгенерирован</span>
              </div>
              <p className="text-xs text-emerald-700/80">
                Скопируйте ключ прямо сейчас. В целях безопасности он больше никогда не будет показан.
              </p>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 bg-card border border-emerald-200 rounded-lg px-4 py-2.5 font-mono text-sm text-foreground truncate select-all">
                  {newKey}
                </div>
                <button
                  type="button"
                  onClick={copyKey}
                  aria-label="Скопировать API-ключ"
                  className={`shrink-0 px-4 py-2.5 rounded-lg border font-medium text-sm transition-all duration-200 ${
                    copied
                      ? 'bg-emerald-600 border-emerald-600 text-primary-foreground shadow-sm'
                      : 'bg-card border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  {copied ? 'Скопировано!' : 'Скопировать'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">API-ключ активен</p>
                <p className="text-xs text-muted-foreground mt-1">
                  В целях безопасности ключ скрыт и не может быть восстановлен. Если вы его забыли, сгенерируйте новый.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              aria-label="Перегенерировать API-ключ"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
              Сгенерировать новый
            </button>

            {confirmRevoke ? (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 animate-in fade-in">
                <span className="text-xs text-rose-700 font-semibold">Отозвать ключ навсегда?</span>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isPending}
                  className="text-xs font-bold text-rose-700 underline hover:no-underline"
                >
                  Да, удалить
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={isPending}
                aria-label="Отозвать API-ключ"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50/50 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg disabled:opacity-50 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
                Отозвать
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-muted/30 border border-border rounded-xl p-4 text-sm text-muted-foreground">
            У вас ещё нет API-ключа. Сгенерируйте его чтобы начать использовать B2B API.
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isPending}
            aria-label="Сгенерировать API-ключ"
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all duration-200 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            Сгенерировать ключ
          </button>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 animate-in slide-in-from-top-1">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2">
        Никогда не передавайте API-ключ третьим лицам. При компрометации немедленно отзовите его.
      </p>
    </div>
  );
}

```

---

### 📄 Файл 29 из 49: `src/app/dashboard/settings/api/page.tsx`

```tsx
export const dynamic = 'force-dynamic';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ApiDashboardClient } from '@/components/dashboard/settings/api/ApiDashboardClient';

export const metadata = {
  title: 'API-доступ | SMMplan',
  description: 'Управляйте вашим B2B API-ключом и изучайте стандартизированные интеграционные руководства.',
};

export default async function ApiSettingsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { apiKeyHash: true },
  });

  if (!user) redirect('/login');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-foreground">API-доступ</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Интегрируйте возможности SMMplan прямо в ваши CRM, платформы реселлеров или боты.
        </p>
      </div>

      <ApiDashboardClient hasKey={!!user.apiKeyHash} />
    </div>
  );
}

```

---

### 📄 Файл 30 из 49: `src/app/dashboard/settings/page.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  User, Mail, Calendar, Shield,
  CreditCard, TrendingUp, Settings, Star, Key,
} from 'lucide-react';
import PasswordCard from '@/components/dashboard/settings/PasswordCard';
import DeleteAccountCard from '@/components/dashboard/settings/DeleteAccountCard';
import TelegramCard from '@/components/dashboard/settings/TelegramCard';
import Consent152FzCard from '@/components/dashboard/settings/Consent152FzCard';
import CompanyRequisitesCard from '@/components/dashboard/settings/CompanyRequisitesCard';
import B2bWebhookCard from '@/components/dashboard/settings/B2bWebhookCard';
import ApiKeyManager from './api/ApiKeyManager';
import { formatBalance } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Профиль и Настройки | SMMplan',
};

export default async function ClientSettingsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const canResetPassword = session.canResetPassword === true;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      passwordHash: true,
      balance: true,
      totalSpent: true,
      createdAt: true,
      referralCode: true,
      referralBalance: true,
      telegramId: true,
      apiKeyHash: true,
      tosAcceptedAt: true,
      tosAcceptedIp: true,
      companyName: true,
      inn: true,
      kpp: true,
      legalAddress: true,
      b2bConfig: {
        select: {
          webhookUrl: true,
          webhookSecret: true,
        },
      },
      _count: {
        select: {
          orders: true,
          referrals: true,
        },
      },
    },
  });

  if (!user) redirect('/login');

  const balanceFormatted    = formatBalance(user.balance);
  const spentFormatted      = formatBalance(user.totalSpent);
  const refBalanceFormatted = formatBalance(user.referralBalance ?? 0);

  const memberSince = user.createdAt.toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // Loyalty tier based on totalSpent
  const spent = Number(user.totalSpent) / 100;
  const tier = spent >= 50000
    ? { name: 'Платиновый', color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20', icon: '💎' }
    : spent >= 10000
    ? { name: 'Золотой',    color: 'text-amber-600 dark:text-amber-400 bg-warning/10 border-amber-500/20',    icon: '🏆' }
    : spent >= 2000
    ? { name: 'Серебряный', color: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',    icon: '⭐' }
    : { name: 'Базовый',    color: 'text-muted-foreground bg-muted border-border/60',   icon: '🌱' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Профиль и настройки</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Управление безопасностью, реквизитами организации, B2B API и профилем
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl font-black uppercase shrink-0">
            {user.email.substring(0, 2)}
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2">
              <p className="font-bold text-foreground truncate max-w-full">{user.email}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase w-fit mx-auto sm:mx-0 shrink-0 ${tier.color}`}>
                {tier.icon} {tier.name}
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-muted-foreground mt-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Участник с {memberSince}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: CreditCard, label: 'Баланс',       value: balanceFormatted,        color: 'text-primary bg-primary/10' },
          { icon: TrendingUp, label: 'Потрачено всего', value: spentFormatted,        color: 'text-success bg-success/10' },
          { icon: Settings,   label: 'Заказов',       value: user._count.orders.toString(), color: 'text-blue-500 bg-blue-500/10' },
          { icon: Star,       label: 'Рефералов',     value: user._count.referrals.toString(), color: 'text-warning bg-warning/10' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border/60 rounded-2xl p-6 space-y-3 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">{label}</div>
              <div className="text-lg font-black text-foreground tabular-nums">{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Account details */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">Данные аккаунта</h2>
        </div>
        <div className="divide-y divide-border">
          {[
            { icon: Mail,     label: 'Email',             value: user.email },
            { icon: Star,     label: 'Реферальный баланс', value: refBalanceFormatted },
            { icon: Shield,   label: 'Реф. код',          value: user.referralCode ?? '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-semibold text-foreground truncate">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 152-FZ Consent Status */}
      <Consent152FzCard
        tosAcceptedAt={user.tosAcceptedAt}
        tosAcceptedIp={user.tosAcceptedIp}
      />

      {/* Tax & Company Requisites */}
      <CompanyRequisitesCard
        initialData={{
          companyName: user.companyName,
          inn: user.inn,
          kpp: user.kpp,
          legalAddress: user.legalAddress,
        }}
      />

      {/* B2B Webhook Settings */}
      <B2bWebhookCard
        initialData={{
          webhookUrl: user.b2bConfig?.webhookUrl,
          webhookSecret: user.b2bConfig?.webhookSecret,
        }}
      />

      {/* API Key Management */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              Управление API-ключами B2B
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Ключ авторизации для программного создания заказов через API SMMplan
            </p>
          </div>
        </div>
        <div className="p-5">
          <ApiKeyManager hasKey={!!user.apiKeyHash} />
        </div>
      </div>

      {/* Telegram Management */}
      <TelegramCard telegramId={user.telegramId} />

      {/* Password Management */}
      <PasswordCard hasPassword={!!user.passwordHash} canResetPassword={canResetPassword} />

      {/* Account Soft Deletion */}
      <DeleteAccountCard hasPassword={!!user.passwordHash} />

      {/* Referral balance usage info */}
      {(user.referralBalance ?? 0) > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-start gap-3">
          <Star className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800 mb-0.5">
              У вас {refBalanceFormatted} реферального баланса
            </p>
            <p className="text-xs text-emerald-700 mb-3">
              Реферальный баланс начисляется автоматически — 15% с каждого заказа приглашённых вами пользователей.
              Средства зачисляются на ваш основной баланс при выводе.
            </p>
            <Link
              href="/dashboard/referrals"
              aria-label="Перейти к реферальной программе"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline hover:no-underline transition-colors"
            >
              Управление реферальной программой →
            </Link>
          </div>
        </div>
      )}

      {/* Loyalty progress */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Уровень лояльности</h2>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase ${tier.color}`}>
            {tier.icon} {tier.name}
          </span>
        </div>

        {/* Tier progression */}
        <div className="space-y-2">
          {[
            { label: 'Базовый',    threshold: 0,     icon: '🌱' },
            { label: 'Серебряный', threshold: 2000,  icon: '⭐' },
            { label: 'Золотой',    threshold: 10000, icon: '🏆' },
            { label: 'Платиновый', threshold: 50000, icon: '💎' },
          ].map((t, i, arr) => {
            const next = arr[i + 1];
            const isCurrentOrPast = spent >= t.threshold;
            const isCurrent = isCurrentOrPast && (!next || spent < next.threshold);
            return (
              <div key={t.label} className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    isCurrentOrPast ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/40'
                  }`}
                >
                  {t.icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs font-semibold ${isCurrent ? 'text-primary' : isCurrentOrPast ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {t.label}
                      {isCurrent && <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-bold">ВЫ ЗДЕСЬ</span>}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      от {t.threshold.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Next tier hint */}
        {spent < 50000 && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
            {spent < 2000  && `До Серебряного уровня: ещё ${(2000 - spent).toLocaleString('ru-RU')} ₽`}
            {spent >= 2000  && spent < 10000 && `До Золотого уровня: ещё ${(10000 - spent).toLocaleString('ru-RU')} ₽`}
            {spent >= 10000 && spent < 50000 && `До Платинового уровня: ещё ${(50000 - spent).toLocaleString('ru-RU')} ₽`}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/dashboard/referrals"
          className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:bg-muted/30 transition-all duration-200 group"
          aria-label="Реферальная программа"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Star className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              Реферальная программа
            </div>
            <div className="text-xs text-muted-foreground">Зарабатывайте 15% с каждого заказа</div>
          </div>
        </Link>

        <Link
          href="/dashboard/settings/api"
          className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:bg-muted/30 transition-all duration-200 group"
          aria-label="API доступ"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              B2B API
            </div>
            <div className="text-xs text-muted-foreground">Документация и полное управление API-ключами</div>
          </div>
        </Link>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 31 из 49: `src/app/dashboard/sidebar-nav.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  ListOrdered,
  Wallet,
  Users,
  MessageSquare,
  Settings,
  UserCircle,
  LogOut,
  ChevronRight,
  Receipt,
  Cpu,
} from 'lucide-react';

import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';

export const NAV = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Главная'     },
  { href: '/dashboard/new-order',    icon: ShoppingCart,    label: 'Новый заказ' },
  { href: '/dashboard/orders',       icon: ListOrdered,     label: 'Мои заказы'  },
  { href: '/dashboard/smart-drip',   icon: Cpu,             label: 'Умный Dripfeed' },
  { href: '/dashboard/transactions', icon: Receipt,         label: 'Транзакции'  },
  { href: '/dashboard/add-funds',    icon: Wallet,          label: 'Пополнить'   },
  { href: '/dashboard/tickets',      icon: MessageSquare,   label: 'Поддержка'   },
  { href: '/dashboard/referrals',    icon: Users,           label: 'Рефералы'    },
  { href: '/dashboard/settings',     icon: UserCircle,      label: 'Профиль'     },
  { href: '/dashboard/settings/api', icon: Settings,        label: 'API'         },
];

// First 5 for mobile bottom nav — most important: home/new-order/orders/add-funds/tickets
export const MOBILE_NAV = NAV.slice(0, 5);

export function SidebarNav({
  email,
  balanceRub,
}: {
  email: string;
  balanceRub: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex w-[240px] flex-col shrink-0 border-r border-border bg-card">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link href="/" className="flex items-center gap-2 group" aria-label="На главную">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">
            S
          </div>
          <span className="font-bold text-foreground text-base">SMMplan</span>
        </Link>
      </div>

      {/* Balance display client component */}
      <BalanceDisplay initialBalance={balanceRub} variant="sidebar" />

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 mt-2" aria-label="Меню личного кабинета">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 transition-colors" />
              <span>{label}</span>
              {!active && (
                <ChevronRight className="w-3 h-3 ml-auto opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0 transition-all duration-200" />
              )}
              {active && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40">
          <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold uppercase shrink-0">
            {email.substring(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">{email}</div>
          </div>
          <Link
            href="/api/auth/logout"
            prefetch={false}
            title="Выйти"
            aria-label="Выйти из аккаунта"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(href);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border flex pb-[env(safe-area-inset-bottom)]"
      aria-label="Нижняя навигация"
    >
      {MOBILE_NAV.map(({ href, icon: Icon, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
            className={`relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors duration-200 ${
              active ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className={`text-[10px] font-semibold tracking-wide ${active ? 'font-bold' : ''}`}>
              {label}
            </span>
            {active && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-primary rounded-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

```

---

### 📄 Файл 32 из 49: `src/app/dashboard/smart-drip/page.tsx`

```tsx
import { getClientCampaigns } from '@/actions/order/smart';
import { SmartDripDashboardClient, CampaignDTO } from './smart-client';

export const dynamic = 'force-dynamic';

export default async function SmartDripDashboardPage() {
  const result = await getClientCampaigns(1, 100);
  const campaigns = result.success ? result.data.campaigns : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Умный Dripfeed</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Мониторинг ваших постепенных доставок и распределения заказов во времени
        </p>
      </div>

      <SmartDripDashboardClient initialCampaigns={campaigns as CampaignDTO[]} />
    </div>
  );
}

```

---

### 📄 Файл 33 из 49: `src/app/dashboard/smart-drip/smart-client.tsx`

```tsx
'use client';

import React, { useState, useTransition } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SocialIcon } from '@/components/ui/SocialIcon';
import { toast } from 'sonner';
import { toggleClientCampaignStatus } from '@/actions/order/smart';
import { 
  Pause, 
  Play, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export interface TaskDTO {
  id: string;
  quantity: number;
  runAt: Date;
  status: 'PLANNED' | 'SENT' | 'COMPLETED' | 'ERROR';
  error: string | null;
  externalOrderId: string | null;
  execStatus: string | null;
}

export interface CampaignDTO {
  id: string;
  serviceName: string;
  networkSlug: string;
  networkName: string;
  link: string;
  totalQuantity: number;
  totalDays: number;
  status: 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  createdAt: Date;
  progress: number;
  tasks: TaskDTO[];
}

interface SmartDripDashboardClientProps {
  initialCampaigns: CampaignDTO[];
}

export function SmartDripDashboardClient({ initialCampaigns }: SmartDripDashboardClientProps) {
  const [campaigns, setCampaigns] = useState<CampaignDTO[]>(initialCampaigns);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  
  const [isPending, startTransition] = useTransition();

  const handleToggleStatus = (campaignId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING';
    
    startTransition(async () => {
      try {
        const res = await toggleClientCampaignStatus(campaignId, nextStatus);
        if (res.success) {
          setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c));
          toast.success(
            nextStatus === 'RUNNING' 
              ? 'Кампания успешно возобновлена' 
              : 'Кампания приостановлена'
          );
        } else {
          toast.error('Не удалось изменить статус кампании');
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        toast.error(err.message || 'Ошибка выполнения действия');
      }
    });
  };

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaignId(prev => prev === campaignId ? null : campaignId);
  };

  const filtered = campaigns.filter(c => 
    c.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.link.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Поиск по тарифу, ссылке или ID..." 
          className="pl-10 h-11 bg-card border-border/80 text-foreground"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Campaigns list */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl border border-border/50 shadow-sm bg-card p-12 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            У вас пока нет активных или завершенных кампаний умного Dripfeed
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((c) => {
            const isExpanded = expandedCampaignId === c.id;

            return (
              <Card key={c.id} className="rounded-2xl border border-border shadow-xs bg-card overflow-hidden transition-all duration-300">
                <CardContent className="p-0">
                  {/* Campaign summary card header */}
                  <div 
                    onClick={() => toggleExpand(c.id)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="shrink-0 mt-0.5">
                        <SocialIcon slug={c.networkSlug} size={22} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm leading-tight truncate">
                            {c.serviceName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            (ID: {c.id})
                          </span>
                        </div>
                        <a 
                          href={c.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-muted-foreground hover:text-primary hover:underline font-mono truncate block max-w-[320px] md:max-w-md"
                        >
                          {c.link}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 flex-wrap md:flex-nowrap justify-between md:justify-end shrink-0">
                      {/* Qty & Period */}
                      <div className="text-left md:text-right">
                        <div className="font-extrabold text-foreground text-xs leading-none">
                          {c.totalQuantity.toLocaleString('ru-RU')} шт
                        </div>
                        <div className="text-[10px] text-muted-foreground font-semibold mt-1">
                          растянуто на {c.totalDays} дней
                        </div>
                      </div>

                      {/* Progress Bar & Status */}
                      <div className="w-[140px] space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-foreground">{c.progress}%</span>
                          <span className="text-muted-foreground font-medium">
                            {c.tasks.filter(t => t.status === 'COMPLETED').length}/{c.tasks.length}
                          </span>
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              c.status === 'COMPLETED' ? 'bg-success' : c.status === 'ERROR' ? 'bg-destructive' : 'bg-primary'
                            }`} 
                            style={{ width: `${c.progress}%` }} 
                          />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge 
                            intent={
                              c.status === 'COMPLETED' ? 'primary' : 
                              c.status === 'RUNNING' ? 'primary' : 
                              c.status === 'PAUSED' ? 'secondary' : 'destructive'
                            }
                            className={`font-bold text-[9px] uppercase tracking-wider px-1.5 py-0 ${
                              c.status === 'COMPLETED' ? 'bg-success/10 text-emerald-800 dark:text-success border-emerald-500/20' :
                              c.status === 'RUNNING' ? 'bg-primary/10 text-blue-800 dark:text-primary border-primary/20' :
                              c.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-800 dark:text-warning border-amber-500/20' : 'bg-destructive/10 text-red-800 dark:text-destructive border-destructive/20'
                            }`}
                          >
                            {c.status === 'COMPLETED' ? 'Завершено' :
                             c.status === 'RUNNING' ? 'Активна' :
                             c.status === 'PAUSED' ? 'Пауза' :
                             c.status === 'PLANNED' ? 'В очереди' : 'Сбой'}
                          </Badge>
                        </div>
                      </div>

                      {/* Expand & Pause Actions */}
                      <div className="flex items-center gap-2">
                        {c.status !== 'COMPLETED' && c.status !== 'ERROR' && (
                          <Button
                            intent={c.status === 'RUNNING' ? 'outline' : 'primary'}
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(c.id, c.status);
                            }}
                            disabled={isPending}
                          >
                            {c.status === 'RUNNING' ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <div className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors shrink-0">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Campaign breakdown tasks list details */}
                  {isExpanded && (
                    <div className="border-t border-border/60 bg-muted/20 px-5 py-4 space-y-3 animate-in slide-in-from-top-3 duration-300">
                      <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-2">
                        График выполнения порций (Транши)
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {c.tasks.map((t, index) => (
                          <div 
                            key={t.id} 
                            className="bg-card border border-border/50 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-xs">Порция #{index + 1}</span>
                                <span className="text-[10px] font-mono text-muted-foreground/80 tabular-nums">({t.quantity} шт)</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span className="tabular-nums">
                                  {new Date(t.runAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              {t.externalOrderId && (
                                <div className="text-[9px] font-mono text-primary flex items-center gap-1">
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  <span>Заказ провайдера: {t.externalOrderId}</span>
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {t.status === 'COMPLETED' && (
                                <span className="text-[10px] font-bold text-emerald-800 dark:text-success flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Выполнено
                                </span>
                              )}
                              {t.status === 'SENT' && (
                                <span className="text-[10px] font-bold text-blue-800 dark:text-primary flex items-center gap-1 animate-pulse">
                                  <Clock className="w-3.5 h-3.5" /> В процессе
                                </span>
                              )}
                              {t.status === 'PLANNED' && (
                                <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Ожидает
                                </span>
                              )}
                              {t.status === 'ERROR' && (
                                <span className="text-[10px] font-bold text-red-800 dark:text-destructive flex items-center gap-1" title={t.error || ''}>
                                  <AlertCircle className="w-3.5 h-3.5" /> Ошибка
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

```

---

### 📄 Файл 34 из 49: `src/app/dashboard/tickets/page.tsx`

```tsx
import { verifySession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ticketService } from '@/services/support/ticket.service';

export const dynamic = 'force-dynamic';

export default async function ClientTicketsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  // Retrieve or create active (non-CLOSED) support live-chat session for the client
  const ticket = await ticketService.getOrCreateTicket(
    session.userId,
    'Чат с поддержкой',
    'WEB'
  );

  // Instantly redirect client to the active chat room
  redirect(`/dashboard/tickets/${ticket.id}`);
}

```

---

### 📄 Файл 35 из 49: `src/app/dashboard/tickets/[id]/page.tsx`

```tsx
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { notFound, redirect } from 'next/navigation';
import { addTicketMessage } from '@/actions/support/ticket';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ChatWindow from '@/components/support/ChatWindow';

export const dynamic = 'force-dynamic';

export default async function ClientTicketChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  if (!session) redirect('/login');

  const { id } = await params;

  const ticket = await db.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      userId: true,
      orderId: true,
      user: {
        select: {
          email: true,
        },
      },
      order: {
        select: {
          id: true,
          numericId: true,
          status: true,
          charge: true,
          createdAt: true,
          service: { select: { name: true } }
        }
      }
    },
  });

  if (!ticket || ticket.userId !== session.userId) return notFound();

  // 1. Fetch user's 3 most recent CLOSED tickets (excluding the active one)
  const historicalTickets = await db.ticket.findMany({
    where: {
      userId: session.userId,
      status: 'CLOSED',
      id: { not: id }
    },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    include: {
      messages: {
        where: { sender: { not: 'INTERNAL' } },
        orderBy: { createdAt: 'asc' },
        include: { 
          replyTo: true, 
          attachments: true,
          order: {
            select: {
              id: true,
              numericId: true,
              status: true,
              charge: true,
              createdAt: true,
              service: { select: { name: true } }
            }
          }
        }
      }
    }
  });

  // Prepend historical messages, oldest closed ticket first
  const mappedHistoricalMessages = [];
  const reversedHistorical = [...historicalTickets].reverse();

  for (const hTicket of reversedHistorical) {
    for (const m of hTicket.messages) {
      mappedHistoricalMessages.push({
        id: m.id,
        sender: m.sender,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        createdAt: m.createdAt.toISOString(),
        isDeleted: m.isDeleted,
        isEdited: m.isEdited,
        originalText: m.originalText,
        orderId: m.orderId,
        order: m.order ? {
          id: m.order.id,
          numericId: m.order.numericId,
          status: m.order.status,
          charge: Number(m.order.charge),
          createdAt: m.order.createdAt.toISOString(),
          serviceName: m.order.service?.name || 'Услуга'
        } : null,
        replyTo: m.replyTo ? {
          id: m.replyTo.id,
          text: m.replyTo.text,
          sender: m.replyTo.sender
        } : null,
        attachments: m.attachments.map(a => ({
          id: a.id,
          url: a.url,
          type: a.type,
          mimeType: a.mimeType,
          name: a.name,
          size: a.size ? Number(a.size) : null,
          createdAt: a.createdAt.toISOString()
        })),
        isHistorical: true,
        historicalTicketId: hTicket.id,
        historicalSubject: hTicket.subject
      });
    }
  }

  // Fetch only the latest 50 messages of the active ticket
  const rawMessages = await db.ticketMessage.findMany({
    where: { 
      ticketId: id,
      sender: { not: 'INTERNAL' }
    },
    orderBy: { createdAt: 'desc' },
    take: 51,
    include: { 
      replyTo: true, 
      attachments: true,
      order: {
        select: {
          id: true,
          numericId: true,
          status: true,
          charge: true,
          createdAt: true,
          service: { select: { name: true } }
        }
      }
    }
  });

  let nextCursor: string | null = null;
  const activeMessages = [...rawMessages];
  if (activeMessages.length > 50) {
    const extraItem = activeMessages.pop();
    nextCursor = extraItem?.id || null;
  }
  activeMessages.reverse();

  const initialActiveMessages = activeMessages.map(m => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    createdAt: m.createdAt.toISOString(),
    isDeleted: m.isDeleted,
    isEdited: m.isEdited,
    originalText: m.originalText,
    orderId: m.orderId,
    order: m.order ? {
      id: m.order.id,
      numericId: m.order.numericId,
      status: m.order.status,
      charge: Number(m.order.charge),
      createdAt: m.order.createdAt.toISOString(),
      serviceName: m.order.service?.name || 'Услуга'
    } : null,
    replyTo: m.replyTo ? {
      id: m.replyTo.id,
      text: m.replyTo.text,
      sender: m.replyTo.sender
    } : null,
    attachments: m.attachments.map(a => ({
      id: a.id,
      url: a.url,
      type: a.type,
      mimeType: a.mimeType,
      name: a.name,
      size: a.size ? Number(a.size) : null,
      createdAt: a.createdAt.toISOString()
    }))
  }));

  // Stitch historical and active messages together
  const initialMessages = [...mappedHistoricalMessages, ...initialActiveMessages];

  // 2. Fetch client's 5 most recent orders for context mapping dropdown
  const initialOrders = await db.order.findMany({
    where: { userId: session.userId },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      numericId: true,
      createdAt: true,
      status: true,
      charge: true,
      service: { select: { name: true } }
    }
  });

  const formattedOrders = initialOrders.map(o => ({
    id: o.id,
    numericId: o.numericId,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    charge: Number(o.charge),
    serviceName: o.service?.name || 'Услуга'
  }));

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="space-y-4 animate-in fade-in duration-500 flex flex-col h-[calc(100dvh-13rem)] md:h-[calc(100dvh-7rem)] min-h-[350px] md:min-h-[500px]">
      {/* Header / breadcrumb */}
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/dashboard/tickets"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all duration-200 min-h-[44px]"
          aria-label="Назад к списку тикетов"
        >
          <ArrowLeft className="w-4 h-4" />
          Поддержка
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground leading-tight truncate">
            {ticket.subject}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Вы можете общаться здесь или переписываться в Telegram (работаем с 09:00 до 21:00 МСК)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/api/support/telegram"
            className="inline-flex items-center gap-2 text-xs font-semibold bg-brand-telegram hover:opacity-90 text-primary-foreground px-4 h-11 rounded-xl shadow-sm transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px]"
            aria-label="Перейти в Telegram-бот"
          >
            <svg 
              viewBox="0 0 24 24" 
              className="w-4 h-4 fill-current"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-2 .12-5.63 2.57-.53.36-1 .54-1.43.53-.47-.01-1.37-.27-2.04-.49-.82-.27-1.47-.41-1.42-.87.03-.24.37-.49 1.02-.74 3.99-1.73 6.66-2.88 8-3.43 3.8-1.56 4.59-1.83 5.11-1.84.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.16-.02.22z"/>
            </svg>
            Написать в Telegram
          </a>
          <span
            className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border uppercase ${
              ticket.status === 'OPEN'
                ? 'text-status-error bg-status-error-bg border-status-error/20'
                : ticket.status === 'PENDING'
                ? 'text-status-warning bg-status-warning-bg border-status-warning/20'
                : 'text-muted-foreground bg-muted border-border'
            }`}
          >
            {ticket.status === 'OPEN'    ? 'Открыт'
             : ticket.status === 'PENDING' ? 'Ожидает вас'
             : 'Закрыт'}
          </span>
        </div>
      </div>

      {ticket.order && (
        <div className="bg-status-info-bg border border-status-info/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm shrink-0 animate-in fade-in duration-300">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-status-info-bg text-status-info flex items-center justify-center font-bold text-lg shrink-0">
              📦
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">Привязанный заказ #{ticket.order.numericId}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  ticket.order.status === 'COMPLETED' ? 'bg-status-success-bg text-status-success' :
                  ticket.order.status === 'IN_PROGRESS' ? 'bg-primary/10 text-primary' :
                  ticket.order.status === 'PENDING' ? 'bg-status-warning-bg text-status-warning' :
                  'bg-default-200 text-default-600'
                }`}>
                  {ticket.order.status === 'COMPLETED' ? 'Выполнен' :
                   ticket.order.status === 'IN_PROGRESS' ? 'Выполняется' :
                   ticket.order.status === 'PENDING' ? 'В очереди' : ticket.order.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{ticket.order.service?.name || 'Услуга'}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
            <span>Дата: {new Date(ticket.order.createdAt).toLocaleDateString('ru-RU')}</span>
            <span className="font-bold text-foreground">{(Number(ticket.order.charge) / 100).toFixed(2)} ₽</span>
          </div>
        </div>
      )}

      {/* Chat messages using premium ChatWindow */}
      <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col min-h-0 shadow-sm">
        <ChatWindow
          ticketId={ticket.id}
          initialMessages={initialMessages}
          isStaff={false}
          onSendMessage={addTicketMessage}
          initialNextCursor={nextCursor}
          isClosed={isClosed}
          initialOrders={formattedOrders}
          clientEmail={ticket.user.email}
        />
      </div>
    </div>
  );
}

```

---

### 📄 Файл 36 из 49: `src/app/dashboard/transactions/page.tsx`

```tsx
export const dynamic = 'force-dynamic';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { TransactionsClient } from '@/components/dashboard/transactions/TransactionsClient';

export const metadata = {
  title: 'История транзакций | SMMplan',
  description: 'Прозрачный балансовый отчет, пополнения, возвраты и детализированный аудит трат.',
};

export default async function TransactionsPage() {
  const session = await verifySession();
  if (!session) redirect('/login');

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  });

  if (!user) redirect('/login');

  // Fetch all ledger transactions of the user
  const entries = await db.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      reason: true,
      status: true,
      idempotencyKey: true,
      transactionType: true,
      createdAt: true,
    },
  });

  // Serialize BigInt and Date values safely for Client Component boundaries
  const serializedEntries = entries.map(entry => ({
    id: entry.id,
    amountCents: typeof entry.amount === 'bigint' ? Number(entry.amount) : entry.amount,
    amountRub: (Number(entry.amount) / 100),
    reason: entry.reason,
    status: entry.status,
    idempotencyKey: entry.idempotencyKey || null,
    transactionType: entry.transactionType,
    createdAt: entry.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Финансовая история</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Контроль платежей, возвратов средств и сводные отчеты для бухгалтерии.
        </p>
      </div>

      <TransactionsClient initialEntries={serializedEntries} userEmail={user.email} />
    </div>
  );
}

```

---

### 📄 Файл 37 из 49: `src/components/dashboard/balance/BalanceDisplay.tsx`

```tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { RotateCw, Wallet } from 'lucide-react';
import { refreshBalanceAction } from '@/actions/auth/refresh-balance';
import { toast } from 'sonner';

interface BalanceDisplayProps {
  initialBalance: string;
  variant: 'sidebar' | 'mobile-header';
}

export function BalanceDisplay({ initialBalance, variant }: BalanceDisplayProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const triggerRefresh = useCallback(async (isSilent = false) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await refreshBalanceAction();
      if (res.success && res.balanceRub) {
        setBalance(res.balanceRub);
        if (!isSilent) {
          toast.success('Баланс успешно обновлен!');
        }
      } else {
        if (!isSilent) {
          toast.error(res.error || 'Не удалось обновить баланс');
        }
      }
    } catch (e) {
      console.error(e);
      if (!isSilent) {
        toast.error('Произошла ошибка при обновлении баланса');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Set up short-term polling if user manually refreshes, to catch delayed payment webhooks
  useEffect(() => {
    if (pollCount <= 0) return;

    const timer = setTimeout(() => {
      triggerRefresh(true);
      setPollCount((prev) => prev - 1);
    }, 10000); // poll every 10 seconds

    return () => clearTimeout(timer);
  }, [pollCount, triggerRefresh]);

  const handleManualClick = () => {
    triggerRefresh(false);
    // Start polling for 12 cycles (2 minutes total) to capture the webhook
    setPollCount(12);
  };

  if (variant === 'mobile-header') {
    return (
      <div className="flex items-center gap-1.5 text-foreground shrink-0 select-none">
        <span className="text-xs font-bold tabular-nums tracking-wide">{balance}</span>
        <button
          onClick={handleManualClick}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 active:scale-90 cursor-pointer"
          title="Обновить баланс"
          aria-label="Обновить баланс"
          disabled={isRefreshing}
        >
          <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3 mt-4 p-3.5 rounded-2xl bg-primary/[0.03] border border-primary/10 shadow-sm relative overflow-hidden group">
      {/* Light glow pattern inside balance card */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase font-extrabold text-muted-foreground/80 tracking-wider">
          Баланс
        </span>
        <button
          onClick={handleManualClick}
          className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all duration-200 active:scale-90 cursor-pointer"
          title="Обновить баланс"
          aria-label="Обновить баланс"
          disabled={isRefreshing}
        >
          <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
        </button>
      </div>
      
      <div className="text-xl font-black text-foreground tabular-nums tracking-tight mb-2">
        {balance}
      </div>

      <Link
        href="/dashboard/add-funds"
        className="w-full flex items-center justify-center gap-1.5 text-xs font-extrabold bg-primary text-primary-foreground rounded-xl py-2 shadow-sm shadow-primary/20 hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
      >
        <Wallet className="w-3.5 h-3.5" />
        <span>Пополнить</span>
      </Link>
    </div>
  );
}

```

---

### 📄 Файл 38 из 49: `src/components/dashboard/classic/ClassicDashboardHome.tsx`

```tsx
import Link from 'next/link';
import { ShoppingCart, Wallet, Users, TrendingUp, ArrowRight, Clock } from 'lucide-react';
import { formatBalance } from '@/lib/utils';
import { PaymentAutoSync } from '@/components/orders/PaymentAutoSync';

const STATUS_LABEL: Record<string, string> = {
  COMPLETED:       'Выполнен',
  IN_PROGRESS:     'В работе',
  PENDING:         'Ожидание',
  AWAITING_PAYMENT:'Ожидает оплаты',
  ERROR:           'Ошибка',
  CANCELED:        'Отменён',
  PARTIAL:         'Частично',
  PROVISIONING:    'Запуск',
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED:       'text-success bg-success/10',
  IN_PROGRESS:     'text-sky-500     bg-sky-500/10',
  PENDING:         'text-orange-500  bg-orange-500/10',
  AWAITING_PAYMENT:'text-orange-500  bg-orange-500/10',
  ERROR:           'text-destructive    bg-destructive/10',
  PARTIAL:         'text-warning        bg-warning/10',
  CANCELED:        'text-muted-foreground bg-muted',
};

export function ClassicDashboardHome({
  user,
  orders,
  referralCount,
  activeOrders,
  hasPendingPayments,
  origin,
}: {
  user: any;
  orders: any[];
  referralCount: number;
  activeOrders: number;
  hasPendingPayments: boolean;
  origin: string;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {hasPendingPayments && <PaymentAutoSync />}
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Добро пожаловать 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{user.email}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Balance */}
        <div className="bg-card shadow-sm border border-border/60 rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Баланс
            </span>
            <Wallet className="w-4 h-4 text-muted-foreground/60" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight font-mono tabular-nums whitespace-nowrap">
            {formatBalance(user.balance)}
          </div>
          <Link
            href="/dashboard/add-funds"
            className="mt-auto w-full h-11 bg-primary/10 text-primary hover:bg-primary/20 hover:scale-[1.02] active:scale-[0.98] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-200"
          >
            Пополнить <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Total spent */}
        <div className="bg-card shadow-sm border border-border/60 rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Потрачено
            </span>
            <TrendingUp className="w-4 h-4 text-muted-foreground/60" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight font-mono tabular-nums">
            {(Number(user.totalSpent) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
          </div>
          <Link
            href="/dashboard/orders"
            className="mt-auto w-full h-11 bg-muted text-foreground hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-200"
          >
            История <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Active orders */}
        <div className="bg-card shadow-sm border border-border/60 rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              В работе
            </span>
            <Clock className="w-4 h-4 text-muted-foreground/60" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight font-mono tabular-nums">
            {activeOrders}
          </div>
          <Link
            href="/dashboard/orders"
            className="mt-auto w-full h-11 bg-muted text-foreground hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-200"
          >
            Заказы <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Referrals */}
        <div className="bg-card shadow-sm border border-border/60 rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Рефералы
            </span>
            <Users className="w-4 h-4 text-muted-foreground/60" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight font-mono tabular-nums">
            {referralCount}
          </div>
          <Link
            href="/dashboard/referrals"
            className="mt-auto w-full h-11 bg-muted text-foreground hover:bg-muted/80 hover:scale-[1.02] active:scale-[0.98] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-200"
          >
            Программа <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/new-order"
          className="group bg-card border border-border/60 rounded-2xl p-6 flex items-center justify-between hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
        >
          <div>
            <div className="font-bold text-lg text-foreground tracking-tight mb-0.5 group-hover:text-primary transition-colors">Новый заказ</div>
            <div className="text-sm text-muted-foreground font-medium">Продвижение подписчиков, просмотров</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </Link>

        {user.referralCode && (
          <div className="bg-card shadow-sm border border-border rounded-2xl p-6 flex flex-col justify-between">
             <div>
               <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                 Ваша ссылка
               </div>
               <div className="font-mono text-sm font-semibold bg-muted px-3 py-2 rounded-xl text-foreground break-all select-all border border-border border-dashed">
                 {user.referralCode ? `${origin}/r/${user.referralCode}` : '—'}
               </div>
             </div>
             <Link
               href="/dashboard/referrals"
               className="flex items-center gap-1 mt-4 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
             >
               Партнёрка <ArrowRight className="w-3 h-3" />
             </Link>
          </div>
        )}
      </div>

      {/* Recent orders */}
      {orders.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base text-foreground">Последние заказы</h2>
            <Link
              href="/dashboard/orders"
              className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
            >
              Все заказы <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="bg-card shadow-sm border border-border/60 rounded-2xl overflow-hidden">
            {orders.map((order) => {
              const color = STATUS_COLOR[order.status] || STATUS_COLOR.CANCELED;
              const label = STATUS_LABEL[order.status] || order.status;
              return (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  aria-label={`Заказ #${order.numericId} — ${order.service.name}`}
                  className="flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors duration-200 group"
                >
                  <span className="font-mono text-[11px] font-bold text-muted-foreground shrink-0 tabular-nums bg-muted px-2 py-1 rounded-md">
                    #{order.numericId}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {order.service.name}
                    </div>
                    <div className="text-[11px] font-bold text-muted-foreground/60 tabular-nums tracking-wide mt-0.5">
                      {order.quantity.toLocaleString('ru-RU')} штук
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-foreground tabular-nums font-mono tracking-tight">
                      {(Number(order.charge) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                    </div>
                    <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 mt-1 rounded-md uppercase tracking-wider ${color}`}>
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <ShoppingCart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Ещё нет заказов</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Сделайте первый заказ и получите результат уже через несколько минут
          </p>
          <Link
            href="/dashboard/new-order"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all duration-200"
          >
            Создать первый заказ <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

```

---

### 📄 Файл 39 из 49: `src/components/dashboard/classic/ClassicDashboardShell.tsx`

```tsx
import Link from 'next/link';
import { SidebarNav, MobileBottomNav } from '@/app/dashboard/sidebar-nav';
import { formatBalance } from '@/lib/utils';
import { BalanceDisplay } from '@/components/dashboard/balance/BalanceDisplay';

export function ClassicDashboardShell({
  user,
  children,
}: {
  user: { email: string; balanceCents: number };
  children: React.ReactNode;
}) {
  const balanceRub = formatBalance(user.balanceCents);

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Sidebar (desktop, client — for active highlight) ── */}
      <SidebarNav email={user.email} balanceRub={balanceRub} />

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between flex-wrap gap-y-2 gap-x-4 min-h-[56px]">
        <Link href="/" className="flex items-center gap-2 font-bold text-foreground min-h-[40px]">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shrink-0">
            S
          </div>
          <span className="truncate">SMMplan</span>
        </Link>
        <div className="flex items-center gap-3 ml-auto">
          <BalanceDisplay initialBalance={formatBalance(user.balanceCents)} variant="mobile-header" />
          <Link
            href="/dashboard/add-funds"
            className="px-3.5 py-2 min-h-[40px] flex items-center text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shrink-0"
          >
            + Пополнить
          </Link>
        </div>
      </div>

      {/* ── Mobile bottom nav (client — for active highlight) ── */}
      <MobileBottomNav />

      {/* ── Main content ── */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 pt-16 pb-24 md:pt-0 md:pb-0 overflow-y-auto outline-none">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

```

---

### 📄 Файл 40 из 49: `src/components/dashboard/settings/api/ApiDashboardClient.tsx`

```tsx
'use client';

import React, { useState } from 'react';
import { Key, BookOpen } from 'lucide-react';
import ApiKeyManager from '@/app/dashboard/settings/api/ApiKeyManager';
import { ApiReferenceDocs } from './ApiReferenceDocs';

interface ApiDashboardClientProps {
  hasKey: boolean;
}

export function ApiDashboardClient({ hasKey }: ApiDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<'key' | 'docs'>('key');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // Determine if user has key currently active (either from DB or newly generated)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isKeyActive = hasKey || !!generatedKey;

  return (
    <div className="space-y-6">
      
      {/* ── Tabs selector ── */}
      <div className="flex bg-muted p-1 rounded-2xl border border-border/40 select-none max-w-xs">
        <button
          onClick={() => setActiveTab('key')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'key' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="w-4 h-4 text-primary" />
          <span>API-Ключ</span>
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'docs' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4 text-primary" />
          <span>Документация</span>
        </button>
      </div>

      {/* ── Active Tab View ── */}
      {activeTab === 'key' ? (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40">
            <h2 className="font-extrabold text-foreground text-sm">B2B Reseller API Key</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Используйте API-ключ для заказа услуг SMMplan из ваших собственных систем.
            </p>
          </div>
          <div className="p-5">
            <ApiKeyManager 
              hasKey={hasKey} 
              onKeyGenerated={(key: string | null) => setGeneratedKey(key)} 
            />
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="font-extrabold text-foreground text-sm">Интеграционная документация API v2</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Спецификации, параметры запросов и примеры интеграции с реселлер-платформой SMMplan.
            </p>
          </div>
          <div className="p-5">
            <ApiReferenceDocs userApiKey={generatedKey} />
          </div>
        </div>
      )}

    </div>
  );
}

```

---

### 📄 Файл 41 из 49: `src/components/dashboard/settings/api/ApiReferenceDocs.tsx`

```tsx
'use client';

import React, { useState } from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Copy, Check, Terminal, Code, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getCurlCode, getNodeCode, jsonResponse } from './ApiReferenceDocsData';

interface ApiReferenceDocsProps {
  userApiKey: string | null;
}

export function ApiReferenceDocs({ userApiKey }: ApiReferenceDocsProps) {
  const [activeAction, setActiveAction] = useState<'services' | 'add' | 'status' | 'balance'>('services');
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  const displayKey = userApiKey || '<ВАШ_API_КЛЮЧ>';
  const host = typeof window !== 'undefined' ? window.location.origin : 'https://smmplan.pro';

  const copyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTextId(id);
    toast.success('Код скопирован!');
    setTimeout(() => setCopiedTextId(null), 2000);
  };

  const curlCode = getCurlCode(host, displayKey);
  const nodeCode = getNodeCode(host, displayKey);

  return (
    <div className="space-y-6">
      
      {/* ── API Action Selector Tabs ── */}
      <div className="flex flex-wrap border-b border-border/60 select-none gap-2 pb-2">
        <button
          onClick={() => setActiveAction('services')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'services' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          services (Список услуг)
        </button>
        <button
          onClick={() => setActiveAction('add')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'add' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          add (Новый заказ)
        </button>
        <button
          onClick={() => setActiveAction('status')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'status' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          status (Статус заказа)
        </button>
        <button
          onClick={() => setActiveAction('balance')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeAction === 'balance' ? 'bg-primary/10 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          balance (Запрос баланса)
        </button>
      </div>

      {/* ── API Details and Parameter Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Description & Parameters */}
        <div className="space-y-5">
          <div>
            <h4 className="font-extrabold text-foreground text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span>Описание метода</span>
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mt-1">
              {activeAction === 'services' && 'Возвращает полный каталог активных услуг, доступных лимитов и тарифов с учетом вашей персональной скидки реселлера.'}
              {activeAction === 'add' && 'Создает новый заказ в системе продвижения. Сумма заказа рассчитывается автоматически и списывается с баланса вашего API-аккаунта.'}
              {activeAction === 'status' && 'Query-опрос состояния заказа. Позволяет узнать остаток невыполненной продвижения (remains) и текущий статус выполнения.'}
              {activeAction === 'balance' && 'Быстрый запрос текущего остатка средств на балансе в рублях РФ.'}
            </p>
          </div>

          {/* Parameters Table */}
          <div className="space-y-3">
            <h5 className="font-extrabold text-foreground text-xs uppercase tracking-wider">Параметры запроса</h5>
            <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm bg-muted/20">
              <table className="w-full text-xs" aria-label="Параметры API">
                <thead>
                  <tr className="bg-muted text-left text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border/40 select-none">
                    <th className="py-2.5 px-4 font-bold">Поле</th>
                    <th className="py-2.5 px-4 font-bold">Тип</th>
                    <th className="py-2.5 px-4 font-bold">Обяз.</th>
                    <th className="py-2.5 px-4 font-bold">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">key</td>
                    <td className="py-2.5 px-4 text-muted-foreground">string</td>
                    <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                    <td className="py-2.5 px-4 text-muted-foreground">Ваш уникальный API-ключ реселлера.</td>
                  </tr>
                  <tr className="border-b border-border/40">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">action</td>
                    <td className="py-2.5 px-4 text-muted-foreground">string</td>
                    <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                    <td className="py-2.5 px-4 text-muted-foreground">Название метода: <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">{activeAction}</code></td>
                  </tr>
                  
                  {activeAction === 'services' && (
                    <tr>
                      <td className="py-2.5 px-4 font-mono font-bold text-foreground">offset</td>
                      <td className="py-2.5 px-4 text-muted-foreground">int</td>
                      <td className="py-2.5 px-4 text-muted-foreground">Нет</td>
                      <td className="py-2.5 px-4 text-muted-foreground">Смещение для пагинации каталога (по умолчанию 0).</td>
                    </tr>
                  )}

                  {activeAction === 'add' && (
                    <>
                      <tr className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">service</td>
                        <td className="py-2.5 px-4 text-muted-foreground">int</td>
                        <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                        <td className="py-2.5 px-4 text-muted-foreground">ID тарифа (например, из списка услуг).</td>
                      </tr>
                      <tr className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">link</td>
                        <td className="py-2.5 px-4 text-muted-foreground">string</td>
                        <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Ссылка на объект продвижения (профиль, пост, канал).</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">quantity</td>
                        <td className="py-2.5 px-4 text-muted-foreground">int</td>
                        <td className="py-2.5 px-4 text-rose-500 font-bold">Да</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Количество продвижения (в рамках мин/макс лимитов).</td>
                      </tr>
                    </>
                  )}

                  {activeAction === 'status' && (
                    <>
                      <tr className="border-b border-border/40">
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">order</td>
                        <td className="py-2.5 px-4 text-muted-foreground">int</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Част.</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Порядковый ID заказа для одиночной проверки.</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">orders</td>
                        <td className="py-2.5 px-4 text-muted-foreground">string</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Част.</td>
                        <td className="py-2.5 px-4 text-muted-foreground">Список ID через запятую для пакетной проверки (макс 100).</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Code Blocks (CURL, Node.js, JSON responses) */}
        <div className="space-y-4">
          
          {/* CURL Command */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>CURL Запрос</span>
              <button
                onClick={() => copyCode(curlCode[activeAction], `curl-${activeAction}`)}
                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none"
              >
                {copiedTextId === `curl-${activeAction}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTextId === `curl-${activeAction}` ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto border border-zinc-800">
              {curlCode[activeAction]}
            </div>
          </div>

          {/* Node.js script */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>Node.js Fetch</span>
              <button
                onClick={() => copyCode(nodeCode[activeAction], `node-${activeAction}`)}
                className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer select-none"
              >
                {copiedTextId === `node-${activeAction}` ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedTextId === `node-${activeAction}` ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto border border-zinc-800">
              {nodeCode[activeAction]}
            </div>
          </div>

          {/* JSON Response Model */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold text-muted-foreground">
              <span>Пример ответа (JSON)</span>
            </div>
            <div className="bg-zinc-950 text-zinc-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed shadow-inner overflow-x-auto border border-zinc-800">
              {jsonResponse[activeAction]}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

```

---

### 📄 Файл 42 из 49: `src/components/dashboard/settings/api/ApiReferenceDocsData.ts`

```ts
export const getCurlCode = (host: string, displayKey: string) => ({
  services: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=services"`,
  
  add: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=add" \\
  -d "service=15" \\
  -d "link=https://t.me/durov" \\
  -d "quantity=100"`,
  
  status: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=status" \\
  -d "order=104"`,
  
  balance: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=balance"`
});

export const getNodeCode = (host: string, displayKey: string) => ({
  services: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'services'
  })
})
.then(res => res.json())
.then(console.log);`,
  
  add: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'add',
    service: '15',
    link: 'https://t.me/durov',
    quantity: '100'
  })
})
.then(res => res.json())
.then(console.log);`,
  
  status: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'status',
    order: '104'
  })
})
.then(res => res.json())
.then(console.log);`,
  
  balance: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'balance'
  })
})
.then(res => res.json())
.then(console.log);`
});

export const jsonResponse = {
  services: `[
  {
    "service": 15,
    "name": "Подписчики Telegram (Эконом)",
    "type": "Default",
    "category": "Подписчики",
    "rate": "0.0300",
    "min": 10,
    "max": 50000
  },
  {
    "service": 18,
    "name": "Просмотры постов Telegram (Быстрые)",
    "type": "Default",
    "category": "Просмотры",
    "rate": "0.0020",
    "min": 100,
    "max": 1000000
  }
]`,
  
  add: `{
  "order": 1284
}`,
  
  status: `{
  "charge": "0.3000",
  "start_count": "0",
  "status": "In progress",
  "remains": "85",
  "currency": "RUB"
}`,
  
  balance: `{
  "balance": "1540.2300",
  "currency": "RUB"
}`
};

```

---

### 📄 Файл 43 из 49: `src/components/dashboard/settings/B2bWebhookCard.tsx`

```tsx
export { default } from '@/components/settings/B2bWebhookCard';
export * from '@/components/settings/B2bWebhookCard';

```

---

### 📄 Файл 44 из 49: `src/components/dashboard/settings/CompanyRequisitesCard.tsx`

```tsx
export { default } from '@/components/settings/CompanyRequisitesCard';
export * from '@/components/settings/CompanyRequisitesCard';

```

---

### 📄 Файл 45 из 49: `src/components/dashboard/settings/Consent152FzCard.tsx`

```tsx
export { default } from '@/components/settings/Consent152FzCard';
export * from '@/components/settings/Consent152FzCard';

```

---

### 📄 Файл 46 из 49: `src/components/dashboard/settings/DeleteAccountCard.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { deleteAccountAction } from '@/actions/auth/delete-account';
import { ShieldAlert, Trash2, Eye, EyeOff, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteAccountCardProps {
  hasPassword: boolean;
}

export default function DeleteAccountCard({ hasPassword }: DeleteAccountCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  
  // Modal Form Fields
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const openModal = () => {
    setConfirmText('');
    setPassword('');
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isPending) return;
    setIsOpen(false);
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();

    if (confirmText !== 'УДАЛИТЬ') {
      toast.error('Необходимо ввести слово "УДАЛИТЬ"');
      return;
    }

    if (hasPassword && !password) {
      toast.error('Пожалуйста, введите ваш пароль');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('confirmText', confirmText);
        if (password) {
          formData.append('password', password);
        }

        const res = await deleteAccountAction(null, formData);
        if (!res.success) {
          toast.error(res.error || 'Ошибка при удалении аккаунта');
          return;
        }

        toast.success('Аккаунт успешно удален. Прощайте!');
        // Redirect to homepage after a brief moment
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        toast.error('Произошла ошибка при отправке запроса');
      }
    });
  };

  return (
    <div className="bg-card border border-destructive/20 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md hover:border-destructive/40">
      <div className="px-5 py-4 border-b border-destructive/10 flex items-center gap-2.5 bg-destructive/5">
        <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
          <Trash2 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-semibold text-destructive text-sm">
            Опасная зона
          </h2>
          <p className="text-[10px] text-muted-foreground font-semibold">
            Действия по безвозвратному удалению вашего личного кабинета
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-4 flex gap-3 text-xs text-destructive/85">
          <ShieldAlert className="w-5 h-5 shrink-0 text-destructive/90" />
          <div className="space-y-1.5">
            <p className="font-bold text-foreground">Внимание при удалении:</p>
            <p className="leading-relaxed">
              Удаление аккаунта приведет к мгновенному выходу со всех ваших устройств. 
              Вы больше не сможете войти, пополнить баланс или создавать новые заказы.
              Ваши исторические данные и транзакции сохраняются для бухгалтерии и аудита в соответствии с законодательством РФ.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground font-semibold max-w-[70%] leading-relaxed">
            Мы очень сожалеем, что вы уходите. Подтвердите удаление вашего аккаунта.
          </div>
          <Button
            type="button"
            intent="destructive"
            size="sm"
            isAnimated={true}
            onClick={openModal}
            className="rounded-xl shrink-0 w-full sm:w-auto font-black px-6 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all duration-150"
          >
            Удалить аккаунт
          </Button>
        </div>
      </div>

      {/* Premium Verification Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-content1 border border-border/80 rounded-[2rem] w-full max-w-md p-6 shadow-2xl space-y-5 animate-in scale-in duration-300 relative mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={closeModal}
              disabled={isPending}
              className="absolute right-5 top-5 text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">Подтвердите удаление</h3>
                <p className="text-[10px] text-muted-foreground font-semibold">Это действие необратимо</p>
              </div>
            </div>

            <form onSubmit={handleDelete} className="space-y-4">
              {/* Type confirmation block */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Введите слово <span className="text-destructive font-black">УДАЛИТЬ</span> для подтверждения
                </label>
                <input
                  type="text"
                  required
                  disabled={isPending}
                  placeholder="УДАЛИТЬ"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 bg-background/50 hover:bg-background/80 transition-all duration-200 font-bold tracking-wider"
                />
              </div>

              {/* Password verify block (if user has set a password) */}
              {hasPassword && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Введите ваш пароль
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isPending}
                      placeholder="Ваш текущий пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isPending}
                  className="flex-1 h-11 rounded-xl bg-content2 hover:bg-content3 text-foreground font-bold text-xs transition-all duration-200 border border-border/50 disabled:opacity-50"
                >
                  Отмена
                </button>
                
                <Button
                  type="submit"
                  intent="destructive"
                  size="sm"
                  disabled={isPending || confirmText !== 'УДАЛИТЬ' || (hasPassword && !password)}
                  className="flex-1 h-11 rounded-xl font-black text-xs hover:shadow-lg transition-all duration-200 shadow-sm"
                >
                  {isPending ? 'Удаление...' : 'Удалить аккаунт'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

```

---

### 📄 Файл 47 из 49: `src/components/dashboard/settings/PasswordCard.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { setPasswordAction, changePasswordAction } from '@/actions/auth/password-settings';
import { Lock, Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function PasswordCard({ hasPassword, canResetPassword = false }: { hasPassword: boolean, canResetPassword?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  
  // Form fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      toast.error('Пароль должен содержать не менее 8 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('password', newPassword);
        formData.append('confirmPassword', confirmPassword);
        
        if (hasPassword) {
          formData.append('currentPassword', currentPassword);
          formData.append('newPassword', newPassword);
          
          const res = await changePasswordAction(formData);
          if (!res.success) {
            toast.error(res.error || 'Ошибка при изменении пароля');
            return;
          }
          toast.success('Пароль успешно обновлен!');
        } else {
          const res = await setPasswordAction(formData);
          if (!res.success) {
            toast.error(res.error || 'Ошибка при установке пароля');
            return;
          }
          toast.success('Пароль успешно установлен!');
        }

        // Reset fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      } catch (error: any) {
        toast.error('Не удалось обновить пароль. Пожалуйста, попробуйте еще раз.');
      }
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5 bg-muted/20">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <KeyRound className="w-4 h-4" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">
            {canResetPassword ? 'Сброс пароля' : hasPassword ? 'Смена пароля' : 'Защита аккаунта'}
          </h2>
          <p className="text-[10px] text-muted-foreground">
            {canResetPassword ? 'Установите новый пароль' : hasPassword ? 'Регулярно обновляйте пароль для безопасности' : 'Установите пароль для быстрого входа без почты'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {!hasPassword && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5 flex gap-3 text-xs text-primary/90">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Для вашего аккаунта еще не задан постоянный пароль. 
              Установите его сейчас, чтобы заходить <strong>по паролю</strong> в один клик.
            </div>
          </div>
        )}

        <div className="space-y-3.5">
          {hasPassword && !canResetPassword && (
            <div className="space-y-1">
              <label htmlFor="currentPassword" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Текущий пароль
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label htmlFor="newPassword" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {hasPassword ? 'Новый пароль' : 'Пароль'}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Минимум 8 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 pr-10 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
                />
                {!hasPassword && (
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Подтверждение пароля
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Повторите новый пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full text-sm border border-border/80 rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 bg-background/50 hover:bg-background/80 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Check className="w-3.5 h-3.5 text-success shrink-0" />
            Минимум 8 символов, цифры и буквы
          </div>
          <Button
            type="submit"
            intent="primary"
            size="sm"
            isAnimated={true}
            disabled={isPending || !newPassword || !confirmPassword || (hasPassword && !canResetPassword && !currentPassword)}
            className="rounded-xl shrink-0 w-full sm:w-auto font-semibold px-6 shadow-sm"
          >
            {isPending ? 'Сохранение...' : canResetPassword ? 'Сохранить новый пароль' : hasPassword ? 'Обновить пароль' : 'Установить пароль'}
          </Button>
        </div>
      </form>
    </div>
  );
}

```

---

### 📄 Файл 48 из 49: `src/components/dashboard/settings/TelegramCard.tsx`

```tsx
'use client';

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Link from 'next/link';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface TelegramCardProps {
  telegramId: string | null;
}

export default function TelegramCard({ telegramId }: TelegramCardProps) {
  const isBound = !!telegramId;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div className="flex items-start gap-4">
          {/* Telegram Premium Color Avatar */}
          <div className="w-12 h-12 rounded-xl bg-[#24A1DE]/10 text-[#24A1DE] flex items-center justify-center shrink-0">
            <svg 
              viewBox="0 0 24 24" 
              className="w-6 h-6 fill-current" 
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-2 .12-5.63 2.57-.53.36-1 .54-1.43.53-.47-.01-1.37-.27-2.04-.49-.82-.27-1.47-.41-1.42-.87.03-.24.37-.49 1.02-.74 3.99-1.73 6.66-2.88 8-3.43 3.8-1.56 4.59-1.83 5.11-1.84.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.16-.02.22z"/>
            </svg>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground text-base">Интеграция с Telegram</h3>
              {isBound ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 uppercase">
                  <CheckCircle2 className="w-3 h-3" />
                  Подключено
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/10 uppercase">
                  <AlertCircle className="w-3 h-3" />
                  Не привязано
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              {isBound
                ? 'Ваш Telegram привязан к аккаунту SMMplan. Уведомления об ответах техподдержки дублируются в чат с ботом, а лимиты на пополнение баланса сняты.'
                : 'Привяжите Telegram-аккаунт для моментального получения уведомлений об ответах техподдержки в чат с ботом и снятия лимитов на оплату банковскими картами (без передачи телефонного номера).'}
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0 mt-3 sm:mt-0">
          {isBound ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground bg-muted px-4 py-2.5 rounded-xl border border-border/60 cursor-default h-[44px]">
                <span>tg: {telegramId.substring(0, 3)}****</span>
              </div>
              <a
                href="/api/support/telegram"
                className="inline-flex items-center justify-center gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-xl shadow-sm hover:shadow transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px]"
                aria-label="Написать в Telegram-бот"
              >
                <Send className="w-4 h-4" />
                Написать в бот
              </a>
            </div>
          ) : (
            <a
              href="/api/support/telegram"
              className="inline-flex items-center gap-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-xl shadow-sm hover:shadow transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px]"
              aria-label="Привязать Telegram-аккаунт"
            >
              <Send className="w-4 h-4" />
              Привязать Telegram
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

```

---

### 📄 Файл 49 из 49: `src/components/dashboard/transactions/TransactionsClient.tsx`

```tsx
'use client';
// audit-disable STR-002

import React, { useState, useMemo } from 'react';
import { 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Receipt, 
  Search, 
  Copy, 
  Check, 
  Printer, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  amountCents: number;
  amountRub: number;
  reason: string;
  status: string;
  idempotencyKey: string | null;
  transactionType: string;
  createdAt: string;
}

interface MobileTransactionListProps {
  entries: Transaction[];
  isAccountantMode: boolean;
  formatDate: (isoString: string, full?: boolean) => string;
  handleCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function MobileTransactionList({
  entries,
  isAccountantMode,
  formatDate,
  handleCopy,
  copiedId,
}: MobileTransactionListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="md:hidden divide-y divide-border/40 select-none">
      {entries.map((item) => {
        const isCredit = item.amountRub > 0;
        const isRefund = item.transactionType === 'REFUND';
        const typeLabel = isRefund ? 'Возврат' : isCredit ? 'Пополнение' : 'Списание';
        const typeColor = isRefund ? 'text-info bg-info/10 border-info/20' 
          : isCredit ? 'text-success-text bg-success/10 border-success/20' 
          : 'text-destructive bg-destructive/10 border-destructive/20';

        if (!isAccountantMode) {
          return (
            <div
              key={item.id}
              className="p-4 space-y-2.5"
            >
              {/* Header: Type Badge & Status */}
              <div className="flex justify-between items-center">
                <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border tracking-wider ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md ${
                  item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                  : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {item.status === 'APPROVED' ? 'Успешно' : item.status === 'PENDING' ? 'В обработке' : 'Отклонено'}
                </span>
              </div>

              {/* Description */}
              <div className="text-xs font-semibold text-foreground leading-normal">
                {item.reason}
              </div>

              {/* Footer: Date & Amount */}
              <div className="flex justify-between items-center pt-1 text-xs">
                <span className="text-muted-foreground font-semibold tabular-nums">
                  {formatDate(item.createdAt)}
                </span>
                <span className={`font-bold tabular-nums text-sm ${isCredit ? 'text-success' : 'text-destructive'}`}>
                  {isCredit ? '+' : ''}{item.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                </span>
              </div>
            </div>
          );
        } else {
          // Accountant mode card
          return (
            <div
              key={item.id}
              className="p-4 space-y-3 font-mono text-[10px]"
            >
              {/* CUID Row */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">ID:</span>
                  <span className="text-[10px] text-foreground select-all font-semibold max-w-[120px] truncate" title={item.id}>
                    {item.id}
                  </span>
                  <button
                    onClick={() => handleCopy(item.id, `id-mob-${item.id}`)}
                    className="w-11 h-11 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                    title="Скопировать Transaction ID"
                  >
                    {copiedId === `id-mob-${item.id}` ? (
                      <Check className="w-3 h-3 text-success animate-in zoom-in" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded ${
                  item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                  : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {item.status}
                </span>
              </div>

              {/* Precise ISO Time & Type */}
              <div className="grid grid-cols-2 gap-2 text-[9px] border-b border-border/20 pb-2">
                <div>
                  <div className="text-muted-foreground font-bold">Precise Time</div>
                  <div className="text-foreground mt-0.5">{formatDate(item.createdAt, true)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-bold">DB Type</div>
                  <div className="text-foreground mt-0.5">{item.transactionType}</div>
                </div>
              </div>

              {/* Idempotency Key */}
              <div className="text-[9px] border-b border-border/20 pb-2">
                <div className="text-muted-foreground font-bold">Idempotency Key</div>
                <div className="mt-0.5">
                  {item.idempotencyKey ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-foreground select-all max-w-[180px] truncate" title={item.idempotencyKey}>
                        {item.idempotencyKey}
                      </span>
                      <button
                        onClick={() => handleCopy(item.idempotencyKey!, `idmp-mob-${item.id}`)}
                        className="w-11 h-11 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                        title="Скопировать Idempotency Key"
                      >
                        {copiedId === `idmp-mob-${item.id}` ? (
                          <Check className="w-3 h-3 text-success" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <div className="text-[9px] text-muted-foreground font-bold">Reason</div>
                <div className="text-foreground font-semibold mt-0.5 leading-relaxed">{item.reason}</div>
              </div>

              {/* Raw Cents */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-bold">Raw Cents</span>
                <span className={`font-bold text-xs ${isCredit ? 'text-success-text' : 'text-destructive'}`}>
                  {isCredit ? '+' : ''}{item.amountCents.toLocaleString('ru-RU')} коп.
                </span>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}

interface TransactionsClientProps {
  initialEntries: Transaction[];
  userEmail: string;
}

export function TransactionsClient({ initialEntries, userEmail }: TransactionsClientProps) {
  const [entries] = useState<Transaction[]>(initialEntries);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'SPENT' | 'REFUND'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  
  // Layout Profile Toggle
  const [isAccountantMode, setIsAccountantMode] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Скопировано в буфер обмена!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Apply Dynamic Client-Side Filtering
  const filteredEntries = useMemo(() => {
    return entries.filter(item => {
      // Search text filter
      const matchesSearch = 
        item.reason.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase()) ||
        (item.idempotencyKey && item.idempotencyKey.toLowerCase().includes(search.toLowerCase()));

      // Operation Type filter
      let matchesType = true;
      if (typeFilter === 'DEPOSIT') {
        matchesType = item.amountRub > 0 && (item.transactionType === 'PAYMENT' || item.transactionType === 'COMPENSATION');
      } else if (typeFilter === 'SPENT') {
        matchesType = item.amountRub < 0 && item.transactionType === 'PAYMENT';
      } else if (typeFilter === 'REFUND') {
        matchesType = item.transactionType === 'REFUND' || (item.amountRub > 0 && item.transactionType === 'REFUND');
      }

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const itemDate = new Date(item.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - itemDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (dateFilter === 'TODAY') {
          matchesDate = itemDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'WEEK') {
          matchesDate = diffDays <= 7;
        } else if (dateFilter === 'MONTH') {
          matchesDate = diffDays <= 30;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [entries, search, typeFilter, dateFilter]);

  // 2. Calculations for Financial KPI Dashboard
  const stats = useMemo(() => {
    let totalDeposited = 0; // Total added
    let totalSpent = 0;     // Total debited
    let totalRefunds = 0;   // Total refunded

    entries.forEach(item => {
      if (item.status !== 'APPROVED') return; // only calculate approved entries

      if (item.transactionType === 'REFUND') {
        totalRefunds += Math.abs(item.amountRub);
      } else if (item.amountRub > 0) {
        totalDeposited += item.amountRub;
      } else if (item.amountRub < 0) {
        totalSpent += Math.abs(item.amountRub);
      }
    });

    return {
      totalDeposited,
      totalSpent,
      totalRefunds,
      balanceDiff: totalDeposited - totalSpent + totalRefunds
    };
  }, [entries]);

  // Format Helper
  const formatDate = (isoString: string, full = false) => {
    const d = new Date(isoString);
    if (full) return d.toLocaleString('ru-RU');
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* ── SECTION 1: FINANCIAL KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        {/* KPI: Deposits */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-success/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Всего зачислено</span>
            <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {stats.totalDeposited.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Пополнения через кассу</p>
        </div>

        {/* KPI: Spent */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Всего потрачено</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {stats.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Списания за услуги продвижения</p>
        </div>

        {/* KPI: Refunds */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-violet-600/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Возвращено</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {stats.totalRefunds.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Компенсации при отменах</p>
        </div>

        {/* KPI: Ledger Sum (Credit/Debit Balance check) */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Итог движения</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black tabular-nums ${stats.balanceDiff >= 0 ? 'text-success' : 'text-destructive'}`}>
            {stats.balanceDiff >= 0 ? '+' : ''}{stats.balanceDiff.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Сальдо балансового счета</p>
        </div>
      </div>

      {/* ── PRINT-ONLY LEDGER REPORT BANNER ── */}
      <div className="hidden print:block border-b-2 border-border pb-6 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">SMMplan Financial Statement</h2>
            <p className="text-sm text-muted-foreground mt-1">Клиент: <span className="font-semibold text-foreground">{userEmail}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Дата генерации: {new Date().toLocaleString('ru-RU')}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-bold">Итоги сводки:</div>
            <div>Пополнено: {stats.totalDeposited.toFixed(2)} ₽</div>
            <div>Потрачено: {stats.totalSpent.toFixed(2)} ₽</div>
            <div>Возвращено: {stats.totalRefunds.toFixed(2)} ₽</div>
            <div className="font-bold border-t border-border mt-1 pt-0.5">Сальдо: {stats.balanceDiff.toFixed(2)} ₽</div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: INTERACTIVE CONTROLS (FILTERS + PROFILE TOGGLE) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-4 shadow-sm print:hidden">
        
        {/* Left: Type and Date Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          
          {/* Type filters */}
          <div className="flex bg-muted p-1 rounded-xl border border-border/40 select-none w-full sm:w-auto shrink-0">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'ALL' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setTypeFilter('DEPOSIT')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'DEPOSIT' ? 'bg-success text-success-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Пополнения
            </button>
            <button
              onClick={() => setTypeFilter('SPENT')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'SPENT' ? 'bg-background text-foreground shadow-sm border border-rose-500/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Списания
            </button>
            <button
              onClick={() => setTypeFilter('REFUND')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'REFUND' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Возвраты
            </button>
          </div>

          {/* Date Selector */}
          <select
            value={dateFilter}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="h-11 w-full sm:w-auto bg-content2 border border-border/60 rounded-xl px-3 py-2 text-sm font-semibold text-foreground outline-none focus:border-primary cursor-pointer select-none"
            aria-label="Фильтр по дате"
          >
            <option value="ALL">За всё время</option>
            <option value="TODAY">За сегодня</option>
            <option value="WEEK">За последние 7 дней</option>
            <option value="MONTH">За последние 30 дней</option>
          </select>
        </div>

        {/* Right: Search & Profile Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1 md:w-60 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск по ID или причине..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-muted border border-border/60 rounded-xl text-sm font-medium placeholder:text-muted-foreground outline-none focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Unofficial Statement Printer Button */}
          <button
            onClick={handlePrint}
            className="h-11 px-4 flex items-center justify-center gap-2 bg-content2 border border-border/60 hover:bg-content3 rounded-xl text-sm font-bold text-foreground transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Распечатать финансовый отчет"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Печать</span>
          </button>

          {/* Dual-Mode Accountant Toggle */}
          <div className="flex items-center gap-2 bg-muted/60 border border-border/40 px-3 h-11 rounded-xl select-none">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Бухгалтер</span>
            <button
              onClick={() => setIsAccountantMode(!isAccountantMode)}
              className="h-11 flex items-center text-primary hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              title="Переключить в режим бухгалтера"
              aria-label="Переключить в режим бухгалтера"
            >
              {isAccountantMode ? (
                <ToggleRight className="w-8 h-8 text-primary fill-current" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: TRANSACTIONS GRID/TABLE ── */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
        
        {/* Simple User Mode (Clean layouts) */}
        {!isAccountantMode ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm" aria-label="История транзакций (простой вид)">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-foreground/75 bg-muted/20 border-b border-border/40 select-none">
                    <th className="py-4 px-5 font-bold">Дата операции</th>
                    <th className="py-4 px-5 font-bold">Тип</th>
                    <th className="py-4 px-5 font-bold">Описание / Причина</th>
                    <th className="py-4 px-5 font-bold text-right">Сумма (₽)</th>
                    <th className="py-4 px-5 font-bold text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((item) => {
                    const isCredit = item.amountRub > 0;
                    const isRefund = item.transactionType === 'REFUND';
                    const typeLabel = isRefund ? 'Возврат' : isCredit ? 'Пополнение' : 'Списание';
                    const typeColor = isRefund ? 'text-info bg-info/10 border-info/20' 
                      : isCredit ? 'text-success-text bg-success/10 border-success/20' 
                      : 'text-destructive bg-destructive/10 border-destructive/20';

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors last:border-0"
                      >
                        {/* Date */}
                        <td className="py-3.5 px-5 text-xs text-muted-foreground font-semibold tabular-nums whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>
                        
                        {/* Badge type */}
                        <td className="py-3.5 px-5">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border tracking-wider select-none ${typeColor}`}>
                            {typeLabel}
                          </span>
                        </td>

                        {/* Decoded Reason */}
                        <td className="py-3.5 px-5 text-xs font-semibold text-foreground leading-normal max-w-[320px]">
                          {item.reason}
                        </td>

                        {/* Amount with colored sign */}
                        <td className={`py-3.5 px-5 text-right font-bold tabular-nums text-sm whitespace-nowrap ${isCredit ? 'text-success' : 'text-destructive'}`}>
                          {isCredit ? '+' : ''}{item.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-5 text-center select-none">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md ${
                            item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                            : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}>
                            {item.status === 'APPROVED' ? 'Успешно' : item.status === 'PENDING' ? 'В обработке' : 'Отклонено'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MobileTransactionList
              entries={filteredEntries}
              isAccountantMode={false}
              formatDate={formatDate}
              handleCopy={handleCopy}
              copiedId={copiedId}
            />
          </>
        ) : (
          <>
            {/* Meticulous Accountant Mode (High Density Database properties) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs" aria-label="История транзакций (бухгалтерский аудит)">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-widest text-foreground/75 bg-muted/30 border-b border-border/40 select-none">
                    <th className="py-4 px-4 font-bold">ISO Время</th>
                    <th className="py-4 px-4 font-bold">Transaction CUID</th>
                    <th className="py-4 px-4 font-bold">Копейки (Raw Cents)</th>
                    <th className="py-4 px-4 font-bold">Тип в БД</th>
                    <th className="py-4 px-4 font-bold">Идемпотентность (Idempotency Key)</th>
                    <th className="py-4 px-4 font-bold">Обоснование (Reason)</th>
                    <th className="py-4 px-4 font-bold text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((item) => {
                    const isCredit = item.amountRub > 0;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/40 hover:bg-muted/20 font-mono transition-colors last:border-0"
                      >
                        {/* Precise Timestamp */}
                        <td className="py-3 px-4 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">
                          {formatDate(item.createdAt, true)}
                        </td>

                        {/* Transaction CUID with Clipboard action */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-foreground select-all font-semibold max-w-[80px] truncate" title={item.id}>
                              {item.id}
                            </span>
                            <button
                              onClick={() => handleCopy(item.id, `id-${item.id}`)}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                              title="Скопировать Transaction ID"
                            >
                              {copiedId === `id-${item.id}` ? (
                                <Check className="w-3 h-3 text-success animate-in zoom-in" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Raw cents count */}
                        <td className={`py-3 px-4 text-left font-bold text-[11px] whitespace-nowrap ${isCredit ? 'text-success-text' : 'text-destructive'}`}>
                          {isCredit ? '+' : ''}{item.amountCents.toLocaleString('ru-RU')} коп.
                        </td>

                        {/* DB Enum type */}
                        <td className="py-3 px-4 text-foreground font-extrabold text-[10px]">
                          {item.transactionType}
                        </td>

                        {/* Idempotency Key */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.idempotencyKey ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground select-all max-w-[90px] truncate" title={item.idempotencyKey}>
                                {item.idempotencyKey}
                              </span>
                              <button
                                onClick={() => handleCopy(item.idempotencyKey!, `idmp-${item.id}`)}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                                title="Скопировать Idempotency Key"
                              >
                                {copiedId === `idmp-${item.id}` ? (
                                  <Check className="w-3 h-3 text-success" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Raw Reason string */}
                        <td className="py-3 px-4 font-semibold text-foreground max-w-[200px] truncate" title={item.reason}>
                          {item.reason}
                        </td>

                        {/* Precise raw Status */}
                        <td className="py-3 px-4 text-center select-none">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded ${
                            item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                            : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MobileTransactionList
              entries={filteredEntries}
              isAccountantMode={true}
              formatDate={formatDate}
              handleCopy={handleCopy}
              copiedId={copiedId}
            />
          </>
        )}

        {/* Empty state container */}
        {filteredEntries.length === 0 && (
          <div className="py-16 text-center select-none print:hidden">
            <div className="text-4xl mb-3">💸</div>
            <h4 className="text-sm font-extrabold text-foreground">История операций пуста</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed mt-1">
              Здесь будут отображаться пополнения счета, оплаты тарифов продвижения и отмены заказов.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

```

---

