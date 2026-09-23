import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  const artifactDir = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c');
  const email = 'admin@smmplan.test';

  console.log('🚀 Starting Playwright Visual Audit for /admin/dashboard...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop 1920x1080
  const context1080 = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page1080 = await context1080.newPage();

  console.log('Logging in...');
  await page1080.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`);
  await page1080.waitForTimeout(2000);

  // Measure horizontal scroll on 1080p
  const scrollInfo1080 = await page1080.evaluate(() => {
    const mainEl = document.getElementById('main-content') || document.body;
    return {
      windowWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      mainScrollWidth: mainEl.scrollWidth,
      mainClientWidth: mainEl.clientWidth,
      hasHorizontalScroll: document.body.scrollWidth > window.innerWidth || mainEl.scrollWidth > mainEl.clientWidth
    };
  });
  console.log('1080p Scroll Check:', scrollInfo1080);

  const path1080 = path.join(artifactDir, 'dashboard_1080p.png');
  await page1080.screenshot({ path: path1080, fullPage: false });
  console.log(`📸 Saved 1080p screenshot: ${path1080}`);

  // 2. Laptop 1366x768
  const context768 = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const page768 = await context768.newPage();
  await page768.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`);
  await page768.waitForTimeout(2000);

  const scrollInfo768 = await page768.evaluate(() => {
    const mainEl = document.getElementById('main-content') || document.body;
    return {
      windowWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      mainScrollWidth: mainEl.scrollWidth,
      mainClientWidth: mainEl.clientWidth,
      hasHorizontalScroll: document.body.scrollWidth > window.innerWidth || mainEl.scrollWidth > mainEl.clientWidth
    };
  });
  console.log('1366x768 Scroll Check:', scrollInfo768);

  const path768 = path.join(artifactDir, 'dashboard_1366p.png');
  await page768.screenshot({ path: path768, fullPage: false });
  console.log(`📸 Saved 1366p screenshot: ${path768}`);

  await browser.close();
  console.log('✅ Visual audit complete!');
}

main().catch(console.error);
