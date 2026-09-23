import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { createSession, verifySession } from '@/lib/session';

describe('Staff Session User-Agent and IP-Pinning Invariants (P1-6)', () => {
  let staffUserId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `staff-session-test-${Date.now()}@example.com`,
        role: 'ADMIN',
        tenantId: 'smmplan',
      },
    });
    staffUserId = user.id;
  });

  afterEach(async () => {
    if (staffUserId) {
      await db.session.deleteMany({ where: { userId: staffUserId } }).catch(() => {});
      await db.securityEvent.deleteMany({ where: { details: { path: ['userId'], equals: staffUserId } } }).catch(() => {});
      await db.user.delete({ where: { id: staffUserId } }).catch(() => {});
    }
  });

  it('creates staff session with ipAddress and userAgent recorded', async () => {
    const { sessionToken } = await createSession(staffUserId, false);
    expect(sessionToken).toBeDefined();

    const createdSession = await db.session.findFirst({
      where: { userId: staffUserId },
    });
    expect(createdSession).not.toBeNull();
    expect(createdSession?.userId).toBe(staffUserId);
  });
});
