'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PaymentDTO } from '@/actions/admin/finance/payments';
import { Copy, Check, FileText } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  SUCCEEDED: 'Успешно',
  PENDING:   'Ожидание',
  CANCELED:  'Отменено',
};

const STATUS_CLASSES: Record<string, string> = {
  SUCCEEDED: 'bg-success/15 text-success border-success/20',
  PENDING:   'bg-warning/15 text-warning border-warning/20',
  CANCELED:  'bg-destructive/15 text-destructive border-destructive/20',
};

const GATEWAY_LABELS: Record<string, string> = {
  yookassa: 'ЮKassa',
  cryptobot: 'CryptoBot',
  test:      'Тестовый',
};

function fmt(cents: number): string {
  return `${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-all duration-200 cursor-pointer shrink-0"
      title="Копировать ID транзакции"
      type="button"
    >
      {copied ? (
        <Check className="w-3 h-3 text-success animate-in fade-in zoom-in-50 duration-200" />
      ) : (
        <Copy className="w-3 h-3 transition-transform active:scale-90" />
      )}
    </button>
  );
}

export const columns: ColumnDef<PaymentDTO>[] = [
  {
    accessorKey: 'userEmail',
    header: 'Клиент',
    cell: ({ row }) => {
      const displayId = row.original.gatewayId || row.original.id;
      return (
        <div className="flex flex-col gap-0.5 min-w-0 w-full max-w-full">
          <Link
            href={`/admin/clients?q=${encodeURIComponent(row.original.userEmail)}`}
            className="text-primary hover:text-primary/80 hover:underline font-mono text-xs font-semibold truncate block transition-colors"
            title={row.original.userEmail}
          >
            {row.original.userEmail}
          </Link>
          <div className="flex items-center gap-1 min-w-0">
            <span 
              className="text-[10px] text-muted-foreground font-mono truncate"
              title={displayId}
            >
              ID: {displayId.slice(0, 8)}...
            </span>
            <CopyButton value={displayId} />
          </div>
        </div>
      );
    },
    filterFn: (row, columnId, filterValue) => {
      const val = String(filterValue).toLowerCase();
      const email = String(row.original.userEmail).toLowerCase();
      const id = String(row.original.id).toLowerCase();
      const gatewayId = row.original.gatewayId ? String(row.original.gatewayId).toLowerCase() : '';
      return email.includes(val) || id.includes(val) || gatewayId.includes(val);
    },
  },
  {
    accessorKey: 'tenantId',
    header: 'Бренд',
    size: 95,
    cell: ({ row }) => {
      const u = row.original;
      const isSmmplan = u.tenantId === 'smmplan';
      const bg = isSmmplan 
        ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' 
        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20';
      return (
        <Badge intent="outline" className={`shadow-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${bg}`}>
          {isSmmplan ? 'SMMplan' : 'SMMflux'}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Сумма</div>,
    size: 115,
    cell: ({ row }) => {
      const isSucceeded = row.original.status === 'SUCCEEDED';
      return (
        <div className="flex items-center justify-end gap-1.5 text-right">
          <span className="font-bold tabular-nums text-xs text-foreground">
            {fmt(row.original.amount)}
          </span>
          {isSucceeded && (
            <Link
              href={`/admin/finance/payments/${row.original.id}/dispute-pack`}
              className="p-1 hover:bg-muted text-primary hover:text-primary/80 rounded transition-colors"
              title="📄 Оформить dispute-пакет документов"
            >
              <FileText className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Статус',
    size: 135,
    cell: ({ row }) => {
      const status = row.original.status;
      const gatewayLabel = GATEWAY_LABELS[row.original.gateway] || row.original.gateway;
      const isPending = status === 'PENDING';
      const isStale = isPending && (Date.now() - new Date(row.original.createdAt).getTime() > 30 * 60 * 1000);

      return (
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge
              className={cn(
                "uppercase font-bold tracking-wider text-[9px] py-0 px-1.5 h-4.5 rounded-md",
                STATUS_CLASSES[status] || 'bg-muted text-muted-foreground border-border'
              )}
            >
              {STATUS_LABELS[status] || status}
            </Badge>
            {isStale && (
              <Badge
                intent="outline"
                className="bg-destructive/15 text-destructive border-destructive/30 text-[8px] font-bold py-0 px-1 h-3.5"
                title="Платёж ожидает подтверждения более 30 минут"
              >
                STALE
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/75 font-medium">
            {gatewayLabel}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Дата',
    size: 120,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {new Date(row.original.createdAt).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: 'short', 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Действие</div>,
    size: 105,
    cell: ({ row, table }) => {
      const p = row.original;
      const isPending = p.status === 'PENDING';
      const meta = table.options.meta as { onApprovePayment?: (payment: PaymentDTO) => void } | undefined;

      if (!isPending || !meta?.onApprovePayment) return null;

      return (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => meta.onApprovePayment!(p)}
            className="px-2 py-0.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 h-6"
            title="Подтвердить зачисление по чеку/письму"
          >
            <span>✓ Подтвердить</span>
          </button>
        </div>
      );
    },
  },
];
