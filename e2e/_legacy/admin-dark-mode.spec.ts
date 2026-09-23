import { test, expect } from '@playwright/test';

test.describe('Admin Dark Mode Switching', () => {
  test('Admin can toggle dark mode and verify HTML classes', async ({ page }) => {
    page.on('pageerror', error => console.error('PAGE ERROR:', error));
    page.on('console', msg => {
      if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
    });

    // 1. Go to /admin/dashboard
    await page.goto('/admin/dashboard');

    // Hide Next.js dev indicator portal to avoid pointer event interception
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });

    // 2. Verify that the admin dashboard layout is loaded
    await expect(page.locator('#main-content')).toBeVisible();

    // 3. Click the collapsed theme toggle button (starts in light mode)
    const collapsedToggleBtn = page.getByRole('button', { name: 'Переключить тему', exact: true });
    await expect(collapsedToggleBtn).toBeVisible();
    await collapsedToggleBtn.click();

    // 4. Verify that the html element has class "dark"
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // 5. Expand the sidebar to test the expanded theme switcher
    const expandSidebarBtn = page.getByRole('button', { name: 'Развернуть меню', exact: true });
    await expect(expandSidebarBtn).toBeVisible();
    await expandSidebarBtn.click();

    // 6. Click the "Светлая тема" button in the expanded switcher
    const lightToggleBtn = page.getByRole('button', { name: 'Светлая тема', exact: true });
    await expect(lightToggleBtn).toBeVisible();
    await lightToggleBtn.click();

    // 7. Verify that it switched back and does not have the dark class
    await expect(htmlElement).not.toHaveClass(/dark/);
  });
});
