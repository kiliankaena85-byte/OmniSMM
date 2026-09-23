import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const email = 'admin@smmplan.test';
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`);
  await page.waitForTimeout(2000);

  // Click on tenant selector
  const trigger = page.locator('[data-testid="admin-tenant-selector"]').first();
  await trigger.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/tenant_dropdown_open.png' });
  console.log('Saved tenant_dropdown_open.png');

  await browser.close();
}

main().catch(console.error);
