import { test, expect } from '@playwright/test';

test.describe('Mobile UX, Touch Targets & Layout Density Suite', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Action buttons satisfy touch target requirements on mobile', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Проверяем высоту ключевых кнопок действий в основном контенте с текстом
    const primaryButtons = await page.locator('main button:not([aria-hidden="true"]), form button').all();
    
    for (const btn of primaryButtons) {
      if (await btn.isVisible()) {
        const text = (await btn.textContent())?.trim() || '';
        // Проверяем только текстовые кнопки действий (не микро-иконки или скрытые служебные триггеры)
        if (text.length > 2) {
          const box = await btn.boundingBox();
          if (box && box.height > 0) {
            expect(box.height, `Кнопка "${text}" имеет слишком малую высоту ${box.height}px`).toBeGreaterThanOrEqual(28);
          }
        }
      }
    }
  });

  test('No horizontal scroll overflow on mobile viewport (375px)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Проверяем, что ширина body не превышает ширину окна (нет горизонтальной прокрутки)
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(isOverflowing, 'Обнаружена горизонтальная полоса прокрутки на мобильном экране 375px').toBeFalsy();
  });
});
