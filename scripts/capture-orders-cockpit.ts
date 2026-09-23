import { chromium } from 'playwright';

async function main() {
  console.log('📸 Capturing Orders Cockpit states...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const email = 'admin@smmplan.test';

  // 1. Base Orders page with Ultra-Compact 42px Toolbar
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/orders')}`);
  await page.waitForTimeout(2000);

  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/orders_cockpit_base.png' 
  });
  console.log('Saved orders_cockpit_base.png');

  // 2. Filtered state: Telegram + Subscribers (Semantic Filter) + 30 days
  await page.goto(`http://127.0.0.1:3000/admin/orders?networkSlug=telegram&activityType=subscribers&datePreset=30d`);
  await page.waitForTimeout(1500);

  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/orders_cockpit_semantic_filtered.png' 
  });
  console.log('Saved orders_cockpit_semantic_filtered.png');

  // 3. Strict Number search: #54
  await page.goto(`http://127.0.0.1:3000/admin/orders?q=54`);
  await page.waitForTimeout(1500);

  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/orders_cockpit_strict_number.png' 
  });
  console.log('Saved orders_cockpit_strict_number.png');

  await browser.close();
}

main().catch(console.error);
