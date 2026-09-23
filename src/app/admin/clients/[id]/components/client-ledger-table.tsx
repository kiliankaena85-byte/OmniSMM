'use client';

import React, { useState, useTransition } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  CreditCard, 
  ShoppingCart, 
  SlidersHorizontal,
  RefreshCw,
  Clock,
  CheckCircle2,
  FileText,
  Copy,
  Check
} from 'lucide-react';
import { ClientLedgerEntryDTO, ClientLedgerSummaryDTO } from '../tabs/types';
import { getClientLedgerAction } from '@/actions/admin/clients';
import { toast } from 'sonner';

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Скопировано');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded transition-colors"
      title="Скопировать ID / UUID"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

interface ClientLedgerTableProps {
  userId: string;
  initialEntries: ClientLedgerEntryDTO[];
  initialSummary: ClientLedgerSummaryDTO;
}

const TYPE_MAP: Record<string, { label: string; icon: React.ReactNode; badgeCls: string }> = {
  TOPUP: {
    label: 'Пополнение',
    icon: <CreditCard className="w-3 h-3 text-emerald-600" />,
    badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
  },
  PAYMENT: {
    label: 'Платеж',
    icon: <CreditCard className="w-3 h-3 text-emerald-600" />,
    badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
  },
  ORDER_CHARGE: {
    label: 'Оплата заказа',
    icon: <ShoppingCart className="w-3 h-3 text-slate-600 dark:text-slate-300" />,
    badgeCls: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
  },
  ORDER_CANCEL: {
    label: 'Отмена заказа',
    icon: <RotateCcw className="w-3 h-3 text-amber-600" />,
    badgeCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
  },
  REFUND: {
    label: 'Авто-возврат',
    icon: <RotateCcw className="w-3 h-3 text-blue-600" />,
    badgeCls: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
  },
  ADJUSTMENT: {
    label: 'Корректировка',
    icon: <SlidersHorizontal className="w-3 h-3 text-indigo-600" />,
    badgeCls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20'
  },
  COMPENSATION: {
    label: 'Компенсация',
    icon: <ArrowDownLeft className="w-3 h-3 text-emerald-600" />,
    badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
  },
  REROUTE: {
    label: 'Перезапуск',
    icon: <RefreshCw className="w-3 h-3 text-purple-600" />,
    badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
  }
};

