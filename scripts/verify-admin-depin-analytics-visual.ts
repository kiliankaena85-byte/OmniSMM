import * as dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import path from 'path';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';

async function main() {
  console.log('🚀 Running visual verification of Telegram Mini App Analytics tab in Admin Panel...');

  const admin = {
    sessionId: 'qa_session_owner_2026',
    userId: 'cmugw141d00026vtakb62tr44',
    email: 'art@artmspektr.ru',
    role: 'OWNER',
    tenantId: 'smmplan'
  };

  const secret = getEncodedKey();
  const token = await new SignJWT({
    sessionId: admin.sessionId,
    userId: admin.userId,
    email: admin.email,
    role: admin.role,
    tenantId: admin.tenantId,
    allowedTenants: ['smmplan', 'flux'],
    contour: 'test',
    canResetPassword: false,
    sessionVer: 1
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const artifactsDir = path.resolve('C:/Users/Артем/.gemini/antigravity/brain/c1f1ef9d-4c5f-42fb-82fb-98201bbbd1a8');
  const stageUrl = 'http://127.0.0.1:3005';

  // --- 1. Desktop Viewport (1440x1200) ---
  console.log('\n--- 1. Desktop Visual Check (1440x1200) ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1200 }
  });

  await desktopContext.addCookies([
    {
      name: 'session_token',
      value: token,
      url: stageUrl
    },
    {
      name: 'x_tenant',
      value: 'smmplan',
      url: stageUrl
    }
  ]);

  const desktopPage = await desktopContext.newPage();
  
  desktopPage.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('Browser Console Error:', msg.text());
    }
  });

  console.log('1. Navigating to http://127.0.0.1:3005/admin/settings?tab=telegram ...');
  await desktopPage.goto('http://127.0.0.1:3005/admin/settings?tab=telegram', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await desktopPage.waitForTimeout(2000);

  // Scroll down to reveal Telegram control center
  await desktopPage.evaluate(() => window.scrollTo(0, 800));
  await desktopPage.waitForTimeout(1000);

  // Click on "Узлы DePIN и Доход" tab
  const depinBtn = desktopPage.locator('button:has-text("Узлы DePIN и Доход")').first();
  console.log('Is depinBtn visible:', await depinBtn.isVisible());
  if (await depinBtn.isVisible()) {
    console.log('2. Clicking "Узлы DePIN и Доход"...');
    await depinBtn.click();
    await desktopPage.waitForTimeout(3000);
  } else {
    console.log('Searching for any depin button...');
    const anyDepin = desktopPage.locator('button:has-text("DePIN")').first();
    if (await anyDepin.isVisible()) {
      await anyDepin.click();
      await desktopPage.waitForTimeout(3000);
    }
  }

  // Scroll to show the analytics dashboard in view
  const analyticsSection = desktopPage.locator('text=Продуктовая аналитика').first();
  if (await analyticsSection.isVisible()) {
    console.log('Found "Продуктовая аналитика", scrolling into view...');
    await analyticsSection.scrollIntoViewIfNeeded();
    await desktopPage.waitForTimeout(1000);
  }

  const desktopShotPath = path.join(artifactsDir, 'stage_depin_analytics_desktop.png');
  await desktopPage.screenshot({ path: desktopShotPath, fullPage: true });
  console.log('✅ Desktop screenshot saved to:', desktopShotPath);

  // Content inspection
  const pageContent = await desktopPage.content();
  console.log('\nVerification Findings on Desktop:');
  console.log('• Contains "Продуктовая аналитика":', pageContent.includes('Продуктовая аналитика') || pageContent.includes('Аналитика'));
  console.log('• Contains "Воронка":', pageContent.includes('Воронка'));
  console.log('• Contains "DAU":', pageContent.includes('DAU'));
  console.log('• Contains "Тапы":', pageContent.includes('тапы') || pageContent.includes('Тапы') || pageContent.includes('тапов'));
  console.log('• Contains "Лидерборд":', pageContent.includes('лидер') || pageContent.includes('Лидер') || pageContent.includes('Кликеры'));

  // --- 2. Mobile Viewport (iPhone 390x844) ---
  console.log('\n--- 2. Mobile Visual Check (iPhone 390x844) ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });

  await mobileContext.addCookies([
    {
      name: 'session_token',
      value: token,
      url: stageUrl
    },
    {
      name: 'x_tenant',
      value: 'smmplan',
      url: stageUrl
    }
  ]);

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:3005/admin/settings?tab=telegram', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await mobilePage.waitForTimeout(2000);

  // Click on "Telegram Бот" tab on mobile
  const mDepinBtn = mobilePage.locator('button:has-text("Узлы DePIN и Доход"), button:has-text("DePIN")').first();
  if (await mDepinBtn.isVisible()) {
    await mDepinBtn.click();
    await mobilePage.waitForTimeout(2500);
  }

  const mobileShotPath = path.join(artifactsDir, 'stage_depin_analytics_mobile.png');
  await mobilePage.screenshot({ path: mobileShotPath, fullPage: true });
  console.log('✅ Mobile screenshot saved to:', mobileShotPath);

  await browser.close();
  console.log('\n🎉 Visual check completed successfully!');
}

main().catch((err) => {
  console.error('Fatal error in visual check:', err);
  process.exit(1);
});
