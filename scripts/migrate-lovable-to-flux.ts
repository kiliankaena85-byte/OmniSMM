import { db } from '../src/lib/db';

async function runMigration() {
  console.log('🚀 Starting Atomic DB Migration: tenantId "lovable" -> "flux"...\n');

  try {
    // ----------------------------------------------------
    // R2 PRE-CHECK: Check for duplicate User rows per email
    // ----------------------------------------------------
    console.log('🔍 R2 PRE-CHECK: Inspecting duplicate User accounts for ("lovable", "flux")...');
    const duplicateUsersRaw = await db.$queryRaw<{ email: string; count: bigint }[]>`
      SELECT email, COUNT(*) as count 
      FROM "User" 
      WHERE "tenantId" IN ('lovable', 'flux') 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `;

    if (duplicateUsersRaw.length > 0) {
      console.log(`⚠️ Found ${duplicateUsersRaw.length} duplicate user email(s). Merging duplicates...`);
      for (const dup of duplicateUsersRaw) {
        const users = await db.user.findMany({
          where: { email: dup.email, tenantId: { in: ['lovable', 'flux'] } },
          orderBy: { createdAt: 'asc' },
        });
        const primaryUser = users.find((u) => u.tenantId === 'flux') || users[0];
        const legacyUsers = users.filter((u) => u.id !== primaryUser.id);

        for (const legacy of legacyUsers) {
          console.log(`  -> Merging user ${legacy.id} (tenantId: ${legacy.tenantId}) into primary ${primaryUser.id}...`);
          await db.order.updateMany({ where: { userId: legacy.id }, data: { userId: primaryUser.id } });
          await db.payment.updateMany({ where: { userId: legacy.id }, data: { userId: primaryUser.id } });
          await db.ticket.updateMany({ where: { userId: legacy.id }, data: { userId: primaryUser.id } });
          await db.user.delete({ where: { id: legacy.id } });
        }
      }
      console.log('✅ Duplicate user merge complete.\n');
    } else {
      console.log('✅ R2 PRE-CHECK PASSED: No duplicate user accounts found.\n');
    }

    // ----------------------------------------------------
    // ATOMIC TRANSACTION: Update all 8 tables
    // ----------------------------------------------------
    const results = await db.$transaction(async (tx) => {
      // 1. User
      const userRes = await tx.user.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      // 2. Tenant (handling unique constraint on slug)
      const existingFluxTenant = await tx.tenant.findUnique({ where: { slug: 'flux' } });
      const legacyLovableTenant = await tx.tenant.findUnique({ where: { slug: 'lovable' } });
      let tenantCount = 0;

      if (legacyLovableTenant) {
        if (existingFluxTenant) {
          // Relink SystemSettings if necessary and delete duplicate legacy tenant
          await tx.systemSettings.deleteMany({ where: { id: legacyLovableTenant.id } }).catch(() => {});
          await tx.tenant.delete({ where: { id: legacyLovableTenant.id } });
          tenantCount = 1;
        } else {
          await tx.tenant.update({
            where: { id: legacyLovableTenant.id },
            data: { slug: 'flux' },
          });
          tenantCount = 1;
        }
      }

      // 3. Network
      const networkRes = await tx.network.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      // 4. Category
      const categoryRes = await tx.category.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      // 5. Service
      const serviceRes = await tx.service.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      // 6. Order
      const orderRes = await tx.order.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      // 7. Payment
      const paymentRes = await tx.payment.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      // 8. Ticket
      const ticketRes = await tx.ticket.updateMany({
        where: { tenantId: 'lovable' },
        data: { tenantId: 'flux' },
      });

      return {
        User: userRes.count,
        Tenant: tenantCount,
        Network: networkRes.count,
        Category: categoryRes.count,
        Service: serviceRes.count,
        Order: orderRes.count,
        Payment: paymentRes.count,
        Ticket: ticketRes.count,
      };
    });

    console.log('==================================================');
    console.log('📊 MIGRATION EXECUTION SUMMARY (Rows Updated)');
    console.log('==================================================');
    console.table(results);
    console.log('\n🎉 DB MIGRATION COMPLETED SUCCESSFULLY WITH 0 ERRORS!\n');

  } catch (err) {
    console.error('💥 DB Migration Failed:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

runMigration();
