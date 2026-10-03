import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:3000/depin', { waitUntil: 'networkidle' });

  // Accept cookies if present
  const acceptBtn = page.locator('button:has-text("Принять")');
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(500);
  }

  // Tap the coin 10 times
  const coinBtn = page.locator('button.rounded-full');
  for (let i = 0; i < 10; i++) {
    await coinBtn.click();
    await page.waitForTimeout(100);
  }

  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'depin_tapped.png' });
  console.log('TAPPED_SCREENSHOT_SAVED');

  const creditsText = await page.locator('text=OmniCredits').locator('..').textContent();
  console.log('Credits display:', creditsText);

  await browser.close();
}

test().catch(console.error);
