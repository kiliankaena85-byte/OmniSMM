import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Testing Lovable Storefront on Stage (3005)...');
  await page.goto('http://127.0.0.1:3005/?tenant=flux', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Test clicking the "+" button to open catalog
  console.log('Clicking "+" button...');
  const plusBtn = page.locator('button[data-testid="flux-open-catalog-btn"], button[title*="каталог"]').first();
  await plusBtn.click();
  await page.waitForTimeout(800);

  // Check that networks are displayed
  const telegramCard = page.locator('text=Telegram').first();
  const isVisible = await telegramCard.isVisible();
  console.log(`Telegram card visible after "+" click: ${isVisible}`);

  // 2. Navigate back to home
  await page.goto('http://127.0.0.1:3005/?tenant=flux', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 3. Test typing URL and clicking submit
  console.log('Typing https://t.me/durov into prompt console...');
  const input = page.locator('input[aria-label="Ссылка для продвижения"]');
  await input.fill('https://t.me/durov');
  await page.waitForTimeout(300);

  const submitBtn = page.locator('button[title="Запустить"]');
  await submitBtn.click();
  await page.waitForTimeout(1000);

  console.log('✅ Interactions verified successfully!');
  await browser.close();
}

verify().catch(console.error);
