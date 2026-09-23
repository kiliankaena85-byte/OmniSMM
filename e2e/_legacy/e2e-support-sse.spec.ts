import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';
import * as fs from 'fs';
import * as path from 'path';

// Clean context (no global setup cookies)
test.use({ storageState: { cookies: [], origins: [] } });

const prisma = new PrismaClient();

test.describe('Support Ticket & SSE Flow', () => {
  const clientEmail = `e2e-client-sse-${Date.now()}@smmplan.local`;
  const clientPassword = 'ClientPassword2026!';
  const operatorEmail = `operator-sse-${Date.now()}@smmplan.test`;
  const operatorPassword = 'SupportPassword2026!';
  const ticketSubject = 'Чат с поддержкой'; // Match seeded subject exactly
  const artifactDir = 'd:/SMM_plan_2/artifacts';

  let clientUser: any = null;
  let operatorUser: any = null;
  let ticket: any = null;

  test.beforeAll(async () => {
    fs.mkdirSync(artifactDir, { recursive: true });

    // Clear rate limits in DB and Redis
    await prisma.rateLimit.deleteMany({}).catch(() => {});
    try {
      const { Redis } = await import('ioredis');
      const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
      await redis.flushdb().catch(() => {});
      await redis.quit().catch(() => {});
    } catch (e) {
      // Ignored
    }

    // 1. Create client
    const hashedClientPassword = await hashPassword(clientPassword);
    clientUser = await prisma.user.create({
      data: {
        email: clientEmail,
        passwordHash: hashedClientPassword,
        role: 'USER',
        balance: 50000,
        isEmailVerified: true,
        isActive: true,
      }
    });

    // 2. Setup operator role
    let supportRole = await prisma.staffRole.findFirst({
      where: { name: 'Support' }
    });
    if (!supportRole) {
      supportRole = await prisma.staffRole.create({
        data: {
          name: 'Support',
          description: 'Старший саппорт оператор',
          isSystem: true
        }
      });
    }

    const sections = ['dashboard', 'clients', 'orders', 'refills', 'tickets'];
    for (const section of sections) {
      await prisma.staffPermission.upsert({
        where: { roleId_section: { roleId: supportRole.id, section } },
        update: { canView: true, canEdit: true },
        create: { roleId: supportRole.id, section, canView: true, canEdit: true }
      });
    }

    // 3. Create operator
    const hashedOperatorPassword = await hashPassword(operatorPassword);
    operatorUser = await prisma.user.create({
      data: {
        email: operatorEmail,
        passwordHash: hashedOperatorPassword,
        role: 'SUPPORT',
        isActive: true,
        isEmailVerified: true,
        staffRoleId: supportRole.id,
      }
    });
  });

  test.afterAll(async () => {
    // Cleanup
    if (ticket) {
      await prisma.ticketMessage.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } }).catch(() => {});
    }
    if (clientUser) {
      await prisma.user.delete({ where: { id: clientUser.id } }).catch(() => {});
    }
    if (operatorUser) {
      await prisma.user.delete({ where: { id: operatorUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('Support ticket chat, operator workspace, real-time message SSE, and closing ticket', async ({ browser }) => {
    // --- 1. Client context ---
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();

    await clientPage.goto('/login');
    await clientPage.locator('#login-email').fill(clientEmail);
    await clientPage.locator('#login-password').fill(clientPassword);
    await clientPage.getByRole('button', { name: 'Войти в кабинет' }).click();
    await expect(clientPage).toHaveURL(/.*dashboard/);

    // Navigate to tickets, should redirect to /dashboard/tickets/[id]
    await clientPage.goto('/dashboard/tickets');
    await clientPage.waitForURL(/\/dashboard\/tickets\/[a-zA-Z0-9_-]+/);

    const clientChatUrl = clientPage.url();
    const ticketId = clientChatUrl.split('/').pop();
    expect(ticketId).toBeTruthy();

    ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    expect(ticket).toBeTruthy();

    // Verify Chat Input fields on client side
    const clientTextArea = clientPage.getByPlaceholder('Опишите вашу проблему...').first();
    await expect(clientTextArea).toBeVisible();

    const clientSubmitBtn = clientPage.locator('button[aria-label="Отправить сообщение"]').first();
    await expect(clientSubmitBtn).toBeVisible();

    // Client sends an initial message
    await clientTextArea.fill('Hello support team, I need help with my balance.');

    // Take screenshot: ticket_created.png
    await clientPage.screenshot({ path: path.join(artifactDir, 'ticket_created.png') });

    await clientSubmitBtn.click();

    // Verify message appears in UI immediately
    await expect(clientPage.getByText('Hello support team, I need help with my balance.').first()).toBeVisible({ timeout: 5000 });

    // --- 2. Operator context ---
    const operatorContext = await browser.newContext();
    const operatorPage = await operatorContext.newPage();

    await operatorPage.goto('/login');
    await operatorPage.locator('#login-email').fill(operatorEmail);
    await operatorPage.locator('#login-password').fill(operatorPassword);
    await operatorPage.getByRole('button', { name: 'Войти в кабинет' }).click();
    await expect(operatorPage).toHaveURL(/.*dashboard/);

    // Navigate to support operator tickets workspace
    await operatorPage.goto('/operator/tickets');
    await expect(operatorPage).toHaveURL(/.*operator\/tickets/);

    // Select the active ticket from sidebar
    const ticketLink = operatorPage.locator(`a[href*="ticketId=${ticketId}"]`);
    await expect(ticketLink).toBeVisible({ timeout: 10000 });
    await ticketLink.click();

    // Verify active chat loaded
    await expect(operatorPage.locator('h3', { hasText: ticketSubject })).toBeVisible({ timeout: 5000 });
    await expect(operatorPage.getByText('Hello support team, I need help with my balance.').first()).toBeVisible();

    // Take screenshot: operator_tickets_workspace.png
    await operatorPage.screenshot({ path: path.join(artifactDir, 'operator_tickets_workspace.png') });

    // --- 3. Operator reply & SSE verification ---
    const operatorTextArea = operatorPage.getByPlaceholder('Напишите сообщение клиенту...');
    await expect(operatorTextArea).toBeVisible();
    await operatorTextArea.fill('Hello client, we have received your request. Checking...');

    const operatorSubmitBtn = operatorPage.getByRole('button', { name: 'Отправить' });
    await expect(operatorSubmitBtn).toBeVisible();
    await operatorSubmitBtn.click();

    // Verify operator sees reply
    await expect(operatorPage.getByText('Hello client, we have received your request. Checking...')).toBeVisible({ timeout: 5000 });

    // Bring client page to front to ensure active state and receive message
    await clientPage.bringToFront();

    // Verify client sees reply dynamically via SSE
    await expect(clientPage.getByText('Hello client, we have received your request. Checking...').first()).toBeVisible({ timeout: 10000 });

    // Take screenshot: sse_message_received.png
    await clientPage.screenshot({ path: path.join(artifactDir, 'sse_message_received.png') });

    // --- 4. Close ticket ---
    await operatorPage.bringToFront();
    const closeTicketBtn = operatorPage.getByRole('button', { name: 'Закрыть тикет' });
    await expect(closeTicketBtn).toBeVisible();
    await closeTicketBtn.click();

    // Verify closed status indicators
    await expect(operatorPage.getByRole('button', { name: 'Открыть заново' })).toBeVisible({ timeout: 5000 });

    // Bring client page to front to check closed state
    await clientPage.bringToFront();
    await clientPage.reload();
    await expect(clientPage.getByText('Тикет закрыт. Создайте новое обращение если нужна помощь.').first()).toBeVisible({ timeout: 10000 });

    // Take screenshot: ticket_closed.png
    await clientPage.screenshot({ path: path.join(artifactDir, 'ticket_closed.png') });

    // Verify status updated in DB
    const dbTicket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    expect(dbTicket?.status).toBe('CLOSED');

    await clientContext.close();
    await operatorContext.close();
  });
});
