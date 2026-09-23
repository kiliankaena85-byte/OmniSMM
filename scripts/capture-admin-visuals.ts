import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('📸 Capturing Admin Screenshots...');

  const email = 'superadmin@smmplan.ru';
  const artifactDir = path.resolve(
    'C:/Users/Артём/.gemini/antigravity/brain/25756746-be5a-4c54-82ae-cad1e4c009e8'
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Login directly
  await page.goto(`http://localhost:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan`);
  await page.waitForTimeout(1000);

  // 1. Dashboard
  console.log('Capturing /admin/dashboard...');
  await page.goto('http://localhost:3000/admin/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  const dashPath = path.join(artifactDir, 'screenshot_admin_dashboard.png');
  await page.screenshot({ path: dashPath, fullPage: true });
  console.log(`Saved: ${dashPath}`);

  // 2. Catalog
  console.log('Capturing /admin/catalog...');
  await page.goto('http://localhost:3000/admin/catalog', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  const catalogPath = path.join(artifactDir, 'screenshot_admin_catalog.png');
  await page.screenshot({ path: catalogPath, fullPage: false });
  console.log(`Saved: ${catalogPath}`);

  // 3. Open ML Pricing & PrimeLike Radar Modal
  console.log('Opening ML Pricing Modal...');
  try {
    const brainBtn = page.locator('button[title*="ML Обоснование"]').first();
    if (await brainBtn.isVisible()) {
      await brainBtn.click();
      await page.waitForTimeout(2000);
      const modalPath = path.join(artifactDir, 'screenshot_admin_ml_pricing_modal.png');
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log(`Saved: ${modalPath}`);
    }
  } catch (e) {
    console.warn('Could not click brain button:', e);
  }

  // 4. Intel
  console.log('Capturing /admin/intel...');
  await page.goto('http://localhost:3000/admin/intel', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  const intelPath = path.join(artifactDir, 'screenshot_admin_intel.png');
  await page.screenshot({ path: intelPath, fullPage: true });
  console.log(`Saved: ${intelPath}`);

  await browser.close();
  console.log('🎉 All screenshots captured successfully!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
