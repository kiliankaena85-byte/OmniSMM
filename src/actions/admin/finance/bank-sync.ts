'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { AlfaBankService, AlfaBankSyncResult } from '@/services/financial/bank-integrations/alfa-bank.service';

/**
 * Synchronizes account balance from Alfa-Bank Open API for a tenant.
 */
export async function syncAlfaBankBalanceAction(
  tenantId: string = 'smmplan',
  forceRefresh: boolean = true
): Promise<AlfaBankSyncResult> {
  return requireStaffPermission('FINANCE', 'view', async () => {
    return AlfaBankService.getLiveBalance(tenantId, forceRefresh);
  });
}
