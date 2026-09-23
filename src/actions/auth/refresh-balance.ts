'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { formatBalance } from '@/lib/utils';

import { headers } from 'next/headers';
import { resolveTenantFromRequest } from '@/lib/tenant-resolver-edge';

export async function refreshBalanceAction() {
  const reqHeaders = await headers();
  const tenantId = resolveTenantFromRequest(reqHeaders);

  const session = await verifySession(tenantId);
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const user = await db.user.findFirst({
    where: { id: session.userId, tenantId },
    select: { balance: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  return {
    success: true,
    balanceRub: formatBalance(user.balance),
  };
}
