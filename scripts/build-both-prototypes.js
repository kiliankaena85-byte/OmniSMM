const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function buildBothPrototypes() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const brainDir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\ea3a0555-f229-4c26-9329-c26f154ae6e0';

  console.log('1. Navigating to SMMplan Landing: http://localhost:3000/');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(brainDir, 'smmplan_live_page_capture.png'), fullPage: true });

  console.log('2. Navigating to FLux Landing: http://localhost:3000/ab-lovable');
  await page.goto('http://localhost:3000/ab-lovable', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(brainDir, 'flux_live_page_capture.png'), fullPage: true });

  await browser.close();
  console.log('Captured live pages for SMMplan & FLux successfully!');
}

buildBothPrototypes();
