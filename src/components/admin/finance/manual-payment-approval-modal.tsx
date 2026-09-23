'use client';

import React, { useState, useTransition } from 'react';
import { manualApprovePaymentAction } from '@/actions/admin/finance/payments';
import { formatRubles } from '@/utils/format-price';
import { 
  CheckCircle2, 
  X, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  CreditCard, 
  Lock,
  User,
  Clock,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export interface PendingPaymentTarget {
  id: string;
  userEmail: string;
  amountCents: number;
  gateway: string;
  gatewayId?: string | null;
  createdAt: string;
}

interface ManualPaymentApprovalModalProps {
  payment: PendingPaymentTarget | null;
  currentUserRole: string;
  supportLimitRub?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ManualPaymentApprovalModal({
  payment,
  currentUserRole,
  supportLimitRub = 3000,
  onClose,
  onSuccess,
}: ManualPaymentApprovalModalProps) {
  const [gatewayTransactionId, setGatewayTransactionId] = useState(payment?.gatewayId || '');
  const [notes, setNotes] = useState('');
  const [isChecked, setIsChecked] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!payment) return null;

  const paymentAmountRub = payment.amountCents / 100;
  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(currentUserRole);
  const isOverLimit = !isOwnerOrAdmin && paymentAmountRub > supportLimitRub;

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();

    if (!gatewayTransactionId.trim()) {
      toast.error('Укажите ID транзакции или номер квитанции из письма');
      return;
    }

    if (!notes.trim() || notes.length < 5) {
      toast.error('Укажите подробное обоснование (минимум 5 символов)');
      return;
    }

    if (!isChecked) {
      toast.error('Подтвердите факт проверки чека в почте');
      return;
    }

    startTransition(async () => {
      try {
        const res = await manualApprovePaymentAction({
          paymentId: payment.id,
          gatewayTransactionId: gatewayTransactionId.trim(),
          notes: notes.trim(),
        });

        if (res.success) {
          toast.success(`Платёж на ${formatRubles(paymentAmountRub)} успешно зачислен на баланс клиента!`);
          onClose();
          if (onSuccess) onSuccess();
        } else {
          toast.error(res.error || 'Ошибка при подтверждении платежа');
        }
      } catch {
        toast.error('Сбой сети при подтверждении платежа');
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Ручное подтверждение платежа</h3>
              <p className="text-[11px] text-muted-foreground">Зачисление по чеку/письму от платёжного шлюза</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleApprove} className="p-5 space-y-4 text-xs">
          {/* Payment Summary Box */}
          <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Клиент:
              </span>
              <span className="font-bold text-foreground font-mono">{payment.userEmail}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-500" /> Сумма платежа:
              </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatRubles(paymentAmountRub)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-500" /> Платёжный шлюз:
              </span>
              <span className="font-bold text-foreground capitalize">{payment.gateway}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Время инициации:
              </span>
              <span className="text-muted-foreground font-mono">
                {new Date(payment.createdAt).toLocaleString('ru-RU')}
              </span>
            </div>
          </div>

          {/* Over limit warning for support */}
          {isOverLimit && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <div className="font-bold">Превышен лимит саппорта ({formatRubles(supportLimitRub)})</div>
                <div className="text-[11px] leading-relaxed">
                  Сумма платежа ({formatRubles(paymentAmountRub)}) превышает ваш лимит. Подтверждение доступно только Администратору или Владельцу платформы.
                </div>
              </div>
            </div>
          )}

          {/* Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-foreground mb-1">
                Внешний ID транзакции / Номер квитанции из письма: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={gatewayTransactionId}
                onChange={(e) => setGatewayTransactionId(e.target.value)}
                placeholder="например: 2d4f8b90-000f-5000-8000-1885b5e9f82d или RRN 489102"
                disabled={isOverLimit || isPending}
                required
                className="w-full h-8 px-3 bg-background border border-border/70 rounded-xl text-foreground font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block font-bold text-foreground mb-1">
                Обоснование / Примечание: <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="например: Проверено поступление на расчетный счет по чеку №4812 из письма ЮKassa от 07:20"
                rows={2}
                disabled={isOverLimit || isPending}
                required
                className="w-full p-2 bg-background border border-border/70 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                disabled={isOverLimit || isPending}
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
              />
              <span className="text-[11px] leading-relaxed text-foreground">
                Я подтверждаю, что лично сверил(а) факт поступления средств на счет в личном кабинете банка / письме платёжного шлюза, и несу ответственность за зачисление.
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="text-[10px] text-muted-foreground">
              {!isOwnerOrAdmin ? `Лимит саппорта: ${formatRubles(supportLimitRub)}` : 'Режим: Администратор (без ограничений)'}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="h-8 px-3 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground font-bold cursor-pointer transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isOverLimit || isPending || !isChecked}
                className="h-8 px-4 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold cursor-pointer transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isPending ? 'Зачисление...' : 'Зачислить средства'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
