import { db } from '../src/lib/db';

async function testGuard() {
  console.log('Testing Safe-Delete Guard on Service.deleteMany({})...');
  try {
    // Attempt dangerous wipe
    await db.service.deleteMany({});
    console.error('❌ FAILURE: Safe-Delete Guard failed to block deleteMany!');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('✅ SUCCESS: Guard successfully intercepted and blocked wipe:', msg);
  } finally {
    process.exit(0);
  }
}

testGuard();
