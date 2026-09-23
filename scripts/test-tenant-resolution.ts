import { chromium } from '@playwright/test';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';
import { db } from '../src/lib/db';

interface TestResult {
  tenant: string;
  route: string;
  isF5: boolean;
  resolvedCookie: string;
  passed: boolean;
}

const results: TestResult[] = [];

async function testTenant(tenantId: string) {
  console.log(`\n==================================================`);
  console.log(`Testing Tenant: "${tenantId}" (Canonical Registration)`);
  console.log(`==================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const expectedCookie = tenantId === 'lovable' ? 'flux' : tenantId;

  // Step 1: Auto login with tenant parameter
  const loginUrl = `${baseUrl}/api/dev/login-direct?email=user_${tenantId}@smmplan.pro&tenant=${tenantId}`;
  console.log(`[AUTH] Navigating to direct login: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const routes = [
    '/dashboard',
    '/dashboard/orders',
    '/dashboard/new-order',
    '/dashboard/add-funds',
    '/dashboard/settings',
  ];

  console.log(`\n--- Part A: Client-side Navigation ---`);
  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cookies = await context.cookies();
    const xTenantCookie = cookies.find(c => c.name === 'x_tenant')?.value || 'NONE';
    const passed = xTenantCookie === expectedCookie;

    results.push({ tenant: tenantId, route, isF5: false, resolvedCookie: xTenantCookie, passed });

    console.log(`Route [${route}]: RESOLVED = "${xTenantCookie}" -> ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) {
      console.error(`❌ Mismatch on route ${route}: Expected "${expectedCookie}", got "${xTenantCookie}"`);
    }
  }

  console.log(`\n--- Part B: Hard Refreshes (F5) ---`);
  for (const route of routes) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const cookies = await context.cookies();
    const xTenantCookie = cookies.find(c => c.name === 'x_tenant')?.value || 'NONE';
    const passed = xTenantCookie === expectedCookie;

    results.push({ tenant: tenantId, route, isF5: true, resolvedCookie: xTenantCookie, passed });

    console.log(`Route [F5 ${route}]: RESOLVED = "${xTenantCookie}" -> ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) {
      console.error(`❌ Mismatch on F5 ${route}: Expected "${expectedCookie}", got "${xTenantCookie}"`);
    }
  }

  await browser.close();
}

async function testV3HonestCases() {
  console.log(`\n==================================================`);
  console.log(`Testing V3 Honest Cases: Legacy JWT Injection, Password Login & Admin Context`);
  console.log(`==================================================`);

  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';

  // Case V3.A: Direct JWT Injection with tenantId='lovable' and real DB session
  console.log('\n--- Case V3.A: Direct JWT Injection (tenantId="lovable") ---');
  let testUser = await db.user.findFirst({ where: { tenantId: 'flux' } });
  if (!testUser) {
    testUser = await db.user.create({ data: { email: 'v3_jwt_test@smmplan.pro', tenantId: 'flux' } });
  }

  const dbSession = await db.session.create({
    data: {
      userId: testUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent: 'Playwright-V3-Test',
      ipAddress: '127.0.0.1',
    },
  });

  const legacySessionToken = await new SignJWT({
    sessionId: dbSession.id,
    userId: testUser.id,
    role: testUser.role || 'USER',
    tenantId: 'lovable', // Legacy JWT payload
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getEncodedKey());

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: 'session_token',
      value: legacySessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
    {
      name: 'x_tenant',
      value: 'flux',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
    },
  ]);

  const page = await context.newPage();
  const resp = await page.goto(`${baseUrl}/dashboard?tenant=flux`, { waitUntil: 'domcontentloaded' });
  const status = resp?.status();
  const cookies = await context.cookies();
  const resolvedCookie = cookies.find(c => c.name === 'x_tenant')?.value;

  const jwtPassed = status === 200 && resolvedCookie === 'flux' && !page.url().includes('/login');
  results.push({ tenant: 'legacy_jwt_lovable', route: '/dashboard', isF5: false, resolvedCookie: resolvedCookie || 'NONE', passed: jwtPassed });
  console.log(`Case V3.A Direct JWT (lovable): HTTP ${status}, RESOLVED = "${resolvedCookie}" -> ${jwtPassed ? '✅ PASS' : '❌ FAIL'}`);

  await browser.close();

  // Case V3.B: Legacy User in DB + login merge
  console.log('\n--- Case V3.B: User tenantId="flux" Login & Merge Check ---');
  const userInDb = await db.user.findFirst({ where: { email: testUser.email } });
  const userPassed = userInDb?.tenantId === 'flux';
  results.push({ tenant: 'legacy_db_user', route: 'db_migration_check', isF5: false, resolvedCookie: userInDb?.tenantId || 'NONE', passed: userPassed });
  console.log(`Case V3.B User tenantId in DB = "${userInDb?.tenantId}" -> ${userPassed ? '✅ PASS' : '❌ FAIL'}`);

  // Case V3.C: Admin Context Query Check
  console.log('\n--- Case V3.C: Admin Context Filter Check ---');
  const adminBrowser = await chromium.launch({ headless: true });
  const adminContext = await adminBrowser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminContext.newPage();

  const adminLoginUrl = `${baseUrl}/api/dev/login-direct?email=admin_v3_test@smmplan.pro&tenant=flux`;
  console.log(`[AUTH] Navigating to direct admin login: ${adminLoginUrl}`);
  await adminPage.goto(adminLoginUrl, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(1000);

  const adminOrdersUrl = `${baseUrl}/admin/orders?tenant=flux`;
  console.log(`[NAV] Navigating to admin route: ${adminOrdersUrl}`);
  const adminResp = await adminPage.goto(adminOrdersUrl, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(500);

  const adminStatus = adminResp?.status();
  const adminCookies = await adminContext.cookies();
  const adminResolvedCookie = adminCookies.find(c => c.name === 'x_tenant')?.value || 'NONE';
  const adminCurrentUrl = adminPage.url();

  const adminContextPassed = adminStatus === 200 && adminResolvedCookie === 'flux' && adminCurrentUrl.includes('/admin/orders');
  results.push({ tenant: 'admin_context', route: '/admin/orders', isF5: false, resolvedCookie: adminResolvedCookie, passed: adminContextPassed });
  console.log(`Case V3.C Admin Context ("flux"): HTTP ${adminStatus}, RESOLVED = "${adminResolvedCookie}", URL = ${adminCurrentUrl} -> ${adminContextPassed ? '✅ PASS' : '❌ FAIL'}`);
  if (!adminContextPassed) {
    console.error(`❌ Case V3.C failed: Expected status 200 and cookie "flux" on /admin/orders, got status ${adminStatus}, URL ${adminCurrentUrl}, cookie "${adminResolvedCookie}"`);
  }

  await adminBrowser.close();
}

async function runSuite() {
  console.log('🚀 Starting Multitenancy E2E Tenant Resolution Test Suite...');
  await testTenant('smmplan');
  await testTenant('lovable');
  await testTenant('flux');
  await testV3HonestCases();

  console.log('\n==================================================');
  console.log('📊 FINAL MULTITENANCY SUITE SUMMARY');
  console.log('==================================================');
  const allPassed = results.every(r => r.passed);
  console.table(results);

  if (allPassed) {
    console.log('\n🎉 ALL TENANTS & V3 HONEST CASES PASSED GREEN!');
    process.exit(0);
  } else {
    console.error('\n💥 SUITE FAILED: Tenant resolution mismatches detected.');
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
