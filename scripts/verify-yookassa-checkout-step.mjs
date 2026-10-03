import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [VISUAL QA] Testing order flow on :3005...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Accept cookies if present
  try {
    const cookieBtn = page.locator('button:has-text("Принять")');
    if (await cookieBtn.isVisible()) {
      await cookieBtn.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.log('No cookie banner or already dismissed');
  }

  // Find a service card or "Заказать" button in the catalog
  console.log('🔍 Looking for order buttons in catalog...');
  const orderBtns = page.locator('button:has-text("Заказать"), button:has-text("Выбрать")');
  const count = await orderBtns.count();
  console.log(`Found ${count} order button(s).`);

  if (count > 0) {
    await orderBtns.first().click();
    await page.waitForTimeout(1500);

    // Take screenshot of step 2 or checkout
    await page.screenshot({ path: 'checkout_step_stage.png', fullPage: false });
    console.log('📸 Saved screenshot: checkout_step_stage.png');

    // Check if YooKassa VPN notice is present in DOM
    const vpnHint = page.locator('text=Внимание: если включен VPN');
    const isVpnHintVisible = await vpnHint.isVisible().catch(() => false);
    console.log(`🔍 YooKassa VPN hint visible: ${isVpnHintVisible}`);
  } else {
    // Try typing a link into the main input
    const linkInput = page.locator('input[placeholder*="ссылку"]');
    if (await linkInput.isVisible()) {
      await linkInput.fill('https://t.me/durov');
      const submitBtn = page.locator('button:has-text("Показать тарифы")');
      await submitBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'checkout_step_stage.png', fullPage: false });
      console.log('📸 Saved screenshot after entering link: checkout_step_stage.png');
    }
  }

  await browser.close();
  console.log('✅ Visual QA on :3005 finished!');
}

main().catch(console.error);
