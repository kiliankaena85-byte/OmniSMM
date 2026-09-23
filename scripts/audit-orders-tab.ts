import { chromium } from 'playwright';

async function main() {
  console.log('📸 Capturing /admin/orders visual audit screenshots...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const email = 'admin@smmplan.test';
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/orders')}`);
  await page.waitForTimeout(2500);

  await page.screenshot({ path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/orders_tab_all_sites.png' });
  console.log('Saved orders_tab_all_sites.png');

  // Test opening tenant selector
  const trigger = page.locator('[data-testid="admin-tenant-selector"]').first();
  if (await trigger.count() > 0) {
    await trigger.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/orders_tab_dropdown_open.png' });
    console.log('Saved orders_tab_dropdown_open.png');
  }

  await browser.close();
}

main().catch(console.error);
