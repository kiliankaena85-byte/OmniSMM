import * as React from 'react';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { adminOrderService } from '@/services/admin/order.service';
import { adminTicketService } from '@/services/admin/ticket.service';
import { db } from '@/lib/db';
import { UrgentTickets } from './components/urgent-tickets';
import { FailedOrders } from './components/failed-orders';
import nextDynamic from 'next/dynamic';

const OrdersChart = nextDynamic(() => import('@/app/admin/dashboard/orders-chart').then(mod => mod.OrdersChart), {
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-card/50 border border-border flex items-center justify-center text-xs text-muted-foreground">Загрузка графиков...</div>,
});
import { LayoutDashboard, MessageSquare, Clock, Package, AlertTriangle, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OperatorDashboardPage() {
  // Enforce staff/operator session
  await enforceOperatorAccess();

  const chartStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Parallel database fetch for operational KPIs and response feeds
  const [
    orderStats,
    ticketStats,
    urgentTickets,
    failedOrders,
    timeseries,
  ] = await Promise.all([
    adminOrderService.getOrderStats(),
    adminTicketService.getTicketStats(),
    db.ticket.findMany({
      where: { status: 'OPEN' },
      orderBy: { updatedAt: 'asc' }, // Oldest first to capture SLA breach
      take: 5,
      include: { user: { select: { email: true } } },
    }),
    db.order.findMany({
      where: { status: 'ERROR' },
      orderBy: { updatedAt: 'desc' }, // Newest first to show recent failures
      take: 5,
      select: { id: true, numericId: true, error: true },
    }),
    adminOrderService.getOrdersTimeseries(chartStart, new Date(), 'day'),
  ]);

  const activeTicketsCount = ticketStats.open + ticketStats.pending;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-10">
      {/* Header greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              Операционная панель
            </h2>
            <p className="text-muted-foreground text-xs mt-0.5 font-medium leading-relaxed">
              Рабочая область дежурного оператора поддержки. Контроль SLA, зависших заказов и тикетов.
            </p>
          </div>
        </div>
      </div>

      {/* 4 KPI Widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Tickets */}
        <div className="p-5 rounded-2xl border border-border/40 bg-card/50 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group hover:shadow-md transition-all">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
            Активные тикеты
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-foreground font-mono tracking-tight">
              {activeTicketsCount}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Открыто / Ждут
            </span>
          </div>
        </div>

        {/* SLA Tickets */}
        <div className="p-5 rounded-2xl border border-border/40 bg-card/50 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group hover:shadow-md transition-all">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
            Нарушение SLA (&gt;15 мин)
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${ticketStats.criticalOpen > 0 ? 'text-destructive' : 'text-success'}`}>
              {ticketStats.criticalOpen}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Без ответа
            </span>
          </div>
        </div>

        {/* Active orders */}
        <div className="p-5 rounded-2xl border border-border/40 bg-card/50 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group hover:shadow-md transition-all">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
            Заказы в работе
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-extrabold text-foreground font-mono tracking-tight">
              {orderStats.inProgress + orderStats.pending}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              В очереди / В работе
            </span>
          </div>
        </div>

        {/* Failed orders */}
        <div className="p-5 rounded-2xl border border-border/40 bg-card/50 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group hover:shadow-md transition-all">
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">
            Сбои провайдеров
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${orderStats.error > 0 ? 'text-destructive' : 'text-foreground'}`}>
              {orderStats.error}
            </span>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              В статусе ERROR
            </span>
          </div>
        </div>
      </div>

      {/* Dynamics Chart Section */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Динамика заказов за последние 7 дней
        </h3>
        <OrdersChart data={timeseries} />
      </div>

      {/* Two Columns for Urgent Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA Tickets List */}
        <UrgentTickets tickets={urgentTickets} />

        {/* Failed Orders List */}
        <FailedOrders orders={failedOrders} />
      </div>
    </div>
  );
}
