'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Building2, MessageCircle } from 'lucide-react';
import { SortableHeader } from './sortable-header';

export type ClientColumn = {
  id: string;
  email: string;
  role: string;
  balance: number;
  quarantineBalance: number;
  totalSpent: number;
  telegramId: string | null;
  companyName: string | null;
  inn: string | null;
  createdAt: Date | string;
  b2bConfig?: {
    isB2b: boolean;
    prioritySupport: boolean;
    webhookUrl: string | null;
  } | null;
  _count: { orders: number };
  tier: { name: string; color: string };
  tenantId: string;
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  OWNER:   { label: 'Владелец', color: 'bg-warning/15 text-warning border-warning/20' },
  ADMIN:   { label: 'Админ',   color: 'bg-primary/10 text-primary border-primary/20' },
  MANAGER: { label: 'Менеджер', color: 'bg-success/15 text-emerald-700 border-success/20' },
  SUPPORT: { label: 'Саппорт', color: 'bg-muted text-muted-foreground border-border' },
  USER:    { label: 'Клиент',  color: 'bg-secondary text-secondary-foreground border-border' },
  BANNED:  { label: 'Забанен', color: 'bg-destructive/15 text-destructive border-destructive/20' },
};

export const columns: ColumnDef<ClientColumn>[] = [
  {
    accessorKey: 'email',
    header: () => <SortableHeader title="Email / Клиент" field="email" defaultOrder="asc" />,
    cell: ({ row }) => {
      const u = row.original;
      const isB2b = u.b2bConfig?.isB2b || Boolean(u.inn);
      return (
        <div className="flex flex-col gap-0.5 py-0.5 max-w-[170px]">
          <div className="flex items-center gap-1.5 truncate">
            <Link
              href={`/admin/clients/${u.id}`}
              className="text-primary hover:text-primary/80 font-mono font-bold text-[13px] transition-colors hover:underline underline-offset-4 truncate"
              title={u.email}
            >
              {u.email}
            </Link>
            {isB2b && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.2 bg-warning/15 text-warning-text border border-warning/30 rounded text-[9px] font-black uppercase tracking-wider">
                <Building2 className="w-2.5 h-2.5" /> B2B
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">ID: {u.id.slice(-6)}</span>
            {u.telegramId && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 shrink-0 truncate max-w-[90px]" title={u.telegramId}>
                <MessageCircle className="w-2.5 h-2.5 shrink-0" /> {u.telegramId}
              </span>
            )}
            {u.companyName && (
              <span className="text-[10px] text-foreground font-medium truncate max-w-[100px]" title={u.companyName}>
                · {u.companyName}
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: 'tenantId',
    header: 'Бренд',
    cell: ({ row }) => {
      const u = row.original;
      const isSmmplan = u.tenantId === 'smmplan';
      const bg = isSmmplan 
        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' 
        : 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      return (
        <Badge intent="outline" className={`shadow-xs px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${bg}`}>
          {isSmmplan ? 'SMMplan' : 'SMMflux'}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'role',
    header: () => <SortableHeader title="Роль" field="role" defaultOrder="asc" />,
    cell: ({ row }) => {
      const u = row.original;
      const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-muted/50 text-foreground border-border/50' };
      return (
        <Badge intent="outline" className={`shadow-xs font-bold px-2 py-0.5 text-[10px] uppercase tracking-wider ${roleInfo.color}`}>
          {roleInfo.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'balance',
    header: () => <SortableHeader title="Баланс" field="balance" align="right" defaultOrder="desc" />,
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="font-bold text-[13px] font-mono tabular-nums tracking-tight text-right text-foreground">
          {Math.round(Number(u.balance) / 100).toLocaleString('ru-RU')} ₽
          {Number(u.quarantineBalance) > 0 && (
            <span className="block text-[10px] text-warning font-medium whitespace-nowrap mt-0.5">
              🔒 {Math.round(Number(u.quarantineBalance) / 100).toLocaleString('ru-RU')} ₽
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'totalSpent',
    header: () => <SortableHeader title="LTV (Объем)" field="totalSpent" align="right" defaultOrder="desc" />,
    cell: ({ row }) => {
      return (
        <div className="text-[13px] font-bold font-mono tabular-nums tracking-tight text-right text-foreground">
          {Math.round(Number(row.original.totalSpent) / 100).toLocaleString('ru-RU')} ₽
        </div>
      );
    },
  },
  {
    accessorKey: '_count.orders',
    header: () => <SortableHeader title="Заказы" field="orders" align="right" defaultOrder="desc" />,
    cell: ({ row }) => {
      return (
        <div className="text-[13px] font-bold font-mono tabular-nums tracking-tight text-right text-foreground">
          {row.original._count.orders.toLocaleString('ru-RU')}
        </div>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: () => <SortableHeader title="Регистрация" field="createdAt" defaultOrder="desc" />,
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt);
      const formattedDate = date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const formattedTime = date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return (
        <div 
          className="text-xs font-mono font-medium text-muted-foreground whitespace-nowrap"
          title={`Зарегистрирован: ${formattedDate} в ${formattedTime}`}
        >
          {formattedDate}
        </div>
      );
    },
  },
  {
    accessorKey: 'tier',
    header: 'Уровень',
    cell: ({ row }) => {
      const tier = row.original.tier;
      return (
        <Badge intent="outline" className={`shadow-xs px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tier.color}`}>
          {tier.name}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Действия</div>,
    cell: ({ row }) => {
      return (
        <div className="text-right">
          <Link
            href={`/admin/clients/${row.original.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-all active:scale-95 shadow-xs"
          >
            Карточка →
          </Link>
        </div>
      );
    },
  },
];
