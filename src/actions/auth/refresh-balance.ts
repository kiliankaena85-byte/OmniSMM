'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { formatBalance } from '@/lib/utils';

export async function refreshBalanceAction() {
  const session = await verifySession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
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
