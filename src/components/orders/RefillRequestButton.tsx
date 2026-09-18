'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface RefillRequestButtonProps {
  orderId: string;
  isRefillEnabled?: boolean;
  orderStatus: string;
  createdAt?: Date | string;
  guaranteeDays?: number;
  refills?: Array<{
    id: string;
    status: string;
    createdAt: Date | string;
  }>;
  className?: string;
}

export function RefillRequestButton({
  orderId,
  isRefillEnabled = false,
  orderStatus,
  createdAt,
  guaranteeDays = 30,
  refills,
  className,
}: RefillRequestButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const initialStatus = refills && refills.length > 0 ? refills[0].status : null;
  const [refillStatus, setRefillStatus] = useState<string | null>(initialStatus);

  if (!isRefillEnabled) {
    return null;
  }

  // Refill is strictly only allowed for COMPLETED or PARTIAL orders
  if (orderStatus !== 'COMPLETED' && orderStatus !== 'PARTIAL') {
    return null;
  }

  // Calculate remaining guarantee period
  const orderDate = createdAt ? new Date(createdAt) : null;
  const elapsedDays = orderDate
    ? Math.floor((Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const remainingDays = Math.max(0, guaranteeDays - elapsedDays);
  const isGuaranteeExpired = orderDate ? elapsedDays > guaranteeDays : false;

  if (refillStatus === 'PENDING' || refillStatus === 'IN_PROGRESS') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg whitespace-nowrap shadow-xs',
          className
        )}
        title="Заявка на гарантийный докрут принята провайдером и находится в обработке"
      >
        <RefreshCw className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
        Докрутка: В процессе
      </span>
    );
  }

  const latestRefill = refills && refills.length > 0 ? refills[0] : null;
  const latestRefillAgeHours = latestRefill
    ? (Date.now() - new Date(latestRefill.createdAt).getTime()) / (1000 * 60 * 60)
    : 999;
  const isCooldownActive = latestRefillAgeHours < 24;
  const remainingCooldownHours = Math.max(1, Math.ceil(24 - latestRefillAgeHours));

  if (refillStatus === 'COMPLETED' && isCooldownActive) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg whitespace-nowrap shadow-xs',
          className
        )}
        title={`Гарантийная докрутка успешно выполнена. Повторный запрос будет доступен через ${remainingCooldownHours} ч.`}
      >
        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        Докрутка выполнена
        <span className="px-1 py-0.2 bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] rounded font-mono font-bold">
          {remainingCooldownHours}ч
        </span>
      </span>
    );
  }

  if (refillStatus === 'REJECTED' && isCooldownActive) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg whitespace-nowrap shadow-xs',
          className
        )}
        title={`Заявка отклонена поставщиком (списания не зафиксированы или гарантия недоступна). Повторный запрос будет доступен через ${remainingCooldownHours} ч.`}
      >
        <ShieldAlert className="w-3 h-3 text-destructive shrink-0" />
        Докрутка отклонена
        <span className="px-1 py-0.2 bg-destructive/20 text-destructive text-[9px] rounded font-mono font-bold">
          {remainingCooldownHours}ч
        </span>
      </span>
    );
  }

  if (refillStatus === 'ERROR' && latestRefillAgeHours < 1) {
    const remainingMins = Math.max(1, Math.ceil(60 - latestRefillAgeHours * 60));
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg whitespace-nowrap shadow-xs',
          className
        )}
        title={`В процессе обработки возникла ошибка. Повтор доступен через ${remainingMins} мин.`}
      >
        <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
        Ошибка запроса
        <span className="px-1 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] rounded font-mono font-bold">
          {remainingMins}м
        </span>
      </span>
    );
  }

  if (isGuaranteeExpired) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 border border-border/40 rounded-lg whitespace-nowrap opacity-75 cursor-not-allowed',
          className
        )}
        title={`Гарантийный период (${guaranteeDays} дн.) для этого заказа истёк`}
      >
        <ShieldAlert className="w-3 h-3 text-muted-foreground/70 shrink-0" />
        Гарантия истекла
      </span>
    );
  }

  const handleRequestRefill = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPending || isGuaranteeExpired) return;

    try {
      setIsPending(true);
      const { requestClientRefillAction } = await import('@/actions/order/refill');
      const res = await requestClientRefillAction(orderId);

      if (res.success) {
        toast.success(res.message || 'Заявка на гарантийный докрут принята!');
        setRefillStatus('PENDING');
        router.refresh();
      } else {
        if (res.refill) {
          setRefillStatus(res.refill.status);
        }
        toast.error(res.error || 'Не удалось отправить заявку на докрутку');
      }
    } catch {
      toast.error('Ошибка сети. Попробуйте снова через несколько минут.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleRequestRefill}
      className={cn(
        'h-7 px-2.5 text-[10px] font-bold rounded-lg transition-all inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer hover:shadow-xs',
        className
      )}
      title={`Запросить бесплатный гарантийный докрут (Refill). Осталось ${remainingDays} дн. гарантии.`}
    >
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      ) : (
        <RefreshCw className="w-3 h-3 shrink-0 text-primary" />
      )}
      <span>Докрутка</span>
      <span className="px-1 py-0.2 bg-primary/20 text-primary text-[9px] rounded font-mono font-black" title={`Осталось ${remainingDays} дней гарантии`}>
        {remainingDays}д
      </span>
    </button>
  );
}

