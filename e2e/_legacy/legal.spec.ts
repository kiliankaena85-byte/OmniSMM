/**
 * e2e/legal.spec.ts
 * Legal Pages E2E Tests — /legal/* routes content, 152-FZ, 54-FZ, offer, absolute canonicals.
 */

import { test, expect } from '@playwright/test';

test.describe('Legal Pages E2E Suite', () => {
  const legalRoutes = [
    { path: '/legal/terms', keyword: /Условия|Пользовательское|Соглашение|Оферт/i, name: 'Terms of Service' },
    { path: '/legal/privacy', keyword: /Политика|Конфиденциальност|152-ФЗ|Персональн/i, name: 'Privacy Policy' },
    { path: '/legal/refund', keyword: /Возврат|Возврата|Правила|Отмен/i, name: 'Refund Policy' },
    { path: '/legal/cookies', keyword: /Cookie|Куки/i, name: 'Cookie Policy' },
    { path: '/legal/service-rules', keyword: /Правила|Запрещ/i, name: 'Service Rules' },
  ];

  for (const route of legalRoutes) {
    test(`${route.name} (${route.path}) returns 200, renders content, has keyword and absolute canonical`, async ({ page, baseURL }) => {
      const response = await page.goto(route.path);
      
      // 1. Status 200 and not redirect to 404
      expect(response?.status()).toBe(200);
      await expect(page).not.toHaveURL(/404|_not-found/);

      // 2. Contains legal keywords
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toMatch(route.keyword);

      // 3. Absolute canonical URL starting with http(s)://
      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      const canonicalHref = await canonical.getAttribute('href');
      expect(canonicalHref).toBeTruthy();
      expect(canonicalHref).toMatch(/^https?:\/\//);
      expect(canonicalHref).not.toContain('lovable.pro');
    });
  }
});
