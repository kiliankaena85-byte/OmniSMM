import { requireStaffPermission } from '@/lib/server/rbac';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { User, StaffRole } from '@prisma/client';

export const OPERATOR_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'];

/**
 * Resolves current operator staff context using existing session/auth patterns.
 */
export async function getOperatorContext() {
  const session = await verifySession();
  if (!session) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: {
      staffRole: {
        include: { permissions: true }
      }
    }
  });

  if (!user || !OPERATOR_ROLES.includes(user.role)) {
    return null;
  }

  return { user, staffRole: user.staffRole };
}

/**
 * Enforces operator role check and redirects safely to login if unauthorized.
 */
export async function enforceOperatorAccess() {
  const context = await getOperatorContext();
  if (!context) {
    redirect('/login');
  }
  return context;
}

/**
 * Thin wrapper over requireStaffPermission to protect operator server actions.
 * If user has role 'OPERATOR', allows core operational sections by default.
 */
export async function requireOperatorPermission<T>(
  section: string,
  actionMode: 'view' | 'edit',
  action: (user: User, role?: StaffRole | null) => Promise<T>
): Promise<T | { success: false; error: string }> {
  const context = await getOperatorContext();
  if (!context) {
    return { success: false, error: 'Unauthorized: Operator context required' };
  }

  if (context.user.role === 'OPERATOR') {
    // Built-in operator access to operational sections
    const OPERATIONAL_SECTIONS = ['ORDERS', 'TICKETS', 'CLIENTS', 'TRANSACTIONS'];
    if (OPERATIONAL_SECTIONS.includes(section.toUpperCase())) {
      return await action(context.user, context.staffRole);
    }
  }

  const res = await requireStaffPermission<T>(section, actionMode, (u, r) => action(u, r));
  return res as T | { success: false; error: string };
}
