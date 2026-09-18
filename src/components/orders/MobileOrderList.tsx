'use client';
export interface MobileOrderItem {
  id: string;
  numericId?: number | null;
  status: string;
  charge: bigint | number;
  discountCents?: number | bigint | null;
  usdToRubRate?: number | null;
  quantity: number;
  remains?: number | null;
  link: string;
  error?: string | null;
  createdAt: Date | string;
  isDripFeed?: boolean | null;
  runs?: number | null;
  interval?: number | null;
  currentRun?: number | null;
  nextRunAt?: Date | string | null;
  customData?: string | null;
  refills?: {
    id: string;
    status: string;
    createdAt: Date | string;
  }[];
  service?: {
    id: string;
    numericId?: number;
    categoryId: string;
    name: string;
    isRefillEnabled?: boolean;
    category?: {
      name: string;
      network?: {
        name: string;
        slug: string;
      } | null;
    } | null;
  } | null;
}

export interface MobileOrderUser {
  id?: string;
  balance?: bigint | number;
}

// audit-disable STR-002

import React, { useState } from 'react';
import {
  Drawer,
  DrawerBackdrop,
  DrawerContent,
  DrawerDialog,
  DrawerHeader,
  DrawerBody,
} from '@heroui/react';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { RetryPaymentModal } from '@/components/orders/RetryPaymentModal';
import { ClientDate } from '@/components/ui/client-date';
import { Clock, ExternalLink, LayoutDashboard, ChevronRight } from 'lucide-react';
import { RepeatOrderButton } from '@/components/orders/RepeatOrderButton';
import { RefillRequestButton } from '@/components/orders/RefillRequestButton';
import { DripFeedProgress } from '@/components/orders/DripFeedProgress';
import { ChargeBreakdownModal } from '@/components/orders/ChargeBreakdownModal';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { CopyText } from '@/components/ui/CopyText';
import { formatRubles } from '@/utils/format-price';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { ServiceIdBadge } from '@/components/ui/service-id-badge';
import { getCustomerFacingOrderError } from '@/utils/order-customer-error';

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

interface MobileOrderListProps {
  orders: MobileOrderItem[];
  user?: MobileOrderUser | null;
  viewMode?: 'table' | 'cards';
}

