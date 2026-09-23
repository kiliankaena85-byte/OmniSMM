import { chromium } from 'playwright';
import { db } from '../src/lib/db';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';
import fs from 'fs';
import path from 'path';

async function createJwt(userId: string, role: string, tenantId = 'smmplan') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'scroll-verification-agent',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId,
    canResetPassword: false,
    role,
    tenantId,
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

async function main() {
  console.log('🔍 Starting Playwright Horizontal Scroll Audit for /admin/clients...');

  const brainDir = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/825b8dde-0bec-45fa-8205-d3b2d05f1962');
  const localArtifactsDir = path.resolve(process.cwd(), 'artifacts');

  if (!fs.existsSync(brainDir)) fs.mkdirSync(brainDir, { recursive: true });
  if (!fs.existsSync(localArtifactsDir)) fs.mkdirSync(localArtifactsDir, { recursive: true });

  const ownerUser = await db.user.findFirst({ where: { role: 'OWNER' } });
  if (!ownerUser) throw new Error('Owner user missing in DB');

  const token = await createJwt(ownerUser.id, 'OWNER');

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '1920_desktop', width: 1920, height: 1080 },
    { name: '1440_laptop', width: 1440, height: 900 },
    { name: '1280_compact', width: 1280, height: 800 },
  ];

  for (const vp of viewports) {
    console.log(`\n--- Testing Viewport ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });

    await context.addCookies([
      { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
      { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
    ]);

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3005/admin/clients', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Scroll metrics evaluation
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;

      const windowScrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const windowClientWidth = doc.clientWidth;
      const hasWindowHorizontalScroll = windowScrollWidth > windowClientWidth;

      // Find the table and its scroll container
      const table = document.querySelector('table');
      const tableContainer = table?.closest('.overflow-x-auto') || table?.parentElement;

      let tableScrollWidth = 0;
      let tableContainerClientWidth = 0;
      let hasTableHorizontalScroll = false;

      if (table && tableContainer) {
        tableScrollWidth = table.scrollWidth;
        tableContainerClientWidth = tableContainer.clientWidth;
        hasTableHorizontalScroll = tableScrollWidth > tableContainerClientWidth;
      }

      // Check column widths
      const headers = Array.from(document.querySelectorAll('table th')).map((th) => {
        const text = th.textContent?.trim() || '';
        const rect = th.getBoundingClientRect();
        return { text, width: Math.round(rect.width) };
      });

      return {
        windowScrollWidth,
        windowClientWidth,
        hasWindowHorizontalScroll,
        tableScrollWidth,
        tableContainerClientWidth,
        hasTableHorizontalScroll,
        headers,
      };
    });

    console.log(`Window: scrollWidth=${metrics.windowScrollWidth}px, clientWidth=${metrics.windowClientWidth}px -> Horizontal Scroll: ${metrics.hasWindowHorizontalScroll ? '🔴 YES (FAIL)' : '🟢 NO (PASS)'}`);
    console.log(`Table: scrollWidth=${metrics.tableScrollWidth}px, containerWidth=${metrics.tableContainerClientWidth}px -> Table Scroll: ${metrics.hasTableHorizontalScroll ? '🔴 YES (FAIL)' : '🟢 NO (PASS)'}`);
    console.log('Columns rendered:');
    metrics.headers.forEach(h => console.log(`  - ${h.text}: ${h.width}px`));

    // Capture screenshot
    const shotLocal = path.join(localArtifactsDir, `clients_table_${vp.name}.png`);
    const shotBrain = path.join(brainDir, `clients_table_${vp.name}.png`);
    await page.screenshot({ path: shotLocal, fullPage: false });
    fs.copyFileSync(shotLocal, shotBrain);
    console.log(`Saved screenshot: ${shotLocal}`);

    await context.close();
  }

  await browser.close();
  console.log('\n✅ Audit completed successfully!');
}

main().catch(err => {
  console.error('❌ Error during audit:', err);
  process.exit(1);
});
