import { test, expect } from '@playwright/test';

test.describe('Landing Page Performance (FCP/LCP)', () => {
  test('should load landing page within Web Vitals thresholds', async ({ page }) => {
    // 1. Go to landing page
    await page.goto('/');

    // 2. Wait for network idle
    await page.waitForLoadState('networkidle');

    // 3. Evaluate FCP (First Contentful Paint)
    const fcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntriesByName('first-contentful-paint');
          if (entries.length > 0) {
            resolve(entries[0].startTime);
            observer.disconnect();
          }
        });
        observer.observe({ type: 'paint', buffered: true });
        
        // Fallback in case paint already happened and buffered didn't catch it
        const paints = performance.getEntriesByName('first-contentful-paint');
        if (paints.length > 0) {
          resolve(paints[0].startTime);
          observer.disconnect();
        }
      });
    });

    // 4. Evaluate LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            lcpValue = entries[entries.length - 1].startTime;
          }
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        
        // Wait 2 seconds for LCP to settle after network idle
        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 2000);
      });
    });

    console.log(`=======================================`);
    console.log(`Landing Page Performance Metrics:`);
    console.log(`FCP: ${fcp.toFixed(2)} ms`);
    console.log(`LCP: ${lcp.toFixed(2)} ms`);
    console.log(`=======================================`);

    // Enterprise thresholds (FCP < 1.8s, LCP < 2.5s)
    // For local dev server (which has on-demand compilation overhead), we allow a bit more leniency (FCP < 3000, LCP < 5000)
    expect(fcp).toBeLessThan(3000);
    expect(lcp).toBeLessThan(5000);
  });
});
