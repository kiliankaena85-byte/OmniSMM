/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Transaction Classifier for Financial Journal and Client Dashboards.
 */

export type TransactionFilterCategory = 'DEPOSIT' | 'SPENT' | 'REFUND' | 'ADJUSTMENT' | 'OTHER';

export interface LedgerItemForClassification {
  amountRub: number;
  transactionType: string;
}

export const DEPOSIT_TYPES = new Set(['TOPUP', 'PAYMENT', 'ADJUSTMENT']);
export const SPEND_TYPES = new Set(['ORDER_CHARGE', 'PAYMENT', 'REROUTE']);
export const REFUND_TYPES = new Set(['REFUND', 'ORDER_CANCEL', 'COMPENSATION']);

/**
 * Classifies a ledger entry into a canonical client-facing category.
 * Mirrors the admin ledger classification rules in src/actions/admin/finance/ledger.ts.
 */
export function classifyTransaction(item: LedgerItemForClassification): TransactionFilterCategory {
  const { amountRub, transactionType } = item;

  if (transactionType === 'REFUND' || transactionType === 'ORDER_CANCEL') {
    return 'REFUND';
  }

  if (transactionType === 'COMPENSATION' && amountRub > 0) {
    return 'REFUND';
  }

  if (amountRub > 0 && DEPOSIT_TYPES.has(transactionType)) {
    return 'DEPOSIT';
  }

  if (amountRub < 0 && SPEND_TYPES.has(transactionType)) {
    return 'SPENT';
  }

  if (transactionType === 'ADJUSTMENT' || transactionType === 'REROUTE') {
    return 'ADJUSTMENT';
  }

  return 'OTHER';
}

/**
 * Checks if a transaction matches a specific filter tab ('ALL', 'DEPOSIT', 'SPENT', 'REFUND').
 */
export function matchesTransactionTypeFilter(
  item: LedgerItemForClassification,
  typeFilter: 'ALL' | 'DEPOSIT' | 'SPENT' | 'REFUND'
): boolean {
  if (typeFilter === 'ALL') return true;

  const category = classifyTransaction(item);
  return category === typeFilter;
}
