'use client';

import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { LedgerEntryDTO } from '@/actions/admin/finance/ledger';
import { Copy, Check } from 'lucide-react';

import { LEDGER_TYPE_CONFIG, resolveLedgerTypeForDisplay } from '@/lib/financial/ledger-types';

const STATUS_LABELS: Record<string, string> = {
  APPROVED:    'Одобрено',
  QUARANTINE:  'Карантин',
  REJECTED:    'Отклонено',
};

const STATUS_CLASSES: Record<string, string> = {
  APPROVED:   'bg-success/15 text-success border-success/20',
  QUARANTINE: 'bg-warning/15 text-warning border-warning/20',
  REJECTED:   'bg-destructive/15 text-destructive border-destructive/20',
};

export function getTypeBadge(type: string, amount: number, adminId: string | null) {
  const resolvedType = resolveLedgerTypeForDisplay(type, amount, adminId);
  const cfg = LEDGER_TYPE_CONFIG[resolvedType] || LEDGER_TYPE_CONFIG.TOPUP;

  return (
    <Badge intent="outline" className={`text-[10px] font-bold px-2 py-0.5 ${cfg.badgeClass}`}>
      {cfg.emoji} {cfg.label}
    </Badge>
  );
}

function fmt(cents: number, showSign = false): string {
  const sign = showSign && cents > 0 ? '+' : '';
  return `${sign}${(Math.abs(cents) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
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
      title="Копировать ID проводки"
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

export const columns: ColumnDef<LedgerEntryDTO>[] = [
  {
    accessorKey: 'userEmail',
    header: 'Клиент',
    cell: ({ row }) => (
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
            title={row.original.id}
          >
            ID: {row.original.id.slice(0, 8)}...
          </span>
          <CopyButton value={row.original.id} />
        </div>
      </div>
    ),
    filterFn: (row, columnId, filterValue) => {
      const val = String(filterValue).toLowerCase();
      const email = String(row.original.userEmail).toLowerCase();
      const id = String(row.original.id).toLowerCase();
      return email.includes(val) || id.includes(val);
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
    accessorKey: 'transactionType',
    header: 'Тип операции',
    size: 145,
    cell: ({ row }) => {
      const { transactionType, amount, adminId } = row.original;
      return getTypeBadge(transactionType, amount, adminId);
    },
  },
  {
    accessorKey: 'reason',
    header: 'Причина',
    cell: ({ row }) => {
      const adminId = row.original.adminId;
      return (
        <div className="flex flex-col items-start gap-0.5 min-w-0 w-full">
          <span className="text-xs text-foreground font-medium truncate block w-full leading-relaxed" title={row.original.reason}>
            {row.original.reason}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium truncate">
            {adminId ? `👤 Оператор (${adminId.slice(0, 6)})` : '⚙️ Система'}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: 'amount',
    header: () => <div className="text-right">Сумма</div>,
    size: 110,
    cell: ({ row }) => {
      const amount = row.original.amount;
      const isPositive = amount >= 0;
      return (
        <div className={`text-right font-bold tabular-nums text-xs ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {fmt(amount, true)}
        </div>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Дата',
    size: 125,
    cell: ({ row }) => {
      const status = row.original.status;
      const showStatusLabel = status !== 'APPROVED';
      return (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleString('ru-RU', { 
              day: '2-digit', 
              month: 'short', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          {showStatusLabel && (
            <Badge
              className={`uppercase font-bold tracking-wider text-[8px] py-0 px-1 h-3.5 rounded ${STATUS_CLASSES[status] || 'bg-muted text-muted-foreground'}`}
            >
              {STATUS_LABELS[status] || status}
            </Badge>
          )}
        </div>
      );
    },
  },
];
