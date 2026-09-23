const { chromium } = require('playwright');
const path = require('path');

async function captureReplica() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const dir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\ea3a0555-f229-4c26-9329-c26f154ae6e0';

  await page.goto('file:///d:/SMM_plan_2/public/flux-desktop-clickable-prototype.html', { waitUntil: 'load' });
  
  // Navigate to Step 2 Networks by clicking catalog link
  await page.click('button:has-text("Или выберите услугу из каталога")');
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(dir, 'new_prototype_step2_networks_exact_replica.png') });
  console.log('Captured 1:1 replica of Step 2 Networks!');

  await browser.close();
}

captureReplica();
