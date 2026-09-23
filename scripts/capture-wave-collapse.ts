import { chromium } from 'playwright';

async function main() {
  console.log('📸 Capturing Collapsible Wave Chart states...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const email = 'admin@smmplan.test';
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`);
  await page.waitForTimeout(2500);

  // 1. Expanded view
  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/wave_expanded.png' 
  });
  console.log('Saved wave_expanded.png');

  // 2. Click collapse button (either button with "Скрыть график" or the chevron)
  await page.locator('button:has-text("Скрыть график")').click();
  await page.waitForTimeout(400);

  // 3. Collapsed view
  await page.screenshot({ 
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/wave_collapsed.png' 
  });
  console.log('Saved wave_collapsed.png');

  await browser.close();
}

main().catch(console.error);
