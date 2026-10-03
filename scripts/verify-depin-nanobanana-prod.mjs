import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [VISUAL QA] Launching headless browser to verify Nano Banana Redesign on PRODUCTION :3000...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile Telegram Mini App standard
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0',
  });

  const page = await context.newPage();

  console.log('🌐 [QA] Navigating to http://localhost:3000/depin ...');
  await page.goto('http://localhost:3000/depin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'depin_nanobanana_prod.png', fullPage: false });
  console.log('📸 [QA] Saved screenshot: depin_nanobanana_prod.png');

  await browser.close();
  console.log('✅ [QA] Production visual audit completed successfully!');
}

main().catch(console.error);
