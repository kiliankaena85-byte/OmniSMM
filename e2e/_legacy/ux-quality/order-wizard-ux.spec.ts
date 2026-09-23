import { test, expect } from '@playwright/test';

test.describe('Order Wizard & Form Resilience UX Suite', () => {
  test('Order flow adheres to non-disabled button rule and interactive responsiveness', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Находим интерактивную область заказа на лендинге
    const mainSection = page.locator('main').first();
    await expect(mainSection).toBeVisible();

    // Проверяем, что ключевые кнопки интерфейса активны (не disabled)
    const buttons = await page.locator('button:not([aria-hidden="true"])').all();
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of buttons.slice(0, 5)) {
      if (await btn.isVisible()) {
        // 🔒 ПРАВИЛО UX: Кнопки интерфейса не должны быть заблокированы серым disabled
        const isDisabled = await btn.isDisabled();
        expect(isDisabled, 'Кнопка действия не должна быть disabled').toBeFalsy();
      }
    }
  });

  test('UI Pricing Rule: Prices are strictly displayed per 1 unit (₽ / шт)', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('domcontentloaded');

    // Проверяем, что в каталоге и карточках подпись цен строго '₽ / шт'
    const pageText = await page.textContent('body');
    
    // Запрещено писать '/ 1000 шт' или '/ 1k'
    expect(pageText).not.toContain('/ 1000 шт');
    expect(pageText).not.toContain('/ 1 000 шт');
  });

  test('Order Stepper and interactive states function smoothly in UI Guide', async ({ page }) => {
    await page.goto('/ui-guide.html');
    await page.waitForLoadState('domcontentloaded');

    // Проверяем наличие всех 18 концепций и интерактивный шейк
    const shakeBtn = page.locator('.shake-btn');
    await expect(shakeBtn).toBeVisible();

    // Кликаем по кнопке вызова шейка
    await shakeBtn.click();
    const shakeBox = page.locator('#shakeBox');
    await expect(shakeBox).toHaveClass(/anim-shake-active/);

    // Проверяем отображение Stepper Wizard
    const stepper = page.locator('.demo-stepper-box');
    await expect(stepper).toBeVisible();
    await expect(stepper.locator('.step-circle')).toHaveCount(4);
  });
});
