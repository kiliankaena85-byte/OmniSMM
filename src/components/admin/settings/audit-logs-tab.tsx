'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdminAuditLog } from '@prisma/client';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, Shield, Globe, Calendar, User, Terminal } from 'lucide-react';

function formatJsonSafe(val?: string | null): string {
  if (!val) return '—';
  try {
    const parsed = JSON.parse(val);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return val;
  }
}

interface AuditLogsTabProps {
  logs: AdminAuditLog[];
}

export function AuditLogsTab({ logs }: AuditLogsTabProps) {
  const [selectedLog, setSelectedLog] = React.useState<AdminAuditLog | null>(null);

  const auditColumns = React.useMemo<ColumnDef<AdminAuditLog>[]>(() => [
    {
      accessorKey: 'action',
      header: 'Действие',
      cell: ({ row }) => (
        <span className="font-bold text-foreground text-xs uppercase tracking-wider font-mono">
          {row.original.action}
        </span>
      ),
    },
    {
      accessorKey: 'targetType',
      header: 'Тип',
      cell: ({ row }) => (
        <Badge className="font-bold text-[10px] bg-muted/60 text-muted-foreground border-border uppercase">
          {row.original.targetType}
        </Badge>
      ),
    },
    {
      accessorKey: 'adminEmail',
      header: 'Сотрудник',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">
          {row.original.adminEmail}
        </span>
      ),
    },
    {
      accessorKey: 'newValue',
      header: 'Изменения',
      cell: ({ row }) => {
        const preview = row.original.newValue || row.original.oldValue || '—';
        return (
          <div 
            onClick={() => setSelectedLog(row.original)}
            className="max-w-[320px] truncate text-[11px] text-muted-foreground font-mono cursor-pointer hover:text-primary transition-colors" 
            title="Нажмите для просмотра полных деталей"
          >
            {preview}
          </div>
        );
      },
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
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(row.original)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Просмотреть детали"
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ),
    },
  ], []);

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-2xl border border-border shadow-sm bg-card overflow-hidden">
        <div className="p-0">
          <DataTable 
            columns={auditColumns} 
            data={logs}
            searchKey="action"
            searchPlaceholder="Поиск по действию (USER_ROLE_CHANGE, SETTINGS_UPDATE)..."
          />
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary pb-1">
              <Terminal className="w-5 h-5" />
              <DialogTitle className="text-base font-bold font-mono">
                {selectedLog?.action}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Неизменяемая запись журнала действий персонала платформы
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/60">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Сотрудник</span>
                  <span className="font-mono text-[11px] font-medium text-foreground">{selectedLog.adminEmail}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Тип объекта</span>
                  <span className="font-mono text-[11px] font-bold text-primary">{selectedLog.targetType}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">IP-адрес</span>
                  <span className="font-mono text-[11px] text-foreground">{selectedLog.ipAddress || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Дата & Время</span>
                  <span className="text-[11px] tabular-nums text-foreground">
                    {new Date(selectedLog.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
              </div>

              {selectedLog.target && (
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Target ID:</span>
                  <div className="p-2 rounded-lg bg-muted/30 font-mono text-[11px] text-foreground select-all break-all">
                    {selectedLog.target}
                  </div>
                </div>
              )}

              {selectedLog.oldValue && (
                <div className="space-y-1">
                  <span className="text-[10px] text-rose-500 uppercase font-bold">Предыдущее значение (Old):</span>
                  <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-300 font-mono text-[11px] overflow-x-auto max-h-48 border border-zinc-800">
                    {formatJsonSafe(selectedLog.oldValue)}
                  </pre>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] text-emerald-500 uppercase font-bold">Новое значение (Payload):</span>
                <pre className="p-3 rounded-xl bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-56 border border-zinc-800">
                  {formatJsonSafe(selectedLog.newValue)}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedLog(null)}
              className="text-xs"
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
