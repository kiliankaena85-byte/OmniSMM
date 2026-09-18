'use client';

import React from 'react';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { CopyText } from '@/components/ui/CopyText';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { ClientDate } from '@/components/ui/client-date';
import { formatRubles } from '@/utils/format-price';
import { getCustomerFacingOrderError } from '@/utils/order-customer-error';
import { ChargeBreakdownModal } from '@/components/orders/ChargeBreakdownModal';
import { DripFeedProgress } from '@/components/orders/DripFeedProgress';
import { RefillRequestButton } from '@/components/orders/RefillRequestButton';
import { RepeatOrderButton } from '@/components/orders/RepeatOrderButton';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { RetryPaymentModal } from '@/components/orders/RetryPaymentModal';
import { MobileOrderItem, MobileOrderUser } from '@/components/orders/MobileOrderList';

const STATUS_ACCENT_BORDER: Record<string, string> = {
  COMPLETED:       'border-l-success',
  IN_PROGRESS:     'border-l-primary',
  PENDING:         'border-l-warning',
  AWAITING_PAYMENT:'border-l-warning',
  PROVISIONING:    'border-l-secondary',
  ERROR:           'border-l-destructive',
  PARTIAL:         'border-l-warning',
  CANCELED:        'border-l-muted-foreground/30',
};

interface DesktopOrderCardsProps {
  orders: MobileOrderItem[];
  user?: MobileOrderUser | null;
}

export function DesktopOrderCards({ orders, user }: DesktopOrderCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {orders.map((order) => {
        const total = order.quantity || 1;
        let completed = 0;
        let progressPercent = 0;

        if (order.status === 'COMPLETED') {
          completed = total;
          progressPercent = 100;
        } else if (
          order.status === 'PENDING' ||
          order.status === 'PROVISIONING' ||
          order.status === 'AWAITING_PAYMENT'
        ) {
          completed = 0;
          progressPercent = 0;
        } else {
          const remains = order.remains ?? order.quantity;
          completed = Math.max(0, Math.min(total, total - remains));
          progressPercent = Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
        }

        const createdAtDate =
          typeof order.createdAt === 'string' ? new Date(order.createdAt) : order.createdAt;
        const customerError = getCustomerFacingOrderError(order.status, order.error);

        return (
          <div
            key={order.id}
            className={`bg-card border border-border border-l-4 ${
              STATUS_ACCENT_BORDER[order.status] || 'border-l-muted-foreground/30'
            } rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between`}
          >
            <div>
              {/* Card Header: ID, Network info, Date */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-muted-foreground">
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="hover:text-primary transition-colors"
                  >
                    #{order.numericId}
                  </Link>
                  <CopyText
                    text={(order.numericId ?? '').toString()}
                    iconOnly
                    tooltipText="Копировать ID"
                  />
                </div>
                <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                  <ClientDate date={order.createdAt} format="date-short" />
                </div>
              </div>

              {/* Network and Category */}
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1.5 min-w-0">
                {order.service?.category?.network?.slug && (
                  <SocialIcon
                    slug={order.service.category.network.slug}
                    size={12}
                    className="inline-block shrink-0"
                  />
                )}
                {order.service?.category?.network?.name && (
                  <span className="text-primary truncate">
                    {order.service.category.network.name}
                  </span>
                )}
                {order.service?.category?.name && (
                  <>
                    <span className="text-muted-foreground/40 shrink-0">•</span>
                    <span className="truncate">{order.service.category.name}</span>
                  </>
                )}
              </div>

              {/* Service Name */}
              <Link href={`/dashboard/orders/${order.id}`} className="block group mt-1">
                <div className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {order.service?.name}
                </div>
              </Link>

              {/* Link & Quantity */}
              <div className="mt-3 pt-2.5 border-t border-border/50 space-y-1.5">
                {order.link && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <a
                      href={order.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:underline truncate max-w-[220px] font-medium"
                    >
                      {order.link}
                    </a>
                    <CopyText text={order.link} iconOnly tooltipText="Копировать ссылку" />
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums font-semibold text-foreground">
                      {order.quantity.toLocaleString('ru-RU')} шт.
                    </span>
                    <DripFeedProgress
                      isDripFeed={order.isDripFeed ?? undefined}
                      runs={order.runs ?? undefined}
                      interval={order.interval}
                      currentRun={order.currentRun ?? undefined}
                      nextRunAt={order.nextRunAt ?? undefined}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatRubles(Number(order.charge) / 100)}
                    </span>
                    <ChargeBreakdownModal
                      numericId={order.numericId ?? 0}
                      chargeCents={order.charge}
                      discountCents={order.discountCents ?? undefined}
                      usdToRubRate={order.usdToRubRate}
                    />
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {['IN_PROGRESS', 'PARTIAL', 'COMPLETED'].includes(order.status) && (
                <div className="mt-3 space-y-1">
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        order.status === 'COMPLETED'
                          ? 'bg-emerald-500'
                          : order.status === 'IN_PROGRESS'
                          ? 'bg-primary animate-pulse'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums flex justify-between font-mono">
                    <span>Доставлено:</span>
                    <span>
                      {completed.toLocaleString('ru-RU')} / {total.toLocaleString('ru-RU')}
                    </span>
                  </div>
                </div>
              )}

              {/* Customer Error Message */}
              {customerError && (
                <div
                  className="mt-2 text-[11px] leading-tight text-destructive font-semibold break-words"
                  title={customerError}
                >
                  {customerError}
                </div>
              )}
            </div>

            {/* Card Footer: Status Badge & Actions */}
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
              <OrderStatusBadge status={order.status} size="sm" />
              <div className="flex items-center gap-1.5">
                <RefillRequestButton
                  orderId={order.id}
                  isRefillEnabled={order.service?.isRefillEnabled}
                  orderStatus={order.status}
                  createdAt={createdAtDate}
                  refills={order.refills}
                />
                {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
                  <div className="flex items-center gap-1">
                    {order.status === 'AWAITING_PAYMENT' && user && (
                      <RetryPaymentModal
                        orderId={order.id}
                        charge={Number(order.charge)}
                        balance={Number(user.balance ?? 0)}
                      />
                    )}
                    <CancelOrderButton
                      orderId={order.id}
                      createdAt={createdAtDate}
                      status={order.status}
                    />
                  </div>
                ) : (
                  <RepeatOrderButton
                    serviceId={order.service?.id || ''}
                    categoryId={order.service?.categoryId || ''}
                    link={order.link}
                    quantity={order.quantity}
                    remains={order.remains}
                    status={order.status}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
