'use client';

import { toast } from 'sonner';
import { type Table } from '@tanstack/react-table';
import { type PaymentDTO } from '@/actions/admin/finance/payments';
import { type LedgerEntryDTO } from '@/actions/admin/finance/ledger';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '../payment-columns';
import { LEDGER_TYPE_CONFIG, resolveLedgerTypeForDisplay } from '@/lib/financial/ledger-types';
import Link from 'next/link';

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week',  label: '7 дней' },
  { value: 'month', label: '30 дней' },
  { value: 'all',   label: 'Всё время' },
] as const;

export const LEDGER_STATUS_OPTIONS = [
  { value: 'ALL',        label: 'Все статусы' },
  { value: 'APPROVED',   label: 'Одобрено' },
  { value: 'QUARANTINE', label: 'Карантин' },
  { value: 'REJECTED',   label: 'Отклонено' },
] as const;

export const LEDGER_TYPE_OPTIONS = [
  { value: 'ALL',          label: 'Все операции' },
  { value: 'TOPUP',        label: '💳 Пополнение баланса' },
  { value: 'ORDER_CHARGE', label: '🛒 Оплата заказа' },
  { value: 'ORDER_CANCEL', label: '🚫 Отмена заказа' },
  { value: 'REFUND',       label: '↩️ Авто-возврат средств' },
  { value: 'REROUTE',      label: '🔄 Перезапуск заказа' },
  { value: 'COMPENSATION', label: '🎁 Компенсация / Бонус' },
  { value: 'ADJUSTMENT',   label: '⚙️ Ручная корректировка' },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'ALL',       label: 'Все статусы' },
  { value: 'SUCCEEDED', label: 'Успешные' },
  { value: 'PENDING',   label: 'В ожидании' },
  { value: 'CANCELED',  label: 'Отменённые' },
] as const;

export const GATEWAY_OPTIONS = [
  { value: 'ALL',       label: 'Все шлюзы' },
  { value: 'yookassa',  label: 'ЮKassa' },
  { value: 'cryptobot', label: 'CryptoBot' },
  { value: 'robokassa', label: 'Robokassa' },
  { value: 'test',      label: 'Тестовые' },
] as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  SUCCEEDED: 'Успешно',
  PENDING:   'Ожидание',
  CANCELED:  'Отменено',
};

export const LEDGER_STATUS_LABELS: Record<string, string> = {
  APPROVED:    'Одобрено',
  QUARANTINE:  'Карантин',
  REJECTED:    'Отклонено',
};

export const GATEWAY_LABELS: Record<string, string> = {
  yookassa:  'ЮKassa',
  cryptobot: 'CryptoBot',
  robokassa: 'Robokassa',
  test:      'Тестовый',
};

