'use client';

import React from 'react';
import { UserDTO, PaymentDTO, OrderDTO, ClientLedgerSummaryDTO } from './types';
import { BalanceTerminalForm } from './balance-terminal-form';
import { BalanceSnapshotPanel } from './balance-snapshot-panel';

interface BalanceTabProps {
  user: UserDTO;
  orders: OrderDTO[];
  payments: PaymentDTO[];
  canSeeFinances: boolean;
  onNavigateToPayments: () => void;
  ledgerSummary?: ClientLedgerSummaryDTO;
}

export function BalanceTab({
  user,
  orders,
  payments,
  canSeeFinances,
  onNavigateToPayments,
  ledgerSummary,
}: BalanceTabProps) {
  const totalSpentRub = (user.totalSpent || 0) / 100;

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column (7 cols): Interactive Financial Terminal */}
      <div className="lg:col-span-7 space-y-6">
        {canSeeFinances && (
          <BalanceTerminalForm 
            user={user} 
            orders={orders} 
            payments={payments} 
          />
        )}
      </div>

      {/* Right Column (5 cols): Financial Snapshot & Policies */}
      <div className="lg:col-span-5 space-y-6">
        <BalanceSnapshotPanel 
          payments={payments} 
          orders={orders} 
          totalSpentRub={totalSpentRub} 
          onNavigateToPayments={onNavigateToPayments} 
          totalDepositedRub={ledgerSummary?.totalDepositedRub}
          paymentsCount={user.paymentsCount}
          ordersCount={user.ordersCount}
        />
      </div>
    </div>
  );
}
