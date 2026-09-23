import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import { decryptSessionToken } from '@/lib/session-edge';

describe('JWT Staff Role Exclusion Security Suite (P2-10)', () => {
  let staffUserId: string;
  let regularUserId: string;

  beforeEach(async () => {
    const staff = await db.user.create({
      data: {
        email: `jwt-staff-${Date.now()}@example.com`,
        role: 'OWNER',
        tenantId: 'smmplan',
      },
    });
    staffUserId = staff.id;

    const regular = await db.user.create({
      data: {
        email: `jwt-user-${Date.now()}@example.com`,
        role: 'USER',
        tenantId: 'smmplan',
      },
    });
    regularUserId = regular.id;
  });

  afterEach(async () => {
    if (staffUserId) {
      await db.session.deleteMany({ where: { userId: staffUserId } }).catch(() => {});
      await db.user.delete({ where: { id: staffUserId } }).catch(() => {});
    }
    if (regularUserId) {
      await db.session.deleteMany({ where: { userId: regularUserId } }).catch(() => {});
      await db.user.delete({ where: { id: regularUserId } }).catch(() => {});
    }
  });

  it('excludes role from JWT payload for staff members (OWNER/ADMIN/etc)', async () => {
    const { sessionToken } = await createSession(staffUserId, false);
    const payload = await decryptSessionToken(sessionToken);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(staffUserId);
    expect(payload?.role).toBeUndefined();
  });

  it('includes role in JWT payload for regular users', async () => {
    const { sessionToken } = await createSession(regularUserId, false);
    const payload = await decryptSessionToken(sessionToken);

    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(regularUserId);
    expect(payload?.role).toBe('USER');
  });
});
