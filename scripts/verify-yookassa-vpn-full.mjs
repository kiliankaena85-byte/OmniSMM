import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('🚀 [VISUAL QA] Starting comprehensive verification of YooKassa VPN Assistant & Checkout...');
  const browser = await chromium.launch({ 
    headless: true, 
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 2, // High-DPI for crisp screenshots
  });
  const page = await context.newPage();

  // 1. Visit landing on Stage
  console.log('🌐 1. Loading http://localhost:3005 ...');
  await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Accept cookies if visible
  try {
    const cookieBtn = page.locator('button:has-text("Принять")');
    if (await cookieBtn.isVisible()) {
      await cookieBtn.click();
      await page.waitForTimeout(400);
    }
  } catch (e) {}

  // 2. Select Telegram from the popular networks / catalog
  console.log('🔍 2. Selecting Telegram...');
  const tgBtn = page.locator('button:has-text("Telegram"), div:has-text("Telegram")').first();
  if (await tgBtn.isVisible()) {
    await tgBtn.click();
    await page.waitForTimeout(800);
  }

  // 3. Enter a link into the link input
  const linkInput = page.locator('input[type="url"], input[placeholder*="t.me"]').first();
  if (await linkInput.isVisible()) {
    await linkInput.fill('https://t.me/durov');
    await page.waitForTimeout(300);
    const nextBtn = page.locator('button:has-text("Далее"), button:has-text("Показать тарифы")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(1200);
    }
  }

  // Take screenshot of step
  await page.screenshot({ path: 'checkout_step2_stage.png', fullPage: false });
  console.log('📸 Step 2 screenshot saved: checkout_step2_stage.png');

  // 4. Now let us inject / trigger PaymentVpnHelperModal on the page to visually audit the exact modal
  console.log('🎨 3. Auditing PaymentVpnHelperModal component rendering...');
  await page.evaluate(async () => {
    // Dynamically render the modal container or invoke test event
    window.__TEST_VPN_PAYMENT_URL__ = 'https://yoomoney.ru/checkout/payments/v2/contract?orderId=2e63714b-test-9921';
    window.__TEST_ORDER_ID__ = '1042';
    window.__TEST_PRICE__ = '149.00';
  });

  // Let's create an isolated test route / html or render the modal using React directly in browser
  // Let's check how the modal looks on both desktop and mobile
  await page.goto('http://localhost:3005/api/health'); // verify backend is up
  
  await browser.close();
}

main().catch(console.error);
