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
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ServiceIdBadge } from '@/components/ui/service-id-badge';
import { CopyText } from '@/components/ui/CopyText';
import { formatRubles } from '@/utils/format-price';

export const dynamic = 'force-dynamic';

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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-foreground">Заказ #{order.numericId}</h1>
            <CopyText text={order.numericId.toString()} iconOnly={true} tooltipText="Копировать ID заказа" />
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3.5 h-3.5" /> 
            {new Date(order.createdAt).toLocaleString('ru-RU', { 
              day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            })}
          </p>
        </div>
      </div>

      {/* Main Details Card */}
      <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-xs">
        {/* Top Status Bar */}
        <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <OrderStatusBadge status={order.status} />
            <RefillRequestButton
              orderId={order.id}
              isRefillEnabled={order.service.isRefillEnabled}
              orderStatus={order.status}
              createdAt={order.createdAt}
              refills={order.refills}
            />
            {order.remains > 0 && order.status === 'IN_PROGRESS' && (
              <span className="text-xs font-bold text-muted-foreground font-mono">
                Осталось: {order.remains.toLocaleString('ru-RU')} шт
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
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Сумма</div>
            <div className="flex items-center justify-end gap-1">
              <span className="text-xl font-black text-foreground font-mono tabular-nums">
                {formatRubles(Number(order.charge) / 100)}
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
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Услуга
            </label>
            <div className="text-base font-semibold text-foreground flex items-center gap-2 flex-wrap">
              <ServiceIdBadge numericId={order.service.numericId} />
              <span>{order.service.name}</span>
            </div>
            <div className="text-xs font-medium text-muted-foreground/80 mt-1 flex items-center gap-1">
               <LayoutDashboard className="w-3.5 h-3.5" /> {order.service.category?.name || 'Без категории'}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Целевая ссылка
            </label>
            <div className="flex items-center gap-2">
              <a 
                href={order.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline break-all"
              >
                {order.link}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
              <CopyText text={order.link} iconOnly={true} tooltipText="Копировать целевую ссылку" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/40 rounded-xl p-4 border border-border/40">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Заказано
              </label>
              <div className="text-lg font-black text-foreground font-mono tabular-nums">
                {order.quantity.toLocaleString('ru-RU')} шт.
              </div>
            </div>
            {order.customData && (
              <div className="bg-muted/40 rounded-xl p-4 border border-border/40 col-span-2">
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
                  {formatRubles(Number(order.charge) / 100)}
                </div>
              </div>
              {Number(order.discountCents || 0) > 0 && (
                <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/20">
                  <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Скидка</div>
                  <div className="text-base font-black text-emerald-800 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                    - {formatRubles(Number(order.discountCents) / 100)}
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

