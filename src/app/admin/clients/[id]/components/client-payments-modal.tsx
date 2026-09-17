'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, ExternalLink, Wallet, CheckCircle, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { PaymentDTO, UserDTO } from '../tabs/types';
import { ClientDate } from '@/components/ui/client-date';
import { formatBalance } from '@/lib/utils';
import { ManualPaymentApprovalModal, PendingPaymentTarget } from '@/components/admin/finance/manual-payment-approval-modal';

interface ClientPaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserDTO;
  payments: PaymentDTO[];
  totalDepositedRub?: number;
  currentUserRole?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  SUCCEEDED: { label: 'Успешно', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  CONFIRMED: { label: 'Подтвержден', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  PENDING:   { label: 'Ожидает', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  FAILED:    { label: 'Отклонен', color: 'bg-destructive/15 text-destructive border-destructive/20' },
  REFUNDED:  { label: 'Возвращен', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20' },
  CANCELLED: { label: 'Отменен', color: 'bg-muted text-muted-foreground border-border' },
};

export function ClientPaymentsModal({
  isOpen,
  onClose,
  user,
  payments,
  totalDepositedRub: propTotalDepositedRub,
  currentUserRole = 'ADMIN',
}: ClientPaymentsModalProps) {
  const [approvalTarget, setApprovalTarget] = useState<PendingPaymentTarget | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalSuccessRub = propTotalDepositedRub !== undefined
    ? propTotalDepositedRub
    : payments
        .filter(p => p.status === 'SUCCEEDED' || p.status === 'CONFIRMED')
        .reduce((sum, p) => sum + p.amountRub, 0);

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200">
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity cursor-pointer"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-5xl max-h-[92vh] bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 bg-muted/25 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Платежи эквайринга
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 font-medium">
                <span>Всего пополнений через шлюзы: <b className="text-foreground font-mono">{payments.length}</b></span>
                <span>•</span>
                <span>Успешно: <b className="text-emerald-700 dark:text-emerald-400 font-mono">+{totalSuccessRub.toLocaleString('ru-RU')} ₽</b></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              aria-label="Закрыть окно"
              className="px-3 py-1.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-foreground flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              <span>Закрыть</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded border border-border/60 text-muted-foreground">
                Esc
              </kbd>
              <X className="w-4 h-4 text-muted-foreground ml-0.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-card/60">
          {payments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground bg-muted/15 rounded-2xl border border-dashed border-border/60 p-6">
              <CreditCard className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm font-semibold">История платежей пуста</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Клиент ещё не совершал пополнений через платежные шлюзы</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden shadow-2xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    <th className="px-3.5 py-2.5">Дата / Время</th>
                    <th className="px-3.5 py-2.5">Шлюз</th>
                    <th className="px-3.5 py-2.5 text-right">Сумма</th>
                    <th className="px-3.5 py-2.5 text-center">Статус</th>
                    <th className="px-3.5 py-2.5">ID транзакции</th>
                    <th className="px-3.5 py-2.5">Чек 54-ФЗ</th>
                    <th className="px-3.5 py-2.5 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {payments.map(p => {
                    const st = STATUS_MAP[p.status] || { label: p.status, color: 'bg-muted text-muted-foreground border-border' };
                    const isPending = p.status === 'PENDING';

                    return (
                      <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3.5 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                          <ClientDate date={p.createdAt} format="datetime" />
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="font-bold text-foreground capitalize">
                            {p.gateway === 'cryptobot' ? 'CryptoBot (USDT)' : p.gateway === 'yookassa' ? 'ЮKassa (Банковская карта)' : p.gateway}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          +{p.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                        </td>
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground truncate max-w-[160px]" title={p.gatewayId || p.id}>
                          {p.gatewayId || p.id}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground">
                          {p.receiptId ? (
                            <span className="text-primary font-bold">#{p.receiptId}</span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => setApprovalTarget({
                                id: p.id,
                                userEmail: user.email,
                                amountCents: Math.round(p.amountRub * 100),
                                gateway: p.gateway,
                                gatewayId: p.gatewayId,
                                createdAt: p.createdAt,
                              })}
                              className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 ml-auto"
                              title="Подтвердить зачисление по чеку/письму"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Подтвердить</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {approvalTarget && (
          <ManualPaymentApprovalModal
            payment={approvalTarget}
            currentUserRole={currentUserRole}
            supportLimitRub={3000}
            onClose={() => setApprovalTarget(null)}
            onSuccess={() => {
              setApprovalTarget(null);
              onClose();
            }}
          />
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>Синхронизировано с платежными шлюзами</span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Вернуться в карточку клиента →
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
