import { db } from '@/lib/db';

export interface FinancialSummary {
  userId: string;
  currentBalanceCents: number;
  totalDepositsCents: number;
  totalChargesCents: number;
  totalRefundsCents: number;
  totalGoodwillCents: number;
  totalCorrectionsCents: number;
  netFlowCents: number;
}

/**
 * Aggregates client financial metrics strictly from approved ledger entries.
 * Returns all values in cents as standard numbers for ease of JSON serialization.
 */
export async function getClientFinancialSummary(userId: string, tenantId?: string): Promise<FinancialSummary> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { balance: true, tenantId: true }
  });

  const currentBalanceCents = user ? Number(user.balance) : 0;
  const effectiveTenantId = tenantId || user?.tenantId;

  // Retrieve all approved ledger entries
  const entries = await db.ledgerEntry.findMany({
    where: {
      userId,
      status: 'APPROVED',
      ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {})
    },
    select: {
      amount: true,
      transactionType: true,
      reason: true,
      adminId: true,
    }
  });

  let totalDeposits = BigInt(0);
  let totalCharges = BigInt(0);
  let totalRefunds = BigInt(0);
  let totalGoodwill = BigInt(0);
  let totalCorrections = BigInt(0);
  let netFlow = BigInt(0);

  for (const entry of entries) {
    const amt = entry.amount; // positive = credit, negative = debit
    netFlow += amt;

    const lowerReason = entry.reason.toLowerCase();
    const isRefund = entry.transactionType === 'REFUND' || lowerReason.includes('возврат');
    const isGoodwill = entry.transactionType === 'COMPENSATION' || lowerReason.includes('компенсаци');

    if (amt > 0) {
      if (isRefund) {
        totalRefunds += amt;
      } else if (isGoodwill) {
        totalGoodwill += amt;
      } else {
        // Positive adjustment or deposit
        if (entry.adminId !== null) {
          totalCorrections += amt;
        } else {
          totalDeposits += amt;
        }
      }
    } else if (amt < 0) {
      // Native negative represents a charge or negative adjustment
      const absAmt = -amt;
      if (entry.adminId !== null && !isGoodwill && !isRefund) {
        // Admin-initiated manual charge (correction)
        totalCorrections += absAmt;
      } else {
        // Regular charge/spent
        totalCharges += absAmt;
      }
    }
  }

  // Discrepancy check: log to warning if current balance doesn't match net flow
  if (BigInt(currentBalanceCents) !== netFlow) {
    console.warn(
      `[FinancialSummary] Discrepancy detected for user ${userId}. User.balance: ${currentBalanceCents} cents, Ledger Net Flow: ${netFlow.toString()} cents.`
    );
  }

  return {
    userId,
    currentBalanceCents,
    totalDepositsCents: Number(totalDeposits),
    totalChargesCents: Number(totalCharges),
    totalRefundsCents: Number(totalRefunds),
    totalGoodwillCents: Number(totalGoodwill),
    totalCorrectionsCents: Number(totalCorrections),
    netFlowCents: Number(netFlow),
  };
}
