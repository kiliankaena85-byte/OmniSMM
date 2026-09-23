import { chromium } from 'playwright';

async function main() {
  console.log('🔍 Диагностика кликов и интерактивности элементов...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Collect any console errors or unhandled exceptions
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[Page Error] ${err.message}`);
  });

  const email = 'admin@smmplan.test';
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`);
  await page.waitForTimeout(2000);

  console.log('Console errors captured during load:', consoleErrors);

  // Check top elements at several coordinates
  const hitElements = await page.evaluate(() => {
    const coords = [
      { x: 30, y: 100, desc: 'Sidebar Icon 1' },
      { x: 30, y: 200, desc: 'Sidebar Icon 2' },
      { x: 500, y: 200, desc: 'Wave Chart Area' },
      { x: 300, y: 500, desc: 'KPI Card' },
      { x: 800, y: 700, desc: 'Dispatcher Button' },
    ];

    return coords.map(c => {
      const el = document.elementFromPoint(c.x, c.y);
      return {
        coord: `${c.x}, ${c.y} (${c.desc})`,
        tagName: el ? el.tagName : 'null',
        className: el ? el.className : 'null',
        id: el ? el.id : 'null',
        outerHTMLPreview: el ? el.outerHTML.substring(0, 120) : 'null',
      };
    });
  });

  console.log('Elements under cursor:', JSON.stringify(hitElements, null, 2));

  // Test clicking sidebar "Заказы" link
  console.log('Testing click on sidebar "Заказы" link...');
  const ordersLink = page.locator('aside a[href*="/admin/orders"]').first();
  const exists = await ordersLink.count();
  console.log(`Orders link count in sidebar: ${exists}`);
  if (exists > 0) {
    const isVis = await ordersLink.isVisible();
    console.log(`Is orders link visible: ${isVis}`);
    try {
      await ordersLink.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log(`Current URL after click: ${page.url()}`);
    } catch (e: any) {
      console.error('Click failed:', e.message);
    }
  }

  // Test clicking provider button
  console.log('Testing click on provider link...');
  const provLink = page.locator('a[href*="/admin/providers"]').first();
  const provCount = await provLink.count();
  console.log(`Provider link count: ${provCount}`);
  if (provCount > 0) {
    try {
      await provLink.click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      console.log(`Current URL after prov click: ${page.url()}`);
    } catch (e: any) {
      console.error('Provider click failed:', e.message);
    }
  }

  await browser.close();
}

main().catch(console.error);
