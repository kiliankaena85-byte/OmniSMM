'use server';

import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';
import {
  LedgerReconciliationService,
  type ReconciliationSummaryDTO,
  type ReconciledAccountDTO,
  type UserAuditTimelineDTO,
} from '@/services/financial/ledger-reconciliation.service';

const getAccountsParamsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(100).default(50),
  search: z.string().max(255).optional(),
  onlyAnomalies: z.boolean().default(false),
  tenantId: z.string().optional(),
});

export type GetAccountsParams = z.infer<typeof getAccountsParamsSchema>;

export type AccountsPageResult = {
  items: ReconciledAccountDTO[];
  totalCount: number;
  page: number;
  pageSize: number;
};

/**
 * Platform-wide reconciliation summary statistics
 */
export async function getReconciliationSummaryAction(
  tenantId?: string
): Promise<ReconciliationSummaryDTO | { success: false; error: string }> {
  try {
    return await requireStaffPermission('finance', 'view', async (admin) => {
      const activeTenantId = resolveAdminTenantContext(admin, tenantId);
      return await LedgerReconciliationService.getSummary(activeTenantId);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка получения сводки сверки';
    return { success: false, error: message };
  }
}

/**
 * Paginated list of reconciled accounts with anomaly sorting
 */
export async function getReconciliationAccountsAction(
  params: Partial<GetAccountsParams>
): Promise<AccountsPageResult | { success: false; error: string }> {
  try {
    return await requireStaffPermission('finance', 'view', async (admin) => {
      const p = getAccountsParamsSchema.parse(params || {});
      const activeTenantId = resolveAdminTenantContext(admin, p.tenantId);
      return await LedgerReconciliationService.getAccounts({
        page: p.page,
        pageSize: p.pageSize,
        search: p.search,
        onlyAnomalies: p.onlyAnomalies,
        tenantId: activeTenantId,
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки списка аккаунтов';
    return { success: false, error: message };
  }
}

/**
 * Full ledger audit timeline & sequential math for a single user
 */
export async function getUserLedgerAuditAction(
  userId: string
): Promise<UserAuditTimelineDTO | { success: false; error: string }> {
  try {
    return await requireStaffPermission('finance', 'view', async () => {
      const validatedUserId = z.string().min(1).parse(userId);
      return await LedgerReconciliationService.getUserAuditTimeline(validatedUserId);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки финансового аудита аккаунта';
    return { success: false, error: message };
  }
}

/**
 * Administrative remediation: Lock account or Auto-Balance discrepancy
 */
export async function reconcileUserAction(
  userId: string,
  action: 'LOCK' | 'AUTO_ADJUST',
  reason?: string
): Promise<{ success: boolean; message: string } | { success: false; error: string }> {
  try {
    return await requireStaffPermission('finance', 'edit', async (admin) => {
      const validatedUserId = z.string().min(1).parse(userId);
      const validatedAction = z.enum(['LOCK', 'AUTO_ADJUST']).parse(action);
      const validatedReason = reason ? z.string().max(500).parse(reason) : undefined;

      return await LedgerReconciliationService.remediateUser(
        validatedUserId,
        validatedAction,
        { id: admin.id, email: admin.email },
        validatedReason
      );
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка выполнения финансовой корректировки';
    return { success: false, error: message };
  }
}
