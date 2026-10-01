import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [VISUAL QA] Submitting order with #landing-url on :3005...');
  const browser = await chromium.launch({ 
    headless: true, 
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );

  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Dismiss cookies
  try {
    const cookieBtn = page.locator('button:has-text("Принять")');
    if (await cookieBtn.isVisible()) await cookieBtn.click();
  } catch (e) {}

  // 1. Select the first service
  const firstServiceCard = page.locator('[data-testid="service-card"]').first();
  await firstServiceCard.scrollIntoViewIfNeeded();
  await firstServiceCard.click();
  await page.waitForTimeout(600);

  // 2. Open checkout
  const openCheckoutBtn = page.locator('button:has-text("Оформить заказ"), button:has-text("Перейти к оформлению"), button:has-text("К оформлению")').first();
  if (await openCheckoutBtn.isVisible()) {
    await openCheckoutBtn.click();
    await page.waitForTimeout(600);
  }

  // 3. Fill in Telegram link into #field-link input
  const linkInput = page.locator('#field-link input').last();
  await linkInput.waitFor({ state: 'visible' });
  await linkInput.fill('https://t.me/durov');
  console.log('Filled #field-link input: https://t.me/durov');
  await page.waitForTimeout(300);

  // 4. Fill in email
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible' });
  await emailInput.fill('client@smmplan.pro');
  console.log('Filled email: client@smmplan.pro');
  await page.waitForTimeout(300);

  // 5. Uncheck Drip-Feed to make it a simple single run
  const dripCheckbox = page.locator('label:has-text("Drip-Feed"), input[type="checkbox"]:has-text("Drip")');
  // Or check terms of service checkbox
  const termsCheckbox = page.locator('input[type="checkbox"]').last();
  await termsCheckbox.check({ force: true });
  await page.waitForTimeout(300);

  // Take screenshot before click
  await page.screenshot({ path: 'stage_checkout_ready.png', fullPage: false });
  console.log('📸 Saved stage_checkout_ready.png');

  // 6. Click pay button
  const payBtn = page.locator('button:has-text("Оплатить")').first();
  console.log('🚀 Clicking "Оплатить"...');
  await payBtn.click();

  // Wait for YooKassa response and modal
  console.log('⏳ Waiting for modal to open...');
  await page.waitForTimeout(10000);

  // Take screenshot of modal
  await page.screenshot({ path: 'stage_vpn_helper_modal_active.png', fullPage: false });
  console.log('📸 Saved stage_vpn_helper_modal_active.png');

  await browser.close();
  console.log('✅ Done!');
}

main().catch(console.error);
