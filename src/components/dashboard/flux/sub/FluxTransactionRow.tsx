import React from 'react';
import Link from 'next/link';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  ShieldCheck, 
  ExternalLink, 
  Copy, 
  Check 
} from 'lucide-react';
import type { FluxTransaction } from './types';

interface FluxTransactionRowProps {
  tx: FluxTransaction;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  formatDate: (iso: string) => string;
}

export function FluxTransactionRow({
  tx,
  copiedId,
  onCopy,
  formatDate,
}: FluxTransactionRowProps) {
  const isRefund = tx.transactionType === 'REFUND' || tx.reason.toLowerCase().includes('возврат');
  const isCredit = tx.amountRub > 0;

  const Icon = isRefund ? RotateCcw : isCredit ? ArrowDownLeft : ArrowUpRight;
  const iconBg = isRefund 
    ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
    : isCredit 
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';

  const amountColor = isRefund 
    ? 'text-sky-600 dark:text-sky-400' 
    : isCredit 
      ? 'text-emerald-600 dark:text-emerald-400' 
      : 'text-foreground';

  const typeBadgeText = isRefund ? 'Возврат' : isCredit ? 'Пополнение' : 'Списание';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card/75 backdrop-blur-xl border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-all duration-200">
      {/* Left: Icon & Description */}
      <div className="flex items-start gap-4 min-w-0">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${iconBg}`}>
          <Icon className="w-5 h-5 shrink-0" />
        </div>

        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${iconBg}`}>
              {typeBadgeText}
            </span>

            <span className="text-[11px] text-muted-foreground font-mono font-bold">
              {formatDate(tx.createdAt)}
            </span>

            {/* Order link badge if available */}
            {tx.orderNumericId && (
              <Link
                href={`/dashboard/orders?search=${tx.orderNumericId}`}
                className="inline-flex items-center gap-1 text-[11px] font-mono font-black text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md transition-colors"
                title="Посмотреть этот заказ"
              >
                <span>Заказ #{tx.orderNumericId}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </Link>
            )}

            {/* 54-FZ Receipt indicator for deposits */}
            {isCredit && !isRefund && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                Чек 54-ФЗ
              </span>
            )}
          </div>

          <div className="text-sm font-bold text-foreground truncate max-w-xl">
            {tx.reason || 'Операция по счету'}
          </div>

          {tx.runningBalanceRub != null && (
            <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <span>Остаток после операции:</span>
              <span className="font-bold text-foreground tabular-nums">
                {tx.runningBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Amount & Copy ID */}
      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
        <div className="text-left sm:text-right">
          <div className={`text-base sm:text-lg font-black tabular-nums ${amountColor}`}>
            {isCredit ? '+' : ''}{tx.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {tx.status === 'APPROVED' || tx.status === 'SUCCESS' ? 'Исполнено' : tx.status}
          </div>
        </div>

        {tx.idempotencyKey && (
          <button
            onClick={() => onCopy(tx.idempotencyKey!, tx.id)}
            className="p-2 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer print:hidden"
            title="Скопировать ID транзакции"
          >
            {copiedId === tx.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
