'use client';

import * as React from 'react';
import { useState, useTransition, useOptimistic } from 'react';
import { toast } from 'sonner';
import { OrderColumn, TenantBrandBadge, STATUS_LABELS } from './columns';
import { OrderSortableHeader } from './order-sortable-header';
import { OrderEnvironmentBadge } from '@/components/admin/OrderEnvironmentBadge';
import { resolveOrderEnvironmentMode, ORDER_ENV_CONFIG } from '@/utils/order-environment';
import { ServiceIdBadge } from '@/components/ui/service-id-badge';
import Link from 'next/link';
import { 
  Clock, 
  Hourglass, 
  Loader, 
  CheckCircle, 
  PieChart, 
  XCircle, 
  AlertTriangle, 
  Undo2, 
  Info, 
  RefreshCw, 
  CheckSquare, 
  Square,
  Copy,
  Check,
  Edit2,
  Trash2
} from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { OrderDetailsModal } from '@/components/admin/OrderDetailsModal';
import { BulkActionsPanel } from '@/components/admin/bulk-actions/BulkActionsPanel';
import { formatKopecks } from '@/utils/format-kopecks';
import { cancelOrderAction, restartOrderAction } from '@/actions/admin/orders';
import { classifyOrderError } from '@/lib/order-error-classifier';
import { ConfirmModal } from '@/components/ui/confirm-modal';