export function MobileOrderList({ orders, user, viewMode = 'table' }: MobileOrderListProps) {
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const [selectedOrder, setSelectedOrder] = useState<MobileOrderItem | null>(null);

  const handleOrderClick = (order: MobileOrderItem) => {
    setSelectedOrder(order);
    onOpen();
  };

  return (
<<<<<<< HEAD
    <>
      {/* Mobile cards list (plain render — 15 items/page, no virtualization needed) */}
      <div className="space-y-3">
        {orders.map((order) => (
          <div 
            key={order.id}
            role="button"
            tabIndex={0}
            onClick={() => handleOrderClick(order)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOrderClick(order); } }}
            className={`bg-card border border-border border-l-4 ${STATUS_ACCENT_BORDER[order.status] || 'border-l-muted-foreground/30'} rounded-2xl p-4 shadow-xs active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
            style={{ minHeight: '120px' }} // Ensures large enough touch target
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono text-muted-foreground">#{order.numericId}</div>
                
                <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1.5 flex items-center gap-1.5 min-w-0">
                  {order.service?.category?.network?.slug && (
                    <SocialIcon slug={order.service?.category.network.slug} size={10} className="inline-block shrink-0" />
                  )}
                  {order.service?.category?.network?.name && (
                    <span className="text-primary truncate">{order.service?.category.network.name}</span>
                  )}
                  {order.service?.category?.name && (
                    <>
                      <span className="text-muted-foreground/50 shrink-0">•</span>
                      <span className="truncate">{order.service?.category.name}</span>
                    </>
                  )}
                </div>
                
                <div className="text-sm font-medium text-foreground line-clamp-2 mt-1 leading-snug break-words flex items-center gap-1.5 flex-wrap">
                  {order.service?.numericId && <ServiceIdBadge numericId={order.service.numericId} />}
                  <span>{order.service?.name}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <div className="text-sm font-bold text-foreground tabular-nums">
                    {formatRubles(Number(order.charge) / 100)}
                  </div>
                  <ChargeBreakdownModal
                    numericId={order.numericId ?? 0}
                    chargeCents={order.charge}
                    discountCents={order.discountCents ?? undefined}
                    usdToRubRate={order.usdToRubRate}
                  />
                </div>
                <div className="mt-1.5 flex justify-end">
                  <OrderStatusBadge status={order.status} size="sm" />
                </div>
              </div>
            </div>
=======
    <div className="space-y-3">
      {/* ── MODE 1: COMPACT LIST-ROWS (DEFAULT / 'table') ── */}
      {viewMode === 'table' ? (
        <div className="space-y-2">
          {orders.map((order) => {
            const createdAtDate =
              typeof order.createdAt === 'string' ? new Date(order.createdAt) : order.createdAt;
            const customerError = getCustomerFacingOrderError(order.status, order.error);
>>>>>>> 3f04ac0a (feat(orders): add compact table vs cards view switcher with localStorage and cross-tab sync)

            return (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOrderClick(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOrderClick(order);
                  }
                }}
                className={`bg-card border border-border border-l-4 ${
                  STATUS_ACCENT_BORDER[order.status] || 'border-l-muted-foreground/30'
                } rounded-xl p-3 shadow-2xs hover:bg-muted/30 active:scale-[0.99] transition-all cursor-pointer select-none`}
              >
                {/* Row 1: ID, Network Icon, Service Name (left) | Price, Status (right) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-mono font-bold text-muted-foreground shrink-0">
                      #{order.numericId}
                    </span>
                    {order.service?.category?.network?.slug && (
                      <SocialIcon
                        slug={order.service.category.network.slug}
                        size={12}
                        className="inline-block shrink-0"
                      />
                    )}
                    <span className="text-xs font-semibold text-foreground truncate">
                      {order.service?.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-foreground tabular-nums whitespace-nowrap">
                      {formatRubles(Number(order.charge) / 100)}
                    </span>
                    <OrderStatusBadge status={order.status} size="sm" />
                  </div>
                </div>

                {/* Row 2: Link snippet, Quantity, Date, Chevron */}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground gap-2 pt-1 border-t border-border/30">
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="tabular-nums font-medium text-foreground/80 shrink-0">
                      {order.quantity.toLocaleString('ru-RU')} шт.
                    </span>
                    {order.link && (
                      <>
                        <span className="text-muted-foreground/40 shrink-0">•</span>
                        <span className="truncate max-w-[150px] sm:max-w-[220px]">
                          {order.link.replace(/^https?:\/\//, '')}
                        </span>
                      </>
                    )}
                    {order.isDripFeed && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary/10 text-primary shrink-0">
                        Drip
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[10px]">
                    <ClientDate date={createdAtDate} format="date-short" />
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  </div>
                </div>

                {customerError && (
                  <div
                    className="mt-1 text-[10px] text-destructive font-semibold truncate"
                    title={customerError}
                  >
                    {customerError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── MODE 2: EXPANDED CARDS GRID ('cards') ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 space-y-0">
          {orders.map((order) => {
            const createdAtDate =
              typeof order.createdAt === 'string' ? new Date(order.createdAt) : order.createdAt;

            return (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOrderClick(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOrderClick(order);
                  }
                }}
                className={`bg-card border border-border border-l-4 ${
                  STATUS_ACCENT_BORDER[order.status] || 'border-l-muted-foreground/30'
                } rounded-2xl p-4 shadow-xs active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
                style={{ minHeight: '120px' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-muted-foreground">
                      #{order.numericId}
                    </div>

                    <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1.5 flex items-center gap-1.5 min-w-0">
                      {order.service?.category?.network?.slug && (
                        <SocialIcon
                          slug={order.service.category.network.slug}
                          size={10}
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
                          <span className="text-muted-foreground/50 shrink-0">•</span>
                          <span className="truncate">{order.service.category.name}</span>
                        </>
                      )}
                    </div>

                    <div className="text-sm font-medium text-foreground line-clamp-2 mt-1 leading-snug break-words">
                      {order.service?.name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-sm font-bold text-foreground tabular-nums">
                        {formatRubles(Number(order.charge) / 100)}
                      </div>
                      <ChargeBreakdownModal
                        numericId={order.numericId ?? 0}
                        chargeCents={order.charge}
                        discountCents={order.discountCents ?? undefined}
                        usdToRubRate={order.usdToRubRate}
                      />
                    </div>
                    <div className="mt-1.5 flex justify-end">
                      <OrderStatusBadge status={order.status} size="sm" />
                    </div>
                  </div>
                </div>

                {/* Link & Copy Text */}
                {order.link && (
                  <div
                    className="mt-2.5 flex items-center gap-1.5 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={order.link}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:underline truncate max-w-[240px] font-medium"
                      aria-label={`Открыть ссылку заказа #${order.numericId}`}
                    >
                      {order.link}
                    </a>
                    <CopyText text={order.link} iconOnly tooltipText="Копировать ссылку" />
                  </div>
                )}

                {/* Progress bar for Partial / In Progress */}
                {order.status === 'IN_PROGRESS' && order.remains != null && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>
                        {order.quantity - order.remains >= order.quantity
                          ? 'Завершение...'
                          : order.quantity - order.remains <= 0
                          ? 'Начинаем работу...'
                          : 'В работе'}
                      </span>
                      <span className="tabular-nums font-mono">
                        {Math.min(
                          order.quantity,
                          Math.max(0, order.quantity - order.remains)
                        )}{' '}
                        / {order.quantity}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-primary rounded-full transition-all duration-500 ${
                          order.quantity - order.remains >= order.quantity ||
                          order.quantity - order.remains <= 0
                            ? 'animate-pulse opacity-80'
                            : ''
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              Math.round(
                                ((order.quantity - order.remains) / order.quantity) * 100
                              )
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Customer Error Message (Full width clean display) */}
                {(() => {
                  const customerError = getCustomerFacingOrderError(
                    order.status,
                    order.error
                  );
                  if (!customerError) return null;
                  return (
                    <div
                      className="mt-2 text-[11px] leading-tight text-destructive font-semibold break-words"
                      title={customerError}
                    >
                      {customerError}
                    </div>
                  );
                })()}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums font-medium">
                      {order.quantity.toLocaleString('ru-RU')} шт.
                    </span>
                    <span>
                      <ClientDate date={order.createdAt} format="date-short" />
                    </span>
                    <DripFeedProgress
                      isDripFeed={order.isDripFeed ?? undefined}
                      runs={order.runs ?? undefined}
                      interval={order.interval}
                      currentRun={order.currentRun ?? undefined}
                      nextRunAt={order.nextRunAt ?? undefined}
                    />
                  </div>

                  <div
                    className="flex items-center gap-1.5 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RefillRequestButton
                      orderId={order.id}
                      isRefillEnabled={order.service?.isRefillEnabled}
                      orderStatus={order.status}
                      createdAt={createdAtDate}
                      refills={order.refills}
                    />
                    {['PENDING', 'AWAITING_PAYMENT'].includes(order.status) ? (
                      <>
                        <CancelOrderButton
                          orderId={order.id}
                          createdAt={createdAtDate}
                          status={order.status}
                        />
                        {order.status === 'AWAITING_PAYMENT' && user && (
                          <RetryPaymentModal
                            orderId={order.id}
                            charge={Number(order.charge)}
                            balance={Number(user.balance ?? 0)}
                          />
                        )}
                      </>
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
      )}

      {/* 4.2 Drawer для деталей (Mobile only) */}
      <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
        <DrawerBackdrop className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-xs flex items-end justify-center">
          <DrawerContent
            placement="bottom"
            className="fixed bottom-0 inset-x-0 z-[9999] w-full max-h-[90dvh] rounded-t-3xl bg-background border-t border-border shadow-2xl pb-[env(safe-area-inset-bottom)] flex flex-col outline-none overflow-hidden"
          >
            <DrawerDialog aria-label="Детали заказа" className="outline-none flex flex-col flex-1 min-h-0">
              {/* Touch action none on handle for swipe down */}
              <div className="w-full flex justify-center pt-3 pb-1 touch-none shrink-0">
                <div className="w-12 h-1.5 bg-muted rounded-full min-h-1.5 min-w-12" />
              </div>
              <DrawerHeader className="flex flex-col gap-1 px-6 min-h-[48px] justify-center shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">Заказ #{selectedOrder?.numericId}</h2>
                  <CopyText
                    text={selectedOrder?.numericId?.toString() || ''}
                    iconOnly={true}
                    tooltipText="Копировать ID"
                  />
                </div>
                <div className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <ClientDate
                    date={
                      selectedOrder
                        ? typeof selectedOrder.createdAt === 'string'
                          ? new Date(selectedOrder.createdAt)
                          : selectedOrder.createdAt
                        : new Date()
                    }
                    format="datetime"
                  />
                </div>
              </DrawerHeader>

              {/* Overscroll contain to avoid refreshing page when scrolling inside Drawer */}
              <DrawerBody className="px-6 pb-6 overflow-y-auto overscroll-contain">
                {selectedOrder && (
                  <div className="space-y-5">
                    {/* Status & Price */}
                    <div className="flex items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Статус
                        </div>
                        <OrderStatusBadge status={selectedOrder?.status || 'PENDING'} />
                        {(() => {
                          const customerError = getCustomerFacingOrderError(
                            selectedOrder?.status || '',
                            selectedOrder?.error
                          );
                          if (!customerError) return null;
                          return (
                            <div
                              className="text-xs text-destructive font-semibold mt-1.5 break-words max-w-[200px]"
                              title={customerError}
                            >
                              {customerError}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Сумма
                        </div>
                        <div className="text-lg font-black tabular-nums">
                          {formatRubles(Number(selectedOrder?.charge ?? 0) / 100)}
                        </div>
                      </div>
                    </div>

                    {/* Service */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">
                        Услуга
                      </label>
                      <div className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                        {selectedOrder?.service?.numericId && <ServiceIdBadge numericId={selectedOrder.service.numericId} />}
                        <span>{selectedOrder?.service?.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <LayoutDashboard className="w-3 h-3 shrink-0" />
                        {selectedOrder?.service?.category?.name || 'Без категории'}
                      </div>
                    </div>

                    {/* Link */}
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">
                        Ссылка
                      </label>
                      <div className="flex items-center gap-2">
                        <a
                          href={selectedOrder?.link || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary break-all"
                        >
                          {selectedOrder?.link || ''}
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                        <CopyText
                          text={selectedOrder?.link || ''}
                          iconOnly={true}
                          tooltipText="Копировать ссылку"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <div className="text-[10px] font-bold text-muted-foreground uppercase">
                          Кол-во
                        </div>
                        <div className="text-base font-black tabular-nums mt-1">
                          {(selectedOrder?.quantity ?? 0).toLocaleString('ru-RU')} шт.
                        </div>
                      </div>

                      {(selectedOrder?.remains ?? 0) > 0 &&
                        selectedOrder.status === 'IN_PROGRESS' && (
                          <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase">
                              Осталось
                            </div>
                            <div className="text-base font-black tabular-nums mt-1 text-primary">
                              {(selectedOrder?.remains ?? 0).toLocaleString('ru-RU')} шт.
                            </div>
                          </div>
                        )}
                    </div>

                    {selectedOrder?.customData && (
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                          Комментарии / Настройки
                        </label>
                        <div className="text-xs font-mono whitespace-pre-wrap">
                          {typeof selectedOrder.customData === 'string'
                            ? selectedOrder.customData
                            : JSON.stringify(selectedOrder.customData)}
                        </div>
                      </div>
                    )}

                    {(selectedOrder?.isDripFeed ||
                      (selectedOrder?.runs && selectedOrder.runs > 1)) && (
                      <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
                        <DripFeedProgress
                          isDripFeed={selectedOrder?.isDripFeed ?? undefined}
                          runs={selectedOrder?.runs ?? undefined}
                          interval={selectedOrder.interval}
                          currentRun={selectedOrder?.currentRun ?? undefined}
                          nextRunAt={selectedOrder?.nextRunAt ?? undefined}
                          showNextRunCountdown={true}
                        />
                      </div>
                    )}

                    <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 space-y-2.5">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>Финансовая детализация</span>
                        <ChargeBreakdownModal
                          numericId={selectedOrder?.numericId ?? 0}
                          chargeCents={selectedOrder.charge}
                          discountCents={selectedOrder?.discountCents ?? undefined}
                          usdToRubRate={selectedOrder.usdToRubRate}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">
                            Оплачено:
                          </span>
                          <span className="font-mono font-bold">
                            {formatRubles(Number(selectedOrder.charge) / 100)}
                          </span>
                        </div>
                        {Number(selectedOrder.discountCents || 0) > 0 && (
                          <div>
                            <span className="text-emerald-600 block text-[10px]">Скидка:</span>
                            <span className="font-mono font-bold text-emerald-600">
                              - {formatRubles(Number(selectedOrder.discountCents) / 100)}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2 pt-1 border-t border-border/30 flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground">Курс ЦБ РФ при оплате:</span>
                          <span className="font-mono font-bold">
                            {selectedOrder.usdToRubRate
                              ? `${selectedOrder.usdToRubRate.toFixed(2)} ₽ / $`
                              : '90.00 ₽ / $'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2">
                      <RefillRequestButton
                        orderId={selectedOrder?.id || ''}
                        isRefillEnabled={selectedOrder.service?.isRefillEnabled}
                        orderStatus={selectedOrder.status}
                        createdAt={
                          typeof selectedOrder.createdAt === 'string'
                            ? new Date(selectedOrder.createdAt)
                            : selectedOrder.createdAt
                        }
                        refills={selectedOrder.refills}
                        className="w-full h-11 text-sm font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                      />
                      {['PENDING', 'AWAITING_PAYMENT'].includes(selectedOrder.status) ? (
                        <div className="flex gap-3">
                          <CancelOrderButton
                            orderId={selectedOrder.id}
                            createdAt={
                              typeof selectedOrder.createdAt === 'string'
                                ? new Date(selectedOrder.createdAt)
                                : selectedOrder.createdAt
                            }
                            status={selectedOrder.status}
                          />
                          {selectedOrder.status === 'AWAITING_PAYMENT' && user && (
                            <RetryPaymentModal
                              orderId={selectedOrder.id}
                              charge={Number(selectedOrder.charge)}
                              balance={Number(user.balance ?? 0)}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <RepeatOrderButton
                            serviceId={selectedOrder?.service?.id || ''}
                            categoryId={selectedOrder?.service?.categoryId || ''}
                            link={selectedOrder.link}
                            quantity={selectedOrder.quantity}
                            remains={selectedOrder.remains}
                            status={selectedOrder.status}
                            className="w-full h-11 text-sm font-bold bg-primary text-primary-foreground border-none hover:bg-primary/90 hover:text-primary-foreground"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </DrawerBody>
            </DrawerDialog>
          </DrawerContent>
        </DrawerBackdrop>
      </Drawer>
    </div>
  );
}
