'use client';

import { AdminAuditLogDTO } from '@/types/system-logs.dto';
import { Eye, History, ShieldCheck } from 'lucide-react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button } from "@heroui/react";

interface AuditTableProps {
  items: AdminAuditLogDTO[];
  onInspect: (item: AdminAuditLogDTO) => void;
}

export function AuditTable({ items, onInspect }: AuditTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border bg-card/40">
        <History className="w-10 h-10 text-muted-foreground/60 mb-3" />
        <h4 className="text-sm font-medium text-foreground">Действия персонала не найдены</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Журнал изменений пуст для выбранных параметров поиска или фильтрации.
        </p>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <>
      <div className="hidden md:block w-full">
        <Table aria-label="Таблица аудита действий администраторов" classNames={{ wrapper: "bg-card shadow-sm border border-border" }}>
          <TableHeader>
            <TableColumn>Дата и время</TableColumn>
            <TableColumn>Администратор</TableColumn>
            <TableColumn>Действие</TableColumn>
            <TableColumn>Тип сущности</TableColumn>
            <TableColumn>ID сущности</TableColumn>
            <TableColumn>IP адрес</TableColumn>
            <TableColumn align="end">Дифф</TableColumn>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{item.adminEmail}</span>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] bg-primary/10 text-primary border border-primary/20">
                    <ShieldCheck className="w-3 h-3" />
                    {item.action}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] text-muted-foreground font-mono">
                    {item.targetType}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-muted-foreground max-w-[140px] truncate" title={item.target}>
                    {item.target}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-muted-foreground">{item.ipAddress || '—'}</span>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="flat" onPress={() => onInspect(item)} startContent={<Eye className="w-3.5 h-3.5" />}>
                    Изменения
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col p-3 rounded-xl border border-border bg-card shadow-sm gap-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] bg-primary/10 text-primary border border-primary/20">
                <ShieldCheck className="w-3 h-3" /> {item.action}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
            </div>
            
            <div className="font-mono text-sm font-medium">{item.adminEmail}</div>
            
            <div className="flex flex-col gap-1 mt-1 text-xs text-muted-foreground">
              <div className="flex justify-between items-center gap-2">
                <span>Объект:</span>
                <span className="font-mono text-foreground text-right truncate">
                  <span className="text-muted-foreground mr-1">{item.targetType}</span>
                  {item.target}
                </span>
              </div>
              <div className="flex justify-between">
                <span>IP:</span>
                <span className="font-mono text-foreground text-right">{item.ipAddress || '—'}</span>
              </div>
            </div>
            
            <div className="mt-2 flex justify-end border-t border-border/50 pt-2">
              <Button size="sm" variant="flat" onPress={() => onInspect(item)} startContent={<Eye className="w-3.5 h-3.5" />}>
                Изменения
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
