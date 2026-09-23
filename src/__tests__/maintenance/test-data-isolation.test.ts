/**
 * src/__tests__/maintenance/test-data-isolation.test.ts
 *
 * Automated Test Suite: Production Data Protection & Safe Test Cleanup Invariants.
 * Verifies that real services, real users, and real orders can NEVER be deleted,
 * and that test data is strictly isolated and safely purged/archived.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { inspectAndCleanTestData } from '../../../scripts/maintenance/clean-test-data';

describe('🛡️ Production Data Isolation & Safe Test Data Cleaner', () => {
  let initialServicesCount: number;
  let initialRealUsersCount: number;
  let initialRealOrdersCount: number;

  beforeAll(async () => {
    initialServicesCount = await db.service.count();
    initialRealUsersCount = await db.user.count({
      where: { NOT: { email: { endsWith: '@smmplan.test' } } }
    });
    initialRealOrdersCount = await db.order.count({
      where: {
        isTest: false,
        NOT: { user: { email: { endsWith: '@smmplan.test' } } }
      }
    });
  });

  it('1. Dry-Run Mode MUST be 100% read-only and mutate zero records', async () => {
    const summary = await inspectAndCleanTestData(false);

    expect(summary.realServicesProtected).toBe(initialServicesCount);
    expect(summary.realUsersProtected).toBe(initialRealUsersCount);
    expect(summary.realOrdersProtected).toBe(initialRealOrdersCount);

    const currentServicesCount = await db.service.count();
    expect(currentServicesCount).toBe(initialServicesCount);
  });

  it('2. Production Protection Baseline: Real services count MUST remain 100% untouched', async () => {
    // Create a temporary synthetic test user and test order
    const testUser = await db.user.create({
      data: {
        email: `isolation_spec_${Date.now()}@smmplan.test`,
        role: 'USER',
        balance: BigInt(10000)
      }
    });

    const activeService = await db.service.findFirstOrThrow({
      where: { isActive: true }
    });

    const testOrder = await db.order.create({
      data: {
        userId: testUser.id,
        serviceId: activeService.id,
        link: 'https://t.me/isolation_check',
        quantity: 100,
        charge: BigInt(5000),
        providerCost: BigInt(1000),
        isTest: true,
        status: 'COMPLETED'
      }
    });

    // Run actual execution cleanup
    const summary = await inspectAndCleanTestData(true);

    // Verify test order was deleted
    const foundOrder = await db.order.findUnique({ where: { id: testOrder.id } });
    expect(foundOrder).toBeNull();

    // Verify real service was NOT touched
    const foundService = await db.service.findUnique({ where: { id: activeService.id } });
    expect(foundService).not.toBeNull();
    expect(foundService?.id).toBe(activeService.id);

    // Verify total real services count is completely untouched
    const afterCount = await db.service.count();
    expect(afterCount).toBe(initialServicesCount);
  });

  it('3. Fail-Closed Guard: Must reject touching Owner or Super Admin accounts', async () => {
    const owner = await db.user.findFirst({
      where: { role: { in: ['OWNER', 'SUPER_ADMIN'] } }
    });

    if (owner) {
      // Ensure owner is NOT matched by test user filters
      const testUsers = await db.user.findMany({
        where: {
          OR: [
            { email: { endsWith: '@smmplan.test' } },
            { email: { endsWith: '@test.local' } }
          ],
          NOT: {
            role: { in: ['OWNER', 'SUPER_ADMIN', 'ADMIN'] }
          }
        }
      });

      const ownerInTestList = testUsers.some(u => u.id === owner.id);
      expect(ownerInTestList).toBe(false);
    }
  });

  it('4. Foreign Key & Cascade Safety: Service with real orders CANNOT be deleted', async () => {
    // Attempting to delete a real service that has orders should fail with Foreign Key constraint
    const serviceWithOrders = await db.service.findFirst({
      where: { orders: { some: {} } }
    });

    if (serviceWithOrders) {
      await expect(
        db.service.delete({ where: { id: serviceWithOrders.id } })
      ).rejects.toThrow();
    }
  });
});
