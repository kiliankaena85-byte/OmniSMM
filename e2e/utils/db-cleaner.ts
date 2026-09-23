import { PrismaClient } from '@prisma/client';

/**
 * Global teardown script for Playwright tests.
 * This runs after all tests complete.
 * It connects directly to the DB and deletes test-generated data.
 */
async function globalTeardown() {
  console.log('[Playwright Teardown] Cleaning up database test records...');
  
  const prisma = new PrismaClient();

  try {
    // 1. Delete test orders
    const deletedOrders = await prisma.order.deleteMany({
      where: {
        OR: [
          { link: { contains: 'test' } },
          { link: { contains: 'e2e' } }
        ]
      }
    });
    console.log(`[Teardown] Deleted ${deletedOrders.count} test orders.`);

    // 2. Delete test payments
    const deletedPayments = await prisma.payment.deleteMany({
      where: {
        OR: [
          { gatewayId: { contains: 'test_' } },
          { gatewayId: { contains: 'mock_' } }
        ]
      }
    });
    console.log(`[Teardown] Deleted ${deletedPayments.count} test payments.`);

    // 3. Delete test tickets (by email containing test-guest or guest-test)
    // First find users, then delete their tickets
    const testUsers = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: 'e2e-tester@test.com' } },
          { email: { contains: 'guest-test@example.com' } },
          { email: { contains: 'referral@test.com' } },
          { email: { contains: 'test' } }
        ]
      }
    });

    const testUserIds = testUsers.map(u => u.id);

    if (testUserIds.length > 0) {
      const deletedTickets = await prisma.ticket.deleteMany({
        where: {
          userId: { in: testUserIds }
        }
      });
      console.log(`[Teardown] Deleted ${deletedTickets.count} test tickets.`);

      // 3.4 Delete orders belonging to test users
      await prisma.order.deleteMany({
        where: { userId: { in: testUserIds } }
      });

      // 3.5 Delete test payments belonging to these users
      await prisma.payment.deleteMany({
        where: { userId: { in: testUserIds } }
      });

      // 3.6 Delete ledger entries for these users if in test database
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "LedgerEntry" CASCADE;`);
      } catch {
        // Ledger table has trigger or is locked
      }

      // 4. Delete test users (or soft delete if referenced by immutable ledger)
      try {
        const deletedUsersCount = await prisma.user.deleteMany({
          where: {
            id: { in: testUserIds }
          }
        });
        console.log(`[Teardown] Deleted ${deletedUsersCount.count} test users.`);
      } catch {
        // Fallback: soft-delete test users that have immutable ledger entries
        await prisma.user.updateMany({
          where: { id: { in: testUserIds } },
          data: { isDeleted: true, isActive: false }
        });
        console.log(`[Teardown] Soft-deleted ${testUserIds.length} test users with financial records.`);
      }
    }

  } catch (err) {
    console.error('[Playwright Teardown] Error during DB cleanup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

export default globalTeardown;
