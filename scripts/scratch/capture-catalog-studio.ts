import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1.5 });

  const email = 'admin@smmplan.test';

  // 1. Capture /admin/catalog/new (Full-Page Studio Editor)
  console.log('Navigating to /admin/catalog/new via login-direct...');
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/catalog/new')}`);
  await page.waitForTimeout(2000);
  const newStudioPath = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/admin_catalog_new_studio.png');
  await page.screenshot({ path: newStudioPath, fullPage: true });
  console.log(`Saved: ${newStudioPath}`);

  // 2. Capture /admin/catalog (Catalog Table with Clean Full-Page Links)
  console.log('Navigating to /admin/catalog...');
  await page.goto('http://127.0.0.1:3000/admin/catalog');
  await page.waitForTimeout(2000);
  const catalogTablePath = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/admin_catalog_table_studio.png');
  await page.screenshot({ path: catalogTablePath, fullPage: false });
  console.log(`Saved: ${catalogTablePath}`);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
