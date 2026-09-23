import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const db = new PrismaClient();
const artifactsDir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\3e9be262-5d53-455f-a65b-d53218850f1f';

test.describe('BLOCK 22: Comprehensive Ticket System & AI Visual Capture', () => {
  let adminUser: any;
  let clientUser: any;
  let testTicket: any;

  test.beforeAll(async () => {
    // 1. Create client
    clientUser = await db.user.create({
      data: {
        email: `visual-client-${Date.now()}@smmplan.pro`,
        tenantId: 'smmplan',
        role: 'USER',
        balance: 15000,
        isActive: true,
      },
    });

    // 2. Create staff admin
    adminUser = await db.user.create({
      data: {
        email: `visual-admin-${Date.now()}@smmplan.pro`,
        tenantId: 'smmplan',
        role: 'ADMIN',
        isActive: true,
      },
    });

    // 3. Create active test ticket
    testTicket = await db.ticket.create({
      data: {
        tenantId: 'smmplan',
        userId: clientUser.id,
        subject: 'Instagram Followers Order #1042 Canceled',
        status: 'OPEN',
        messages: {
          create: [
            {
              sender: 'USER',
              text: 'Здравствуйте! Заказывал 1000 подписчиков в Instagram на профиль https://instagram.com/my_shop. Заказ сразу отменился, почему? Аккаунт открыт!',
            },
          ],
        },
      },
    });
  });

  test.afterAll(async () => {
    if (testTicket?.id) {
      await db.ticketMessage.deleteMany({ where: { ticketId: testTicket.id } }).catch(() => {});
      await db.ticket.deleteMany({ where: { id: testTicket.id } }).catch(() => {});
    }
    await db.user.deleteMany({ where: { id: { in: [clientUser?.id, adminUser?.id].filter(Boolean) } } }).catch(() => {});
    await db.$disconnect();
  });

  test('Capture 1: Admin Tickets List View', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/tickets');
    await page.waitForTimeout(1000);

    const outPath = path.join(artifactsDir, 'ticket_admin_list_view.png');
    await page.screenshot({ path: outPath, fullPage: false });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('Capture 2: Admin Single Ticket Workspace with AI & Chat Input', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/admin/tickets/${testTicket.id}`);
    await page.waitForTimeout(1000);

    const outPath = path.join(artifactsDir, 'ticket_admin_workspace_ai.png');
    await page.screenshot({ path: outPath, fullPage: false });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('Capture 3: Client Dashboard Tickets View', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard/tickets');
    await page.waitForTimeout(1000);

    const outPath = path.join(artifactsDir, 'ticket_client_dashboard_view.png');
    await page.screenshot({ path: outPath, fullPage: false });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('Capture 4: Mobile Responsive Ticket View (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/admin/tickets/${testTicket.id}`);
    await page.waitForTimeout(1000);

    const outPath = path.join(artifactsDir, 'ticket_mobile_375px_view.png');
    await page.screenshot({ path: outPath, fullPage: false });
    expect(fs.existsSync(outPath)).toBe(true);
  });

  test('Capture 5: Admin Settings Integrations (AI Kill-Switch Section)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/settings');
    await page.waitForTimeout(1000);

    const outPath = path.join(artifactsDir, 'admin_settings_ai_killswitch.png');
    await page.screenshot({ path: outPath, fullPage: false });
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
