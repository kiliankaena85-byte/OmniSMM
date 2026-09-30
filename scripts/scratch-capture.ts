import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function capture() {
  const artifactDir = 'C:/Users/Артем/.gemini/antigravity/brain/649413b5-d403-4baa-baa8-c7005bc1923b';
  const browser = await chromium.launch({
    headless: true,
    channel: 'msedge'
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1.5,
  });

  console.log('Navigating to http://127.0.0.1:3005/?tenant=flux ...');
  await page.goto('http://127.0.0.1:3005/?tenant=flux', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Hero block screenshot
  await page.screenshot({
    path: path.join(artifactDir, 'flux-current-hero-full.png'),
    clip: { x: 0, y: 0, width: 1440, height: 950 }
  });
  console.log('Captured Hero -> flux-current-hero-full.png');

  // 2. Full page screenshot
  await page.screenshot({
    path: path.join(artifactDir, 'flux-current-fullpage.png'),
    fullPage: true
  });
  console.log('Captured Full Page -> flux-current-fullpage.png');

  await browser.close();
}

capture().catch(console.error);
