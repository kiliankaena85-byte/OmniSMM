import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  
  // 1. Desktop
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { host: 'smmflux.ru' }
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3005/?tenant=flux', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const destLocal = path.resolve('artifacts/screenshots-lovable/lovable-storefront-desktop-full.png');
  const destBrain = 'C:/Users/Артем/.gemini/antigravity/brain/649413b5-d403-4baa-baa8-c7005bc1923b/lovable-storefront-desktop-full.png';
  
  await page.screenshot({ path: destLocal, clip: { x: 0, y: 0, width: 1440, height: 750 } });
  fs.copyFileSync(destLocal, destBrain);
  await context.close();

  // 2. Mobile (iPhone 390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: { host: 'smmflux.ru' }
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:3005/?tenant=flux', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  
  const mobileLocal = path.resolve('artifacts/screenshots-lovable/lovable-storefront-mobile-full.png');
  const mobileBrain = 'C:/Users/Артем/.gemini/antigravity/brain/649413b5-d403-4baa-baa8-c7005bc1923b/lovable-storefront-mobile-full.png';
  
  await mobilePage.screenshot({ path: mobileLocal, clip: { x: 0, y: 0, width: 390, height: 650 } });
  fs.copyFileSync(mobileLocal, mobileBrain);
  await mobileContext.close();

  await browser.close();
  console.log('✅ Full Lovable storefront screenshots captured successfully!');
}

main().catch(console.error);
