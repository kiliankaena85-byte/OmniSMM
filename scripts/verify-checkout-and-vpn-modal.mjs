import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [VISUAL QA] Starting full end-to-end checkout & modal test on :3005...');
  const browser = await chromium.launch({ 
    headless: true, 
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );

  const context = await browser.newContext({
    viewport: { width: 1366, height: 820 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Route logs to console
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Dismiss cookies
  try {
    const cookieBtn = page.locator('button:has-text("Принять")');
    if (await cookieBtn.isVisible()) {
      await cookieBtn.click();
      await page.waitForTimeout(300);
    }
  } catch (e) {}

  // 1. Click on the first service card in the catalog
  console.log('🔍 Clicking on first service card in catalog...');
  const firstServiceCard = page.locator('[data-testid="service-card"]').first();
  await firstServiceCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await firstServiceCard.click();
  await page.waitForTimeout(1000);

  // Take screenshot of catalog with selected card and sticky checkout bar
  await page.screenshot({ path: 'stage_service_selected.png', fullPage: false });
  console.log('📸 Saved stage_service_selected.png');

  // 2. Click on the checkout button in the sticky bar
  const openCheckoutBtn = page.locator('button:has-text("Оформить заказ"), button:has-text("Перейти к оформлению"), button:has-text("К оформлению")').first();
  if (await openCheckoutBtn.isVisible()) {
    console.log('🔍 Clicking checkout button in sticky bar...');
    await openCheckoutBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. Take screenshot of the checkout modal / drawer with payment options
  await page.screenshot({ path: 'stage_checkout_drawer.png', fullPage: false });
  console.log('📸 Saved stage_checkout_drawer.png');

  // Check if YooKassa VPN notice is present in checkout
  const vpnNoticeInCheckout = await page.locator('text=Для перехода в ЮKassa').isVisible().catch(() => false);
  console.log(`🔍 YooKassa VPN notice visible in checkout: ${vpnNoticeInCheckout}`);

  // 4. Fill in link, quantity, email
  console.log('📝 Filling checkout fields...');
  const linkField = page.locator('input[placeholder*="t.me"], input[name="link"]').first();
  if (await linkField.isVisible()) {
    await linkField.fill('https://t.me/durov');
  }

  const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="@"]').first();
  if (await emailField.isVisible()) {
    await emailField.fill('vpn-audit@smmplan.pro');
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'stage_checkout_filled.png', fullPage: false });
  console.log('📸 Saved stage_checkout_filled.png');

  // 5. Submit order to trigger PaymentVpnHelperModal
  console.log('🚀 Submitting checkout form...');
  const payBtn = page.locator('button:has-text("Оплатить"), button[type="submit"]:has-text("Оформить")').first();
  if (await payBtn.isVisible()) {
    await payBtn.click();
    // Wait up to 6 seconds for response and modal popup
    await page.waitForTimeout(5000);
  }

  // Take screenshot after submit: check for PaymentVpnHelperModal
  await page.screenshot({ path: 'stage_payment_vpn_modal.png', fullPage: false });
  console.log('📸 Saved stage_payment_vpn_modal.png');

  const modalTitleVisible = await page.locator('text=Ожидание оплаты, text=Оплата с телефона (СБП)').isVisible().catch(() => false);
  console.log(`🔍 PaymentVpnHelperModal visible: ${modalTitleVisible}`);

  // 6. Mobile Viewport test for the modal
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  
  // Also take screenshot of mobile
  await mobilePage.screenshot({ path: 'stage_mobile_overview.png', fullPage: false });
  console.log('📸 Saved stage_mobile_overview.png');

  await browser.close();
  console.log('✅ End-to-end verification completed!');
}

main().catch(console.error);
