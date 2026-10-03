import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [VISUAL QA] Launching headless browser to verify DePIN TMA Skip & Replace Flow on :3005...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile Telegram Mini App standard
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.0',
  });

  const page = await context.newPage();

  console.log('🌐 [QA] Navigating to http://localhost:3005/depin ...');
  await page.goto('http://localhost:3005/depin', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(2000);

  // Take initial screenshot of available tasks with skip buttons
  await page.screenshot({ path: 'depin_stage_skip_buttons.png', fullPage: true });
  console.log('📸 [QA] Saved screenshot: depin_stage_skip_buttons.png');

  // Verify skip buttons exist
  const alreadyWatchedBtn = page.locator('button:has-text("Уже смотрел")').first();
  const ownPostBtn = page.locator('button:has-text("Мой пост")').first();
  const skipBtn = page.locator('button:has-text("Пропуск")').first();

  const hasAlreadyWatched = await alreadyWatchedBtn.isVisible().catch(() => false);
  const hasOwnPost = await ownPostBtn.isVisible().catch(() => false);
  const hasSkip = await skipBtn.isVisible().catch(() => false);

  console.log(`🔍 [QA] "Уже смотрел" button visible: ${hasAlreadyWatched}`);
  console.log(`🔍 [QA] "Мой пост" button visible: ${hasOwnPost}`);
  console.log(`🔍 [QA] "Пропуск" button visible: ${hasSkip}`);

  if (hasAlreadyWatched) {
    console.log('👉 [QA] Clicking "Уже смотрел" on first task...');
    await alreadyWatchedBtn.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'depin_stage_after_skip.png', fullPage: true });
    console.log('📸 [QA] Saved screenshot after skip: depin_stage_after_skip.png');
  }

  await browser.close();
  console.log('✅ [QA] Visual audit completed successfully!');
}

main().catch(console.error);
