import { test, expect } from '@playwright/test';
import { scanPageA11y } from '../utils/a11y-scanner';

test.describe('Accessibility & WCAG 2.2 Level AA Quality Gate', () => {
  test('Landing Page satisfies WCAG 2.2 AA accessibility requirements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const result = await scanPageA11y(page);
    const criticalOrSerious = result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    
    expect(criticalOrSerious, `Обнаружены критические нарушения доступности: ${JSON.stringify(criticalOrSerious, null, 2)}`).toHaveLength(0);
  });

  test('UI Guide (/ui-guide.html) satisfies WCAG 2.2 AA accessibility requirements', async ({ page }) => {
    await page.goto('/ui-guide.html');
    await page.waitForLoadState('domcontentloaded');

    const result = await scanPageA11y(page);
    const criticalOrSerious = result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    
    expect(criticalOrSerious, `Нарушения доступности в интерактивном атласе: ${JSON.stringify(criticalOrSerious, null, 2)}`).toHaveLength(0);
  });

  test('Catalog Page satisfies WCAG 2.2 AA accessibility requirements', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    const result = await scanPageA11y(page);
    const criticalOrSerious = result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    
    expect(criticalOrSerious, `Нарушения доступности в каталоге: ${JSON.stringify(criticalOrSerious, null, 2)}`).toHaveLength(0);
  });
});
