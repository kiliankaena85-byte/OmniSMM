import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../../src/lib/auth/password';

const prisma = new PrismaClient();

test.describe('Support Ticket & Real-Time SSE Chat Flow', () => {
  const clientEmail = 'e2e_client_sse_test@smmplan.local';
  const clientPassword = 'ClientPassword2026!';
  const operatorEmail = 'support@smmplan.test';
  const operatorPassword = 'SupportPassword2026!';
  const ticketSubject = 'Чат с поддержкой'; // Default subject used by getOrCreateTicket

  let clientUser: any = null;
  let operatorUser: any = null;
  let ticket: any = null;

  test.beforeAll(async () => {
    // 1. Ensure clean state
    await prisma.ticketMessage.deleteMany({
      where: {
        ticket: {
          user: {
            email: { in: [clientEmail, operatorEmail] }
          }
        }
      }
    });
    await prisma.ticket.deleteMany({
      where: {
        user: {
          email: { in: [clientEmail, operatorEmail] }
        }
      }
    });
    await prisma.user.deleteMany({
      where: { email: { in: [clientEmail, operatorEmail] } }
    });

    // 2. Create the E2E Client User
    const hashedClientPassword = await hashPassword(clientPassword);
    clientUser = await prisma.user.create({
      data: {
        email: clientEmail,
        passwordHash: hashedClientPassword,
        role: 'USER',
        balance: 50000, // 500.00 RUB
        isActive: true,
      }
    });

    // 3. Create/Ensure the Support Staff Role and Permissions
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

    // 4. Create the E2E Support Operator User
    const hashedOperatorPassword = await hashPassword(operatorPassword);
    operatorUser = await prisma.user.create({
      data: {
        email: operatorEmail,
        passwordHash: hashedOperatorPassword,
        role: 'SUPPORT',
        isActive: true,
        staffRoleId: supportRole.id,
      }
    });
  });

  test.afterAll(async () => {
    // Clean up created resources after tests complete
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

  test('Support ticket creation, operator response, and real-time SSE stream delivery', async ({ browser }) => {
    // --- STEP 1: Client logs in and initiates support ticket ---
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();

    // Log in as Client User
    await clientPage.goto('/login');
    await clientPage.getByRole('button', { name: 'Войти по паролю' }).click();
    await clientPage.locator('#login-email').fill(clientEmail);
    await clientPage.locator('#login-password').fill(clientPassword);
    await clientPage.getByRole('button', { name: 'Войти в кабинет' }).click();

    // Verify client is on dashboard
    await expect(clientPage).toHaveURL(/.*dashboard/);

    // Access Support Tickets: visiting /dashboard/tickets automatically retrieves/creates ticket
    // and redirects to /dashboard/tickets/[ticketId]
    await clientPage.goto('/dashboard/tickets');
    await clientPage.waitForURL(/\/dashboard\/tickets\/[a-zA-Z0-9_-]+/);

    const clientChatUrl = clientPage.url();
    const ticketId = clientChatUrl.split('/').pop();
    expect(ticketId).toBeTruthy();

    // Fetch the ticket from DB to track status
    ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });
    expect(ticket).toBeTruthy();

    // Verify Chat Input fields on client side
    const clientTextArea = clientPage.getByPlaceholder('Опишите вашу проблему...');
    await expect(clientTextArea).toBeVisible();
    await expect(clientTextArea).toBeEnabled();

    const clientSubmitBtn = clientPage.getByRole('button', { name: 'Отправить сообщение' });
    await expect(clientSubmitBtn).toBeVisible();

    // Client sends an initial message
    await clientTextArea.fill('Hello support team, I need help with my balance.');
    
    // Listen for the SSE connection to open on the client page
    const clientSseRequestPromise = clientPage.waitForRequest(request =>
      request.url().includes(`/api/support/chat/stream?ticketId=${ticketId}`) && request.method() === 'GET'
    );
    await clientSubmitBtn.click();

    // Verify SSE connection established and is active
    const clientSseRequest = await clientSseRequestPromise;
    expect(clientSseRequest).toBeTruthy();

    // Verify message appears in UI immediately (Optimistic UI check)
    await expect(clientPage.getByText('Hello support team, I need help with my balance.')).toBeVisible({ timeout: 5000 });


    // --- STEP 2: Operator logs in and accesses tickets workspace ---
    const operatorContext = await browser.newContext();
    const operatorPage = await operatorContext.newPage();

    // Log in as Support Operator
    await operatorPage.goto('/login');
    await operatorPage.getByRole('button', { name: 'Войти по паролю' }).click();
    await operatorPage.locator('#login-email').fill(operatorEmail);
    await operatorPage.locator('#login-password').fill(operatorPassword);
    await operatorPage.getByRole('button', { name: 'Войти в кабинет' }).click();

    // Navigate to support operator tickets workspace
    await operatorPage.goto('/operator/tickets');
    await expect(operatorPage).toHaveURL(/.*operator\/tickets/);

    // Select the active ticket from sidebar
    const ticketLink = operatorPage.locator(`a[href*="ticketId=${ticketId}"]`);
    await expect(ticketLink).toBeVisible({ timeout: 10000 });
    await ticketLink.click();

    // Verify active chat loaded on the right
    await expect(operatorPage.locator('h3', { hasText: ticketSubject })).toBeVisible({ timeout: 5000 });
    await expect(operatorPage.getByText('Hello support team, I need help with my balance.')).toBeVisible();


    // --- STEP 3: Real-time operator reply delivery via SSE ---
    const operatorTextArea = operatorPage.getByPlaceholder('Напишите сообщение клиенту...');
    await expect(operatorTextArea).toBeVisible();

    await operatorTextArea.fill('Hello client, we have received your request. Checking...');

    const operatorSubmitBtn = operatorPage.getByRole('button', { name: 'Отправить' });
    await expect(operatorSubmitBtn).toBeVisible();
    await operatorSubmitBtn.click();

    // Verification in Operator UI
    await expect(operatorPage.getByText('Hello client, we have received your request. Checking...')).toBeVisible({ timeout: 5000 });

    // Verification in Client UI (Real-time update via SSE without manual refresh)
    await expect(clientPage.getByText('Hello client, we have received your request. Checking...')).toBeVisible({ timeout: 10000 });


    // --- STEP 4: Transition ticket status to CLOSED ---
    // From Operator UI
    const closeTicketBtn = operatorPage.getByRole('button', { name: 'Закрыть тикет' });
    await expect(closeTicketBtn).toBeVisible();
    await closeTicketBtn.click();

    // Verify UI reflects CLOSED status for operator
    const reopenTicketBtn = operatorPage.getByRole('button', { name: 'Открыть заново' });
    await expect(reopenTicketBtn).toBeVisible({ timeout: 5000 });

    // Verify UI reflects CLOSED status for client (disabled chat inputs and status indicator)
    await expect(clientPage.getByText('Тикет закрыт. Создайте новое обращение если нужна помощь.')).toBeVisible({ timeout: 10000 });
    await expect(clientPage.getByPlaceholder('Опишите вашу проблему...')).not.toBeVisible();

    // Verify DB status transitions to CLOSED
    let updatedTicket = null;
    for (let i = 0; i < 5; i++) {
      await clientPage.waitForTimeout(1000);
      updatedTicket = await prisma.ticket.findUnique({
        where: { id: ticketId }
      });
      if (updatedTicket?.status === 'CLOSED') break;
    }
    expect(updatedTicket?.status).toBe('CLOSED');
    expect(updatedTicket?.resolvedAt).toBeTruthy();

    // Clean up browser contexts
    await clientContext.close();
    await operatorContext.close();
  });
});
