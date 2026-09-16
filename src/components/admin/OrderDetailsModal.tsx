'use client';

import * as React from 'react';
import { useState, useEffect, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  RotateCcw, 
  XCircle, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Share2, 
  User, 
  Layers, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Zap, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import {
  cancelOrderAction,
  restartOrderAction,
  setOrderStatusAction,
  forceCompleteOrderAction,
  getFailoverPreview,
  manualRerouteOrder,
  getOrderDetailsAction,
} from '@/actions/admin/orders';
import { formatKopecks } from '@/utils/format-kopecks';
import { classifyOrderError } from '@/lib/order-error-classifier';

export interface OrderModalColumn {
  id: string;
  numericId: number;
  externalId?: string | null;
  link?: string;
  quantity?: number;
  remains?: number;
  status: string;
  charge: number | string;
  providerCost?: number | string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  isDripFeed?: boolean;
  dripExternalIds?: string[];
  runs?: number | null;
  interval?: number | null;
  currentRun?: number;
  error?: string | null;
  user?: { email: string; id?: string };
  providerName?: string | null;
  tenantId?: string;
  service?: {
    name: string;
    isCancelEnabled?: boolean;
    category: {
      name: string;
      network: { name: string } | null;
    };
  };
}

export interface OrderDetailsModalProps {
  order: OrderModalColumn | null;
  isOpen?: boolean;
  onClose: () => void;
  canSeeRates?: boolean;
  userRole?: string;
  addOptimisticUpdate?: (update: { id: string; status: string; remains?: number }) => void;
  onSuccess?: () => void;
}

interface FailoverRoute {
  routeId: string;
  providerName: string;
  priceUnknown?: boolean;
  newCostCents: number | null;
  marginCents: number | null;
  marginPercent: number | null;
  isMarginPositive: boolean;
}

interface FailoverPreviewData {
  success: boolean;
  clientPaidCents: number;
  currentBalance: number;
  routes: FailoverRoute[];
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; borderCls: string }> = {
  AWAITING_PAYMENT: { label: 'Ожидает оплаты', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400', borderCls: 'border-slate-500/30' },
  PENDING:          { label: 'В очереди',       cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', borderCls: 'border-amber-500/30' },
  IN_PROGRESS:      { label: 'В работе',        cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',       borderCls: 'border-sky-500/30' },
  COMPLETED:        { label: 'Выполнен',        cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', borderCls: 'border-emerald-500/30' },
  PARTIAL:          { label: 'Частично',        cls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', borderCls: 'border-orange-500/30' },
  CANCELED:         { label: 'Отменён',         cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',     borderCls: 'border-rose-500/30' },
  ERROR:            { label: 'Ошибка',          cls: 'bg-red-500/10 text-red-600 dark:text-red-400',       borderCls: 'border-red-500/30' },
  REFUNDING:        { label: 'Возврат средств', cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', borderCls: 'border-violet-500/30' },
};

function localizeProviderError(error: string | null): string | null {
  if (!error) return null;
  const errLower = error.toLowerCase();

  if (
    errLower.includes('fail-fast') ||
    errLower.includes('mock_') ||
    errLower.includes('.env') ||
    errLower.includes('err_internal_server') ||
    errLower.includes('configure it in')
  ) {
    return null;
  }

  if (errLower.includes('invalid link') || errLower.includes('bad link')) {
    return 'Неверная ссылка (профиль закрыт или неверный формат)';
  }
  if (errLower.includes('rate limit') || errLower.includes('too many requests')) {
    return 'Превышен лимит запросов у провайдера';
  }
  if (errLower.includes('not enough balance') || errLower.includes('low balance')) {
    return 'Недостаточный баланс у провайдера';
  }
  return error;
}

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
    setConfirmAction(null);
  }, [fullOrder]);

  // Keyboard Shortcuts: Esc, Alt+C, Alt+R, Alt+M
  useEffect(() => {
    if (!order) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.altKey) {
        if (e.code === 'KeyC') {
          e.preventDefault();
          setConfirmAction('cancel');
          setConfirmOpen(true);
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          setConfirmAction('restart');
          setConfirmOpen(true);
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          if (!isFailoverOpen) {
            handleFailoverClick();
          } else {
            setIsFailoverOpen(false);
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, isFailoverOpen]);

  if (!order || !isOpen) return null;

  const currentOrder = fullOrder || order;

  // Safe Price & Margin Calculations
  const quantity = currentOrder.quantity ?? 0;
  const parseAmountRub = (val: number | string | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') {
      return val > 1000 && Number.isInteger(val) ? val / 100 : val;
    }
    const str = String(val).replace(/,/g, '.').trim();
    const num = parseFloat(str);
    if (!Number.isFinite(num)) return 0;
    return num > 1000 && Number.isInteger(num) ? num / 100 : num;
  };

  const chargeRub = parseAmountRub(currentOrder.charge);
  const pricePerUnitRub = quantity > 0 ? chargeRub / quantity : 0;
  const costRub = parseAmountRub(currentOrder.providerCost);
  const marginRub = chargeRub - costRub;
  const marginPercent = chargeRub > 0 ? Math.round((marginRub / chargeRub) * 100) : 0;

  const progressPercent = quantity > 0 
    ? Math.min(100, Math.max(0, Math.round(((quantity - (currentOrder.remains ?? 0)) / quantity) * 100))) 
    : 100;

  const localizedError = localizeProviderError(currentOrder.error ?? null);
  const statusInfo = STATUS_CONFIG[currentOrder.status] || { label: currentOrder.status, cls: 'bg-muted text-muted-foreground', borderCls: 'border-border' };

  // Copy helpers
  const handleCopyLink = () => {
    if (currentOrder.link) {
      navigator.clipboard.writeText(currentOrder.link);
      setCopiedLink(true);
      toast.success('Ссылка скопирована в буфер');
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(String(currentOrder.numericId));
    setCopiedId(true);
    toast.success(`ID #${currentOrder.numericId} скопирован`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Status Change Handler
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

  // Confirmation actions execution
  const executeConfirm = () => {
    if (!currentOrder || !confirmAction) return;
    setConfirmOpen(false);
    const fd = new FormData();
    fd.append('orderId', currentOrder.id);

    if (confirmAction === 'cancel') {
      startTransition(async () => {
        if (addOptimisticUpdate) {
          addOptimisticUpdate({ id: currentOrder.id, status: 'CANCELED' });
        }
        try {
          const r = await cancelOrderAction(fd);
          if (r.success) {
            toast.success(`Заказ #${currentOrder.numericId} отменен с возвратом средств клиенту`);
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

  // Failover Handler
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

  const selectedRoute = failoverPreview?.routes.find(r => r.routeId === selectedRouteId);

  if (!mounted) return null;

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
        {/* TOP HEADER */}
        <div className="px-6 py-4 border-b border-border/70 bg-muted/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-mono font-black text-sm shrink-0">
              #{currentOrder.numericId}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-foreground tracking-tight truncate">
                  Заказ #{currentOrder.numericId}
                </h2>
                <button
                  onClick={handleCopyId}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  title="Скопировать номер заказа"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {/* Brand Badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                  currentOrder.tenantId === 'flux'
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                }`}>
                  {currentOrder.tenantId === 'flux' ? 'SMMflux' : 'SMMplan'}
                </span>
                {/* Status Badge */}
                <span className={`text-xs px-2.5 py-0.5 rounded-lg font-bold border ${statusInfo.cls} ${statusInfo.borderCls}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs font-semibold text-muted-foreground truncate mt-0.5">
                {currentOrder.service?.category.network?.name ? `${currentOrder.service.category.network.name} · ` : ''}
                {currentOrder.service?.category.name} → <span className="text-foreground">{currentOrder.service?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/admin/orders/${currentOrder.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-all text-xs font-bold border border-border/40 cursor-pointer"
              title="Открыть заказ в новом окне / отдельной вкладке"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">В новом окне</span>
            </a>
            <span className="hidden sm:inline-flex text-[11px] text-muted-foreground font-mono bg-muted/60 px-2 py-1 rounded-lg border border-border/40">
              ESC
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
              title="Закрыть окно (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DIALOG BODY (3-Column Bento Grid) */}
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
                
                {/* ── CARD 1: КЛИЕНТ & ЦЕЛЬ ── */}
                <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>Клиент & Ссылка</span>
                    </div>

                    {/* Client Email */}
                    <div className="bg-card border border-border/60 rounded-xl p-2.5">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Email клиента</div>
                      <div className="text-xs font-bold text-foreground truncate mt-0.5">
                        {currentOrder.user?.email || 'Гостевой заказ (без email)'}
                      </div>
                    </div>

                    {/* Target Link */}
                    <div className="bg-card border border-border/60 rounded-xl p-2.5 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-bold">
                        <span>Ссылка на цель</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleCopyLink}
                            className="p-1 rounded text-muted-foreground hover:text-foreground"
                            title="Скопировать ссылку"
                          >
                            {copiedLink ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {currentOrder.link && (
                            <a
                              href={currentOrder.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded text-primary hover:text-primary/80"
                              title="Открыть в новой вкладке"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-primary font-semibold truncate break-all">
                        {currentOrder.link || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Volume & Progress */}
                  <div className="space-y-2 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Количество:</span>
                      <span className="font-bold tabular-nums">{quantity.toLocaleString('ru-RU')} шт</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Остаток:</span>
                      <span className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {(currentOrder.remains ?? 0).toLocaleString('ru-RU')} шт
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                        <span>Прогресс</span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/40">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CARD 2: ИСПОЛНЕНИЕ & ПРОВАЙДЕР ── */}
                <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <Layers className="w-3.5 h-3.5 text-sky-500" />
                      <span>Исполнение</span>
                    </div>

                    {/* Provider Info */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-card border border-border/60 rounded-xl p-2.5">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Провайдер</div>
                        <div className="text-xs font-bold text-foreground truncate mt-0.5">
                          {currentOrder.providerName || 'Не назначен'}
                        </div>
                      </div>
                      <div className="bg-card border border-border/60 rounded-xl p-2.5">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">ID провайдера</div>
                        <div className="text-xs font-mono font-bold text-foreground truncate mt-0.5">
                          {currentOrder.externalId ? `#${currentOrder.externalId}` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Status Changer Input */}
                    <div className="bg-card border border-border/60 rounded-xl p-2.5 space-y-2">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Управление статусом</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="flex-1 bg-muted/60 border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground outline-none cursor-pointer"
                        >
                          <option value="PENDING">⏳ В очереди</option>
                          <option value="IN_PROGRESS">⚡ В работе</option>
                          <option value="COMPLETED">🟢 Выполнен</option>
                          <option value="PARTIAL">🟠 Частично выполнен</option>
                          <option value="CANCELED">❌ Отменён</option>
                          <option value="ERROR">🔴 Ошибка</option>
                          <option value="AWAITING_PAYMENT">⚪ Ожидает оплаты</option>
                        </select>
                        <button
                          onClick={handleSetStatus}
                          disabled={isPending || selectedStatus === currentOrder.status}
                          className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-all cursor-pointer shrink-0"
                        >
                          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
                        </button>
                      </div>

                      {/* Remains input if PARTIAL */}
                      {selectedStatus === 'PARTIAL' && (
                        <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-muted-foreground font-semibold">Остаток для возврата:</span>
                          <input
                            type="number"
                            min="0"
                            max={quantity}
                            value={remains}
                            onChange={(e) => setRemains(Number(e.target.value))}
                            className="w-24 bg-muted/60 border border-border rounded px-2 py-1 text-xs font-mono font-bold text-right outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="space-y-1.5 pt-2 border-t border-border/40 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Создан:</span>
                      <span className="font-mono text-foreground">
                        {currentOrder.createdAt ? new Date(currentOrder.createdAt).toLocaleString('ru-RU') : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Обновлен:</span>
                      <span className="font-mono text-foreground">
                        {currentOrder.updatedAt ? new Date(currentOrder.updatedAt).toLocaleString('ru-RU') : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── CARD 3: ЮНИТ-ЭКОНОМИКА & БИЛЛИНГ ── */}
                <div className="bg-muted/30 border border-border/60 rounded-2xl p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Юнит-экономика</span>
                    </div>

                    {/* Client Price & Unit Rate */}
                    <div className="bg-card border border-border/60 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Сумма заказа</span>
                        <span className="text-sm font-extrabold text-foreground tabular-nums">
                          {chargeRub.toFixed(2)} ₽
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Цена за 1 шт:</span>
                        <span className="font-mono">{pricePerUnitRub.toFixed(4)} ₽ / шт</span>
                      </div>
                    </div>

                    {/* PRICE DRIFT HOLD ALERT & ACTION GUIDANCE */}
                    {currentOrder.error && currentOrder.error.includes('PRICE_DRIFT_HOLD') && (
                      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 space-y-2 text-xs">
                        <div className="flex items-center gap-1.5 font-extrabold text-rose-600 dark:text-rose-400">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Защита от убытка (Отрицательная маржа)</span>
                        </div>
                        <p className="text-[11px] text-foreground/90 leading-snug">
                          Поставщик поднял закупочную цену (<strong>{costRub.toFixed(2)} ₽</strong>), из-за чего выполнение заказа принесет убыток платформе (клиент оплатил <strong>{chargeRub.toFixed(2)} ₽</strong>).
                        </p>
                        <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px]">
                          <div className="font-bold text-foreground">Что делать сотруднику:</div>
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            1. <strong>«Сменить провайдера»</strong> — выбрать альтернативного поставщика с положительной маржой.
                          </div>
                          <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            2. <strong>«Отменить и вернуть»</strong> — вернуть клиенту 100% средств на баланс, если дешевых поставщиков нет.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cost & Margin (Separated: Cost visible in modal to Support & Admin, Margin strictly OWNER/ADMIN) */}
                    <div className="bg-card border border-border/60 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Закупочная цена (себестоимость):</span>
                        <span className="font-mono font-bold text-foreground tabular-nums">
                          {costRub.toFixed(2)} ₽
                        </span>
                      </div>
                      {canSeeRates ? (
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/40">
                          <span className="font-bold text-foreground">Чистая маржа:</span>
                          <span className={`font-mono font-extrabold tabular-nums ${
                            marginRub >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {marginRub >= 0 ? `+${marginRub.toFixed(2)}` : marginRub.toFixed(2)} ₽ ({marginPercent}%)
                          </span>
                        </div>
                      ) : (
                        <div className="pt-1.5 border-t border-border/40 text-right text-[10px] text-muted-foreground italic">
                          🔒 Маржа доступна только Администраторам
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dripfeed / Anomaly Indicator */}
                  <div className="pt-2 border-t border-border/40">
                    {currentOrder.isDripFeed ? (
                      <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Dripfeed: {currentOrder.currentRun ?? 1} из {currentOrder.runs ?? 1} запусков</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>Тип заказа:</span>
                        <span className="font-semibold text-foreground">Прямой запуск (Одиночный)</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* PROVIDER ERROR BANNER WITH ERROR TAXONOMY */}
              {currentOrder.error && (() => {
                const classified = classifyOrderError(currentOrder.error);
                return (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                        <ShieldAlert className="w-4 h-4" />
                        <span>Ответ / Ошибка провайдера:</span>
                      </div>
                      {classified && (
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${classified.badgeBg} ${classified.badgeText} ${classified.badgeBorder}`}>
                          {classified.code}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-rose-700 dark:text-rose-300">
                      {classified ? classified.titleRu : currentOrder.error}
                    </div>

                    {classified && (
                      <div className="text-xs text-foreground/85 leading-relaxed bg-card/60 p-2.5 rounded-xl border border-border/50">
                        <div className="font-semibold text-[11px] text-muted-foreground uppercase mb-0.5">Пояснение:</div>
                        {classified.descriptionRu}
                        <div className="mt-2 pt-1.5 border-t border-border/40 text-[11px] text-primary font-medium">
                          💡 <strong>Действие:</strong> {classified.recommendedAction}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-muted-foreground font-mono break-all pt-0.5">
                      Сырой ответ: {currentOrder.error}
                    </div>
                  </div>
                );
              })()}

              {/* FAILOVER PREVIEW SECTION (INLINE ACCORDION) */}
              {isFailoverOpen && failoverPreview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h3 className="font-extrabold text-sm text-foreground">
                        Резервные маршруты (Failover Provider Switch)
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsFailoverOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground font-bold"
                    >
                      Скрыть ✕
                    </button>
                  </div>

                  {failoverPreview.routes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Для данной услуги нет настроенных резервных маршрутов в каталоге.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {failoverPreview.routes.map((route) => {
                          const isSelected = selectedRouteId === route.routeId;
                          return (
                            <div
                              key={route.routeId}
                              onClick={() => setSelectedRouteId(route.routeId)}
                              className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1.5 ${
                                isSelected
                                  ? 'bg-amber-500/15 border-amber-500 text-foreground ring-1 ring-amber-500 shadow-sm'
                                  : 'bg-card border-border/60 hover:border-amber-500/40 text-muted-foreground'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-foreground">{route.providerName}</span>
                                <span className={route.isMarginPositive ? 'text-emerald-500' : 'text-rose-500'}>
                                  {route.marginPercent !== null ? `${route.marginPercent}%` : '—'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span>Новая закупка:</span>
                                <span className="font-mono font-bold">
                                  {route.newCostCents !== null ? `${(route.newCostCents / 100).toFixed(2)} ₽` : 'Неизвестно'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {selectedRoute && !selectedRoute.isMarginPositive && (
                        <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-xs space-y-2">
                          <p className="text-rose-600 dark:text-rose-400 font-bold">
                            ⚠️ Внимание: Выбранный провайдер сделает маржу отрицательной (убыток).
                          </p>
                          <label className="flex items-center gap-2 cursor-pointer font-semibold">
                            <input
                              type="checkbox"
                              checked={acknowledgeBlindReroute}
                              onChange={(e) => setAcknowledgeBlindReroute(e.target.checked)}
                              className="rounded border-border"
                            />
                            <span>Я осознаю финансовый риск и подтверждаю перевод заказа</span>
                          </label>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={handleConfirmFailover}
                          disabled={isPending || (!selectedRoute?.isMarginPositive && !acknowledgeBlindReroute)}
                          className="px-4 py-2 bg-warning hover:bg-warning/90 disabled:opacity-40 text-warning-foreground font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          <span>Перевести заказ на {selectedRoute?.providerName || 'маршрут'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 border-t border-border/70 bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
            <span className="font-semibold text-foreground">Действия с заказом #{currentOrder.numericId}:</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {/* Failover Button */}
            <button
              onClick={() => {
                if (!isFailoverOpen) {
                  handleFailoverClick();
                } else {
                  setIsFailoverOpen(false);
                }
              }}
              disabled={isPending}
              className="px-3.5 py-2 rounded-xl border border-warning/30 bg-warning/10 hover:bg-warning/20 text-warning-text font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Перевести заказ на резервного провайдера (Alt+M)"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Сменить провайдера</span>
            </button>

            {/* Restart Order */}
            <button
              onClick={() => {
                setConfirmAction('restart');
                setConfirmOpen(true);
              }}
              disabled={isPending}
              className="px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted font-bold text-xs text-foreground transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Повторить отправку заказа провайдеру (Alt+R)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Перезапустить</span>
            </button>

            {/* Force Complete */}
            {(() => {
              const isMissingExternalId = Boolean(currentOrder.providerName) && !currentOrder.externalId;
              const disableComplete = isPending || currentOrder.status === 'COMPLETED' || isMissingExternalId;
              
              return (
                <button
                  onClick={() => {
                    setConfirmAction('force_complete');
                    setConfirmOpen(true);
                  }}
                  disabled={disableComplete}
                  title={isMissingExternalId ? 'Запрещено: нет ID провайдера' : 'Завершить заказ принудительно'}
                  className="px-3.5 py-2 rounded-xl border border-success/30 bg-success/10 hover:bg-success/20 text-success-text font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Завершить</span>
                </button>
              );
            })()}

            {/* Cancel & Refund */}
            {(() => {
              const isPendingState = ['PENDING', 'PENDING_CHECK', 'AWAITING_PAYMENT'].includes(currentOrder.status);
              const isCancelAllowed = userRole !== 'SUPPORT' || isPendingState || currentOrder.service?.isCancelEnabled === true;
              const canCancel = isCancelAllowed && !['CANCELED'].includes(currentOrder.status); // Allow COMPLETED to be canceled

              if (!canCancel) return null;
              return (
                <button
                  onClick={() => {
                    setConfirmAction('cancel');
                    setConfirmOpen(true);
                  }}
                  disabled={isPending}
                  className="px-3.5 py-2 rounded-xl bg-destructive hover:bg-destructive/90 disabled:opacity-40 text-destructive-foreground font-bold text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  title="Отменить заказ и вернуть средства на баланс (Alt+C)"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Отменить и вернуть</span>
                </button>
              );
            })()}
          </div>
        </div>
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
            ? `Средства (${chargeRub.toFixed(2)} ₽) будут автоматически возвращены на баланс клиента.`
            : confirmAction === 'restart'
            ? `Заказ будет повторно отправлен текущему провайдеру с новыми параметрами.`
            : `Статус заказа будет переведен в "Выполнен".`}
        </p>
      </ConfirmModal>
    </div>,
    document.body
  );
}