export function fmt(cents: number, showSign = false): string {
  const sign = showSign && cents > 0 ? '+' : '';
  return `${sign}${(Math.abs(cents) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function downloadCsvExport(params: {
  type: 'ledger' | 'payments' | 'reconciliation' | 'balance_adjustments';
  period?: string;
  status?: string;
  tenantId?: string;
  search?: string;
  onlyAnomalies?: boolean;
}) {
  const query = new URLSearchParams();
  query.set('type', params.type);
  if (params.period) query.set('period', params.period);
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.tenantId && params.tenantId !== 'all') query.set('tenant', params.tenantId);
  if (params.search) query.set('search', params.search);
  if (params.onlyAnomalies) query.set('onlyAnomalies', 'true');

  const exportUrl = `/api/admin/export?${query.toString()}`;
  toast.info('Формирование отчёта для бухгалтера в CSV...', { duration: 2500 });
  
  const link = document.createElement('a');
  link.href = exportUrl;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function renderMobilePayments(table: Table<PaymentDTO>) {
  return (
    <div className="space-y-3">
      {table.getRowModel().rows.map((row) => {
        const item = row.original;
        const isSucceeded = item.status === 'SUCCEEDED';
        const displayId = item.gatewayId || item.id;
        return (
          <div key={item.id} className="p-4 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs space-y-2.5 text-foreground transition-all hover:border-border">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold font-mono truncate">{item.userEmail}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[130px]" title={displayId}>
                    ID: {displayId.slice(0, 8)}...
                  </span>
                  <CopyButton value={displayId} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold font-mono tabular-nums text-foreground block">
                  {fmt(item.amount)}
                </span>
                {isSucceeded && (
                  <Link 
                    href={`/admin/finance/payments/${item.id}/dispute-pack`}
                    className="inline-block text-[10px] text-primary font-bold uppercase tracking-wider mt-1 hover:underline"
                  >
                    📄 Споры
                  </Link>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center text-xs pt-2 border-t border-border/40">
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                {new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex items-center gap-2">
                <Badge intent="outline" className="text-[9px] font-bold uppercase py-0 px-1.5 h-4">
                  {GATEWAY_LABELS[item.gateway] || item.gateway}
                </Badge>
                <Badge 
                  intent="outline"
                  className={`text-[9px] font-bold uppercase py-0 px-1.5 h-4 rounded ${
                    item.status === 'SUCCEEDED' 
                      ? 'bg-success/15 text-success border-success/20' 
                      : item.status === 'PENDING' 
                      ? 'bg-warning/15 text-warning border-warning/20' 
                      : 'bg-destructive/15 text-destructive border-destructive/20'
                  }`}
                >
                  {PAYMENT_STATUS_LABELS[item.status] || item.status}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function renderMobileLedger(table: Table<LedgerEntryDTO>) {
  return (
    <div className="space-y-3">
      {table.getRowModel().rows.map((row) => {
        const item = row.original;
        const isPositive = item.amount >= 0;
        return (
          <div key={item.id} className="p-4 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm shadow-xs space-y-2.5 text-foreground transition-all hover:border-border">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold font-mono truncate">{item.userEmail}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[130px]" title={item.id}>
                    ID: {item.id.slice(0, 8)}...
                  </span>
                  <CopyButton value={item.id} />
                </div>
              </div>
              <div className={`text-right font-bold font-mono text-xs shrink-0 tabular-nums ${isPositive ? 'text-success' : 'text-destructive'}`}>
                {fmt(item.amount, true)}
              </div>
            </div>
            
            <div className="text-xs bg-muted/30 px-3 py-2 rounded-xl border border-border/40 space-y-1">
              <p className="font-medium text-foreground text-xs leading-relaxed">{item.reason}</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {item.adminId ? `👤 Оператор (${item.adminId.slice(0, 6)})` : '⚙️ Система'}
              </p>
            </div>
            
            <div className="flex justify-between items-center text-xs pt-2 border-t border-border/40 gap-2 flex-wrap">
              <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                {new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex items-center gap-1.5">
                {(() => {
                  const resolvedType = resolveLedgerTypeForDisplay(item.transactionType, item.amount, item.adminId);
                  const cfg = LEDGER_TYPE_CONFIG[resolvedType] || LEDGER_TYPE_CONFIG.TOPUP;
                  return (
                    <Badge intent="outline" className={`text-[9px] font-bold px-1.5 py-0 h-4 rounded ${cfg.badgeClass}`}>
                      {cfg.emoji} {cfg.label}
                    </Badge>
                  );
                })()}
                <Badge 
                  intent="outline" 
                  className={`text-[9px] font-bold uppercase py-0 px-1.5 h-4 rounded ${
                    item.status === 'APPROVED' 
                      ? 'bg-success/15 text-success border-success/20' 
                      : item.status === 'QUARANTINE' 
                      ? 'bg-warning/15 text-warning border-warning/20' 
                      : 'bg-destructive/15 text-destructive border-destructive/20'
                  }`}
                >
                  {LEDGER_STATUS_LABELS[item.status] || item.status}
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
