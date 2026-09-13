import { BalanceRequestsClient } from './balance-requests-client';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { verifySession } from '@/lib/session';

export const metadata = {
  title: 'Заявки на корректировку баланса | OmniSMM 1.0',
};

/**
 * ADM-03 follow-up: the balance requests UI requires its own section —
 * the Cashier role (balance_requests:edit) reaches this page through the
 * loosened finance layout without holding 'finance'.
 */
export default async function BalanceRequestsPage() {
  await enforceSectionAccess('balance_requests');
  const session = await verifySession();
  return <BalanceRequestsClient currentUserId={session?.userId} currentUserRole={session?.role} />;
}
