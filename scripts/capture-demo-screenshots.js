const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function captureAllPages() {
  const artifactsDir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\ea3a0555-f229-4c26-9329-c26f154ae6e0';
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  console.log('Starting visual capture for all 7 pages of SMMplan & SMMflux...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const baseUrl = process.env.DEMO_URL || 'http://localhost:3000/client-demo';

  const subPages = ['dashboard', 'orders', 'new-order', 'deposit', 'referrals', 'support', 'settings'];

  try {
    for (const brand of ['plan', 'flux']) {
      for (const tab of subPages) {
        const url = `${baseUrl}/${brand}/${tab}`;
        console.log(`Capturing ${brand} - ${tab} at ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(300);

        const fileName = `page_${brand}_${tab}.png`;
        const filePath = path.join(artifactsDir, fileName);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`Saved: ${fileName}`);
      }
    }
  } catch (err) {
    console.error('Capture error:', err.message);
  } finally {
    await browser.close();
  }
}

captureAllPages();