interface Props {
  data: OrderColumn[];
  canSeeRates?: boolean;
  userRole?: string;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  AWAITING_PAYMENT: { label: 'Ожидает оплаты', dot: 'bg-zinc-400',                   bg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  PENDING:          { label: 'В очереди',      dot: 'bg-amber-500',                  bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  PENDING_CHECK:    { label: 'Проверка ссылки', dot: 'bg-sky-500 animate-pulse',      bg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20' },
  IN_PROGRESS:      { label: 'В работе',       dot: 'bg-primary animate-pulse',      bg: 'bg-primary/10 text-primary border-primary/20' },
  COMPLETED:        { label: 'Выполнен',       dot: 'bg-emerald-500',                bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  PARTIAL:          { label: 'Частично',       dot: 'bg-orange-500',                 bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20' },
  CANCELED:         { label: 'Отменён',        dot: 'bg-rose-500',                   bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
  ERROR:            { label: 'Ошибка',         dot: 'bg-red-500',                    bg: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20' },
  REFUNDING:        { label: 'Возврат',        dot: 'bg-purple-500',                 bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, dot: 'bg-muted-foreground', bg: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap ${config.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function InfoStack({ order }: { order: OrderColumn }) {
  const s = order.service;
  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const netName = s?.category?.network?.name || 'Соцсеть';
  const catName = s?.category?.name || '—';
  const srvName = s?.name || 'Услуга';
  
  // Format Date: 2026-08-21 01:53:06
  const dateObj = new Date(order.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFormatted = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(order.link);
      setCopied(true);
      toast.success('Ссылка скопирована');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <div className="flex flex-col space-y-1 text-xs min-w-0 py-0.5">
      {/* 1. Соцсеть · Категория · Название */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px] uppercase select-none tracking-wide">
          {netName}
        </span>
        <span className="font-bold text-foreground text-xs">
          {catName}
        </span>
        <span className="text-muted-foreground font-normal">·</span>
        {order.service?.numericId && (
          <ServiceIdBadge 
            numericId={order.service.numericId}
            href={`/admin/catalog?q=${order.service.numericId}`}
          />
        )}
        <span className="text-muted-foreground font-medium truncate max-w-[220px]" title={srvName}>
          «{srvName}»
        </span>
      </div>

      {/* 2. Ссылка */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <span className="text-muted-foreground select-none">Ссылка:</span>
        <a 
          href={order.link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline truncate max-w-[280px]"
          title={order.link}
          onClick={(e) => e.stopPropagation()}
        >
          {order.link}
        </a>
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
          title="Скопировать ссылку"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>

      {/* 3. Количество и остаток */}
      <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
        <span>
          Кол-во: <strong className="text-foreground font-semibold">{order.quantity.toLocaleString('ru-RU')} шт.</strong>
        </span>
        {order.remains > 0 ? (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">
            (остаток: {order.remains.toLocaleString('ru-RU')})
          </span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            (остаток: 0)
          </span>
        )}
      </div>

      {/* 4. Раскрывающийся спойлер деталей провайдера */}
      <div className="pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDetailsOpen(!detailsOpen);
          }}
          className="text-primary hover:underline text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          {detailsOpen ? '▾ Скрыть детали провайдера' : '▸ Показать детали провайдера'}
        </button>

        {detailsOpen && (
          <div className="mt-1.5 space-y-1 text-xs pt-1 border-t border-border/40">
            <div className="flex items-baseline gap-1.5">
              <span className="text-foreground/70 shrink-0">Провайдер:</span>
              <span className="text-primary font-medium">
                {order.providerName || '—'} {order.externalId ? `(${order.externalId})` : ''}
              </span>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-foreground/70 shrink-0">ID заказа у провайдера:</span>
              <span className="text-foreground font-mono">
                {order.externalId || '-'}
              </span>
            </div>

            <div className="flex items-start gap-1.5 pt-0.5">
              <span className="text-foreground/70 shrink-0">Статус провайдера:</span>
              <div className="space-y-1 flex-1">
                {order.error ? (() => {
                  const classified = classifyOrderError(order.error);
                  if (classified) {
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border ${classified.badgeBg} ${classified.badgeText} ${classified.badgeBorder}`}>
                            {classified.code}
                          </span>
                          <span className="font-semibold text-foreground text-[11px]">
                            {classified.titleRu}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground break-all">
                          {order.error}
                        </div>
                      </div>
                    );
                  }
                  return <span className="text-muted-foreground break-all">{order.error}</span>;
                })() : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function timeRelative(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} д назад`;
}

export function OrderClient({ data, canSeeRates = true, userRole = 'SUPPORT' }: Props) {
  const [optimisticData, addOptimisticUpdate] = useOptimistic(
    data,
    (state, update: { id: string, status: keyof typeof STATUS_CONFIG | string, remains?: number }) => {
      return state.map(order => 
        order.id === update.id 
          ? { ...order, status: update.status, remains: update.remains ?? order.remains } 
          : order
      );
    }
  );

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const editOrderId = searchParams.get('edit_order_id');
  const selectedOrder = React.useMemo(
    () => optimisticData.find(o => o.id === editOrderId) ?? null,
    [optimisticData, editOrderId]
  );

  // Selection mode & Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Status-Locked Selection (Poka-Yoke): Lock selection to homogeneous order status
  const lockedStatus = React.useMemo(() => {
    if (selectedIds.size === 0) return null;
    const firstSelected = optimisticData.find(o => selectedIds.has(o.id));
    return firstSelected ? firstSelected.status : null;
  }, [selectedIds, optimisticData]);

  // Confirm Modals state for single row actions
  const [cancelModalOrder, setCancelModalOrder] = useState<OrderColumn | null>(null);
  const [isBulkCancelOpen, setIsBulkCancelOpen] = useState(false);
  const bulkRestartTriggerRef = React.useRef<(() => void) | null>(null);
  const [, startTransition] = useTransition();

  const canCancel = ['OWNER', 'ADMIN'].includes(userRole);

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      const targetOrder = optimisticData.find(o => o.id === id);
      if (lockedStatus && targetOrder && targetOrder.status !== lockedStatus) {
        toast.warning(`Выбор заблокирован по статусу «${STATUS_LABELS[lockedStatus] || lockedStatus}». Нельзя смешивать разные статусы.`);
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      // Select all of the FIRST available order status or all if homogeneous
      const targetStatus = lockedStatus || optimisticData[0]?.status;
      if (targetStatus) {
        const matchingIds = optimisticData.filter(o => o.status === targetStatus).map(o => o.id);
        setSelectedIds(new Set(matchingIds));
        toast.info(`Выбрано ${matchingIds.length} заказов со статусом «${STATUS_LABELS[targetStatus] || targetStatus}»`);
      }
    }
  };

  function openDrawer(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('edit_order_id', id);
    router.push(`${pathname}?${params.toString()}`);
  }

  function closeDrawer() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit_order_id');
    router.replace(`${pathname}?${params.toString()}`);
  }

  const handleSingleCancel = (order: OrderColumn) => {
    setCancelModalOrder(order);
  };

  const executeSingleCancel = () => {
    if (!cancelModalOrder) return;
    const orderId = cancelModalOrder.id;
    setCancelModalOrder(null);

    startTransition(async () => {
      addOptimisticUpdate({ id: orderId, status: 'CANCELED' });
      try {
        const fd = new FormData();
        fd.set('orderId', orderId);
        const res = await cancelOrderAction(fd);
        if (res.success) {
          toast.success(`🚫 Заказ #${cancelModalOrder.numericId} отменён`);
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error((err as Error).message || 'Ошибка при отмене заказа');
      }
    });
  };

  const handleSingleRestart = (order: OrderColumn) => {
    startTransition(async () => {
      addOptimisticUpdate({ id: order.id, status: 'IN_PROGRESS' });
      try {
        const fd = new FormData();
        fd.set('orderId', order.id);
        const res = await restartOrderAction(fd);
        if (res.success) {
          toast.success(`⟳ Заказ #${order.numericId} перезапущен`);
        } else if (res.error) {
          toast.error(res.error);
        }
      } catch (err) {
        toast.error((err as Error).message || 'Ошибка при перезапуске заказа');
      }
    });
  };

  const selectedOrdersList = React.useMemo(
    () => optimisticData.filter(o => selectedIds.has(o.id)),
    [optimisticData, selectedIds]
  );

  return (
    <div className="w-full space-y-4">
      {/* Top Toolbar: Selection Mode Toggle & Page Controls */}
      <div className="flex items-center justify-between gap-3 bg-muted/20 border border-border/60 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setSelectionMode(!selectionMode);
              if (selectionMode) setSelectedIds(new Set());
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all cursor-pointer ${
              selectionMode
                ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                : 'bg-background hover:bg-muted text-foreground border-border/80'
            }`}
          >
            {selectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {selectionMode ? 'Выйти из выбора' : 'Выбрать заказы'}
          </button>

          {selectionMode && (
            <>
              {/* Кнопка "Выбрать все" с учетом зафиксированного статуса */}
              <button
                type="button"
                onClick={() => {
                  const targetStatus = lockedStatus || optimisticData[0]?.status;
                  if (targetStatus) {
                    const matchingIds = optimisticData.filter(o => o.status === targetStatus).map(o => o.id);
                    setSelectedIds(new Set(matchingIds));
                    toast.info(`Выбрано ${matchingIds.length} заказов со статусом «${STATUS_LABELS[targetStatus] || targetStatus}»`);
                  }
                }}
                className="px-2.5 py-1 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border/60 rounded-md transition-all cursor-pointer"
              >
                {lockedStatus 
                  ? `Выбрать все (${STATUS_LABELS[lockedStatus] || lockedStatus}: ${optimisticData.filter(o => o.status === lockedStatus).length})`
                  : `Выбрать все (${optimisticData.length})`}
              </button>

              {/* Кнопка "Снять всё" появляется, когда есть выбранные элементы */}
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2.5 py-1 text-xs font-medium bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 rounded-md transition-all cursor-pointer"
                >
                  Снять всё
                </button>
              )}
            </>
          )}

          {/* Status Lock Badge Indicator */}
          {selectionMode && lockedStatus && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 animate-in fade-in">
              <span>🔒 Статус: {STATUS_LABELS[lockedStatus] || lockedStatus}</span>
            </span>
          )}

          {/* Быстрые действия прямо в верхней панели (Contextual for locked status) */}
          {selectionMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-border/60 animate-in fade-in duration-150">
              <span className="text-xs font-bold text-foreground mr-1">
                {selectedIds.size} шт:
              </span>

              {/* Кнопка отмены доступна ТОЛЬКО для нефинализированных и ошибочных заказов */}
              {!['COMPLETED', 'CANCELED'].includes(lockedStatus || '') && (
                <button
                  type="button"
                  onClick={() => setIsBulkCancelOpen(true)}
                  className="px-2.5 py-1 text-xs font-bold bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-md transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Отменить и вернуть ({selectedIds.size})</span>
                </button>
              )}

              {/* Кнопка перезапуска доступна для ERROR / PENDING / PENDING_CHECK */}
              {['ERROR', 'PENDING', 'PENDING_CHECK'].includes(lockedStatus || '') && (
                <button
                  type="button"
                  onClick={() => {
                    if (bulkRestartTriggerRef.current) {
                      bulkRestartTriggerRef.current();
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 rounded-md transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Перезапустить ({selectedIds.size})</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Показано: <strong className="text-foreground font-mono">{optimisticData.length}</strong>
        </div>
      </div>

      {/* Desktop View: Clean Semantic Table (lg+) — Zero horizontal scroll & True tabular alignment */}
      <div className="hidden lg:block w-full bg-card border border-border/80 rounded-xl shadow-2xs overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground select-none">
              <th scope="col" className="py-2 px-3 w-[125px]">
                <OrderSortableHeader title="ID" field="numericId" />
              </th>
              <th scope="col" className="py-2 px-3 w-[160px]">
                <OrderSortableHeader title="Клиент" field="client" />
              </th>
              <th scope="col" className="py-2.5 px-3">Информация о заказе</th>
              <th scope="col" className="py-2 px-3 w-[130px]">
                <OrderSortableHeader title="Дата" field="createdAt" />
              </th>
              <th scope="col" className="py-2 px-3 w-[100px] text-right">
                <OrderSortableHeader title="Сумма" field="charge" align="right" />
              </th>
              <th scope="col" className="py-2 px-3 w-[120px]">
                <OrderSortableHeader title="Статус" field="status" />
              </th>
              <th scope="col" className="py-2.5 px-3 w-[90px] text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {optimisticData.map((order) => {
              const isSelected = selectedIds.has(order.id);
              const isLockedOut = lockedStatus !== null && order.status !== lockedStatus;
              const dateObj = new Date(order.createdAt);
              const formattedDate = dateObj.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
              const formattedTime = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const envMode = order.resolvedEnvironmentMode || resolveOrderEnvironmentMode(order);
              const envConfig = ORDER_ENV_CONFIG[envMode] || ORDER_ENV_CONFIG.PRODUCTION;

              return (
                <tr
                  key={order.id}
                  onClick={() => {
                    if (selectionMode) {
                      if (!isLockedOut) toggleSelectRow(order.id);
                    } else {
                      openDrawer(order.id);
                    }
                  }}
                  className={`transition-colors cursor-pointer group ${envConfig.rowBorderClass} ${
                    isSelected 
                      ? 'bg-primary/5' 
                      : isLockedOut
                      ? 'opacity-40 bg-muted/10 cursor-not-allowed'
                      : 'hover:bg-muted/30'
                  }`}
                  title={isLockedOut ? `Нельзя смешивать со статусом «${STATUS_LABELS[lockedStatus] || lockedStatus}»` : undefined}
                >
                  {/* ID */}
                  <td className={`py-3 px-3 align-top font-mono text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors ${envConfig.rowBorderClass}`}>
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {selectionMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isLockedOut}
                            onChange={() => toggleSelectRow(order.id)}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary shrink-0 ${
                              isLockedOut ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                            }`}
                            title={isLockedOut ? `Нельзя выбрать: активна фиксация на статусе «${STATUS_LABELS[lockedStatus] || lockedStatus}»` : undefined}
                          />
                        )}
                        <span className="truncate font-bold text-foreground">#{order.numericId}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <TenantBrandBadge tenantId={order.tenantId} />
                        <OrderEnvironmentBadge mode={envMode} size="sm" />
                      </div>
                    </div>
                  </td>

                  {/* User Email (Never clipped — wraps softly) */}
                  <td className="py-3 px-3 align-top min-w-[140px] max-w-[200px]">
                    <Link
                      href={`/admin/clients?q=${encodeURIComponent(order.user.email)}`}
                      title={order.user.email}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium text-foreground/90 hover:text-primary hover:underline break-all whitespace-normal leading-snug block"
                    >
                      {order.user.email}
                    </Link>
                  </td>

                  {/* Information Stack */}
                  <td className="py-3 px-3 align-top">
                    <InfoStack order={order} />
                  </td>

                  {/* Date Column */}
                  <td className="py-3 px-3 align-top whitespace-nowrap">
                    <div className="flex flex-col text-xs leading-normal font-mono">
                      <span className="font-semibold text-foreground tabular-nums text-[11px]" suppressHydrationWarning>
                        {formattedDate} {formattedTime}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-sans font-medium" suppressHydrationWarning>
                        {timeRelative(order.createdAt)}
                      </span>
                    </div>
                  </td>

                  {/* Price & Margin */}
                  <td className="py-3 px-3 align-top text-right whitespace-nowrap font-mono">
                    <div className="flex flex-col items-end text-xs leading-tight font-medium">
                      <div className="font-bold text-foreground tabular-nums text-xs">
                        {formatKopecks(order.charge)}
                      </div>
                      {canSeeRates && (
                        <div className="text-muted-foreground/70 text-[10px] select-none tabular-nums font-mono">
                          закуп: {formatKopecks(order.providerCost)}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 align-top whitespace-nowrap">
                    <StatusBadge status={order.status} />
                  </td>

                  {/* Row Actions */}
                  <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => openDrawer(order.id)}
                        className="p-1.5 rounded-md text-primary bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer"
                        title="Редактировать заказ / Сменить статус"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSingleRestart(order)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all cursor-pointer"
                        title="Перезапустить заказ"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      {canCancel && !['COMPLETED', 'CANCELED'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => handleSingleCancel(order)}
                          className="p-1.5 rounded-md text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 transition-all cursor-pointer"
                          title="Отменить / Удалить заказ с возвратом"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Stack (< lg) — Zero horizontal scroll */}
      <div className="block lg:hidden space-y-3">
        {optimisticData.map((order) => {
          const isSelected = selectedIds.has(order.id);
          const isLockedOut = lockedStatus !== null && order.status !== lockedStatus;
          const envMode = order.resolvedEnvironmentMode || resolveOrderEnvironmentMode(order);
          const envConfig = ORDER_ENV_CONFIG[envMode] || ORDER_ENV_CONFIG.PRODUCTION;

          return (
            <article
              key={order.id}
              onClick={() => {
                if (selectionMode) {
                  if (!isLockedOut) toggleSelectRow(order.id);
                } else {
                  openDrawer(order.id);
                }
              }}
              className={`bg-card border border-border/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3 cursor-pointer ${envConfig.rowBorderClass} ${
                isSelected 
                  ? 'ring-2 ring-primary/40 bg-primary/5' 
                  : isLockedOut 
                  ? 'opacity-40 bg-muted/10 cursor-not-allowed'
                  : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isLockedOut}
                      onChange={() => toggleSelectRow(order.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-4 h-4 rounded border-border text-primary ${
                        isLockedOut ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'
                      }`}
                    />
                  )}
                  <span className="font-mono font-bold text-sm text-primary">#{order.numericId}</span>
                  <TenantBrandBadge tenantId={order.tenantId} />
                  <OrderEnvironmentBadge mode={envMode} size="sm" />
                  <span className="text-xs text-muted-foreground" title={new Date(order.createdAt).toLocaleString('ru-RU')}>
                    {timeRelative(order.createdAt)}
                  </span>
                </div>

                <StatusBadge status={order.status} />
              </div>

              {/* User Email */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Клиент:</span>
                <Link
                  href={`/admin/clients?q=${encodeURIComponent(order.user.email)}`}
                  className="font-semibold text-primary hover:underline truncate max-w-[200px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {order.user.email}
                </Link>
              </div>

              {/* Info Stack */}
              <InfoStack order={order} />

              {/* Footer */}
              <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Стоимость</span>
                  <span className="font-bold text-sm tabular-nums text-foreground">{formatKopecks(order.charge)}</span>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => openDrawer(order.id)}
                    className="p-2 rounded-xl bg-muted text-foreground font-semibold text-xs flex items-center gap-1"
                  >
                    <Info className="w-3.5 h-3.5" /> Детали
                  </button>
                  {canCancel && !['COMPLETED', 'CANCELED'].includes(order.status) && (
                    <button
                      type="button"
                      onClick={() => handleSingleCancel(order)}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-600 font-semibold text-xs flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Отмена
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Floating Bulk Actions Panel */}
      {selectionMode && (
        <BulkActionsPanel
          selectedOrders={selectedOrdersList}
          canSeeRates={canSeeRates}
          userRole={userRole}
          onClearSelection={() => setSelectedIds(new Set())}
          externalCancelOpen={isBulkCancelOpen}
          onOpenCancelModal={() => setIsBulkCancelOpen(true)}
          onCloseCancelModal={() => setIsBulkCancelOpen(false)}
          onRegisterRestart={(fn) => {
            bulkRestartTriggerRef.current = fn;
          }}
        />
      )}

      {/* Order Details Modal (Wide Bento Window) */}
      <OrderDetailsModal
        order={selectedOrder}
        onClose={closeDrawer}
        canSeeRates={canSeeRates}
        onSuccess={() => router.refresh()}
      />

      {/* Single Cancel Confirm Modal */}
      {cancelModalOrder && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setCancelModalOrder(null)}
          onConfirm={executeSingleCancel}
          title={`Отмена заказа #${cancelModalOrder.numericId}`}
          confirmText="Отменить и вернуть"
          isDanger={true}
        >
          <p className="text-xs text-muted-foreground">
            Вы уверены, что хотите отменить заказ #{cancelModalOrder.numericId} и произвести возврат средств клиенту ({cancelModalOrder.user.email})?
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}
