'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
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
import { ServiceIdBadge } from '@/components/ui/service-id-badge';
import { MobileOrderItem, MobileOrderUser } from '@/components/orders/MobileOrderList';

interface DesktopOrderTableProps {
  orders: MobileOrderItem[];
  user?: MobileOrderUser | null;
}

export function DesktopOrderTable({ orders, user }: DesktopOrderTableProps) {
  const router = useRouter();

  const handleRowClick = (e: React.MouseEvent, orderId: string) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [role="button"], input')) {
      return;
    }
    router.push(`/dashboard/orders/${orderId}`);
  };

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table aria-label="Список заказов">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px] min-w-[65px] px-2.5 sm:px-3 text-xs">ID</TableHead>
              <TableHead className="min-w-[180px] px-2.5 sm:px-3 text-xs">Услуга</TableHead>
              <TableHead className="min-w-[150px] px-2.5 sm:px-3 text-xs">Ссылка / Кол-во</TableHead>
              <TableHead className="w-[100px] min-w-[90px] text-right whitespace-nowrap px-2.5 sm:px-3 text-xs">Сумма</TableHead>
              <TableHead className="w-[170px] min-w-[160px] px-2.5 sm:px-3 text-xs">Статус</TableHead>
              <TableHead className="w-[160px] min-w-[150px] px-2.5 sm:px-3 text-xs">Действия</TableHead>
              <TableHead className="w-[100px] min-w-[95px] text-right whitespace-nowrap px-2.5 sm:px-3 text-xs">Дата</TableHead>
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

              return (
                <TableRow
                  key={order.id}
                  onClick={(e) => handleRowClick(e, order.id)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap px-2.5 sm:px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="hover:text-primary font-bold transition-colors"
                        aria-label={`Открыть заказ #${order.numericId}`}
                      >
                        #{order.numericId}
                      </Link>
                      <CopyText
                        text={(order.numericId ?? '').toString()}
                        iconOnly={true}
                        tooltipText="Копировать ID заказа"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-2.5 sm:px-3 py-3">
                    <Link href={`/dashboard/orders/${order.id}`} className="block" tabIndex={-1}>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                        {order.service?.category?.network?.slug && (
                          <SocialIcon
                            slug={order.service.category.network.slug}
                            size={12}
                            className="inline-block"
                          />
                        )}
                        {order.service?.category?.network?.name && (
                          <span className="text-primary">
                            {order.service.category.network.name}
                          </span>
                        )}
                        {order.service?.category?.network?.name &&
                          order.service?.category?.name && (
                            <span className="text-muted-foreground/30">•</span>
                          )}
                        {order.service?.category?.name && (
                          <span className="text-muted-foreground/80">
                            {order.service.category.name}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-foreground line-clamp-2 max-w-[240px] hover:text-primary transition-colors leading-tight flex items-center gap-1.5 flex-wrap">
                        {order.service?.numericId && <ServiceIdBadge numericId={order.service.numericId} />}
                        <span>{order.service?.name}</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="px-2.5 sm:px-3 py-3">
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
                          <CopyText
                            text={order.link}
                            iconOnly={true}
                            tooltipText="Копировать целевую ссылку"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums font-medium">
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
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-foreground tabular-nums whitespace-nowrap px-2.5 sm:px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-mono">
                        {formatRubles(Number(order.charge) / 100)}
                      </span>
                      <ChargeBreakdownModal
                        numericId={order.numericId ?? 0}
                        chargeCents={order.charge}
                        discountCents={order.discountCents ?? undefined}
                        usdToRubRate={order.usdToRubRate}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="px-2.5 sm:px-3 py-3">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center">
                        <OrderStatusBadge status={order.status} size="sm" />
                      </div>
                      {(() => {
                        const customerError = getCustomerFacingOrderError(
                          order.status,
                          order.error
                        );
                        if (!customerError) return null;
                        return (
                          <div
                            className="text-[10px] leading-tight text-destructive max-w-[160px] line-clamp-2 break-words font-semibold"
                            title={customerError}
                          >
                            {customerError}
                          </div>
                        );
                      })()}
                      {['IN_PROGRESS', 'PARTIAL', 'COMPLETED'].includes(order.status) && (
                        <div className="space-y-0.5 max-w-[140px]">
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
                          <div className="text-[9px] text-muted-foreground tabular-nums flex justify-between font-mono">
                            <span>Доставлено:</span>
                            <span>
                              {completed.toLocaleString('ru-RU')} /{' '}
                              {total.toLocaleString('ru-RU')}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-2.5 sm:px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <RefillRequestButton
                        orderId={order.id}
                        isRefillEnabled={order.service?.isRefillEnabled}
                        orderStatus={order.status}
                        createdAt={createdAtDate}
                        refills={order.refills}
                      />
                      {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
                        <div className="flex flex-col gap-1">
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
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap px-2.5 sm:px-3 py-3">
                    <ClientDate
                      date={order.createdAt}
                      format="datetime"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
