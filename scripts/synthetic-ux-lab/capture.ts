import { chromium } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

/**
 * Скрипт двойного захвата (Visual + Semantic) для Синтетической UX-лаборатории
 * Использование: npx tsx scripts/synthetic-ux-lab/capture.ts http://localhost:3000/catalog
 */

async function capture() {
  const url = process.argv[2] || 'http://localhost:3000';
  const outDir = path.join(process.cwd(), '.agent', 'research_data', 'captures');

  // Убеждаемся, что директория существует
  await fs.mkdir(outDir, { recursive: true });

  console.log(`[1/4] Запускаем Headless Chromium...`);
  const browser = await chromium.launch({ headless: true });
  
  // Устанавливаем размер viewport как типичный десктоп
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2, // Retina для четкого скриншота (важно для VLM)
  });
  const page = await context.newPage();

  console.log(`[2/4] Переходим по адресу: ${url}`);
  try {
    // Ждем, пока отрендерится React и утихнет сеть
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    
    // Даем небольшую паузу для микро-анимаций и lazy-load изображений
    await page.waitForTimeout(2000);

    const timestamp = Date.now();
    const screenshotPath = path.join(outDir, `capture_${timestamp}.png`);
    const semanticPath = path.join(outDir, `capture_${timestamp}_semantic.json`);

    console.log(`[3/4] Делаем захват визуала (Screenshot)...`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(`[4/4] Извлекаем семантику (Accessibility Tree)...`);
    const axSnapshot = await page.evaluate(`
      (function() {
        function buildTree(node) {
          if (!node) return null;
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            return text ? { role: 'text', name: text } : null;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return null;
          
          const el = node;
          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const ariaLabel = el.getAttribute('aria-label');
          const ariaHidden = el.getAttribute('aria-hidden');
          
          if (ariaHidden === 'true' || role === 'script' || role === 'style' || role === 'noscript') return null;

          const children = Array.from(node.childNodes)
            .map(child => buildTree(child))
            .filter(Boolean);

          if (!ariaLabel && children.length === 1 && children[0] && children[0].role === 'text') {
              return { role, name: children[0].name };
          }

          const res = { role };
          if (ariaLabel) res.name = ariaLabel;
          if (children.length > 0) res.children = children;
          return res;
        }
        return buildTree(document.body);
      })()
    `);
    
    await fs.writeFile(
      semanticPath, 
      JSON.stringify(axSnapshot, null, 2), 
      'utf-8'
    );

    console.log(`\n✅ Успешно захвачено!`);
    console.log(`📸 Скриншот: ${screenshotPath}`);
    console.log(`🌳 Семантика: ${semanticPath}`);
    console.log(`\nТеперь эти два файла можно передавать в Gemini 3.5 Flash для проведения gsd-usability-test.`);

  } catch (error) {
    console.error('❌ Ошибка при захвате:', error);
  } finally {
    await browser.close();
  }
}

capture();
