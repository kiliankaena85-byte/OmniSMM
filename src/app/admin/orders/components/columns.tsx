'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { cancelOrderAction } from '@/actions/admin/orders';
import { X, Edit2, Zap, Timer, Snail, Turtle, ArrowUpDown, Copy, Check } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { formatEta } from '@/utils/format-eta';
import { OrderEnvironmentBadge } from '@/components/admin/OrderEnvironmentBadge';
import { resolveOrderEnvironmentMode, type OrderEnvironmentMode } from '@/utils/order-environment';

export type OrderColumn = {
  id: string;
  numericId: number;
  externalId: string | null;
  link: string;
  quantity: number;
  remains: number;
  status: string;
  charge: string;
  providerCost: string;
  createdAt: Date;
  updatedAt: Date;
  isDripFeed: boolean;
  dripExternalIds: string[];
  runs: number | null;
  interval: number | null;
  currentRun: number;
  error: string | null;
  user: { email: string };
  providerName: string | null;
  providerTicketUrl?: string | null;
  tenantId?: string;
  environmentMode?: string;
  isTest?: boolean;
  payment?: {
    id: string;
    gatewayId: string | null;
    gateway: string;
  } | null;
  resolvedEnvironmentMode?: OrderEnvironmentMode;
  service: { 
    name: string;
    isCancelEnabled?: boolean;
    etaP50Seconds: number | null;
    etaP90Seconds: number | null;
    etaSampleCount: number | null;
    etaSpeedClass: string | null;
    etaUpdatedAt: string | null;
    category: {
      name: string;
      network: { name: string } | null;
    };
  };
};

export function TenantBrandBadge({ tenantId }: { tenantId?: string | null }) {
  if (tenantId === 'flux') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 whitespace-nowrap shadow-2xs">
        🌌 SMMflux
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 whitespace-nowrap shadow-2xs">
      🏛️ SMMplan
    </span>
  );
}

// ── Speed Class Visual Config ──

export const SPEED_CLASS_META: Record<string, { label: string; color: string; icon: React.ReactNode; window: string }> = {
  FAST:       { label: 'Быстрый',         color: 'text-emerald-600 dark:text-emerald-400', icon: <Zap className="w-3 h-3" />,    window: '2ч' },
  MEDIUM:     { label: 'Средний',          color: 'text-sky-600 dark:text-sky-400',     icon: <Timer className="w-3 h-3" />,  window: '24ч' },
  SLOW:       { label: 'Медленный',        color: 'text-amber-600 dark:text-amber-400',   icon: <Turtle className="w-3 h-3" />, window: '72ч' },
  ULTRA_SLOW: { label: 'Очень медленный',  color: 'text-rose-600 dark:text-rose-400',    icon: <Snail className="w-3 h-3" />,  window: '7д' },
};

/** Format "time ago" from ISO date string */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  return `${days}д назад`;
}

// ── Status Config ──

export const STATUS_STYLES: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
  AWAITING_PAYMENT: 'warning',
  PENDING: 'default',
  PENDING_CHECK: 'primary',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  PARTIAL: 'warning',
  CANCELED: 'default',
  ERROR: 'danger',
  REFUNDING: 'secondary',
};

export const STATUS_LABELS: Record<string, string> = {
  ALL: 'Все',
  AWAITING_PAYMENT: 'Ожидает',
  PENDING: 'В очереди',
  PENDING_CHECK: 'Проверка ссылки',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Выполнен',
  PARTIAL: 'Частичный',
  CANCELED: 'Отменён',
  ERROR: 'Ошибка',
  REFUNDING: 'Возврат',
};

// ── Sub-Components ──

