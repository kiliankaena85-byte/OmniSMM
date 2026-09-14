'use client';

import { Table } from '@/components/admin/hero-ui';

interface Log {
  id: string;
  action: string;
  adminEmail: string;
  createdAt: Date;
}

export function RecentAuditTable({ logs }: { logs: Log[] }) {
  const rows = logs.map((log) => (
    <Table.Row key={log.id}>
      <Table.Cell>
        <span className="text-muted-foreground font-mono text-[11px]">LOG_{log.id.slice(0,6).toUpperCase()}</span>
      </Table.Cell>
      <Table.Cell>
        <span className="font-bold text-foreground text-[13px]">{log.action}</span>
      </Table.Cell>
      <Table.Cell>
        <span className="font-medium text-foreground text-[13px]">{log.adminEmail.split('@')[0]}</span>
      </Table.Cell>
      <Table.Cell>
        <span className="text-xs font-medium text-muted-foreground">
          {new Date(log.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </Table.Cell>
    </Table.Row>
  ));

  return (
    <div className="w-full">
      <Table aria-label="Журнал безопасности">
        <Table.ScrollContainer>
          <Table.Content aria-label="Журнал безопасности (Audit Log)">
            <Table.Header>
              <Table.Column isRowHeader>Log ID</Table.Column>
              <Table.Column>Действие</Table.Column>
              <Table.Column>Сотрудник</Table.Column>
              <Table.Column>Дата и время</Table.Column>
            </Table.Header>
            <Table.Body emptyContent="Записей в журнале безопасности пока нет">
              {rows}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}
