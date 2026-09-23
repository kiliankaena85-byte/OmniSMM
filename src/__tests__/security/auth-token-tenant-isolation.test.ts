import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import crypto from 'crypto';

describe('AuthToken Tenant Isolation and Unique Hash Security Suite (P1-5)', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        email: `authtoken-test-${Date.now()}@example.com`,
        role: 'USER',
        tenantId: 'smmplan',
      },
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    if (testUserId) {
      await db.authToken.deleteMany({ where: { userId: testUserId } }).catch(() => {});
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it('allows looking up token uniquely by token and tenantId', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await db.authToken.create({
      data: {
        token: hashedToken,
        tenantId: 'smmplan',
        userId: testUserId,
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    // Valid lookup with matching tenantId
    const found = await db.authToken.findUnique({
      where: {
        token_tenantId: {
          token: hashedToken,
          tenantId: 'smmplan',
        },
      },
    });

    expect(found).not.toBeNull();
    expect(found?.userId).toBe(testUserId);

    // Cross-tenant lookup must return null
    const crossTenant = await db.authToken.findUnique({
      where: {
        token_tenantId: {
          token: hashedToken,
          tenantId: 'flux',
        },
      },
    });

    expect(crossTenant).toBeNull();
  });
});
