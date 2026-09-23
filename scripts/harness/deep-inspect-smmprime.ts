import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function inspect() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  
  try {
    await page.goto('https://smmprime.ru', { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      await page.waitForLoadState('networkidle', { timeout: 8000 });
    } catch {}

    const data = await page.evaluate(() => {
      const title = document.title;
      const h1 = document.querySelector('h1')?.textContent?.trim() || '';
      
      // Header & Navigation
      const navItems = Array.from(document.querySelectorAll('header nav a, .header__nav a, nav a')).map(a => ({
        text: a.textContent?.trim() || '',
        href: a.getAttribute('href') || ''
      })).filter(a => a.text.length > 0);

      // Hero subtitle / text
      const heroText = Array.from(document.querySelectorAll('header p, .hero p, main p')).slice(0, 5).map(p => p.textContent?.trim()).filter(Boolean);

      // Main sections
      const sections = Array.from(document.querySelectorAll('section, main > div')).map(s => {
        const title = s.querySelector('h2, h3, h4')?.textContent?.trim() || '';
        return {
          id: s.id || '',
          className: (s.className || '').slice(0, 100),
          title
        };
      }).filter(s => s.title.length > 0);

      // Buttons / CTAs
      const ctas = Array.from(document.querySelectorAll('button, a.btn, a[class*="button"]')).slice(0, 15).map(btn => ({
        text: btn.textContent?.trim() || '',
        tag: btn.tagName.toLowerCase()
      })).filter(b => b.text.length > 0);

      return {
        title,
        h1,
        heroText,
        navItemsCount: navItems.length,
        navItems: navItems.slice(0, 25),
        sections,
        ctas
      };
    });

    console.log(JSON.stringify(data, null, 2));
    fs.writeFileSync(
      path.resolve(process.cwd(), '.planning/screenshots/smmprime_deep_inspect.json'),
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  } catch (err: unknown) {
    console.error('Error during inspection:', err);
  } finally {
    await browser.close();
  }
}

inspect();
