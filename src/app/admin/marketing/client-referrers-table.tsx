'use client';

import { Table } from '@/components/admin/hero-ui';
import Link from 'next/link';
import { PayoutButton } from './payout-button';
import { formatRubles } from '@/utils/format-price';

type ReferrerType = {
  id: string;
  email: string;
  referralBalance: number;
  _count: { referrals: number };
};

export function ReferrersTable({ referrers }: { referrers: ReferrerType[] }) {
  return (
    <>
      <Table aria-label="Таблица рефералов">
        <Table.ScrollContainer>
          <Table.Content aria-label="Топ рефоводов">
            <Table.Header>
              <Table.Column isRowHeader>КЛИЕНТ</Table.Column>
              <Table.Column className="text-right">БАЛАНС / ДОСТУПНО К ВЫПЛАТЕ</Table.Column>
              <Table.Column className="text-right">РЕФЕРАЛЫ</Table.Column>
              <Table.Column className="text-right">ДЕЙСТВИЕ</Table.Column>
            </Table.Header>
            <Table.Body renderEmptyState={() => "Нет активных реферальных балансов"}>
              {referrers.map(u => (
                <Table.Row key={u.id}>
                  <Table.Cell>
                    <Link 
                      href={`/admin/clients?q=${encodeURIComponent(u.email)}`}
                      className="text-primary hover:underline font-mono text-xs font-semibold"
                    >
                      {u.email}
                    </Link>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <span className="font-black text-success tabular-nums">{formatRubles(u.referralBalance / 100)}</span>
                  </Table.Cell>
                  <Table.Cell className="text-right text-muted-foreground tabular-nums">
                    <span className="px-2 py-1 rounded-md bg-muted text-[10px] font-bold">{u._count.referrals} чел.</span>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <PayoutButton userId={u.id} amount={u.referralBalance} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </>
  );
}
