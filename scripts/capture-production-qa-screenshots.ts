import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🚀 Launching Chromium Browser for Visual QA...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const artifactDir = 'C:/Users/Артём/.gemini/antigravity/brain/94b4db79-7a02-4bc2-a8e3-43afbae751e5';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  // 1. SMMplan Classic API
  console.log('1. Navigating to SMMplan (http://localhost:3000)...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const smmplanShot = path.join(artifactDir, 'smmplan_live_qa.png');
  await page.screenshot({ path: smmplanShot, fullPage: false });
  console.log('✔ SMMplan screenshot captured:', smmplanShot);

  // 2. SMMflux Radiant Aurora
  console.log('2. Navigating to SMMflux (http://localhost:3000/?tenant=flux)...');
  await page.goto('http://localhost:3000/?tenant=flux', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const smmfluxShot = path.join(artifactDir, 'smmflux_live_qa.png');
  await page.screenshot({ path: smmfluxShot, fullPage: false });
  console.log('✔ SMMflux screenshot captured:', smmfluxShot);

  // 3. Admin Workspace
  console.log('3. Navigating to Admin Panel (http://localhost:3000/admin)...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const adminShot = path.join(artifactDir, 'smmpanel_admin_live_qa.png');
  await page.screenshot({ path: adminShot, fullPage: false });
  console.log('✔ Admin Panel screenshot captured:', adminShot);

  await browser.close();
  console.log('🎉 Browser Visual QA Completed Successfully!');
}

main().catch(err => {
  console.error('❌ Browser QA Failed:', err);
  process.exit(1);
});
