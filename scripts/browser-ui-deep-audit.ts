import { chromium, Page } from 'playwright';

interface AuditResult {
  url: string;
  viewport: string;
  status: number;
  horizontalOverflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  consoleErrors: string[];
  failedRequests: string[];
  interactiveChecks: {
    heroInputFound?: boolean;
    canTypeLink?: boolean;
    autoDetectTriggered?: boolean;
    commandKOpened?: boolean;
    touchTargetsViolationsCount?: number;
  };
  passed: boolean;
}

const VIEWPORTS = [
  { name: 'Mobile SE (375x667)', width: 375, height: 667 },
  { name: 'Mobile iPhone 14 (390x844)', width: 390, height: 844 },
  { name: 'Tablet iPad (768x1024)', width: 768, height: 1024 },
  { name: 'Desktop (1440x900)', width: 1440, height: 900 },
];

const PAGES_TO_AUDIT = [
  '/',
  '/services/vk',
  '/services/vk/vk-podpischiki-uchastniki',
  '/services/telegram',
  '/dashboard/new-order',
  '/client-demo'
];

async function runBrowserAudit() {
  console.log('================================================================');
  console.log('🌐 AUTOMATED BROWSER UI & ERROR AUDIT (PLAYWRIGHT HEADLESS)');
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results: AuditResult[] = [];

  for (const pagePath of PAGES_TO_AUDIT) {
    const fullUrl = `http://localhost:3000${pagePath}`;
    console.log(`\n🔍 Auditing Route: ${pagePath}`);

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15'
      });

      const page = await context.newPage();
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('requestfailed', req => {
        // Ignore aborted telemetry/favicon if any
        if (!req.url().includes('favicon') && !req.url().includes('analytics')) {
          failedRequests.push(`${req.method()} ${req.url()} (${req.failure()?.errorText})`);
        }
      });

      page.on('response', res => {
        if (res.status() >= 400 && !res.url().includes('favicon')) {
          failedRequests.push(`HTTP ${res.status()} on ${res.url()}`);
        }
      });

      let status = 200;
      try {
        const response = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        status = response?.status() || 200;
        await page.waitForTimeout(800); // Allow react hydration and animations
      } catch (err: any) {
        consoleErrors.push(`Navigation failed: ${err.message}`);
        status = 500;
      }

      // Check horizontal overflow
      const overflowMetrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const scrollWidth = docEl.scrollWidth;
        const clientWidth = docEl.clientWidth;
        const bodyWidth = document.body.scrollWidth;
        const maxScroll = Math.max(scrollWidth, bodyWidth);
        return {
          scrollWidth: maxScroll,
          clientWidth,
          hasOverflow: maxScroll > clientWidth + 1
        };
      });

      // Check Touch Target violations (< 44px on mobile)
      const touchTargetViolations = await page.evaluate((isMobile) => {
        if (!isMobile) return 0;
        let violations = 0;
        const clickables = document.querySelectorAll('button, a, input, select');
        clickables.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            // Check if interactive element is too small (< 28px without padding)
            if (rect.width < 28 || rect.height < 28) {
              violations++;
            }
          }
        });
        return violations;
      }, vp.width < 500);

      // Perform Interactive Checks on specific pages
      const interactive: any = { touchTargetsViolationsCount: touchTargetViolations };

      if (pagePath === '/dashboard/new-order') {
        const heroInput = await page.$('input[placeholder*="Вставьте ссылку"]');
        interactive.heroInputFound = !!heroInput;

        if (heroInput) {
          await heroInput.fill('https://vk.com/wall-1_1');
          await page.waitForTimeout(400);
          const val = await heroInput.inputValue();
          interactive.canTypeLink = val.includes('vk.com');
          // Check if auto-detect changed network
          const isVkDetected = await page.evaluate(() => {
            return document.body.innerText.includes('ВКонтакте');
          });
          interactive.autoDetectTriggered = isVkDetected;
        }

        // Test Command K shortcut
        if (vp.width > 700) {
          await page.keyboard.press('Control+k');
          await page.waitForTimeout(500);
          const cmdDialog = await page.$('[role="dialog"], [data-cmdk-root]');
          interactive.commandKOpened = !!cmdDialog;
          await page.keyboard.press('Escape');
        }
      }

      const passed = !overflowMetrics.hasOverflow && consoleErrors.length === 0 && failedRequests.length === 0;

      const auditEntry: AuditResult = {
        url: pagePath,
        viewport: vp.name,
        status,
        horizontalOverflow: overflowMetrics.hasOverflow,
        scrollWidth: overflowMetrics.scrollWidth,
        clientWidth: overflowMetrics.clientWidth,
        consoleErrors,
        failedRequests,
        interactiveChecks: interactive,
        passed
      };

      results.push(auditEntry);

      console.log(`  [${passed ? 'PASS ✅' : 'FAIL ⚠️'}] ${vp.name} | Overflow: ${overflowMetrics.hasOverflow ? `YES (${overflowMetrics.scrollWidth}px > ${overflowMetrics.clientWidth}px)` : 'NO'} | Errors: ${consoleErrors.length} | 404s: ${failedRequests.length}`);
      if (consoleErrors.length > 0) {
        console.log(`      🔴 Console Errors:`, consoleErrors.slice(0, 3));
      }
      if (failedRequests.length > 0) {
        console.log(`      🟠 Failed Requests:`, failedRequests.slice(0, 3));
      }

      await context.close();
    }
  }

  await browser.close();

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  console.log('\n================================================================');
  console.log(`🏆 AUDIT SUMMARY: ${passedTests} / ${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  if (passedTests < totalTests) {
    console.log('⚠️ Identified UI/Runtime issues to resolve:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`- ${r.url} on ${r.viewport}:`);
      if (r.horizontalOverflow) console.log(`   * Horizontal overflow: ${r.scrollWidth}px vs ${r.clientWidth}px`);
      if (r.consoleErrors.length) console.log(`   * Console: ${r.consoleErrors.join(', ')}`);
      if (r.failedRequests.length) console.log(`   * Network: ${r.failedRequests.join(', ')}`);
    });
  }
}

runBrowserAudit().catch(console.error);
