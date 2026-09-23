import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.describe('Support Tickets Flow', () => {

  test('Optimistic UI: Admin replies to a ticket', async ({ page }) => {
    // 1. Seed a test user and an OPEN ticket
    const prisma = new PrismaClient();
    let testUser = await prisma.user.findFirst({ where: { email: 'e2e_ticket_user@test.local' } });
    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'e2e_ticket_user@test.local',
          tenantId: 'smmplan',
          role: 'USER',
        }
      });
    }

    let ticket = await prisma.ticket.findFirst({
      where: { subject: 'E2E Test Ticket' }
    });

    if (!ticket) {
      ticket = await prisma.ticket.create({
        data: {
          subject: 'E2E Test Ticket',
          status: 'OPEN',
          userId: testUser.id,
          messages: {
            create: {
              text: 'I need help with my E2E order.',
              sender: 'USER',
            }
          }
        }
      });
    } else {
      // Ensure it's OPEN
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'OPEN' }
      });
    }
    await prisma.$disconnect();

    // 2. Go to the ticket page
    await page.goto(`/admin/tickets/${ticket.id}`);

    // 3. Verify ticket subject is visible
    await expect(page.getByText('E2E Test Ticket').first()).toBeVisible({ timeout: 10000 });

    // 4. Find the textarea and send a message
    const messageInput = page.getByPlaceholder(/Введите ваше сообщение/i).first();
    await expect(messageInput).toBeVisible();
    await messageInput.fill('Hello from Playwright E2E');

    // Submit the form
    const submitButton = page.locator('button[type="submit"], button:has-text("Отправить"), button[aria-label="Отправить"]').first();
    await submitButton.click();

    // 5. Verify optimistic UI - message should appear immediately
    const messageText = page.getByText('Hello from Playwright E2E').first();
    await expect(messageText).toBeVisible({ timeout: 5000 });

    // 6. Verify ticket status changed to PENDING in the database
    // We wait for the server action to persist. 1s might be too short for slow systems.
    let updatedTicket = null;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const prismaValidate = new PrismaClient();
      updatedTicket = await prismaValidate.ticket.findUnique({
        where: { id: ticket.id }
      });
      await prismaValidate.$disconnect();
      if (updatedTicket?.status === 'PENDING') break;
    }
    
    expect(updatedTicket?.status).toBe('PENDING');
  });

});

test.describe('Telegram Support Binding Flows', () => {
  
  test('Level 1: Generate Smart Bind token for authenticated user', async ({ request }) => {
    const response = await request.get('/api/support/telegram', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    
    const location = response.headers().location;
    expect(location).toContain('t.me/');
    expect(location).toContain('?start=tg_bind_');

    const tokenStr = location?.split('tg_bind_')[1];
    expect(tokenStr).toBeTruthy();
    
    const prisma = new PrismaClient();
    const token = await prisma.authToken.findUnique({
      where: { token: `tg_bind_${tokenStr}` }
    });
    await prisma.authToken.delete({ where: { token: `tg_bind_${tokenStr}` } }).catch(() => {});
    await prisma.$disconnect();
    
    expect(token).toBeTruthy();
    expect(token?.used).toBe(false);
  });

  test('Level 2 & 3: Admin UI Request Auth & Manual Bind', async ({ page }) => {
    const prisma = new PrismaClient();
    
    let tempUser = await prisma.user.findFirst({ where: { email: 'tg_99999@smmplan.bot' } });
    if (!tempUser) {
      tempUser = await prisma.user.create({
        data: {
          email: 'tg_99999@smmplan.bot',
          tenantId: 'smmplan',
          telegramId: '99999',
          role: 'USER',
        }
      });
    } else {
      await prisma.user.update({
        where: { id: tempUser.id },
        data: { telegramId: '99999' }
      });
    }

    const ticket = await prisma.ticket.create({
      data: {
        subject: 'E2E Telegram Ticket',
        status: 'OPEN',
        userId: tempUser.id,
      }
    });
    
    let webUser = await prisma.user.findFirst({ where: { email: 'e2e_target_web@test.local' } });
    if (!webUser) {
      // eslint-disable-next-line no-useless-assignment
      webUser = await prisma.user.create({
        data: {
          email: 'e2e_target_web@test.local',
          tenantId: 'smmplan',
          role: 'USER',
        }
      });
    }

    await prisma.$disconnect();

    await page.goto(`/admin/tickets/${ticket.id}`);

    // Capture browser logs
    page.on('console', msg => console.log(`[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`));

    // Verify sidebar is visible and shows the temp user
    await expect(page.getByText('Временный профиль')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'tg_99999@smmplan.bot' })).toBeVisible();

    // Level 2: Request Auth Magic Link
    const requestAuthBtn = page.getByRole('button', { name: /Отправить ссылку для привязки/i });
    await expect(requestAuthBtn).toBeVisible();
    
    // Stability wait to ensure hydration and avoid Fast Refresh issues
    await page.waitForTimeout(2000);
    
    await requestAuthBtn.click();
    
    // Wait for the message to appear in the chat window
    await expect(page.getByText(/подтвердите владение заказом/i)).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000); // Allow Next.js revalidation to fully finish and DOM to settle

    // Level 3: Manual Bind
    const manualEmailInput = page.getByPlaceholder('email@client.ru');
    await expect(manualEmailInput).toBeVisible();
    await expect(manualEmailInput).toBeEnabled({ timeout: 10000 });
    await manualEmailInput.fill('e2e_target_web@test.local');
    
    const manualSubmitBtn = page.locator('#manual-bind-submit');
    await expect(manualSubmitBtn).toBeEnabled({ timeout: 10000 });
    await manualSubmitBtn.click();

    // Wait for confirmation block to appear and click 'Слить'
    const confirmBtn = page.locator('#manual-bind-confirm');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    
    // Wait for bind to complete in DB
    let deletedTempUser = null;
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1500);
      const pCheck = new PrismaClient();
      deletedTempUser = await pCheck.user.findFirst({ where: { email: 'tg_99999@smmplan.bot' } });
      await pCheck.$disconnect();
      if (deletedTempUser === null) break;
    }
    expect(deletedTempUser).toBeNull();
    
    const finalPrisma = new PrismaClient();
    const updatedWebUser = await finalPrisma.user.findFirst({ 
      where: { email: 'e2e_target_web@test.local' },
      include: { tickets: true }
    });
    
    expect(updatedWebUser?.telegramId).toBe('99999');
    expect(updatedWebUser?.tickets.some(t => t.id === ticket.id)).toBe(true);

    // Clean up
    await finalPrisma.ticketMessage.deleteMany({ where: { ticketId: ticket.id } });
    await finalPrisma.ticket.deleteMany({ where: { id: ticket.id } });
    await finalPrisma.user.update({ where: { id: updatedWebUser!.id }, data: { telegramId: null } });
    await finalPrisma.user.delete({ where: { id: updatedWebUser!.id } });
    await finalPrisma.$disconnect();
  });
});

