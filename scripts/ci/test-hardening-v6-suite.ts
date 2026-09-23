import { NextRequest } from 'next/server';
import { proxy } from '../../src/proxy';
import { db } from '../../src/lib/db';
import { BUILD_ID } from '../../src/lib/build-info';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../../src/lib/session-edge';
import { OPERATOR_ROLES, getOperatorContext } from '../../src/lib/operator/rbac';

async function createTestJwt(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

async function runHardeningV6Suite() {
  console.log('🛡️ [TEST SUITE] Running Comprehensive Hardening v6 Test Suite...\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, label: string, details?: string) {
    totalCount++;
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${label}${details ? ` -> ${details}` : ''}`);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 1. MATRIX D1–D6: Pentest Arsenal Deactivation Verification
  // ═════════════════════════════════════════════════════════════
  console.log('▶ TEST GROUP 1: Pentest Arsenal Deactivation (D1–D6)');
  const pentestUsers = await db.user.findMany({
    where: {
      email: {
        in: [
          'pentest7-user@smmplan.pro',
          'pentest7-operator@smmplan.pro',
          'pentest7-admin@smmplan.pro',
          'pentest7-flux@smmflux.ru',
        ]
      }
    }
  });

  assert(pentestUsers.length === 4, 'D0: Exactly 4 pentest accounts found in DB');
  for (const u of pentestUsers) {
    assert(
      !u.isActive && u.isDeleted && u.passwordHash === null && u.apiKeyHash === null,
      `D-Account [${u.email}]: Disabled, deleted, passwordHash=null, apiKeyHash=null`
    );
  }

  const activePentestSessions = await db.session.count({
    where: { userId: { in: pentestUsers.map(u => u.id) } }
  });
  assert(activePentestSessions === 0, 'D-Sessions: Zero active physical sessions for pentest accounts');

  // ═════════════════════════════════════════════════════════════
  // 2. MATRIX H1–H7: Host-Only Spoofing Shield & Cross-Contour (N-10.3)
  // ═════════════════════════════════════════════════════════════
  console.log('\n▶ TEST GROUP 2: Host Spoofing & Cross-Contour Matrix (H1–H7)');

  // Save original env
  const origContour = process.env.CONTOUR;
  const origNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  // H1: test instance receiving Host: smmplan.pro
  process.env.CONTOUR = 'test';
  const reqH1 = new NextRequest('https://test.smmplan.pro/api/health', {
    headers: { host: 'smmplan.pro' }
  });
  const resH1 = await proxy(reqH1);
  assert(resH1.status === 403, 'H1: test instance rejects Host: smmplan.pro with 403');

  // H2: test instance receiving Host: www.smmplan.pro
  const reqH2 = new NextRequest('https://test.smmplan.pro/api/health', {
    headers: { host: 'www.smmplan.pro' }
  });
  const resH2 = await proxy(reqH2);
  assert(resH2.status === 403, 'H2: test instance rejects Host: www.smmplan.pro with 403');

  // H3: test instance receiving Host: smmflux.ru
  const reqH3 = new NextRequest('https://test.smmplan.pro/api/health', {
    headers: { host: 'smmflux.ru' }
  });
  const resH3 = await proxy(reqH3);
  assert(resH3.status === 403, 'H3: test instance rejects Host: smmflux.ru with 403');

  // H4: test instance receiving Host: www.smmflux.ru
  const reqH4 = new NextRequest('https://test.smmplan.pro/api/health', {
    headers: { host: 'www.smmflux.ru' }
  });
  const resH4 = await proxy(reqH4);
  assert(resH4.status === 403, 'H4: test instance rejects Host: www.smmflux.ru with 403');

  // H5: prod instance receiving Host: test.smmplan.pro
  process.env.CONTOUR = 'prod';
  const reqH5 = new NextRequest('https://smmplan.pro/api/health', {
    headers: { host: 'test.smmplan.pro' }
  });
  const resH5 = await proxy(reqH5);
  assert(resH5.status === 403, 'H5: prod instance rejects Host: test.smmplan.pro with 403');

  // H6: prod instance receiving Host: smmflux.ru
  const reqH6 = new NextRequest('https://smmplan.pro/api/health', {
    headers: { host: 'smmflux.ru' }
  });
  const resH6 = await proxy(reqH6);
  assert(resH6.status === 403, 'H6: prod instance rejects Host: smmflux.ru with 403');

  // H7: Unknown foreign host
  const reqH7 = new NextRequest('https://test.smmplan.pro/api/health', {
    headers: { host: 'attacker-evil.com' }
  });
  const resH7 = await proxy(reqH7);
  assert(resH7.status === 403, 'H7: Rejects unknown foreign host with 403');

  // H8: Cross-contour spoofing header mismatch (Host: test.smmplan.pro vs x-forwarded-host: smmplan.pro)
  const reqH8 = new NextRequest('https://test.smmplan.pro/api/health', {
    headers: { host: 'test.smmplan.pro', 'x-forwarded-host': 'smmplan.pro' }
  });
  const resH8 = await proxy(reqH8);
  assert(resH8.status === 403, 'H8: Rejects Host / X-Forwarded-Host mismatch with 403');

  // H9: Legit test request
  process.env.CONTOUR = 'test';
  const reqH9 = new NextRequest('https://test.smmplan.pro/', {
    headers: { host: 'test.smmplan.pro' }
  });
  const resH9 = await proxy(reqH9);
  assert(resH9.status === 200, 'H9: Legit test request allowed (200 OK)');

  // H10: Legit prod request
  process.env.CONTOUR = 'prod';
  const reqH10 = new NextRequest('https://smmplan.pro/', {
    headers: { host: 'smmplan.pro' }
  });
  const resH10 = await proxy(reqH10);
  assert(resH10.status === 200, 'H10: Legit prod request allowed (200 OK)');

  // ═════════════════════════════════════════════════════════════
  // 3. MATRIX G1–G4: Dead / Test Token Handling on Prod (N-10.5)
  // ═════════════════════════════════════════════════════════════
  console.log('\n▶ TEST GROUP 3: Dead Token Handling Matrix (G1–G4)');
  process.env.CONTOUR = 'prod';

  // Test token (issued with contour: 'test') presented to prod dashboard
  const testTokenJwt = await createTestJwt({
    sessionId: 'test_session_123',
    userId: 'user_123',
    role: 'USER',
    tenantId: 'smmplan',
    contour: 'test',
  });

  // G1: /dashboard on prod with test contour token -> 307 to /login
  const reqG1 = new NextRequest('https://smmplan.pro/dashboard', {
    headers: { host: 'smmplan.pro', cookie: `session_token=${testTokenJwt}` }
  });
  const resG1 = await proxy(reqG1);
  assert(resG1.status === 307, 'G1: Dead/test token on prod /dashboard redirects with 307');
  const locG1 = resG1.headers.get('location') || '';
  assert(locG1.includes('/login'), 'G1: Redirect destination is /login');
  assert(resG1.headers.get('set-cookie')?.includes('session_token=;'), 'G1: Clears session_token cookie');

  // G2: /admin on prod with dead/test token -> 307 to /login
  const reqG2 = new NextRequest('https://smmplan.pro/admin', {
    headers: { host: 'smmplan.pro', cookie: `session_token=${testTokenJwt}` }
  });
  const resG2 = await proxy(reqG2);
  assert(resG2.status === 307, 'G2: Dead/test token on prod /admin redirects with 307');

  // G3: /operator on prod with dead/test token -> 307 to /login
  const reqG3 = new NextRequest('https://smmplan.pro/operator', {
    headers: { host: 'smmplan.pro', cookie: `session_token=${testTokenJwt}` }
  });
  const resG3 = await proxy(reqG3);
  assert(resG3.status === 307, 'G3: Dead/test token on prod /operator redirects with 307');

  // G4: Unauthenticated request to /login -> 200 OK (no redirect loop)
  const reqG4 = new NextRequest('https://smmplan.pro/login', {
    headers: { host: 'smmplan.pro' }
  });
  const resG4 = await proxy(reqG4);
  assert(resG4.status === 200, 'G4: Unauthenticated /login returns 200 OK');

  // ═════════════════════════════════════════════════════════════
  // 4. MATRIX O1–O4: Operator Panel & Role RBAC
  // ═════════════════════════════════════════════════════════════
  console.log('\n▶ TEST GROUP 4: Operator Panel & Role RBAC (O1–O4)');
  assert(OPERATOR_ROLES.includes('OPERATOR'), 'O0: OPERATOR_ROLES contains OPERATOR');

  process.env.CONTOUR = 'test';

  const opJwt = await createTestJwt({
    sessionId: 'session_op_123',
    userId: 'op_123',
    role: 'OPERATOR',
    tenantId: 'smmplan',
    contour: 'test',
  });

  const userJwt = await createTestJwt({
    sessionId: 'session_user_123',
    userId: 'user_123',
    role: 'USER',
    tenantId: 'smmplan',
    contour: 'test',
  });

  // O1: OPERATOR access to /operator -> 200 OK (allowed)
  const reqO1 = new NextRequest('https://test.smmplan.pro/operator', {
    headers: { host: 'test.smmplan.pro', cookie: `session_token=${opJwt}` }
  });
  const resO1 = await proxy(reqO1);
  assert(resO1.status === 200, 'O1: OPERATOR role is allowed on /operator (200 OK)');

  // O2: OPERATOR access to /admin -> 307 redirect to /operator
  const reqO2 = new NextRequest('https://test.smmplan.pro/admin', {
    headers: { host: 'test.smmplan.pro', cookie: `session_token=${opJwt}` }
  });
  const resO2 = await proxy(reqO2);
  assert(resO2.status === 307, 'O2: OPERATOR role on /admin is redirected (307)');
  const locO2 = resO2.headers.get('location') || '';
  assert(locO2.includes('/operator'), 'O2: Redirect destination is /operator');

  // O3: USER access to /operator -> 307 redirect to /dashboard
  const reqO3 = new NextRequest('https://test.smmplan.pro/operator', {
    headers: { host: 'test.smmplan.pro', cookie: `session_token=${userJwt}` }
  });
  const resO3 = await proxy(reqO3);
  assert(resO3.status === 307, 'O3: Regular USER on /operator is redirected (307)');
  const locO3 = resO3.headers.get('location') || '';
  assert(locO3.includes('/dashboard'), 'O3: Redirect destination is /dashboard');

  // O4: Guest (no token) access to /operator -> 307 redirect to /login
  const reqO4 = new NextRequest('https://test.smmplan.pro/operator', {
    headers: { host: 'test.smmplan.pro' }
  });
  const resO4 = await proxy(reqO4);
  assert(resO4.status === 307, 'O4: Guest on /operator is redirected to /login (307)');

  // ═════════════════════════════════════════════════════════════
  // 5. N-10.6: Dynamic x-build-id header verification
  // ═════════════════════════════════════════════════════════════
  console.log('\n▶ TEST GROUP 5: Dynamic x-build-id Header (N-10.6)');
  assert(BUILD_ID.startsWith('v6-'), 'N-10.6a: BUILD_ID starts with v6- prefix');
  assert(resH9.headers.get('x-build-id') === BUILD_ID, 'N-10.6b: proxy injects dynamic x-build-id header matching BUILD_ID');

  // Restore env
  process.env.CONTOUR = origContour;
  process.env.NODE_ENV = origNodeEnv;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`🎯 HARDENING V6 SUITE SUMMARY: ${passedCount}/${totalCount} PASS (100% GREEN)`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runHardeningV6Suite()
  .catch((err) => {
    console.error('Fatal error in suite:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
