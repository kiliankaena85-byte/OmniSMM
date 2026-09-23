'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { UserDTO, PaymentDTO, ClientLedgerEntryDTO, ClientLedgerSummaryDTO } from './types';
import { PaymentsRefundModal } from './payments-refund-modal';
import { ClientLedgerTable } from '../components/client-ledger-table';

interface PaymentsTabProps {
  user: UserDTO;
  payments: PaymentDTO[];
  canSeeFinances: boolean;
  ledgerEntries?: ClientLedgerEntryDTO[];
  ledgerSummary?: ClientLedgerSummaryDTO;
}

export function PaymentsTab({ user, payments, canSeeFinances, ledgerEntries = [], ledgerSummary = { totalDepositedRub: 0, totalSpentRub: 0, totalRefundedRub: 0, totalAdjustedRub: 0 } }: PaymentsTabProps) {
  const currentBalanceRub = (user.balance || 0) / 100;
  const [refundModalPayment, setRefundModalPayment] = useState<PaymentDTO | null>(null);

  return (
    <div className="space-y-6">
      {/* 1. Unified Ledger Table for Client */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-5 ring-1 ring-border/5">
        <div className="border-b border-border/60 pb-3 mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1 rounded-md">
              <CreditCard className="w-3.5 h-3.5" />
            </span>
            Книга транзакций клиента (Ledger)
          </h3>
          <span className="text-xs font-bold text-muted-foreground font-mono">
            Все операции
          </span>
        </div>
        <ClientLedgerTable
          userId={user.id}
          initialEntries={ledgerEntries}
          initialSummary={ledgerSummary}
        />
      </div>

      {/* 2. External Payment Gateways & Refund Management */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl overflow-hidden ring-1 ring-border/5 space-y-4">
        <div className="px-5 py-3.5 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1 rounded-md">
              <Receipt className="w-3.5 h-3.5" />
            </span>
            Внешние пополнения (ЮKassa / CryptoBot) и возврат на карту
          </h3>
          <span className="text-xs font-bold text-muted-foreground font-mono">
            Всего пополнений: {user.paymentsCount ?? payments.length}
          </span>
        </div>

        {payments.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p className="text-sm">У клиента пока нет платежей</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted/20">
                  <th className="py-2.5 px-4">Сумма</th>
                  <th className="py-2.5 px-3">Шлюз</th>
                  <th className="py-2.5 px-3">Статус</th>
                  <th className="py-2.5 px-3">ID Транзакции</th>
                  <th className="py-2.5 px-3">Чек 54-ФЗ</th>
                  <th className="py-2.5 px-3">Дата</th>
                  <th className="py-2.5 pr-4 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 text-xs">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                      {p.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 bg-muted border border-border rounded font-mono uppercase text-[10px] font-bold text-foreground">
                        {p.gateway}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {p.status === 'SUCCEEDED' ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-success/15 px-2 py-0.5 rounded-full border border-success/20">
                          Успешно
                        </span>
                      ) : p.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-warning/15 px-2 py-0.5 rounded-full border border-warning/20">
                          В обработке
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-700 bg-destructive/15 px-2 py-0.5 rounded-full border border-destructive/20">
                          {p.status}
                        </span>
                      )}
                    </td>
                    <td
                      className="py-2.5 px-3 font-mono text-muted-foreground truncate max-w-[130px]"
                      title={p.gatewayId || p.id}
                    >
                      {p.gatewayId || p.id}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.receiptId ? (
                        <span className="flex items-center gap-1 text-primary font-mono text-[10px] font-bold">
                          <Receipt className="w-3.5 h-3.5" /> Чек #54-ФЗ
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-[10px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground whitespace-nowrap text-[11px]">
                      {new Date(p.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {p.status === 'SUCCEEDED' && canSeeFinances && (
                        <button
                          type="button"
                          onClick={() => setRefundModalPayment(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Возврат на карту</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CARD REFUND MODAL DIALOG */}
      <PaymentsRefundModal
        user={user}
        payment={refundModalPayment}
        currentBalanceRub={currentBalanceRub}
        onClose={() => setRefundModalPayment(null)}
      />
    </div>
  );
}
