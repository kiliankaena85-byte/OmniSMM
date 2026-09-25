'use client';

import { SecurityEventDTO } from '@/types/system-logs.dto';
import { Eye, ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button } from "@heroui/react";

interface SecurityTableProps {
  items: SecurityEventDTO[];
  onInspect: (item: SecurityEventDTO) => void;
}

export function SecurityTable({ items, onInspect }: SecurityTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border bg-card/40">
        <ShieldAlert className="w-10 h-10 text-muted-foreground/60 mb-3" />
        <h4 className="text-sm font-medium text-foreground">События безопасности не обнаружены</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          За выбранный период или по заданным критериям фильтра инцидентов безопасности не зафиксировано.
        </p>
      </div>
    );
  }

  const renderSeverityBadge = (severity: string) => {
    const upper = severity.toUpperCase();
    if (upper === 'CRITICAL' || upper === 'HIGH' || upper === 'FATAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <AlertTriangle className="w-3 h-3" />
          {severity}
        </span>
      );
    }
    if (upper === 'WARNING' || upper === 'WARN') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <AlertTriangle className="w-3 h-3" />
          {severity}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
        <Info className="w-3 h-3" />
        {severity}
      </span>
    );
  };

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
      {/* Desktop View: HeroUI Table (Hidden on Mobile) */}
      <div className="hidden md:block w-full">
        <Table aria-label="Таблица событий безопасности" classNames={{ wrapper: "bg-card shadow-sm border border-border" }}>
          <TableHeader>
            <TableColumn>Дата и время</TableColumn>
            <TableColumn>Событие</TableColumn>
            <TableColumn>Уровень</TableColumn>
            <TableColumn>IP адрес</TableColumn>
            <TableColumn align="end">Детали</TableColumn>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs font-medium">{item.event}</span>
                </TableCell>
                <TableCell>{renderSeverityBadge(item.severity)}</TableCell>
                <TableCell>
                  <span className="font-mono text-muted-foreground">{item.ip || '—'}</span>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="flat" onPress={() => onInspect(item)} startContent={<Eye className="w-3.5 h-3.5" />}>
                    Контекст
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View: Stacked Cards (Hidden on Desktop) */}
      <div className="md:hidden flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col p-3 rounded-xl border border-border bg-card shadow-sm gap-2">
            <div className="flex items-center justify-between">
              {renderSeverityBadge(item.severity)}
              <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
            </div>
            <div className="font-mono text-sm font-medium">{item.event}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-xs text-muted-foreground">IP: {item.ip || '—'}</span>
              <Button size="sm" variant="flat" onPress={() => onInspect(item)} startContent={<Eye className="w-3.5 h-3.5" />}>
                Контекст
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
