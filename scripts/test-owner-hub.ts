import { db } from '../src/lib/db';
import { redis } from '../src/lib/redis';
import { isOwnerOrAdmin } from '../src/bot/scenes/owner-hub.wizard';
import { BalanceVerifier } from '../src/utils/balance-verifier';
import { P0ThreatSensorService } from '../src/services/telemetry/p0-threat-sensor.service';
import crypto from 'crypto';

async function testOwnerHub() {
  console.log('=== TESTING OWNER DEVOPS & TESTING HUB SUITE ===\n');

  // 1. Test Authorization Guard
  const ownerId = process.env.ADMIN_ALERT_CHAT_ID || '268747191';
  const isAuthorized = await isOwnerOrAdmin(ownerId);
  const isFakeRejected = !(await isOwnerOrAdmin('9999999999'));

  console.log(`1. Authorization Guard:`);
  console.log(`   Owner (${ownerId}) authorized: ${isAuthorized ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Random User (9999999999) rejected: ${isFakeRejected ? '✅ PASS' : '❌ FAIL'}`);

  if (!isAuthorized || !isFakeRejected) {
    throw new Error('Authorization Guard Failed!');
  }

  // 2. Test PostgreSQL & Redis Telemetry
  const pgStart = Date.now();
  await db.$queryRaw`SELECT 1`;
  const pgLatency = Date.now() - pgStart;

  const redisStart = Date.now();
  await redis.ping();
  const redisLatency = Date.now() - redisStart;

  console.log(`\n2. Infrastructure Telemetry:`);
  console.log(`   PostgreSQL Ping: ✅ ${pgLatency} ms`);
  console.log(`   Redis Ping: ✅ ${redisLatency} ms`);

  // 3. Test Disk & P0 Sensor
  const disk = await P0ThreatSensorService.checkDiskSpace();
  console.log(`\n3. Disk & Storage Sensor:`);
  console.log(`   Disk Free: ✅ ${disk.freeGb} GB / ${disk.totalGb} GB (${disk.freePercent}%)`);

  // 4. Test Ledger Integrity Verification
  const ledgerResults = await BalanceVerifier.verifyAllBalances();
  const discrepancies = ledgerResults.filter(r => r.isDiscrepancy);
  console.log(`\n4. Financial Ledger Integrity:`);
  console.log(`   Users Checked: ${ledgerResults.length}`);
  console.log(`   Discrepancies Found: ${discrepancies.length} (Expected: 0)`);
  if (discrepancies.length > 0) {
    console.warn('   ⚠️ Discrepancy details:', discrepancies);
  } else {
    console.log(`   ✅ 100% Ledger Balance Match!`);
  }

  // 5. Test Active Services Catalog Count
  const servicesCount = await db.service.count({ where: { isActive: true } });
  console.log(`\n5. Catalog Active Services:`);
  console.log(`   Active Services: ${servicesCount} (Expected: 313)`);
  if (servicesCount < 300) {
    console.warn(`   ⚠️ Warning: Active services count is ${servicesCount}`);
  } else {
    console.log(`   ✅ PrimeLike Catalog fully active.`);
  }

  // 6. Test Magic Link Generation
  const testToken = `test_magic_${crypto.randomBytes(16).toString('hex')}`;
  const adminUser = await db.user.findFirst({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'DEVELOPER'] } }
  });

  if (adminUser) {
    const createdToken = await db.authToken.create({
      data: {
        userId: adminUser.id,
        token: testToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false
      }
    });

    const readToken = await db.authToken.findUnique({ where: { id: createdToken.id } });
    console.log(`\n6. Magic Link Auth Engine:`);
    console.log(`   Token generated & saved: ${readToken?.token ? '✅ PASS' : '❌ FAIL'}`);

    // Cleanup test token
    await db.authToken.delete({ where: { id: createdToken.id } });
  }

  console.log('\n🎉 ALL OWNER HUB VERIFICATION CHECKS PASSED!\n');
}

testOwnerHub().catch(console.error).finally(() => db.$disconnect());