export function RowActions({ order }: { order: OrderColumn }) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function executeCancel() {
    setConfirmOpen(false);
    const fd = new FormData();
    fd.append('orderId', order.id);

    startTransition(async () => {
      try {
        const res = await cancelOrderAction(fd);
        if (res && res.success) {
          toast.success(`🚫 Заказ #${order.numericId} отменён`);
        } else {
          toast.error(res?.error || 'Ошибка отмены заказа');
        }
      } catch (e) {
        toast.error((e as Error).message ?? 'Ошибка');
      }
    });
  }

  const isPendingState = ['PENDING', 'PENDING_CHECK', 'AWAITING_PAYMENT'].includes(order.status);
  const canCancel = (isPendingState || order.service?.isCancelEnabled === true) && !['COMPLETED', 'CANCELED', 'PARTIAL', 'ERROR'].includes(order.status);

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`?edit_order_id=${order.id}`}
        className="inline-flex items-center justify-center p-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
        title="Открыть панель деталей"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </Link>
      {canCancel && (
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
          className="inline-flex items-center justify-center p-1.5 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 transition-colors disabled:opacity-40"
          title="Отменить заказ"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeCancel}
        title="Отмена заказа"
        isDanger={true}
        confirmText="Отменить заказ"
      >
        Вы действительно хотите отменить заказ <strong>#{order.numericId}</strong>? При наличии остатка клиент получит возврат.
      </ConfirmModal>
    </div>
  );
}

function EtaTooltipContent({ service }: { service: OrderColumn['service'] }) {
  const meta = SPEED_CLASS_META[service.etaSpeedClass ?? ''] ?? SPEED_CLASS_META.MEDIUM;
  
  return (
    <div className="p-2.5 space-y-2 min-w-[180px]">
      {/* Speed Class Header */}
      <div className="flex items-center gap-1.5">
        <span className={meta.color}>{meta.icon}</span>
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">окно {meta.window}</span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono tracking-tight">
        <span className="text-muted-foreground font-sans tracking-normal">Медиана (P50)</span>
        <span className="font-semibold text-foreground tabular-nums text-right">
          {formatEta(service.etaP50Seconds!)}
        </span>
        
        <span className="text-muted-foreground font-sans tracking-normal">Максимум (P90)</span>
        <span className="font-semibold text-foreground tabular-nums text-right">
          {service.etaP90Seconds ? formatEta(service.etaP90Seconds) : '—'}
        </span>
        
        <span className="text-muted-foreground font-sans tracking-normal">Выборка</span>
        <span className="font-medium text-foreground tabular-nums text-right">
          {service.etaSampleCount} <span className="font-sans tracking-normal">зак.</span>
        </span>
      </div>

      {/* Last updated */}
      {service.etaUpdatedAt && (
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/50">
          Обновлено: {timeAgo(service.etaUpdatedAt)}
        </div>
      )}
    </div>
  );
}

// ── Column Definitions ──

