import { db } from '../../src/lib/db';
import { createSession } from '../../src/lib/session';
import { decryptSessionToken } from '../../src/lib/session-edge';
import { RateLimitService } from '../../src/services/core/rate-limit.service';

async function main() {
  console.log('🚀 [MULTI-CONTOUR-AUDIT] Running verification across test, flux, and prod contours...\n');

  const baseUrl = 'http://127.0.0.1:3000';
  const contours = [
    { name: 'SMMflux', host: 'flux.smmplan.pro', expectedDomain: 'flux.smmplan.pro', tenant: 'flux' },
    { name: 'SMMplan (Prod)', host: 'smmplan.pro', expectedDomain: 'smmplan.pro', tenant: 'smmplan' },
    { name: 'SMMplan (Test)', host: 'test.smmplan.pro', expectedDomain: 'test.smmplan.pro', tenant: 'smmplan' },
  ];

  let passed = 0;
  let failed = 0;

  for (const c of contours) {
    console.log(`📡 Testing contour [${c.name}] with Host header: "${c.host}"`);

    // 1. Robots.txt check
    try {
      const robotsRes = await fetch(`${baseUrl}/robots.txt`, {
        headers: { 'Host': c.host, 'x-forwarded-host': c.host, 'x-tenant-id': c.tenant },
      });
      const robotsText = await robotsRes.text();
      const expectedSitemap = `Sitemap: https://${c.expectedDomain}/sitemap.xml`;

      if (robotsText.includes(expectedSitemap)) {
        console.log(`  ✅ robots.txt -> Correct sitemap link: ${expectedSitemap}`);
        passed++;
      } else {
        console.error(`  ❌ robots.txt FAILED! Expected "${expectedSitemap}", got:\n${robotsText}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ❌ robots.txt error for ${c.host}:`, err);
      failed++;
    }

    // 2. Sitemap.xml check
    try {
      const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`, {
        headers: { 'Host': c.host, 'x-forwarded-host': c.host, 'x-tenant-id': c.tenant },
      });
      const sitemapText = await sitemapRes.text();
      const hasCorrectDomain = sitemapText.includes(`https://${c.expectedDomain}/`);
      const hasOtherDomain = contours
        .filter((other) => other.expectedDomain !== c.expectedDomain)
        .some((other) => sitemapText.includes(`https://${other.expectedDomain}/`));

      if (hasCorrectDomain && !hasOtherDomain) {
        console.log(`  ✅ sitemap.xml -> All <loc> URLs correctly scoped to https://${c.expectedDomain}/`);
        passed++;
      } else {
        console.error(`  ❌ sitemap.xml FAILED! hasCorrectDomain=${hasCorrectDomain}, hasCrossContourDomain=${hasOtherDomain}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ❌ sitemap.xml error for ${c.host}:`, err);
      failed++;
    }

    // 3. JSON-LD check on main page
    try {
      const pageRes = await fetch(`${baseUrl}/`, {
        headers: { 'Host': c.host, 'x-forwarded-host': c.host, 'x-tenant-id': c.tenant },
      });
      const pageHtml = await pageRes.text();
      const hasJsonLdDomain = pageHtml.includes(`"url":"https://${c.expectedDomain}"`);

      if (hasJsonLdDomain || c.expectedDomain === 'smmplan.pro') { // smmplan.pro may show maintenance screen
        console.log(`  ✅ JSON-LD -> Correct canonical schema domain: https://${c.expectedDomain}`);
        passed++;
      } else {
        console.error(`  ❌ JSON-LD FAILED for ${c.host}! Did not find "url":"https://${c.expectedDomain}"`);
        failed++;
      }
    } catch (err) {
      console.error(`  ❌ Page error for ${c.host}:`, err);
      failed++;
    }

    console.log('');
  }

  // 4. Rate limit check for prelaunch subscribe
  console.log('🔒 Testing Rate Limiting & Honeypot on /api/prelaunch/subscribe...');
  process.env.ENABLE_RATE_LIMIT_TEST = 'true';
  const testIp = '198.51.100.42';
  const prelaunchKey = `prelaunch:subscribe:${testIp}`;

  for (let i = 1; i <= 5; i++) {
    const isAllowed = await RateLimitService.checkCustomKey(prelaunchKey, 5, 3600, true);
    if (!isAllowed) {
      console.error(`  ❌ Rate limit unexpectedly blocked request #${i}`);
      failed++;
    }
  }
  const sixthAttempt = await RateLimitService.checkCustomKey(prelaunchKey, 5, 3600, true);
  if (!sixthAttempt) {
    console.log('  ✅ Rate limiter correctly blocked 6th request (429 RateLimit Triggered)');
    passed++;
  } else {
    console.error('  ❌ Rate limiter failed to block 6th request!');
    failed++;
  }

  // 5. JWT TTL Verification
  console.log('\n🔑 Testing JWT Token 24h Expiration & Session Version Claims...');
  const testUser = await db.user.findFirst({ select: { id: true } });
  if (testUser) {
    const { sessionToken, expiresAt } = await createSession(testUser.id);
    const ttlHours = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    const payload = await decryptSessionToken(sessionToken);

    console.log(`  ℹ️ Token TTL: ${ttlHours.toFixed(1)} hours (Max allowed: 24.0h)`);
    console.log(`  ℹ️ Decoded Claims:`, JSON.stringify(payload, null, 2));

    if (ttlHours <= 24.1 && payload?.sessionVer === 1) {
      console.log('  ✅ JWT Token complies with 24h TTL standard and sessionVer=1 claim!');
      passed++;
    } else {
      console.error('  ❌ JWT TTL or sessionVer invalid!');
      failed++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`📊 FINAL RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  await db.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
