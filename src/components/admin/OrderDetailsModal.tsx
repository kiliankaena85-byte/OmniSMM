'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  cancelOrderAction,
  restartOrderAction,
  setOrderStatusAction,
  forceCompleteOrderAction,
  getFailoverPreview,
  manualRerouteOrder,
  getOrderDetailsAction,
  syncSingleOrderStatusAction,
} from '@/actions/admin/orders';
import { classifyOrderError } from '@/lib/order-error-classifier';

import {
  OrderModalColumn,
  OrderDetailsModalProps,
  FailoverPreviewData,
  parseAmountRub,
} from './order-details/types';
import { OrderDetailsHeader } from './order-details/OrderDetailsHeader';
import { OrderServiceDetails } from './order-details/OrderServiceDetails';
import { OrderProviderStatusCard } from './order-details/OrderProviderStatusCard';
import { OrderFinancialSummary } from './order-details/OrderFinancialSummary';
import { OrderFailoverSection } from './order-details/OrderFailoverSection';
import { OrderBottomActions } from './order-details/OrderBottomActions';

export type { OrderModalColumn, OrderDetailsModalProps };

export function OrderDetailsModal({
  order,
  isOpen = true,
  onClose,
  canSeeRates = true,
  userRole = 'SUPPORT',
  addOptimisticUpdate,
  onSuccess,
}: OrderDetailsModalProps) {
  const [fullOrder, setFullOrder] = useState<OrderModalColumn | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState('');
  const [remains, setRemains] = useState(0);
  const [failoverPreview, setFailoverPreview] = useState<FailoverPreviewData | null>(null);
  const [isFailoverOpen, setIsFailoverOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [acknowledgeBlindReroute, setAcknowledgeBlindReroute] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'cancel' | 'restart' | 'force_complete' | null>(null);

  // Hydrate order details if needed
  useEffect(() => {
    if (!order) {
      setFullOrder(null);
      return;
    }

    const hasFullDetails = order.link !== undefined && order.service?.category !== undefined;
    if (hasFullDetails) {
      setFullOrder(order);
    } else {
      setIsLoadingDetails(true);
      getOrderDetailsAction(order.id)
        .then((res) => {
          if (res && typeof res === 'object' && 'id' in res) {
            setFullOrder(res as unknown as OrderModalColumn);
          } else {
            setFullOrder(order);
          }
        })
        .catch((err) => {
          console.warn('[OrderDetailsModal] Load error:', err);
          setFullOrder(order);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [order]);

  // Synchronize status and remains
  useEffect(() => {
    if (fullOrder) {
      setSelectedStatus(fullOrder.status);
      setRemains(fullOrder.remains ?? 0);
    }
    setIsFailoverOpen(false);
    setConfirmOpen(false);
  }, [order, isFailoverOpen]);

  if (!order || !isOpen || !mounted) return null;

  const currentOrder: OrderModalColumn = fullOrder || order;

  // Calculations
  const quantity = currentOrder.quantity ?? 0;
  const chargeRub = parseAmountRub(currentOrder.charge);
  const costRub = parseAmountRub(currentOrder.providerCost);
  const marginRub = chargeRub - costRub;
  const marginPercent = chargeRub > 0 ? Math.round((marginRub / chargeRub) * 100) : 0;
  const pricePerUnitRub = quantity > 0 ? chargeRub / quantity : 0;
  const progressPercent = quantity > 0 
    ? Math.min(100, Math.max(0, Math.round(((quantity - (currentOrder?.remains ?? 0)) / quantity) * 100))) 
    : 100;

  // Handlers
  const handleCopyLink = () => {
    if (currentOrder?.link) {
      navigator.clipboard.writeText(currentOrder.link);
      setCopiedLink(true);
      toast.success('Ссылка скопирована в буфер');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyId = () => {
    if (currentOrder?.numericId) {
      navigator.clipboard.writeText(String(currentOrder.numericId));
      setCopiedId(true);
      toast.success(`ID #${currentOrder.numericId} скопирован`);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSetStatus = () => {
    if (!currentOrder) return;
    startTransition(async () => {
      if (addOptimisticUpdate) {
        addOptimisticUpdate({
          id: currentOrder.id,
          status: selectedStatus,
          remains: selectedStatus === 'PARTIAL' ? remains : undefined,
        });
      }
      try {
        const r = await setOrderStatusAction(
          currentOrder.id,
          selectedStatus as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'CANCELED' | 'ERROR',
          selectedStatus === 'PARTIAL' ? remains : undefined
        );
        if (r.success) {
          const refund = r.refundCents > 0 ? ` Возврат клиенту: ${(r.refundCents / 100).toFixed(2)} ₽` : '';
          toast.success(`Статус заказа #${r.numericId} обновлен на "${selectedStatus}".${refund}`);
          if (onSuccess) onSuccess();
          onClose();
        } else {
          toast.error(r.error || 'Ошибка изменения статуса');
        }
      } catch (e) {
        toast.error((e as Error).message || 'Ошибка изменения статуса');
      }
    });
  };

  const executeConfirm = () => {
    if (!currentOrder || !confirmAction) return;
    setConfirmOpen(false);
    const fd = new FormData();
    fd.append('orderId', currentOrder.id);

    if (confirmAction === 'cancel') {
      startTransition(async () => {
        try {
          const r = await cancelOrderAction(fd);
          if (r.success) {
            if (r.status === 'CANCELING') {
              toast.info(r.message || 'Запрос на отмену отправлен провайдеру. Средства удерживаются в эскроу до подтверждения.');
              if (addOptimisticUpdate) {
                addOptimisticUpdate({ id: currentOrder.id, status: 'CANCELING' });
              }
            } else {
              toast.success(r.message || `Заказ #${currentOrder.numericId} отменен с возвратом средств клиенту`);
              if (addOptimisticUpdate) {
                addOptimisticUpdate({ id: currentOrder.id, status: 'CANCELED' });
              }
            }
            if (onSuccess) onSuccess();
            onClose();
          } else {
            toast.error(r.error || 'Ошибка отмены заказа');
          }
        } catch (e) {
          toast.error((e as Error).message || 'Ошибка отмены');
        }
      });
    } else if (confirmAction === 'restart') {
      startTransition(async () => {
        if (addOptimisticUpdate) {
          addOptimisticUpdate({ id: currentOrder.id, status: 'PENDING' });
        }
        try {
          const r = await restartOrderAction(fd);
          if (r.success) {
            toast.success(`Заказ #${currentOrder.numericId} успешно перезапущен у провайдера`);
            if (onSuccess) onSuccess();
            onClose();
          } else {
            toast.error(r.error || 'Ошибка перезапуска');
          }
        } catch (e) {
          toast.error((e as Error).message || 'Ошибка перезапуска');
        }
      });
    } else if (confirmAction === 'force_complete') {
      startTransition(async () => {
        if (addOptimisticUpdate) {
          addOptimisticUpdate({ id: currentOrder.id, status: 'COMPLETED' });
        }
        try {
          const r = await forceCompleteOrderAction(currentOrder.id);
          if (r.success) {
            toast.success(`Заказ #${currentOrder.numericId} принудительно завершен`);
            if (onSuccess) onSuccess();
            onClose();
          } else {
            toast.error(r.error || 'Ошибка завершения');
          }
        } catch (e) {
          toast.error((e as Error).message || 'Ошибка завершения');
        }
      });
    }
  };

  const handleSyncStatus = () => {
    if (!currentOrder) return;
    startTransition(async () => {
      try {
        const r = await syncSingleOrderStatusAction(currentOrder.id);
        if (r.success) {
          toast.success(r.message || 'Статус успешно сверен с провайдером');
          if (r.status && addOptimisticUpdate) {
            addOptimisticUpdate({ id: currentOrder.id, status: r.status });
          }
          if (onSuccess) onSuccess();
          onClose();
        } else {
          toast.error(r.error || 'Не удалось сверить статус');
        }
      } catch (e) {
        toast.error((e as Error).message || 'Ошибка запроса к провайдеру');
      }
    });
  };

  const handleFailoverClick = () => {
    if (!currentOrder) return;
    startTransition(async () => {
      try {
        const preview = await getFailoverPreview(currentOrder.id);
        if (preview.success) {
          if (preview.routes.length > 0) {
            setSelectedRouteId(preview.routes[0].routeId);
          }
          setFailoverPreview(preview);
          setIsFailoverOpen(true);
        } else {
          toast.error(('error' in preview ? preview.error : undefined) || 'Нет доступных альтернативных маршрутов');
        }
      } catch (e) {
        toast.error((e as Error).message || 'Ошибка загрузки маршрутов');
      }
    });
  };

  const handleConfirmFailover = () => {
    if (!currentOrder || !selectedRouteId) return;
    startTransition(async () => {
      try {
        const r = await manualRerouteOrder(currentOrder.id, selectedRouteId, acknowledgeBlindReroute);
        if (r.success) {
          toast.success(`Заказ #${currentOrder.numericId} переведен на резервный маршрут`);
          setIsFailoverOpen(false);
          setAcknowledgeBlindReroute(false);
          if (onSuccess) onSuccess();
          onClose();
        } else {
          toast.error(r.error || 'Ошибка перевода заказа');
        }
      } catch (e) {
        toast.error((e as Error).message || 'Ошибка при перезапуске');
      }
    });
  };

  const classifiedError = currentOrder?.error ? classifyOrderError(currentOrder.error) : null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-zinc-950/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Main Wide Dialog Window */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-5xl max-h-[92vh] bg-card text-card-foreground border border-border/80 shadow-2xl rounded-3xl overflow-hidden flex flex-col z-10 select-none"
      >
        <OrderDetailsHeader
          order={currentOrder}
          copiedId={copiedId}
          onCopyId={handleCopyId}
          onClose={onClose}
        />

        {/* DIALOG BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          {isLoadingDetails ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-sm font-medium">Загрузка расширенных параметров заказа...</span>
            </div>
          ) : (
            <>
              {/* 3-COLUMN BENTO GRID */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <OrderServiceDetails
                  order={currentOrder}
                  copiedLink={copiedLink}
                  onCopyLink={handleCopyLink}
                  quantity={quantity}
                  progressPercent={progressPercent}
                />

                <OrderProviderStatusCard
                  order={currentOrder}
                  selectedStatus={selectedStatus}
                  onSelectedStatusChange={setSelectedStatus}
                  remains={remains}
                  onRemainsChange={setRemains}
                  quantity={quantity}
                  isPending={isPending}
                  onSetStatus={handleSetStatus}
                />

                <OrderFinancialSummary
                  order={currentOrder}
                  chargeRub={chargeRub}
                  costRub={costRub}
                  marginRub={marginRub}
                  marginPercent={marginPercent}
                  pricePerUnitRub={pricePerUnitRub}
                  canSeeRates={canSeeRates}
                />
              </div>

              {/* PROVIDER ERROR BANNER */}
              {currentOrder.error && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Ответ / Ошибка провайдера:</span>
                    </div>
                    {classifiedError && (
                      <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${classifiedError.badgeBg} ${classifiedError.badgeText} ${classifiedError.badgeBorder}`}>
                        {classifiedError.code}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    {classifiedError ? classifiedError.titleRu : currentOrder.error}
                  </div>

                  {classifiedError && (
                    <div className="text-xs text-foreground/85 leading-relaxed bg-card/60 p-2.5 rounded-xl border border-border/50">
                      <div className="font-semibold text-[11px] text-muted-foreground uppercase mb-0.5">Пояснение:</div>
                      {classifiedError.descriptionRu}
                      <div className="mt-2 pt-1.5 border-t border-border/40 text-[11px] text-primary font-medium">
                        💡 <strong>Действие:</strong> {classifiedError.recommendedAction}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground font-mono break-all pt-0.5">
                    Сырой ответ: {currentOrder.error}
                  </div>
                </div>
              )}

              {/* FAILOVER PREVIEW SECTION */}
              {failoverPreview && (
                <OrderFailoverSection
                  isOpen={isFailoverOpen}
                  onClose={() => setIsFailoverOpen(false)}
                  failoverPreview={failoverPreview}
                  selectedRouteId={selectedRouteId}
                  onSelectRouteId={setSelectedRouteId}
                  acknowledgeBlindReroute={acknowledgeBlindReroute}
                  onAcknowledgeChange={setAcknowledgeBlindReroute}
                  isPending={isPending}
                  onConfirmFailover={handleConfirmFailover}
                />
              )}
            </>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <OrderBottomActions
          order={currentOrder}
          userRole={userRole}
          isPending={isPending}
          isFailoverOpen={isFailoverOpen}
          onSyncStatus={handleSyncStatus}
          onToggleFailover={() => {
            if (!isFailoverOpen) {
              handleFailoverClick();
            } else {
              setIsFailoverOpen(false);
            }
          }}
          onTriggerConfirm={(action) => {
            setConfirmAction(action);
            setConfirmOpen(true);
          }}
        />
      </motion.div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setConfirmAction(null);
        }}
        onConfirm={executeConfirm}
        title={
          confirmAction === 'cancel'
            ? `Отменить заказ #${currentOrder.numericId}?`
            : confirmAction === 'restart'
            ? `Перезапустить заказ #${currentOrder.numericId}?`
            : `Принудительно завершить заказ #${currentOrder.numericId}?`
        }
        confirmText={confirmAction === 'cancel' ? 'Отменить заказ' : 'Подтвердить'}
        isDanger={confirmAction === 'cancel'}
      >
        <p className="text-xs text-muted-foreground">
          {confirmAction === 'cancel'
            ? currentOrder.externalId
              ? `Заказ передан провайдеру (ID: ${currentOrder.externalId}). Запрос на отмену будет отправлен провайдеру, а средства (${chargeRub.toFixed(2)} ₽) будут удержаны в эскроу до подтверждения отмены. При подтверждении возврат поступит автоматически.`
              : `Средства (${chargeRub.toFixed(2)} ₽) будут автоматически возвращены на баланс клиента.`
            : confirmAction === 'restart'
            ? `Заказ будет повторно отправлен текущему провайдеру с новыми параметрами.`
            : `Статус заказа будет переведен в "Выполнен".`}
        </p>
      </ConfirmModal>
    </div>,
    document.body
  );
}
