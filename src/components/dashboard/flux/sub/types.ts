export interface FluxTransaction {
  id: string;
  amountCents: number;
  amountRub: number;
  runningBalanceCents?: number | null;
  runningBalanceRub?: number | null;
  reason: string;
  status: string;
  idempotencyKey: string | null;
  transactionType: string;
  orderNumericId?: number | null;
  createdAt: string;
}

export interface FluxTransactionsSummary {
  totalDeposited: number;
  totalSpentGross: number;
  totalRefunded: number;
  totalSpentNet: number;
  depositCount: number;
  orderCount: number;
  refundCount: number;
}
