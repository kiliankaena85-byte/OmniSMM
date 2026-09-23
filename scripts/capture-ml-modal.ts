import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const artifactDir = path.resolve(
    'C:/Users/Артём/.gemini/antigravity/brain/25756746-be5a-4c54-82ae-cad1e4c009e8'
  );
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();

  const email = 'superadmin@smmplan.ru';
  await page.goto(`http://localhost:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan`);
  await page.waitForTimeout(1000);

  await page.goto('http://localhost:3000/admin/catalog', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Click the brain button on first service
  const brainBtn = page.locator('button[aria-label*="ML Обоснование"]').first();
  await brainBtn.scrollIntoViewIfNeeded();
  await brainBtn.click();

  // Wait for the modal content to finish loading (wait until spinner disappears or content appears)
  console.log('Waiting for ML content in modal...');
  await page.waitForSelector('text=Себестоимость закупки', { timeout: 15000 });
  await page.waitForTimeout(1000);

  const modalPath = path.join(artifactDir, 'screenshot_admin_ml_pricing_modal.png');
  await page.screenshot({ path: modalPath, fullPage: false });
  console.log('Saved:', modalPath);

  await browser.close();
}

main().catch(console.error);
