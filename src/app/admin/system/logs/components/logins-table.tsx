'use client';

import { LoginLogDTO } from '@/types/system-logs.dto';
import { CheckCircle2, XCircle, LogIn } from 'lucide-react';
import { Table } from '@/components/admin/hero-ui';

interface LoginsTableProps {
  items: LoginLogDTO[];
}

export function LoginsTable({ items }: LoginsTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border bg-card/40">
        <LogIn className="w-10 h-10 text-muted-foreground/60 mb-3" />
        <h4 className="text-sm font-medium text-foreground">Записи авторизаций не найдены</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          По текущим параметрам поиска или фильтрации попыток входа не зафиксировано.
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

  const renderStatus = (success: boolean) => success ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
      <CheckCircle2 className="w-3 h-3" /> Успешно
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
      <XCircle className="w-3 h-3" /> Отклонено
    </span>
  );

  return (
    <>
      {/* Desktop View: HeroUI Table (Hidden on Mobile) */}
      <div className="hidden md:block w-full">
        <div className="bg-card shadow-sm border border-border rounded-xl overflow-hidden">
          <Table aria-label="Таблица попыток авторизации">
            <Table.Header>
              <Table.Column>Дата и время</Table.Column>
              <Table.Column>Email аккаунта</Table.Column>
              <Table.Column>Статус</Table.Column>
              <Table.Column>Причина сбоя</Table.Column>
              <Table.Column>IP адрес</Table.Column>
              <Table.Column>Клиент (User-Agent)</Table.Column>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-xs font-medium">{item.email}</span>
                  </Table.Cell>
                  <Table.Cell>{renderStatus(item.success)}</Table.Cell>
                  <Table.Cell>
                    {item.failReason ? (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[11px] text-rose-400 font-mono">{item.failReason}</span>
                    ) : <span className="text-muted-foreground/60">—</span>}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="font-mono text-muted-foreground">{item.ipAddress}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-muted-foreground max-w-[220px] truncate" title={item.userAgent || ''}>
                      {item.userAgent || '—'}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>

      {/* Mobile View: Stacked Cards (Hidden on Desktop) */}
      <div className="md:hidden flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col p-3 rounded-xl border border-border bg-card shadow-sm gap-2">
            <div className="flex items-center justify-between">
              {renderStatus(item.success)}
              <span className="font-mono text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span>
            </div>
            <div className="font-mono text-sm font-medium break-all">{item.email}</div>
            
            <div className="flex flex-col gap-1 mt-1 text-xs text-muted-foreground">
              {item.failReason && (
                <div className="flex justify-between">
                  <span>Причина:</span>
                  <span className="text-rose-400 font-mono">{item.failReason}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>IP:</span>
                <span className="font-mono text-foreground">{item.ipAddress}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span>Клиент:</span>
                <span className="text-muted-foreground truncate max-w-[180px]">{item.userAgent || '—'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
