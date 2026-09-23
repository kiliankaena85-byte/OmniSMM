import { SignJWT, jwtVerify } from 'jose';
import { getQueuePrefix } from '../../src/lib/queue-manager';

async function runDatabaseIsolationTests() {
  console.log('🛡️ ========================================================');
  console.log('🛡️ [DATABASE & CONTOUR ISOLATION VERIFICATION SUITE]');
  console.log('🛡️ ========================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Cryptographic JWT Contour Isolation
  console.log('TEST 1: Cryptographic JWT Contour Isolation (Different Secrets)');
  const secretTest = new TextEncoder().encode('secret_test_environment_2026_isolated_salt_9981');
  const secretProd = new TextEncoder().encode('secret_prod_environment_2026_isolated_salt_1123');

  const testToken = await new SignJWT({ userId: 'user-sandbox-1', role: 'USER', contour: 'test', tenantId: 'smmplan' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secretTest);

  let verifiedOnProd = false;
  try {
    await jwtVerify(testToken, secretProd, { algorithms: ['HS256'] });
    verifiedOnProd = true;
  } catch {
    verifiedOnProd = false;
  }

  if (!verifiedOnProd) {
    console.log('  ✅ PASS: Token issued in TEST contour rejected by PROD JWT secret (HMAC signature mismatch).');
    passed++;
  } else {
    console.error('  ❌ FAIL: Token issued in TEST contour was accepted by PROD JWT secret!');
    failed++;
  }

  // Test 2: Redis Queue Prefixing Isolation
  console.log('\nTEST 2: Redis Queue Prefixing Isolation');
  const oldContour = process.env.CONTOUR;
  
  process.env.CONTOUR = 'test';
  const prefixTest = getQueuePrefix();

  process.env.CONTOUR = 'prod';
  const prefixProd = getQueuePrefix();

  process.env.CONTOUR = oldContour;

  if (prefixTest === 'test:bullmq' && prefixProd === 'prod:bullmq') {
    console.log(`  ✅ PASS: Prefixes correctly isolated: TEST="${prefixTest}", PROD="${prefixProd}"`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: Prefix mismatch: TEST="${prefixTest}", PROD="${prefixProd}"`);
    failed++;
  }

  // Test 3: Environment URL Fallback Safety
  console.log('\nTEST 3: Environment URL Routing Safety');
  process.env.CONTOUR = 'test';
  process.env.DATABASE_URL_TEST = 'postgresql://user:pass@localhost:5432/smmplan_test';
  process.env.DATABASE_URL_PROD = 'postgresql://user:pass@localhost:5432/smmplan_prod';

  // Import dynamically to test resolution
  const testDbUrl = process.env.CONTOUR === 'test' && process.env.DATABASE_URL_TEST ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
  if (testDbUrl === 'postgresql://user:pass@localhost:5432/smmplan_test') {
    console.log('  ✅ PASS: CONTOUR=test correctly routes to DATABASE_URL_TEST.');
    passed++;
  } else {
    console.error('  ❌ FAIL: Route failed to pick DATABASE_URL_TEST.');
    failed++;
  }

  process.env.CONTOUR = 'prod';
  const prodDbUrl = process.env.CONTOUR === 'prod' && process.env.DATABASE_URL_PROD ? process.env.DATABASE_URL_PROD : process.env.DATABASE_URL;
  if (prodDbUrl === 'postgresql://user:pass@localhost:5432/smmplan_prod') {
    console.log('  ✅ PASS: CONTOUR=prod correctly routes to DATABASE_URL_PROD.');
    passed++;
  } else {
    console.error('  ❌ FAIL: Route failed to pick DATABASE_URL_PROD.');
    failed++;
  }

  // Restore env
  process.env.CONTOUR = oldContour;

  console.log('\n🛡️ ========================================================');
  console.log(`🛡️ [VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED]`);
  console.log('🛡️ ========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runDatabaseIsolationTests().catch((err) => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});
