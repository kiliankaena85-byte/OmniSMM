'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Clock, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink 
} from 'lucide-react';
import { FluxOrder } from '@/types/flux';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { CopyText } from '@/components/ui/CopyText';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { ClientDate } from '@/components/ui/client-date';
import { RepeatOrderButton } from '@/components/orders/RepeatOrderButton';
import { RefillRequestButton } from '@/components/orders/RefillRequestButton';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { RetryPaymentModal } from '@/components/orders/RetryPaymentModal';
import { DripFeedProgress } from '@/components/orders/DripFeedProgress';
import { ChargeBreakdownModal } from '@/components/orders/ChargeBreakdownModal';
import { formatRubles } from '@/utils/format-price';
import { getCustomerFacingOrderError } from '@/utils/order-customer-error';

export function FluxOrdersKanban({ 
  orders, 
  userBalanceCents = 0 
}: { 
  orders: FluxOrder[]; 
  userBalanceCents?: number;
}) {
  const [activeTab, setActiveTab] = useState<'queue' | 'in_progress' | 'done'>('queue');
  
  // Categorize orders into kanban columns
  const queueOrders = orders.filter(o => 
    ['PENDING', 'PROVISIONING', 'AWAITING_PAYMENT', 'PENDING_CHECK'].includes(o.status)
  );
  
  const inProgressOrders = orders.filter(o => 
    ['IN_PROGRESS', 'PARTIAL'].includes(o.status)
  );
  
  const doneOrders = orders.filter(o => 
    ['COMPLETED', 'CANCELED', 'ERROR'].includes(o.status)
  );

  const renderCard = (order: FluxOrder) => {
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

    const priceCents = order.chargeCents ?? Math.round(order.charge * 100);
    const rubles = priceCents / 100;

    return (
      <div 
        key={order.id} 
        className="p-5 bg-card/80 backdrop-blur-md border border-border/40 rounded-[1.75rem] shadow-xs hover:border-primary/40 hover:shadow-md transition-all duration-300 space-y-3.5 group flex flex-col justify-between"
      >
        {/* Header: ID, Network & Live Status Badge */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
              <SocialIcon slug={order.service.network?.slug || 'other'} size={14} />
            </div>
            <Link 
              href={`/dashboard/orders/${order.id}`} 
              className="font-mono text-[11px] font-black text-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              #{order.numericId}
            </Link>
            <CopyText text={order.numericId.toString()} iconOnly={true} tooltipText="Копировать ID" />
          </div>
          <OrderStatusBadge status={order.status} size="sm" />
        </div>

        {/* Service title & Date */}
        <div className="space-y-1">
          <div className="text-[10px] text-muted-foreground">
            <ClientDate date={order.createdAt} format="datetime" />
          </div>
          <Link 
            href={`/dashboard/orders/${order.id}`}
            className="block font-extrabold text-xs text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors" 
            title={order.service.name}
          >
            {order.service.name}
          </Link>
        </div>

        {/* Target Link & Copy Action */}
        <div className="bg-muted/40 p-2.5 rounded-xl border border-border/30 space-y-1">
          <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block">
            Целевая ссылка
          </span>
          <div className="flex items-center justify-between gap-1.5">
            {order.link ? (
              <>
                <a 
                  href={order.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline font-bold truncate max-w-[190px] inline-flex items-center gap-1 min-w-0"
                  title={order.link}
                >
                  {order.link}
                </a>
                <div className="flex items-center gap-1 shrink-0">
                  <CopyText text={order.link} iconOnly={true} tooltipText="Копировать ссылку" />
                </div>
              </>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">—</span>
            )}
          </div>
        </div>

        {/* Progress Representation */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
            <span>
              {order.status === 'COMPLETED' ? 'Выполнено 100%' : 
               order.status === 'IN_PROGRESS' ? `В процессе (${progressPercent}%)` : 
               order.status === 'PARTIAL' ? `Частично (${progressPercent}%)` : 
               'Прогресс:'}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {completed.toLocaleString('ru-RU')} / {total.toLocaleString('ru-RU')} шт
            </span>
          </div>
          <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden border border-border/20">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                order.status === 'COMPLETED' ? 'bg-emerald-500' :
                order.status === 'IN_PROGRESS' ? 'bg-primary animate-pulse' :
                order.status === 'PARTIAL' ? 'bg-purple-500' :
                order.status === 'ERROR' ? 'bg-destructive' : 'bg-muted-foreground/40'
              }`} 
              style={{ width: `${order.status === 'COMPLETED' ? 100 : progressPercent}%` }} 
            />
          </div>
        </div>

        {/* Drip-Feed indicator if enabled */}
        {order.isDripFeed && (
          <div className="pt-0.5">
            <DripFeedProgress
              isDripFeed={order.isDripFeed}
              runs={order.runs}
              interval={order.interval}
              currentRun={order.currentRun}
              nextRunAt={order.nextRunAt}
            />
          </div>
        )}

        {/* Price & Actions Row */}
        <div className="pt-3 border-t border-border/20 flex items-center justify-between gap-2">
          <div>
            <span className="text-[9px] uppercase font-bold text-muted-foreground block">Сумма</span>
            <div className="flex items-center gap-1">
              <span className="font-mono font-black text-xs text-foreground tabular-nums">
                {formatRubles(rubles)}
              </span>
              <ChargeBreakdownModal
                numericId={order.numericId}
                chargeCents={priceCents}
                discountCents={order.discountCents}
                usdToRubRate={order.usdToRubRate}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <RefillRequestButton
              orderId={order.id}
              isRefillEnabled={order.service.isRefillEnabled}
              orderStatus={order.status}
              createdAt={order.createdAt}
              refills={order.refills}
            />
            {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
              <div className="flex items-center gap-1">
                {order.status === 'AWAITING_PAYMENT' && (
                  <RetryPaymentModal 
                    orderId={order.id} 
                    charge={priceCents}
                    balance={userBalanceCents}
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

        {(() => {
          const customerError = getCustomerFacingOrderError(order.status, order.error);
          if (!customerError) return null;
          return (
            <div className="p-2 bg-destructive/10 border border-destructive/20 text-destructive text-[9px] font-semibold rounded-xl flex items-center gap-1.5" title={customerError}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate min-w-0">{customerError}</span>
            </div>
          );
        })()}
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
    <div className="space-y-6">
      {/* Mobile Tab Selector (block md:hidden) */}
      <div className="md:hidden flex items-center gap-1 p-1 bg-muted/50 rounded-2xl border border-border/30">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'queue' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          В очереди ({queueOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'in_progress' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          В работе ({inProgressOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('done')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'done' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
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
