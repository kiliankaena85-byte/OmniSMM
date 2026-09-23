/**
 * Antigravity Full Desktop UI Capture & Structure Analyzer Harness
 *
 * Инструмент для надежного анализа и захвата веб-интерфейсов:
 * - Принудительный десктопный Viewport (1920x1080 @2x) — гарантирует рендер боковых панелей (Desktop Sidebar)
 * - Ожидание сетевой активности (networkidle) и гидратации DOM
 * - Извлечение структуры навигации (Aside/Sidebar/Nav/Header)
 * - Сохранение скриншотов с сохранением fixed/sticky элементов
 *
 * Использование:
 *   npx tsx scripts/harness/capture-full-ui.ts <url> [--output=dir] [--timeout=30000]
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedNavSection {
  tag: string;
  className: string;
  links: Array<{ text: string; href: string }>;
  subHeadings: string[];
}

interface PageAnalysisResult {
  url: string;
  title: string;
  viewport: { width: number; height: number };
  timestamp: string;
  hasSidebar: boolean;
  navSections: ExtractedNavSection[];
  screenshotPath?: string;
  summary: string;
}

async function run() {
  const args = process.argv.slice(2);
  const targetUrl = args.find((a) => !a.startsWith('--')) || 'http://localhost:3000';
  const outputArg = args.find((a) => a.startsWith('--output='));
  const outputDir = outputArg ? outputArg.split('=')[1] : path.resolve(process.cwd(), '.planning/screenshots');

  console.log('\n==================================================================');
  console.log('🖥️  ANTIGRAVITY FULL DESKTOP UI CAPTURE & ANALYZER HARNESS');
  console.log('==================================================================');
  console.log(`🌐 Target URL : \x1b[36m${targetUrl}\x1b[0m`);
  console.log(`📁 Output Dir : ${outputDir}\n`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('⏳ Навигация к целевому адресу и ожидание загрузки...');
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Ожидание сетевой активности и гидратации
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      console.log('ℹ️  Network idle timeout (страница содержит фоновые запросы, продолжаем)...');
    }

    const title = await page.title();
    const status = response?.status() || 0;
    console.log(`✅ Страница загружена. Статус: ${status} | Заголовок: "${title}"`);

    // Анализ DOM структуры навигации и сайдбаров
    const analysis: PageAnalysisResult = await page.evaluate((url) => {
      const asideElements = Array.from(document.querySelectorAll('aside, [role="navigation"], nav, [data-sidebar], .sidebar'));
      
      const navSections: ExtractedNavSection[] = asideElements.map((el) => {
        const links = Array.from(el.querySelectorAll('a')).map((a) => ({
          text: (a.textContent || '').trim().replace(/\s+/g, ' '),
          href: a.getAttribute('href') || '',
        })).filter((l) => l.text.length > 0);

        const subHeadings = Array.from(el.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-sidebar-group]')).map(
          (h) => (h.textContent || '').trim()
        ).filter(Boolean);

        return {
          tag: el.tagName.toLowerCase(),
          className: el.className || '',
          links,
          subHeadings,
        };
      });

      return {
        url,
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        timestamp: new Date().toISOString(),
        hasSidebar: asideElements.length > 0,
        navSections,
        summary: `Обнаружено ${asideElements.length} секций навигации/сайдбаров и ${navSections.reduce((acc, s) => acc + s.links.length, 0)} ссылок.`,
      };
    }, targetUrl);

    // Скриншот первого экрана с десктопным сайдбаром
    const sanitizedName = targetUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const screenshotPath = path.join(outputDir, `capture_${sanitizedName}_1920x1080.png`);
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: false, // Desktop viewport capture (1920x1080) для идеального отображения fixed сайдбаров
    });

    analysis.screenshotPath = screenshotPath;

    // Сохранение JSON отчёта
    const reportPath = path.join(outputDir, `analysis_${sanitizedName}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2), 'utf-8');

    console.log('\n📊 Результаты анализа:');
    console.log(`  - Сайдбар обнаружен: ${analysis.hasSidebar ? '\x1b[32mДА\x1b[0m' : '\x1b[33mНЕТ (или скрыт)\x1b[0m'}`);
    console.log(`  - Секций навигации : ${analysis.navSections.length}`);
    console.log(`  - Скриншот сохранен: \x1b[34m${screenshotPath}\x1b[0m`);
    console.log(`  - JSON анализ      : \x1b[34m${reportPath}\x1b[0m\n`);

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Ошибка во время захвата: ${errorMsg}`);
  } finally {
    await browser.close();
  }
}

run();
