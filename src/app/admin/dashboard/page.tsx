import { accountingService } from '@/services/financial/accounting.service';
import { adminOrderService } from '@/services/admin/order.service';
import { adminUserService } from '@/services/admin/user.service';
import { adminTicketService } from '@/services/admin/ticket.service';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { unstable_cache } from 'next/cache';
import nextDynamic from 'next/dynamic';

const getCachedHealthData = unstable_cache(
  async () => {
    return db.service.groupBy({
      by: ['isQuarantined', 'cooldownReason'],
      _count: true,
      where: {
        OR: [
          { isQuarantined: true },
          { cooldownReason: 'ZOMBIE_AUTO_DISABLED' },
          { cooldownUntil: { gt: new Date() }, cooldownReason: { not: 'ZOMBIE_AUTO_DISABLED' } },
        ]
      }
    });
  },
  ['admin_dashboard_catalog_health'],
  { revalidate: 60, tags: ['catalog', 'health'] }
);

const OrdersChart = nextDynamic(() => import('./orders-chart').then(mod => mod.OrdersChart), {
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-card/50 border border-border flex items-center justify-center text-xs text-muted-foreground">Загрузка графиков...</div>,
});
import { 
  Check, 
  Clock, 
  ChevronDown, 
  Bell, 
  Settings, 
  Home, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Users, 
  Layers, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';
import Link from 'next/link';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { OPERATIONS_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { RecentAuditTable } from './recent-audit-table';
import { ProviderLiquidityWidget } from './ProviderLiquidityWidget';
import { WebhookLatencyWidget } from './WebhookLatencyWidget';
import { FinancialEscalationWidget } from './FinancialEscalationWidget';
import { TopSpendersWidget } from './TopSpendersWidget';
import { RecentOrdersFeedWidget } from './RecentOrdersFeedWidget';
import { TopServicesWidget } from './TopServicesWidget';
import { PaymentGatewaysWidget } from './PaymentGatewaysWidget';
import { RefundMonitorWidget } from './RefundMonitorWidget';
import { StormRadarWidget } from './StormRadarWidget';
import { stormDetectorService } from '@/services/admin/storm-detector.service';
import { CollapsibleWaveChart } from './CollapsibleWaveChart';
import { PeriodSelector } from './PeriodSelector';
import { ExecutiveAiDigestCard } from '@/components/admin/dashboard/executive-ai-digest-card';
import { formatEta } from '@/utils/format-eta';
import { formatKopecks } from '@/utils/format-kopecks';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tenant?: string }>;
}) {
  const session = await verifySession();
  const user = session ? await db.user.findUnique({
    where: { id: session.userId },
    include: {
      staffRole: {
        include: { permissions: true }
      }
    }
  }) : null;

  const resolvedSearchParams = await searchParams;
  const period = resolvedSearchParams.period || 'all';
  const { resolveAdminTenantContext } = await import('@/utils/admin-tenant');
  const resolvedTenant = resolveAdminTenantContext(user, resolvedSearchParams.tenant);
  const tenantFilter = resolvedTenant !== 'all' ? resolvedTenant : undefined;

  // Calculate start and end date boundaries in local timezone
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let step: 'hour' | 'day' | 'week' | 'month';

  if (period === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    step = 'hour';
  } else if (period === 'yesterday') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    step = 'hour';
  } else if (period === '7d') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    step = 'day';
  } else if (period === '30d') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
    step = 'day';
  } else {
    // all time
    const oldestOrder = await db.order.findFirst({ orderBy: { createdAt: 'asc' } });
    startDate = oldestOrder ? oldestOrder.createdAt : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) {
      step = 'hour';
    } else if (diffDays <= 60) {
      step = 'day';
    } else if (diffDays <= 365) {
      step = 'week';
    } else {
      step = 'month';
    }
  }

  const filterStart = period === 'all' ? undefined : startDate;
  const filterEnd = period === 'all' ? undefined : endDate;

  const [
    metrics,
    orderStats,
    userStats,
    ticketStats,
    catalogStats,
    recentAudit,
    timeseries,
    topSpenders,
    recentOrders,
    topServices,
    gatewayStats,
    refundStats,
    stormReport
  ] = await Promise.all([
    accountingService.getMetrics(filterStart, filterEnd, tenantFilter),
    adminOrderService.getOrderStats(filterStart, filterEnd, tenantFilter),
    adminUserService.getUserStats(filterStart, filterEnd, tenantFilter),
    adminTicketService.getTicketStats(filterStart, filterEnd, tenantFilter),
    adminCatalogService.getCatalogStats(tenantFilter, filterStart, filterEnd),
    db.adminAuditLog.findMany({
      where: filterStart && filterEnd ? { createdAt: { gte: filterStart, lte: filterEnd } } : {},
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    adminOrderService.getOrdersTimeseries(startDate, endDate, step, tenantFilter),
    adminUserService.getTopSpenders(6, tenantFilter),
    adminOrderService.getRecentOrders(6, tenantFilter),
    adminOrderService.getTopServices(6, filterStart, filterEnd, tenantFilter),
    accountingService.getGatewayBreakdown(filterStart, filterEnd, tenantFilter),
    adminOrderService.getRefundAndFailureStats(filterStart, filterEnd, tenantFilter),
    stormDetectorService.auditServiceStorms({ windowHours: 72, tenantId: tenantFilter }),
  ]);

  const { getRolePermissions } = await import('@/lib/permissions');
  const perms = getRolePermissions(user?.role, user?.staffRole?.permissions);

  const canSeeFinancials = perms.canViewFinancials;
  const canSeeProviders = perms.canViewLiquidity;
  const canSeeAnalytics = perms.canAccessExecutive;
  const canSeeSettings = perms.canViewAuditLogs;
  const canEditAnalytics = user?.role === 'OWNER' || user?.role === 'ADMIN' || Boolean(
    user?.staffRole?.permissions?.some((p) => p.section.toUpperCase() === 'ANALYTICS' && p.canEdit)
  );
  const canEditSettings = perms.canUseKillSwitch;

  const revenueGross = metrics.revenueGross;
  const profitNet = metrics.profitNet;
  let marginPercentage = metrics.marginPercentage;
  const totalLiability = userStats.totalLiability;
  
  const oStats = { ...orderStats };
  const uStats = { ...userStats };
  const cStats = { ...catalogStats };
  const tStats = { ...ticketStats };

  if (isNaN(marginPercentage) || !isFinite(marginPercentage)) {
    marginPercentage = 0;
  }

  const netPositionBigInt = BigInt(revenueGross) - BigInt(totalLiability);
  const netPositionStr = formatKopecks(netPositionBigInt);

  const profitMargin = metrics.revenueNet > 0 ? (metrics.profitNet / metrics.revenueNet) * 100 : 0;
  const successOrderRate = oStats.total > 0 ? ((oStats.completed / oStats.total) * 100).toFixed(1) : '100';

  return (
    <div className="space-y-5 w-full max-w-full pb-10 select-none">
      
      {/* ── HEADER WITH SITE (TENANT) SELECTOR & PERIOD SELECTOR ── */}
      <AdminTabbedHeader
        icon={Home}
        title={`Панель управления · ${
          user?.role === 'OWNER'
            ? 'Владелец'
            : user?.role === 'SUPPORT' || user?.role === 'OPERATOR'
            ? 'Командный центр поддержки'
            : user?.role === 'MANAGER'
            ? 'Менеджер'
            : 'Администратор'
        }`}
        description={
          user?.role === 'SUPPORT' || user?.role === 'OPERATOR'
            ? 'Оперативный мониторинг потока заказов, контроль очереди тикетов и радар сбоев.'
            : 'Оперативный пульс платформы, динамика потоков заказов и финансовый мониторинг.'
        }
        tabs={OPERATIONS_TABS}
        onboardingKey="dashboard"
        onboarding={ONBOARDING_CONFIGS.dashboard}
        currentTenant={tenantFilter}
        action={<PeriodSelector period={period} />}
      />

      <SystemHealthBanner />

      {/* ── 1. HERO SECTION: COLLAPSIBLE FULL-WIDTH WAVE CHART ── */}
      <CollapsibleWaveChart data={timeseries} step={step} />

      {/* ── 2. CRITICAL RADAR: SOCIAL NETWORK STORMS & ALGORITHM WATCHDOG (SHADOW MODE) ── */}
      <StormRadarWidget report={stormReport} />

      {/* ── 3. KPI STRIP: 4 BENTO CARDS ── */}
      {canSeeFinancials ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Валовый оборот */}
          <Link
            href="/admin/finance"
            className="bg-card text-card-foreground border border-border/70 hover:border-primary/50 hover:shadow-md rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-2 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Валовый оборот (GMV)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Поступления
              </span>
            </div>
            <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight font-mono">
              {formatKopecks(revenueGross)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
              <span>Эквайринг: {formatKopecks(metrics.gatewayFees)}</span>
              <span className="font-semibold text-foreground">100%</span>
            </div>
          </Link>

          {/* Card 2: Чистая маржа */}
          <Link
            href="/admin/finance"
            className="bg-card text-card-foreground border border-border/70 hover:border-primary/50 hover:shadow-md rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-2 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Чистая маржа</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                profitMargin >= 30
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
              }`}>
                {profitMargin.toFixed(1)}% маржа
              </span>
            </div>
            <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight font-mono">
              {formatKopecks(profitNet)}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
              <span>Себестоимость: {formatKopecks(metrics.cogs)}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{profitMargin.toFixed(0)}%</span>
            </div>
          </Link>

          {/* Card 3: Поток заказов */}
          <Link
            href="/admin/orders"
            className="bg-card text-card-foreground border border-border/70 hover:border-primary/50 hover:shadow-md rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-2 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Всего заказов</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                Успех {successOrderRate}%
              </span>
            </div>
            <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight font-mono">
              {oStats.total.toLocaleString('ru-RU')} шт
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
              <span>В работе: {oStats.inProgress} шт</span>
              <span>В очереди: {oStats.pending} шт</span>
            </div>
          </Link>

          {/* Card 4: Клиентская база */}
          <Link
            href="/admin/clients"
            className="bg-card text-card-foreground border border-border/70 hover:border-primary/50 hover:shadow-md rounded-lg p-4 shadow-sm flex flex-col justify-between space-y-2 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">Клиенты & Каталог</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                {cStats.activeServices} услуг
              </span>
            </div>
            <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight font-mono">
              {uStats.total.toLocaleString('ru-RU')} клиентов
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
              <span>Активных: {uStats.active}</span>
              <span className="text-primary font-semibold">База растет</span>
            </div>
          </Link>
        </div>
      ) : (
        /* Support-Only 4-Card Strip (100% Clickable with live filters) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/orders?status=IN_PROGRESS"
            className="bg-card border border-border/70 hover:border-primary/50 hover:shadow-md rounded-lg p-4 shadow-sm transition-all cursor-pointer group block"
          >
            <div className="text-xs text-muted-foreground font-bold uppercase group-hover:text-primary transition-colors flex items-center justify-between">
              <span>Заказов в работе</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">{oStats.inProgress} шт</div>
          </Link>
          <Link
            href="/admin/orders?status=PENDING"
            className="bg-card border border-border/70 hover:border-primary/50 hover:shadow-md rounded-lg p-4 shadow-sm transition-all cursor-pointer group block"
          >
            <div className="text-xs text-muted-foreground font-bold uppercase group-hover:text-primary transition-colors flex items-center justify-between">
              <span>Заказов в очереди</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground mt-1">{oStats.pending} шт</div>
          </Link>
          <Link
            href="/admin/orders?status=ERROR"
            className="bg-card border border-border/70 hover:border-rose-500/50 hover:shadow-md rounded-lg p-4 shadow-sm transition-all cursor-pointer group block"
          >
            <div className="text-xs text-rose-600 dark:text-rose-400 font-bold uppercase flex items-center justify-between">
              <span>Сбои / Ошибки</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600 mt-1">{oStats.error} сбоев</div>
          </Link>
          <Link
            href="/admin/tickets?status=OPEN"
            className="bg-card border border-border/70 hover:border-amber-500/50 hover:shadow-md rounded-lg p-4 shadow-sm transition-all cursor-pointer group block"
          >
            <div className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase flex items-center justify-between">
              <span>Тикетов в очереди</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-600 mt-1">{tStats.open} тикетов</div>
          </Link>
        </div>
      )}

      {/* ── 4. LIVE CLIENT & ORDER STREAMS (6 + 6 GRID) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 col: Live Recent Orders Feed */}
        <div className="lg:col-span-6">
          <RecentOrdersFeedWidget orders={recentOrders} />
        </div>

        {/* Right 6 col: Top Spenders VIP */}
        <div className="lg:col-span-6">
          <TopSpendersWidget clients={topSpenders} />
        </div>
      </div>

      {/* ── 5. INCIDENT DISPATCHER & PROVIDER LIQUIDITY (6 + 6 GRID) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 col: Incident Dispatcher & Financial Escalation */}
        <div className={canSeeProviders ? "lg:col-span-6" : "lg:col-span-12"}>
          <FinancialEscalationWidget
            errorOrdersCount={oStats.error}
            openTicketsCount={tStats.open}
            pendingBalanceRequestsCount={0}
          />
        </div>

        {/* Right 6 col: Provider Liquidity Widget */}
        {canSeeProviders && (
          <div className="lg:col-span-6">
            <ProviderLiquidityWidget />
          </div>
        )}
      </div>

      {/* ── 6. CATALOG REVENUE & PAYMENT GATEWAYS (6 + 6 GRID) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 col: Top Performing Services */}
        <div className="lg:col-span-6">
          <TopServicesWidget services={topServices} />
        </div>

        {/* Right 6 col: Payment Gateways Breakdown */}
        <div className="lg:col-span-6">
          <PaymentGatewaysWidget gateways={gatewayStats} />
        </div>
      </div>

      {/* ── 7. FINANCIAL BALANCE (FOR OWNER / ADMIN) ── */}
      {canSeeFinancials && (
        <div className="bg-card text-card-foreground rounded-lg p-5 border border-border/70 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Финансовый баланс платформы</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                  RUB (₽)
                </span>
              </div>
              <div className="text-2xl lg:text-3xl font-extrabold text-foreground tabular-nums tracking-tight font-mono">
                {netPositionStr}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Чистый капитал за вычетом обязательств перед клиентами
              </p>
            </div>

            <div className="flex gap-2">
              <Link href="/admin/finance">
                <button
                  type="button"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md text-xs px-4 h-9 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Детальный биллинг</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
              <Link href="/admin/analytics">
                <button
                  type="button"
                  className="bg-muted/60 hover:bg-muted text-foreground border border-border/60 font-semibold rounded-md text-xs px-4 h-9 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>P&L Аналитика</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-border/40 text-xs">
            <div className="p-3 rounded-md bg-muted/20 border border-border/50">
              <div className="text-[10px] text-muted-foreground font-bold uppercase">Пополнения (Оборот)</div>
              <div className="font-mono font-bold text-foreground tabular-nums text-sm mt-0.5">{formatKopecks(revenueGross)}</div>
            </div>
            <div className="p-3 rounded-md bg-muted/20 border border-border/50">
              <div className="text-[10px] text-muted-foreground font-bold uppercase">Обязательства (Остатки на балансах)</div>
              <div className="font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums text-sm mt-0.5">{formatKopecks(totalLiability)}</div>
            </div>
            <div className="p-3 rounded-md bg-muted/20 border border-border/50">
              <div className="text-[10px] text-muted-foreground font-bold uppercase">Чистая прибыль (Net Profit)</div>
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums text-sm mt-0.5">{formatKopecks(profitNet)}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 7.5. EXECUTIVE AI OBSERVER & DAILY DIGEST ── */}
      {canSeeAnalytics && (
        <ExecutiveAiDigestCard
          canAccessExecutive={perms.canAccessExecutive}
          canUseKillSwitch={perms.canUseKillSwitch}
          canEditSettings={canEditSettings}
          canEditAnalytics={canEditAnalytics}
        />
      )}

      {/* ── 8. TECHNICAL METRICS & REFUND MONITOR (6 + 6 GRID) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 6 col: Refund & Drop Monitor */}
        <div className="lg:col-span-6">
          <RefundMonitorWidget stats={refundStats} />
        </div>

        {/* Right 6 col: Webhook Latency Radar */}
        <div className="lg:col-span-6">
          <WebhookLatencyWidget />
        </div>
      </div>

      {/* ── 9. RECENT AUDIT LOG (BOTTOM STRIP) ── */}
      {canSeeSettings && (
        <div className="bg-card text-card-foreground rounded-lg p-5 border border-border/70 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border/50 pb-3">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">Журнал безопасности и действий (Audit Trail)</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Фиксация ключевых изменений с привязкой к аккаунту и времени</p>
            </div>
            <Link
              href="/admin/settings?tab=audit"
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Полный журнал</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <RecentAuditTable logs={recentAudit} />
        </div>
      )}

    </div>
  );
}

async function SystemHealthBanner() {
  const healthData = await getCachedHealthData();

  if (!healthData || healthData.length === 0) return null;

  let quarantineCount = 0;
  let zombieCount = 0;
  let apiBlockCount = 0;

  for (const row of healthData) {
    if (row.isQuarantined) {
      quarantineCount += row._count;
    } else if (row.cooldownReason === 'ZOMBIE_AUTO_DISABLED') {
      zombieCount += row._count;
    } else if (row.cooldownReason) {
      apiBlockCount += row._count;
    }
  }

  if (quarantineCount === 0 && zombieCount === 0 && apiBlockCount === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/10 rounded-md text-amber-600 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="font-bold text-foreground text-xs">Обнаружены аномалии в каталоге</h4>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
            {quarantineCount > 0 && <span>• {quarantineCount} ценовых скачков</span>}
            {zombieCount > 0 && <span>• {zombieCount} отключенных услуг</span>}
            {apiBlockCount > 0 && <span>• {apiBlockCount} блокировок API</span>}
          </div>
        </div>
      </div>
      <Link href="/admin/catalog/quarantine" className="shrink-0 bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
        Центр аномалий
      </Link>
    </div>
  );
}