function InfoColumnCell({ order, canSeeRates }: { order: OrderColumn; canSeeRates: boolean }) {
  const [copied, setCopied] = useState(false);
  const s = order.service;
  const netName = s.category.network?.name || 'Соцсеть';
  const catName = s.category.name;
  const srvName = s.name;
  const dateFormatted = new Date(order.createdAt).toISOString().replace('T', ' ').slice(0, 19);

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(order.link);
      setCopied(true);
      toast.success('Ссылка скопирована в буфер');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  return (
    <div className="flex flex-col text-xs leading-relaxed text-foreground py-1 max-w-[400px] whitespace-normal break-words space-y-1">
      {/* 1. Соцсеть · Категория · Название */}
      <div className="flex items-center gap-1.5 flex-wrap font-medium">
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px] uppercase select-none tracking-wide">
          {netName}
        </span>
        <span className="font-bold text-foreground text-xs">
          {catName}
        </span>
        <span className="text-muted-foreground font-normal">·</span>
        <span className="text-muted-foreground font-medium truncate max-w-[200px]" title={srvName}>
          «{srvName}»
        </span>
      </div>

      {/* 2. Ссылка с кнопкой копирования */}
      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <span className="text-muted-foreground shrink-0 select-none">Ссылка:</span>
        <a
          href={order.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all font-medium truncate max-w-[280px]"
          title={order.link}
          onClick={(e) => e.stopPropagation()}
        >
          {order.link}
        </a>
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0 active:scale-90"
          title="Скопировать ссылку"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 3. Количество, остаток и точная дата создания */}
      <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground flex-wrap pt-0.5">
        <span>
          Кол-во: <strong className="text-foreground">{order.quantity.toLocaleString('ru-RU')} шт.</strong>
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
        <span>·</span>
        <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px]" title="Дата создания">
          🕒 {dateFormatted}
        </span>
      </div>

      {/* 4. Раскрывающийся спойлер деталей провайдера */}
      <details className="mt-1 group/details" onClick={(e) => e.stopPropagation()}>
        <summary className="text-primary hover:text-primary/80 cursor-pointer text-[10px] select-none list-none inline-flex items-center gap-1 font-semibold transition-colors">
          <span className="group-open/details:hidden">▸ Показать детали</span>
          <span className="hidden group-open/details:inline">▾ Скрыть детали</span>
        </summary>

        <div className="mt-1.5 p-2 rounded-lg bg-muted/50 border border-border/60 text-[11px] space-y-1 font-mono">
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground font-sans">Провайдер:</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              {order.providerName || '—'}
              {order.providerTicketUrl && (
                <a
                  href={order.providerTicketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-1.5 py-0.5 rounded transition-all active:scale-95 font-sans"
                  title="Открыть поддержку провайдера"
                >
                  Поддержка ↗
                </a>
              )}
            </span>
          </div>

          {order.externalId && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground font-sans">ID у провайдера:</span>
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                #{order.externalId}
                {order.providerTicketUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (typeof window !== 'undefined' && navigator.clipboard) {
                        navigator.clipboard.writeText(order.externalId!);
                        toast.success(`Внешний ID (${order.externalId}) скопирован`);
                      }
                      window.open(order.providerTicketUrl!, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer font-sans"
                    title="Скопировать ID и открыть тикет"
                  >
                    Тикет ↗
                  </button>
                )}
              </span>
            </div>
          )}

          {order.error && (
            <div className="mt-1 p-1.5 bg-destructive/10 border border-destructive/20 rounded text-destructive text-[10px] leading-tight break-words">
              <strong>Ошибка провайдера:</strong> {order.error}
            </div>
          )}

          {order.isDripFeed && order.dripExternalIds && order.dripExternalIds.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] flex-wrap pt-0.5">
              <span className="text-muted-foreground font-sans">Drip запуски:</span>
              {order.dripExternalIds.map((id, idx) => (
                <span key={idx} className="bg-purple-500/10 text-purple-600 border border-purple-500/20 px-1 py-0.5 rounded text-[9px]">
                  #{id}
                </span>
              ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

// ── Column Definitions ──

export const columns = (canSeeRates: boolean = true): ColumnDef<OrderColumn>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-border text-primary focus:ring-indigo-600 cursor-pointer"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-border text-primary focus:ring-indigo-600 cursor-pointer"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'user_email',
    accessorFn: (row) => row.user.email,
    header: 'Email',
    enableHiding: false,
  },
  {
    accessorKey: 'numericId',
    id: 'order',
    header: ({ column }) => (
      <button
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center gap-1 hover:text-foreground transition-colors font-bold text-foreground text-xs cursor-pointer"
      >
        ЗАКАЗ
        <ArrowUpDown className="w-3 h-3 ml-1" />
      </button>
    ),
    cell: ({ row }) => {
      const order = row.original;
      const email = order.user.email;
      return (
        <div className="flex flex-col text-xs leading-normal py-1 space-y-1 min-w-[130px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-foreground tabular-nums text-xs">
              #{order.numericId}
            </span>
            <TenantBrandBadge tenantId={order.tenantId} />
            <OrderEnvironmentBadge mode={order.resolvedEnvironmentMode || resolveOrderEnvironmentMode(order)} size="sm" />
          </div>
          <Link
            href={`/admin/clients?q=${encodeURIComponent(email)}`}
            className="text-primary hover:underline text-xs font-semibold break-all whitespace-normal leading-snug"
            title={email}
            onClick={(e) => e.stopPropagation()}
          >
            {email}
          </Link>
        </div>
      );
    },
  },
  {
    id: 'info',
    header: 'ИНФОРМАЦИЯ О ЗАКАЗЕ',
    cell: ({ row }) => <InfoColumnCell order={row.original} canSeeRates={canSeeRates} />,
  },
  {
    accessorKey: 'charge',
    header: ({ column }) => (
      <div className="flex justify-end">
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1 hover:text-foreground transition-colors font-bold text-foreground text-xs cursor-pointer"
        >
          СУММА
          <ArrowUpDown className="w-3 h-3 ml-1" />
        </button>
      </div>
    ),
    cell: ({ row }) => {
      const order = row.original;
      const chargeBig = BigInt(order.charge || '0');
      const costBig = BigInt(order.providerCost || '0');
      const marginBig = chargeBig - costBig;
      const chargeNum = Number(chargeBig) / 100;
      const costNum = Number(costBig) / 100;
      const marginNum = Number(marginBig) / 100;
      const marginPercent = chargeBig > BigInt(0) ? Math.round((Number(marginBig) / Number(chargeBig)) * 100) : 0;
      const isPositive = marginBig >= BigInt(0);

      return (
        <div className="flex flex-col items-end text-xs leading-normal py-1 font-semibold text-right min-w-[90px] font-mono">
          <div className="font-bold text-foreground tabular-nums tracking-tight text-sm">{chargeNum.toFixed(2)} <span className="font-sans text-xs">₽</span></div>
          {canSeeRates && (
            <div className="text-muted-foreground text-[10px] mt-0.5 font-normal select-none tabular-nums tracking-tight">
              Закупка: {costNum.toFixed(2)} <span className="font-sans">₽</span>
            </div>
          )}
          {canSeeRates && (
            <div className={`text-[10px] font-bold mt-0.5 select-none tabular-nums tracking-tight ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              Маржа: {marginPercent}% ({marginNum.toFixed(2)} <span className="font-sans">₽</span>)
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <button
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="flex items-center gap-1 hover:text-foreground transition-colors font-bold text-foreground text-xs"
      >
        СТАТУС
        <ArrowUpDown className="w-3 h-3 ml-1" />
      </button>
    ),
    cell: ({ row }) => {
      const order = row.original;
      const status = order.status;
      const style = STATUS_STYLES[status] || 'default';
      
      const classes: Record<string, string> = {
        success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        primary: 'bg-primary/10 text-primary border-primary/20',
        default: 'bg-muted text-muted-foreground border-border/80',
      };
 
      const s = order.service;
      const showEta = s.etaP50Seconds && s.etaSampleCount && s.etaSampleCount >= 2;
      const meta = showEta ? (SPEED_CLASS_META[s.etaSpeedClass ?? ''] ?? SPEED_CLASS_META.MEDIUM) : null;
 
      return (
        <div className="flex flex-col gap-1 py-1 whitespace-nowrap min-w-[110px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={`font-black text-[10px] uppercase border px-2 py-0.5 rounded-md ${classes[style] || classes.default}`}>
              {STATUS_LABELS[status] || status}
            </Badge>
            {order.isDripFeed && (
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-md">
                Drip ({order.currentRun}/{order.runs})
              </span>
            )}
          </div>
          
          {showEta && meta && (
            <div className="relative group/eta">
              <div className="flex items-center gap-1 font-semibold text-[11px] cursor-help">
                <span className={meta.color}>
                  {meta.icon}
                </span>
                <span className="text-muted-foreground group-hover/eta:text-primary transition-colors">
                  ≈ {formatEta(s.etaP50Seconds!)}
                </span>
              </div>
 
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-1.5 z-50 invisible opacity-0 group-hover/eta:visible group-hover/eta:opacity-100 transition-all duration-200 pointer-events-none">
                <div className="bg-card border border-border/80 rounded-lg shadow-xl p-2.5 min-w-[190px]">
                  <EtaTooltipContent service={s} />
                  {/* Arrow */}
                  <div className="absolute bottom-full right-4 w-3 h-3 bg-card border-t border-l border-border/80 rotate-[45deg] translate-y-1.5" />
                </div>
              </div>
            </div>
          )}
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: 'ДЕЙСТВИЯ',
    cell: ({ row }) => <RowActions order={row.original} />
  },
];
