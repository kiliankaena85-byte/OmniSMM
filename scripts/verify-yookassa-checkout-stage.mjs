import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [VISUAL QA] Launching browser to verify YooKassa & VPN Assistant on :3005...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );

  // 1. Desktop Test
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('🌐 [QA] Navigating to http://localhost:3005 ...');
  await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of landing page
  await page.screenshot({ path: 'landing_stage.png', fullPage: false });
  console.log('📸 [QA] Saved screenshot: landing_stage.png');

  // Check if YooKassa VPN hint exists in DOM
  const vpnHints = await page.locator('text=Внимание: если включен VPN').count();
  console.log(`🔍 [QA] Found ${vpnHints} gateway VPN hint(s) on initial page.`);

  // 2. Check Mobile Viewport (iPhone 14 standard)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: 'landing_mobile_stage.png', fullPage: false });
  console.log('📸 [QA] Saved screenshot: landing_mobile_stage.png');

  await browser.close();
  console.log('✅ [QA] Preflight check on :3005 completed successfully!');
}

main().catch(console.error);
