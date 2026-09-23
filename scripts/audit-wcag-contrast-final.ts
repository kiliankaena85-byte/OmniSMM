import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function parseRgb(rgbStr: string): [number, number, number] {
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: string, rgb2: string): number {
  const [r1, g1, b1] = parseRgb(rgb1);
  const [r2, g2, b2] = parseRgb(rgb2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

// Temporary test route with full app context
const testPagePath = 'd:/SMM_plan_2/src/app/theme-contrast-final/page.tsx';
const testPageCode = `'use client';
import React, { useState } from 'react';
import { TelegramLinkGuideModal } from '@/components/orders/TelegramLinkGuideModal';

export default function ThemeContrastFinalPage() {
  const [th, setTh] = useState('sky-light');

  return (
    <div id="app-root" className={\`min-h-screen bg-background text-foreground \${th.includes('dark') ? 'dark ' + th : th}\`} data-theme={th}>
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

  console.log('--- STARTING ACCURATE WCAG 2.2 AUDIT ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });

  await page.goto('http://127.0.0.1:3001/theme-contrast-final', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const themesToTest = [
    'sky-light', 'sky-dark',
    'emerald-light', 'emerald-dark',
    'violet-light', 'violet-dark',
    'warm-light', 'warm-dark',
    'telegram-light', 'telegram-dark'
  ];

  const results: any[] = [];

  for (const theme of themesToTest) {
    await page.evaluate((t) => {
      const root = document.getElementById('app-root')!;
      const isDark = t.includes('dark');
      root.className = `min-h-screen bg-background text-foreground ${isDark ? 'dark ' + t : t}`;
      root.setAttribute('data-theme', t);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);

    await page.waitForTimeout(300);

    const data = await page.evaluate(() => {
      const modal = document.querySelector('#modal-container > div > div') as HTMLElement;
      const title = modal?.querySelector('h2') as HTMLElement;
      const subtitle = modal?.querySelector('p') as HTMLElement;
      const button = modal?.querySelector('button.bg-primary') as HTMLElement;

      const modalBg = window.getComputedStyle(modal).backgroundColor;
      const titleColor = window.getComputedStyle(title).color;
      const subColor = window.getComputedStyle(subtitle).color;
      const btnBg = button ? window.getComputedStyle(button).backgroundColor : 'rgb(3,105,161)';
      const btnColor = button ? window.getComputedStyle(button).color : 'rgb(255,255,255)';

      return { modalBg, titleColor, subColor, btnBg, btnColor };
    });

    const titleContrast = getContrastRatio(data.titleColor, data.modalBg);
    const subContrast = getContrastRatio(data.subColor, data.modalBg);
    const btnContrast = getContrastRatio(data.btnColor, data.btnBg);

    results.push({
      theme,
      title: `${titleContrast}:1 (${titleContrast >= 4.5 ? '✅ Pass AA' : '⚠️ ' + titleContrast})`,
      subtitle: `${subContrast}:1 (${subContrast >= 4.5 ? '✅ Pass AA' : '⚠️ ' + subContrast})`,
      btn: `${btnContrast}:1 (${btnContrast >= 4.5 ? '✅ Pass AA' : '⚠️ ' + btnContrast})`,
      titleColor: data.titleColor,
      modalBg: data.modalBg
    });
  }

  await browser.close();

  fs.rmSync('d:/SMM_plan_2/src/app/theme-contrast-final', { recursive: true, force: true });
  fs.rmSync('d:/SMM_plan_2/scripts/audit-wcag-contrast-final.ts', { force: true });

  console.log('--- FINAL WCAG 2.2 AUDIT RESULTS ---');
  console.table(results.map(r => ({
    'Тема': r.theme,
    'Заголовок (H2)': r.title,
    'Подзаголовок (Muted)': r.subtitle,
    'Кнопка действия': r.btn
  })));
}

main().catch(err => {
  console.error('Audit failure:', err);
  process.exit(1);
});
