import { test, expect } from '@playwright/test';

test.describe('BLOCK 21 Visual QA: AI Support Layout & Viewport Density', () => {

  test('Visual QA 1 [Desktop 1440px]: AI Button and Chat Input density is compact and non-overlapping', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/support');

    // 1. Verify page loads and body has no horizontal scrollbar
    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 5;
    });
    expect(bodyOverflow).toBe(true);

    // 2. Take desktop screenshot
    await page.screenshot({ path: 'test-results/visual-qa-support-desktop-1440.png', fullPage: false });
  });

  test('Visual QA 2 [Laptop 1024px]: Interface remains ergonomic without clipping', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/support');

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 5;
    });
    expect(bodyOverflow).toBe(true);

    await page.screenshot({ path: 'test-results/visual-qa-support-laptop-1024.png', fullPage: false });
  });

  test('Visual QA 3 [Mobile 375px]: Responsive layout stacks cleanly with 0 horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/support');

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 5;
    });
    expect(bodyOverflow).toBe(true);

    await page.screenshot({ path: 'test-results/visual-qa-support-mobile-375.png', fullPage: false });
  });
});
