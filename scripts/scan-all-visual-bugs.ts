import { chromium } from 'playwright';

interface VisualBug {
  category: 'OVERLAP' | 'TEXT_CLIPPED' | 'ICON_DISTORTED' | 'OVERFLOW_SCREEN' | 'MISALIGNED';
  route: string;
  viewport: string;
  selector: string;
  textSnippet: string;
  details: string;
}

const VIEWPORTS = [
  { name: 'Mobile Mini (320x600)', width: 320, height: 600 },
  { name: 'Mobile iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'Mobile iPhone 14 (390x844)', width: 390, height: 844 },
  { name: 'Tablet iPad (768x1024)', width: 768, height: 1024 },
  { name: 'Desktop HD (1440x900)', width: 1440, height: 900 },
];

const ROUTES = [
  '/',
  '/services/vk',
  '/services/vk/vk-podpischiki-uchastniki',
  '/services/telegram',
  '/services/instagram',
  '/dashboard',
  '/dashboard/new-order',
  '/dashboard/orders',
  '/dashboard/add-funds',
  '/dashboard/referrals',
  '/dashboard/transactions',
  '/dashboard/settings',
];

async function scanVisualBugs() {
  console.log('================================================================');
  console.log('🔬 DEEP VISUAL BUG & ARTIFACT SCANNER (PLAYWRIGHT)');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const allBugs: VisualBug[] = [];

  for (const route of ROUTES) {
    const url = `http://localhost:3000${route}`;
    console.log(`\n🔎 Scanning Route: ${route}`);

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(600); // allow animations & hydration
      } catch (err: any) {
        console.log(`  ❌ Failed to load ${route} on ${vp.name}: ${err.message}`);
        await context.close();
        continue;
      }

      // 1. Scan for Elements overflowing the viewport horizontally
      const overflowBugs = await page.evaluate((vpName) => {
        const bugs: any[] = [];
        const winWidth = window.innerWidth;
        const allElements = document.querySelectorAll('body *');

        allElements.forEach((el) => {
          // Ignore SVG defs, scripts, styles, hidden
          if (['SCRIPT', 'STYLE', 'DEFS', 'PATH', 'G', 'SYMBOL'].includes(el.tagName)) return;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          // Check if right edge exceeds screen width by > 2px
          if (rect.right > winWidth + 2 && !el.classList.contains('overflow-x-auto') && !el.closest('.overflow-x-auto')) {
            // Only report direct parent or leaf
            if (el.children.length === 0 || (el.tagName === 'DIV' && el.classList.length > 0)) {
              bugs.push({
                category: 'OVERFLOW_SCREEN',
                selector: `${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0, 3).join('.')}`,
                textSnippet: (el.textContent || '').trim().slice(0, 40),
                details: `Element right edge (${Math.round(rect.right)}px) exceeds viewport width (${winWidth}px)`
              });
            }
          }
        });
        return bugs.slice(0, 5); // limit per page
      }, vp.name);

      overflowBugs.forEach(b => allBugs.push({ ...b, route, viewport: vp.name }));

      // 2. Scan for Distorted SVGs / Icons (e.g. squished icons without shrink-0)
      const iconBugs = await page.evaluate(() => {
        const bugs: any[] = [];
        const svgs = document.querySelectorAll('svg');

        svgs.forEach((svg) => {
          const rect = svg.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          // Check if SVG is intended to be square (ratio != 1.0 by > 20%)
          // (exclude horizontal logos or banners)
          const isSquareType = rect.width < 50 && rect.height < 50;
          if (isSquareType) {
            const ratio = rect.width / rect.height;
            if (ratio < 0.75 || ratio > 1.35) {
              bugs.push({
                category: 'ICON_DISTORTED',
                selector: `svg.${Array.from(svg.classList).join('.')}`,
                textSnippet: svg.parentElement?.textContent?.trim().slice(0, 30) || 'icon',
                details: `Icon squished: width ${Math.round(rect.width)}px vs height ${Math.round(rect.height)}px (ratio: ${ratio.toFixed(2)})`
              });
            }
          }

          // Check if icon is too tiny (< 10px) due to missing shrink-0
          if (rect.width > 0 && rect.width < 10 && !svg.closest('.opacity-0')) {
            bugs.push({
              category: 'ICON_DISTORTED',
              selector: `svg.${Array.from(svg.classList).join('.')}`,
              textSnippet: svg.parentElement?.textContent?.trim().slice(0, 30) || 'tiny icon',
              details: `Icon shrunk to ${Math.round(rect.width)}px width due to flex container squeeze`
            });
          }
        });
        return bugs.slice(0, 5);
      });

      iconBugs.forEach(b => allBugs.push({ ...b, route, viewport: vp.name }));

      // 3. Scan for Overlapping Text/Buttons
      const overlapBugs = await page.evaluate(() => {
        const bugs: any[] = [];
        const headings = document.querySelectorAll('h1, h2, h3, h4, label, button, a.btn');

        for (let i = 0; i < headings.length; i++) {
          const a = headings[i];
          const rectA = a.getBoundingClientRect();
          if (rectA.width === 0 || rectA.height === 0 || !rectA.top) continue;

          for (let j = i + 1; j < Math.min(headings.length, i + 8); j++) {
            const b = headings[j];
            if (a.contains(b) || b.contains(a)) continue;
            const rectB = b.getBoundingClientRect();
            if (rectB.width === 0 || rectB.height === 0) continue;

            // Check bounding box intersection
            const overlapX = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
            const overlapY = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
            const overlapArea = overlapX * overlapY;

            if (overlapArea > 50 && overlapX > 15 && overlapY > 8) {
              // Avoid false positives on absolute badges intentionally on top
              const isBadge = a.classList.contains('absolute') || b.classList.contains('absolute');
              if (!isBadge) {
                bugs.push({
                  category: 'OVERLAP',
                  selector: `${a.tagName} & ${b.tagName}`,
                  textSnippet: `"${(a.textContent || '').trim().slice(0, 20)}" vs "${(b.textContent || '').trim().slice(0, 20)}"`,
                  details: `Elements collide with overlap area of ${Math.round(overlapArea)}px²`
                });
              }
            }
          }
        }
        return bugs.slice(0, 3);
      });

      overlapBugs.forEach(b => allBugs.push({ ...b, route, viewport: vp.name }));

      await context.close();
    }
  }

  await browser.close();

  console.log('\n================================================================');
  console.log(`📊 TOTAL VISUAL BUGS DETECTED: ${allBugs.length}`);
  console.log('================================================================\n');

  // Deduplicate and group bugs
  const categorized: Record<string, VisualBug[]> = {
    'OVERFLOW_SCREEN': [],
    'OVERLAP': [],
    'ICON_DISTORTED': [],
    'TEXT_CLIPPED': [],
    'MISALIGNED': []
  };

  allBugs.forEach(b => {
    if (categorized[b.category]) {
      categorized[b.category].push(b);
    }
  });

  Object.entries(categorized).forEach(([cat, bugs]) => {
    console.log(`\n📌 CATEGORY: ${cat} (${bugs.length} issues)`);
    if (bugs.length === 0) {
      console.log('  ✅ No issues detected in this category.');
    } else {
      bugs.forEach((b, idx) => {
        console.log(`  ${idx + 1}. [${b.route}] on ${b.viewport}`);
        console.log(`     Target: ${b.selector} (${b.textSnippet})`);
        console.log(`     Detail: ${b.details}`);
      });
    }
  });
}

scanVisualBugs().catch(console.error);
