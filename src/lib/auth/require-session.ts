/**
 * @file require-session.ts
 * @module Auth/RequireSession
 * 
 * Canonical centralized session validation helper (V-04 / Pentest Retest #4).
 * Strict verification flow:
 * 1. Decrypts JWT (supports dual-key rotation: primary + previous keys).
 * 2. Queries PostgreSQL DB Session (must exist, not expired, not deleted).
 * 3. Checks DB User status (must exist, isActive === true, isDeleted === false, role !== 'BANNED').
 * 4. Checks tenant isolation boundaries.
 */

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { User, StaffRole } from '@prisma/client';

export interface ValidatedSession {
  userId: string;
  user: User & { staffRole?: (StaffRole & { permissions: { section: string; canView: boolean; canEdit: boolean }[] }) | null };
  role: string;
  tenantId: string;
}

/**
 * Validates session against PostgreSQL database and returns full active user.
 * Returns null if token is missing, forged, expired, revoked, or user is disabled/banned.
 */
export async function requireSession(requiredTenantId?: string): Promise<ValidatedSession | null> {
  const verified = await verifySession(requiredTenantId);
  if (!verified || !verified.userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: verified.userId },
    include: {
      staffRole: {
        include: { permissions: true }
      }
    }
  });

  if (!user || user.isDeleted || !user.isActive || user.role === 'BANNED') {
    return null;
  }

  return {
    userId: user.id,
    user,
    role: user.role,
    tenantId: user.tenantId || verified.tenantId || 'smmplan',
  };
}

/**
 * Validates staff session (OWNER, ADMIN, MANAGER, SUPPORT).
 */
export async function requireStaffSession(requiredTenantId?: string): Promise<ValidatedSession | null> {
  const session = await requireSession(requiredTenantId);
  if (!session) return null;

  const isStaff = ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'].includes(session.role);
  if (!isStaff) return null;

  return session;
}
