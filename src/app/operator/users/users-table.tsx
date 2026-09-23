'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export type OperatorUserRow = {
  id: string;
  email: string;
  role: string;
  balance: number;
  quarantineBalance: number;
  totalSpent: number;
  createdAt: Date;
  _count: { orders: number; tickets: number };
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  OWNER:   { label: 'Владелец', color: 'bg-warning/15 text-warning border-transparent hover:bg-warning/20' },
  ADMIN:   { label: 'Админ',   color: 'bg-primary/10 text-primary border-transparent hover:bg-primary/20' },
  MANAGER: { label: 'Менеджер', color: 'bg-success/15 text-success border-transparent hover:bg-success/20' },
  SUPPORT: { label: 'Саппорт', color: 'bg-muted text-muted-foreground border-transparent hover:bg-muted' },
  USER:    { label: 'Клиент',  color: 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary' },
  BANNED:  { label: 'Забанен', color: 'bg-destructive/15 text-destructive border-transparent hover:bg-destructive/20' },
};

export const columns: ColumnDef<OperatorUserRow>[] = [
  {
    accessorKey: 'email',
    header: 'Email / Клиент',
    cell: ({ row }) => {
      const u = row.original;
      return (
        <Link
          href={`/operator/users/${u.id}`}
          className="text-primary hover:text-primary/80 font-mono font-medium text-[13px] transition-colors hover:underline underline-offset-4"
        >
          {u.email}
        </Link>
      );
    },
  },
  {
    accessorKey: 'role',
    header: 'Роль',
    cell: ({ row }) => {
      const u = row.original;
      const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-muted/50 text-foreground border-border/50' };
      return (
        <Badge intent="outline" className={`shadow-sm font-bold px-2 py-0.5 text-[10px] uppercase tracking-wider ${roleInfo.color}`}>
          {roleInfo.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'balance',
    header: () => <div className="text-right">Баланс</div>,
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="font-bold text-[13px] font-mono tabular-nums tracking-tight text-right text-foreground">
          {(Number(u.balance) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          {Number(u.quarantineBalance) > 0 && (
            <span className="block text-[11px] text-warning font-medium whitespace-nowrap mt-0.5 opacity-90">
              🔒 {(Number(u.quarantineBalance) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'totalSpent',
    header: () => <div className="text-right">LTV (Расход)</div>,
    cell: ({ row }) => {
      return (
        <div className="text-[13px] font-bold font-mono tabular-nums tracking-tight text-right text-foreground">
          {(Number(row.original.totalSpent) / 100).toLocaleString('ru-RU')} ₽
        </div>
      );
    },
  },
  {
    accessorKey: '_count.orders',
    header: () => <div className="text-right">Заказы</div>,
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
    header: 'Регистрация',
    cell: ({ row }) => {
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString('ru-RU')}
        </span>
      );
    },
  },
];

interface UsersTableProps {
  data: OperatorUserRow[];
}

export function UsersTable({ data }: UsersTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="email"
      searchPlaceholder="Фильтр по email..."
    />
  );
}
