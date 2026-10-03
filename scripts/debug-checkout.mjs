import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ 
    headless: true, 
    channel: 'chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  }).catch(() =>
    chromium.launch({ headless: true, channel: 'msedge' })
  );
  const page = await browser.newPage();
  page.on('console', m => console.log('LOG:', m.text()));
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('response', async r => {
    if (r.request().method() === 'POST' || r.url().includes('yoo') || r.url().includes('checkout')) {
      console.log('RESPONSE:', r.status(), r.url());
      try {
        const text = await r.text();
        console.log('BODY:', text.slice(0, 300));
      } catch {}
    }
  });

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Dismiss cookie
  try {
    const cookieBtn = page.locator('button:has-text("Принять")');
    if (await cookieBtn.isVisible()) await cookieBtn.click();
  } catch (e) {}

  await page.locator('[data-testid="service-card"]').first().click();
  await page.waitForTimeout(500);

  const openBtn = page.locator('button:has-text("Оформить заказ")').first();
  if (await openBtn.isVisible()) await openBtn.click();
  await page.waitForTimeout(500);

  await page.locator('#field-link input').last().fill('https://t.me/durov');
  await page.locator('input[type="email"]').fill('client@smmplan.pro');
  await page.locator('input[type="checkbox"]').last().check({ force: true });
  
  console.log('🚀 Clicking "Оплатить"...');
  await page.locator('button:has-text("Оплатить")').first().click();

  console.log('⏳ Waiting for modal with text "Ожидание оплаты"...');
  await page.waitForSelector('text=Ожидание оплаты', { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'stage_vpn_modal_opened.png', fullPage: false });
  console.log('📸 Saved stage_vpn_modal_opened.png');
  await browser.close();
}

main().catch(console.error);
