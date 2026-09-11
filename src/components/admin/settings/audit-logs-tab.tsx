'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import type { AdminAuditLog } from '@prisma/client';
import { DataTable } from '@/components/ui/data-table';

const auditColumns: ColumnDef<AdminAuditLog>[] = [
  {
    accessorKey: 'action',
    header: 'Действие',
    cell: ({ row }) => (
      <span className="font-bold text-foreground text-xs uppercase tracking-wider">
        {row.original.action}
      </span>
    ),
  },
  {
    accessorKey: 'targetType',
    header: 'Тип',
    cell: ({ row }) => (
      <Badge className="font-bold text-[10px] bg-muted text-muted-foreground border-border uppercase">
        {row.original.targetType}
      </Badge>
    ),
  },
  {
    accessorKey: 'adminEmail',
    header: 'Админ',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground font-mono">
        {row.original.adminEmail}
      </span>
    ),
  },
  {
    accessorKey: 'newValue',
    header: 'Детали',
    cell: ({ row }) => (
      <div className="max-w-[360px] truncate text-[11px] text-muted-foreground font-medium" title={row.original.newValue || row.original.oldValue || ''}>
        {row.original.newValue || row.original.oldValue || '—'}
      </div>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Дата',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/70 tabular-nums whitespace-nowrap">
        {new Date(row.original.createdAt).toLocaleString('ru-RU')}
      </span>
    ),
  },
];

interface AuditLogsTabProps {
  logs: AdminAuditLog[];
}

export function AuditLogsTab({ logs }: AuditLogsTabProps) {
  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-2xl border border-border shadow-sm bg-card overflow-hidden">
        <div className="p-0">
          <DataTable 
            columns={auditColumns} 
            data={logs}
            searchKey="action"
            searchPlaceholder="Поиск по действию..."
          />
        </div>
      </div>
    </div>
  );
}
