import { chromium } from 'playwright';
import path from 'path';
import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';
import { getEncodedKey } from '../src/lib/session-edge';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Capturing Admin Panel Telegram Settings (/admin/settings) on Stage :3005...');

  const admin = await prisma.user.findFirst({
    where: { role: { in: ['OWNER', 'SUPPORT', 'SUPER_ADMIN'] } }
  });
  if (!admin) throw new Error('No admin user found in database');

  const secret = getEncodedKey();
  const token = await new SignJWT({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
    tenantId: 'smmplan'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 }
  });

  await context.addCookies([
    {
      name: 'session',
      value: token,
      domain: '127.0.0.1',
      path: '/'
    }
  ]);

  const page = await context.newPage();
  const artifactsDir = path.resolve('C:/Users/Артем/.gemini/antigravity/brain/c1f1ef9d-4c5f-42fb-82fb-98201bbbd1a8');

  console.log('1. Navigating to http://127.0.0.1:3005/admin/settings ...');
  await page.goto('http://127.0.0.1:3005/admin/settings', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Click on Telegram tab
  const tgTab = page.locator('button:has-text("Telegram"), [role="tab"]:has-text("Telegram")').first();
  if (await tgTab.isVisible()) {
    console.log('2. Clicking Telegram tab...');
    await tgTab.click();
    await page.waitForTimeout(1500);
  }

  const screenshotPath = path.join(artifactsDir, 'stage_admin_telegram_control.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('   Saved Admin Telegram Settings screenshot to:', screenshotPath);

  await browser.close();
  await prisma.$disconnect();
  console.log('✅ Admin Panel Verification Complete!');
}

main().catch(err => {
  console.error('❌ Admin Verification Failed:', err);
  process.exit(1);
});
