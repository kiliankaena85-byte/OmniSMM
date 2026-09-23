import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = 'C:/Users/Артём/.gemini/antigravity/brain/6224d023-9600-45e9-bdba-d0f3fbeb4e3b';

// Temporary test route to mount all themes with modal
const testPagePath = 'd:/SMM_plan_2/src/app/theme-stress-test/page.tsx';
const testPageCode = `'use client';
import React, { useState } from 'react';
import { TelegramLinkGuideModal } from '@/components/orders/TelegramLinkGuideModal';

export default function ThemeStressTestPage() {
  return (
    <div className="min-h-screen p-6" id="theme-root">
      <div id="modal-container">
        <TelegramLinkGuideModal
          isOpen={true}
          onClose={() => {}}
          tenantVariant="classic"
        />
      </div>
    </div>
  );
}
`;

async function main() {
  fs.mkdirSync(path.dirname(testPagePath), { recursive: true });
  fs.writeFileSync(testPagePath, testPageCode, 'utf8');

  console.log('--- STARTING EMPIRICAL THEME AUDIT IN HEADLESS CHROMIUM ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });

  await page.goto('http://127.0.0.1:3001/theme-stress-test', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const results: any[] = [];
  const themesToTest = [
    'sky-light', 'sky-dark',
    'emerald-light', 'emerald-dark',
    'violet-light', 'violet-dark',
    'warm-light', 'warm-dark',
    'telegram-light', 'telegram-dark'
  ];

  for (const theme of themesToTest) {
    console.log(`Auditing theme: ${theme}...`);
    
    // Switch theme directly on root element
    await page.evaluate((th) => {
      const root = document.getElementById('theme-root') || document.body;
      const isDark = th.includes('dark');
      
      // Clear previous classes
      root.className = `min-h-screen p-6 transition-colors duration-200 ${isDark ? 'dark ' + th : th}`;
      root.setAttribute('data-theme', th);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);

    await page.waitForTimeout(400);

    // Measure modal bounding box and geometry
    const metrics = await page.evaluate((th) => {
      const modalEl = document.querySelector('#modal-container > div > div') as HTMLElement;
      const headerEl = modalEl?.querySelector('h2') as HTMLElement;
      const buttonEl = modalEl?.querySelector('button') as HTMLElement;
      const cardEl = modalEl?.querySelector('.rounded-2xl') as HTMLElement;

      if (!modalEl) return null;

      const compModal = window.getComputedStyle(modalEl);
      const compHeader = headerEl ? window.getComputedStyle(headerEl) : null;
      const compBtn = buttonEl ? window.getComputedStyle(buttonEl) : null;

      return {
        theme: th,
        widthPx: modalEl.offsetWidth,
        heightPx: modalEl.offsetHeight,
        modalBg: compModal.backgroundColor,
        modalText: compModal.color,
        headerColor: compHeader?.color,
        btnBg: compBtn?.backgroundColor,
        btnColor: compBtn?.color,
      };
    }, theme);

    // Capture screenshot of each theme
    const screenshotPath = path.join(ARTIFACTS_DIR, `theme_${theme}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    results.push(metrics);
  }

  await browser.close();

  // Clean up test page
  fs.rmSync('d:/SMM_plan_2/src/app/theme-stress-test', { recursive: true, force: true });

  console.log('--- EMPIRICAL MEASUREMENT RESULTS ---');
  console.table(results.map(r => ({
    'Тема': r.theme,
    'Ширина': `${r.widthPx}px`,
    'Высота': `${r.heightPx}px`,
    'Фон модалки': r.modalBg,
    'Цвет текста': r.modalText,
  })));

  // Write empirical results to json artifact
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'theme_empirical_audit.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('Audit complete! Evidence saved.');
}

main().catch(err => {
  console.error('Audit failure:', err);
  process.exit(1);
});
