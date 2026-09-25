'use client';

import { TelegramErrorLogDTO } from '@/types/system-logs.dto';
import { Eye, Bot, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Button } from "@heroui/react";

interface TelegramTableProps {
  items: TelegramErrorLogDTO[];
  onInspect: (item: TelegramErrorLogDTO) => void;
}

export function TelegramTable({ items, onInspect }: TelegramTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border bg-card/40">
        <Bot className="w-10 h-10 text-muted-foreground/60 mb-3" />
        <h4 className="text-sm font-medium text-foreground">Ошибки Telegram-шлюза не обнаружены</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Все сервисы Telegram-интеграций и фоновые демоны работают в штатном режиме без сбоев.
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

  const renderLevel = (level: string) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
      level === 'FATAL' || level === 'ERROR'
        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    }`}>
      <AlertOctagon className="w-3 h-3" /> {level}
    </span>
  );

  return (
    <>
      <div className="hidden md:block w-full">
        <Table aria-label="Таблица ошибок Telegram" classNames={{ wrapper: "bg-card shadow-sm border border-border" }}>
          <TableHeader>
            <TableColumn>Дата</TableColumn>
            <TableColumn>Уровень</TableColumn>
            <TableColumn>Источник</TableColumn>
            <TableColumn>Текст ошибки</TableColumn>
            <TableColumn>Повторов</TableColumn>
            <TableColumn>Статус</TableColumn>
            <TableColumn align="end">Стэк</TableColumn>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.firstSeenAt)}</span>
                </TableCell>
                <TableCell>{renderLevel(item.level)}</TableCell>
                <TableCell>
                  <span className="font-mono text-foreground">{item.source}</span>
                </TableCell>
                <TableCell>
                  <div className="max-w-[320px] truncate" title={item.errorMessage}>
                    {item.errorCode && <span className="font-mono text-muted-foreground mr-1.5">[{item.errorCode}]</span>}
                    {item.errorMessage}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-muted-foreground">{item.occurrenceCount}x</span>
                </TableCell>
                <TableCell>
                  {item.isResolved ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><CheckCircle2 className="w-3 h-3" /> Решено</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-500"><Clock className="w-3 h-3" /> Активно</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="flat" onPress={() => onInspect(item)} startContent={<Eye className="w-3.5 h-3.5" />}>
                    Стэк
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
              {renderLevel(item.level)}
              <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.firstSeenAt)}</span>
            </div>
            
            <div className="font-mono text-sm font-medium">
              <span className="text-muted-foreground mr-1.5">[{item.source}]</span>
            </div>
            <div className="text-sm">
              {item.errorCode && <span className="font-mono text-muted-foreground mr-1">[{item.errorCode}]</span>}
              {item.errorMessage}
            </div>
            
            <div className="flex items-center justify-between mt-1 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-muted-foreground">{item.occurrenceCount}x</span>
                {item.isResolved ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><CheckCircle2 className="w-3 h-3" /></span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-500"><Clock className="w-3 h-3" /></span>
                )}
              </div>
              <Button size="sm" variant="flat" onPress={() => onInspect(item)} startContent={<Eye className="w-3.5 h-3.5" />}>
                Стэк
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
