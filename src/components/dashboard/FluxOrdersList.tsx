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
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { ExternalLink, AlertCircle } from 'lucide-react';
import { formatRubles } from '@/utils/format-price';
import { getCustomerFacingOrderError } from '@/utils/order-customer-error';

export interface FluxOrder {
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

export function FluxOrdersList({
  orders,
  userBalanceCents = 0
}: {
  orders: FluxOrder[];
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
          className="inline-flex h-11 px-6 items-center text-xs font-bold bg-primary text-primary-foreground rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xs"
        >
          Запустить рекламу
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => {
        const total = order.quantity || 1;
        let completed = 0;
        let percent = 0;

        if (order.status === 'COMPLETED') {
          completed = total;
          percent = 100;
        } else if (order.status === 'PENDING' || order.status === 'PROVISIONING' || order.status === 'AWAITING_PAYMENT') {
          completed = 0;
          percent = 0;
        } else {
          const remains = order.remains ?? order.quantity;
          completed = Math.max(0, Math.min(total, total - remains));
          percent = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
        }

        return (
          <div
            key={order.id}
            className="p-4 sm:p-6 bg-card/60 backdrop-blur-md border border-border/30 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 hover:border-primary/20 transition-all duration-200"
          >
            {/* Column 1: Platform & Service Details */}
            <div className="flex items-start gap-3 sm:gap-4 min-w-0 max-w-sm flex-1">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <SocialIcon slug={order.service.network.slug} size={20} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                  <Link 
                    href={`/dashboard/orders/${order.id}`}
                    className="font-bold text-primary hover:underline transition-colors"
                  >
                    #{order.numericId}
                  </Link>
                  <CopyText text={order.numericId.toString()} iconOnly={true} tooltipText="Копировать ID" />
                  <span>•</span>
                  <ClientDate date={order.createdAt} format="datetime" />
                </div>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="font-extrabold text-sm text-foreground leading-tight hover:text-primary transition-colors block truncate" 
                  title={order.service.name}
                >
                  {order.service.name}
                </Link>
              </div>
            </div>

            {/* Column 2: Link target & amount */}
            <div className="flex-1 min-w-[180px] max-w-full space-y-1">
              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground block">Целевая ссылка</span>
              <div className="flex items-center gap-2">
                {order.link ? (
                  <>
                    <a
                      href={order.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary font-bold hover:underline truncate max-w-[220px]"
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
                <span>
                  {order.status === 'COMPLETED' ? 'Выполнено 100%' :
                   order.status === 'IN_PROGRESS' ? `Выполнено: ${percent}%` :
                   order.status === 'PARTIAL' ? `Частично: ${percent}%` :
                   'Прогресс:'}
                </span>
                <span className="font-mono tabular-nums text-foreground">{completed.toLocaleString('ru-RU')} / {order.quantity.toLocaleString('ru-RU')}</span>
              </div>
              
              <div className="h-2 w-full bg-muted/60 border border-border/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    order.status === 'COMPLETED' ? 'bg-emerald-500' :
                    order.status === 'IN_PROGRESS' ? 'bg-primary animate-pulse' :
                    order.status === 'PARTIAL' ? 'bg-purple-500' :
                    order.status === 'ERROR' ? 'bg-destructive' : 'bg-muted-foreground/40'
                  }`}
                  style={{ width: `${order.status === 'COMPLETED' ? 100 : percent}%` }}
                />
              </div>

              {(() => {
                const customerError = getCustomerFacingOrderError(order.status, order.error);
                if (!customerError) return null;
                return (
                  <p className="text-[9px] text-destructive font-semibold flex items-center gap-0.5 truncate min-w-0" title={customerError}>
                    <AlertCircle className="w-3 h-3 shrink-0" /> {customerError}
                  </p>
                );
              })()}
            </div>

            {/* Column 4: Cost & Status info */}
            <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 md:pl-2">
              <div className="text-right">
                <span className="block text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Стоимость</span>
                <div className="flex items-center justify-end gap-1">
                  <span className="font-mono font-black text-sm text-foreground tabular-nums">
                    {formatRubles(order.chargeCents / 100)}
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
                <OrderStatusBadge status={order.status} />

                {/* Actions Panel */}
                <div className="flex items-center gap-1.5">
                  <RefillRequestButton
                    orderId={order.id}
                    isRefillEnabled={order.service.isRefillEnabled}
                    orderStatus={order.status}
                    createdAt={order.createdAt}
                    refills={order.refills}
                  />
                  {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
                    <div className="flex items-center gap-1.5">
                      {order.status === 'AWAITING_PAYMENT' && (
                        <RetryPaymentModal 
                          orderId={order.id} 
                          charge={order.chargeCents}
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
            </div>

          </div>
        );
      })}
    </div>
  );
}
