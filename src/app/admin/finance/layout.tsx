import { ReactNode } from 'react';
import { enforceAnySectionAccess } from '@/lib/server/rbac';

/**
 * ADM-03 follow-up: coarse gate — the finance area is reachable with the
 * 'finance' section OR the balance-* sections, so the Cashier role can open
 * /admin/finance/balance-requests (its approval UI). Every nested page then
 * enforces its own specific section.
 */
export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await enforceAnySectionAccess(['finance', 'balance_requests', 'balance_stats']);
  return children;
}
