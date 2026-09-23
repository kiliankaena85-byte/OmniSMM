import { chromium } from 'playwright';

async function main() {
  console.log('📸 Capturing complete 3-tier /admin/dashboard views...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const email = 'admin@smmplan.test';
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`);
  await page.waitForTimeout(2500);

  // 1. Top view: Wave chart, Storm Radar, KPI cards
  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/dashboard_tier1_top.png' 
  });
  console.log('Saved dashboard_tier1_top.png');

  // 2. Middle view: Live Orders feed, VIP clients, Dispatcher, Provider Liquidity
  await page.locator('#main-content').evaluate(el => el.scrollTo(0, 750));
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/dashboard_tier2_mid.png' 
  });
  console.log('Saved dashboard_tier2_mid.png');

  // 3. Bottom view: Top Services, Gateways, Financial Balance, Refunds, Audit
  await page.locator('#main-content').evaluate(el => el.scrollTo(0, 1600));
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/dashboard_tier3_bottom.png' 
  });
  console.log('Saved dashboard_tier3_bottom.png');

  await browser.close();
}

main().catch(console.error);
