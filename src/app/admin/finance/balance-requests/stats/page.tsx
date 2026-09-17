import { BalanceAdjustmentStatsClient } from './balance-requests-stats-client';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const metadata = {
  title: 'Статистика корректировок баланса | OmniSMM 1.0',
};

/**
 * ADM-03 follow-up: stats page enforces its own 'balance_stats' section
 * (the Cashier role has view-only access to it).
 */
export default async function BalanceAdjustmentStatsPage() {
  await enforceSectionAccess('balance_stats');
  return <BalanceAdjustmentStatsClient />;
}
