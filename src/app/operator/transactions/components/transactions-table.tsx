'use client';

import * as React from 'react';
import Link from 'next/link';
import { Table } from '@/components/admin/hero-ui';
import { Badge } from '@/components/ui/badge';
import { LedgerEntryDTO } from '@/actions/operator/transactions/get-transactions-list.action';
import { LEDGER_TYPE_CONFIG, resolveLedgerTypeForDisplay } from '@/lib/financial/ledger-types';

interface TransactionsTableProps {
  data: LedgerEntryDTO[];
}

function renderTypeBadge(item: LedgerEntryDTO) {
  const resolvedType = resolveLedgerTypeForDisplay(item.transactionType, item.amount, item.adminId);
  const cfg = LEDGER_TYPE_CONFIG[resolvedType] || LEDGER_TYPE_CONFIG.TOPUP;

  return (
    <Badge intent="outline" className={`text-[10px] font-bold px-2 py-0.5 ${cfg.badgeClass}`}>
      {cfg.emoji} {cfg.label}
    </Badge>
  );
}

function renderStatusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge intent="outline" className="text-[10px] font-bold px-2 py-0.5 bg-success/15 text-success border-success/30">
          Одобрено
        </Badge>
      );
    case 'QUARANTINE':
      return (
        <Badge intent="outline" className="text-[10px] font-bold px-2 py-0.5 bg-warning/15 text-warning border-warning/30 animate-pulse">
          Карантин
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge intent="outline" className="text-[10px] font-bold px-2 py-0.5 bg-destructive/15 text-destructive border-destructive/30">
          Отклонено
        </Badge>
      );
    default:
      return (
        <Badge intent="outline" className="text-[10px] font-bold px-2 py-0.5 bg-muted text-muted-foreground">
          {status}
        </Badge>
      );
  }
}

export function TransactionsTable({ data }: TransactionsTableProps) {
  return (
    <Table.ScrollContainer>
      <Table aria-label="Таблица транзакций Ledger">
        <Table.Header>
          <Table.Column isRowHeader>ID Транзакции</Table.Column>
          <Table.Column>Клиент</Table.Column>
          <Table.Column className="text-right">Сумма</Table.Column>
          <Table.Column>Тип операции</Table.Column>
          <Table.Column>Статус</Table.Column>
          <Table.Column>Назначение / Описание</Table.Column>
          <Table.Column>Дата</Table.Column>
        </Table.Header>
        <Table.Body emptyContent="Транзакции не найдены">
          {data.map((item) => {
            const isCredit = item.amount > 0;
            const formattedAmount = (Math.abs(item.amount) / 100).toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
            });

            return (
              <Table.Row key={item.id}>
                {/* ID */}
                <Table.Cell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {item.id.slice(0, 10)}...
                </Table.Cell>

                {/* Client Link */}
                <Table.Cell>
                  <Link
                    href={`/operator/users/${item.userId}`}
                    className="text-primary hover:underline font-mono font-medium text-xs break-all"
                  >
                    {item.userEmail}
                  </Link>
                </Table.Cell>

                {/* Amount */}
                <Table.Cell className="text-right">
                  <span
                    className={`font-mono font-bold text-xs tabular-nums tracking-tight ${
                      isCredit ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {isCredit ? '+' : '-'}
                    {formattedAmount} ₽
                  </span>
                </Table.Cell>

                {/* Type */}
                <Table.Cell>
                  {renderTypeBadge(item)}
                </Table.Cell>

                {/* Status */}
                <Table.Cell>
                  {renderStatusBadge(item.status)}
                </Table.Cell>

                {/* Reason */}
                <Table.Cell className="max-w-[280px]">
                  <p className="text-xs text-foreground leading-normal font-medium break-words font-sans">
                    {item.reason}
                  </p>
                </Table.Cell>

                {/* Date */}
                <Table.Cell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(item.createdAt).toLocaleDateString('ru-RU')} в{' '}
                  {new Date(item.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </Table.ScrollContainer>
  );
}