export function ClientLedgerTable({ 
  userId, 
  initialEntries = [], 
  initialSummary = { totalDepositedRub: 0, totalSpentRub: 0, totalRefundedRub: 0, totalAdjustedRub: 0 } 
}: ClientLedgerTableProps) {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [entries, setEntries] = useState<ClientLedgerEntryDTO[]>(initialEntries || []);
  const [summary, setSummary] = useState<ClientLedgerSummaryDTO>(initialSummary || {
    totalDepositedRub: 0,
    totalSpentRub: 0,
    totalRefundedRub: 0,
    totalAdjustedRub: 0
  });
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = (type: string) => {
    setFilterType(type);
    startTransition(async () => {
      const res = await getClientLedgerAction(userId, type);
      if (res.success) {
        setEntries(res.entries);
        setSummary(res.summary);
      } else {
        toast.error(res.error || 'Ошибка загрузки транзакций');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Summary Strip with Clear Aggregates */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-muted/30 border border-border/60 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Всего пополнено
          </div>
          <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
            +{summary.totalDepositedRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
        </div>

        <div className="bg-muted/30 border border-border/60 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Всего списано (заказы)
          </div>
          <div className="text-sm font-black font-mono text-rose-600 dark:text-rose-400">
            −{summary.totalSpentRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
        </div>

        <div className="bg-muted/30 border border-border/60 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Всего возвращено
          </div>
          <div className="text-sm font-black font-mono text-blue-600 dark:text-blue-400">
            +{summary.totalRefundedRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
        </div>

        <div className="bg-muted/30 border border-border/60 rounded-xl p-3 shadow-2xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> Корректировки саппорта
          </div>
          <div className={`text-sm font-black font-mono ${summary.totalAdjustedRub >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {summary.totalAdjustedRub >= 0 ? '+' : '−'}{Math.abs(summary.totalAdjustedRub).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
        </div>
      </div>

      {/* 2. Interactive Filter Chips */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-border/40 pb-2.5">
        {[
          { id: 'ALL', label: 'Все операции' },
          { id: 'TOPUP', label: '💳 Пополнения' },
          { id: 'ORDER_CHARGE', label: '🛒 Оплата заказов' },
          { id: 'REFUND', label: '↩️ Возвраты' },
          { id: 'ADJUSTMENT', label: '⚙️ Корректировки саппорта' },
        ].map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => handleFilterChange(f.id)}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              filterType === f.id
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
        {isPending && <span className="text-xs text-muted-foreground animate-pulse ml-2">Загрузка...</span>}
      </div>

      {/* 3. Unified Ledger Table */}
      {entries.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground bg-muted/10 rounded-2xl border border-dashed border-border/60">
          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs font-medium">Операций по выбранному фильтру не найдено</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/40">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-[10px] uppercase font-bold tracking-wider text-muted-foreground bg-muted/25">
                <th className="py-2.5 px-3">ID / UUID проводки</th>
                <th className="py-2.5 px-3">Дата / Время</th>
                <th className="py-2.5 px-3">Тип</th>
                <th className="py-2.5 px-3">Сумма</th>
                <th className="py-2.5 px-3">Основание / Причина</th>
                <th className="py-2.5 px-3">Инициатор</th>
                <th className="py-2.5 pr-3 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-xs">
              {entries.map(item => {
                const typeConfig = TYPE_MAP[item.transactionType] || {
                  label: item.transactionType,
                  icon: <SlidersHorizontal className="w-3 h-3" />,
                  badgeCls: 'bg-muted text-muted-foreground border-border'
                };
                const isIncome = item.direction === 'INCOME';
                const displayUuid = item.idempotencyKey || item.id;

                return (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    {/* ID / UUID */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <span
                          className="px-1.5 py-0.5 rounded-md bg-muted/60 text-foreground border border-border/50 text-[10px] font-bold truncate max-w-[120px] inline-block select-all"
                          title={displayUuid}
                        >
                          {displayUuid.startsWith('gateway-credit-')
                            ? `yoo:${displayUuid.replace('gateway-credit-', '').slice(0, 8)}...`
                            : displayUuid.startsWith('gateway-charge-')
                            ? `order:${displayUuid.replace('gateway-charge-', '').slice(0, 8)}...`
                            : displayUuid.startsWith('deposit-')
                            ? `topup:${displayUuid.replace('deposit-', '').slice(0, 8)}...`
                            : `${displayUuid.slice(0, 10)}...`}
                        </span>
                        <CopyBtn text={displayUuid} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      {new Date(item.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${typeConfig.badgeCls}`}>
                        {typeConfig.icon}
                        <span>{typeConfig.label}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-xs">
                      <span className={`inline-flex items-center gap-0.5 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isIncome ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        <span>{isIncome ? '+' : '−'}{item.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-foreground text-xs font-medium max-w-[280px] truncate" title={item.reason}>
                      {item.reason}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px] truncate max-w-[140px]" title={item.adminEmail || 'Система / Клиент'}>
                      {item.adminEmail ? item.adminEmail.split('@')[0] : 'Система'}
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {item.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-700 bg-success/15 px-2 py-0.5 rounded-full border border-success/20">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Исполнено
                        </span>
                      ) : item.status === 'QUARANTINE' ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-amber-700 bg-warning/15 px-2 py-0.5 rounded-full border border-warning/20">
                          <Clock className="w-2.5 h-2.5" /> Эскроу
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                          {item.status}
                        </span>
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
  );
}
