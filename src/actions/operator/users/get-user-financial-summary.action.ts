'use server';

import { requireOperatorPermission } from '@/lib/operator/rbac';
import { getClientFinancialSummary } from '@/services/operator/users/client-financial-summary.query';
import { z } from 'zod';

const inputSchema = z.object({
  userId: z.string().min(1)
});

/**
 * Guarded server action retrieving a user's ledger-based financial summary.
 * Guarded by 'orders' section 'view' permission.
 */
export async function getUserFinancialSummaryAction(userId: string) {
  const parsed = inputSchema.safeParse({ userId });
  if (!parsed.success) {
    throw new Error('Некорректный ID пользователя');
  }

  return requireOperatorPermission('orders', 'view', async () => {
    return getClientFinancialSummary(parsed.data.userId);
  });
}
