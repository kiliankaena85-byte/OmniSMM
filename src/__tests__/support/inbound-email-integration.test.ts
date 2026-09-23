import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { ticketService } from '@/services/support/ticket.service';

// Mock dependencies
vi.mock('@/lib/smtp', () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  sendTicketCreatedMail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/support/sse.service', () => ({
  publishMessageSSE: vi.fn(),
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getInboundEmailWebhookSecret: vi.fn().mockResolvedValue('test-secret-12345'),
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmplan.pro'),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({
      SITE_NAME: 'SMMplan',
      SUPPORT_EMAIL: 'support@smmplan.pro'
    })
  }
}));

describe('Inbound Email Integration & Ticket Creation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('1. Automatically creates user and ticket when a new customer emails support@smmplan.pro', async () => {
    const testEmail = `inbound-new-${Date.now()}@example.com`;
    const testSubject = 'Вопрос по пополнению баланса через СБП';
    const testText = 'Здравствуйте! Я перевел 1000 рублей через СБП, но баланс не обновился. Помогите, пожалуйста.';

    const ticket = await ticketService.createInboundEmailTicket({
      fromEmail: testEmail,
      fromName: 'Алексей Смирнов',
      toEmail: 'support@smmplan.pro',
      subject: testSubject,
      text: testText,
      tenantId: 'smmplan'
    });

    expect(ticket).toBeDefined();
    expect(ticket.id).toBeDefined();
    expect(ticket.subject).toBe(testSubject);
    expect(ticket.source).toBe('EMAIL');
    expect(ticket.status).toBe('OPEN');
    expect(ticket.tenantId).toBe('smmplan');
    expect(ticket.user.email).toBe(testEmail.toLowerCase());
    expect(ticket.user.isEmailVerified).toBe(true);

    expect(ticket.messages.length).toBe(1);
    expect(ticket.messages[0].sender).toBe('USER');
    expect(ticket.messages[0].text).toBe(testText);
  });

  it('2. Correctly sets tenantId to flux when email arrives at support@smmflux.ru', async () => {
    const testEmail = `flux-user-${Date.now()}@test.com`;

    const ticket = await ticketService.createInboundEmailTicket({
      fromEmail: testEmail,
      toEmail: 'support@smmflux.ru',
      subject: 'Вопрос по заказу в SMMflux',
      text: 'Здравствуйте! Заказ #123 в процессе?',
    });

    expect(ticket.tenantId).toBe('flux');
    expect(ticket.user.tenantId).toBe('flux');
    expect(ticket.source).toBe('EMAIL');
  });

  it('3. Appends messages to existing ticket when customer replies to email', async () => {
    // Step 1: Create initial ticket
    const initialEmail = `reply-user-${Date.now()}@test.com`;
    const initialTicket = await ticketService.createInboundEmailTicket({
      fromEmail: initialEmail,
      subject: 'Запрос на возврат',
      text: 'Прошу вернуть средства за невыполненный заказ #555',
      tenantId: 'smmplan'
    });

    // Step 2: Staff responds (changes status to PENDING)
    await ticketService.addMessage(
      initialTicket.id,
      'STAFF',
      'Здравствуйте! Уточните, пожалуйста, номер транзакции оплаты.'
    );

    const updatedAfterStaff = await db.ticket.findUnique({
      where: { id: initialTicket.id }
    });
    expect(updatedAfterStaff?.status).toBe('PENDING');

    // Step 3: Customer replies via email
    const replyText = 'Номер транзакции 987654321, прикрепил к письму.';
    await ticketService.addMessage(
      initialTicket.id,
      'USER',
      replyText
    );

    const updatedAfterReply = await db.ticket.findUnique({
      where: { id: initialTicket.id },
      include: { messages: true }
    });

    expect(updatedAfterReply?.status).toBe('OPEN');
    expect(updatedAfterReply?.messages.length).toBe(3); // Initial + Staff + Customer Reply
    expect(updatedAfterReply?.messages[2].text).toBe(replyText);
    expect(updatedAfterReply?.messages[2].sender).toBe('USER');
  });

  it('4. Handles attachments with Cyrillic filename preservation', async () => {
    const testEmail = `attachment-user-${Date.now()}@test.com`;

    const ticket = await ticketService.createInboundEmailTicket({
      fromEmail: testEmail,
      subject: 'Скриншот ошибки оплаты',
      text: 'Прикрепляю чек и скриншот экрана',
      tenantId: 'smmplan',
      attachments: [
        {
          url: '/tickets/test/receipt.pdf',
          type: 'document',
          mimeType: 'application/pdf',
          name: 'Чек об оплате СБП.pdf',
          size: 102400
        },
        {
          url: '/tickets/test/screen.png',
          type: 'image',
          mimeType: 'image/png',
          name: 'Скриншот экрана.png',
          size: 51200
        }
      ]
    });

    expect(ticket.messages[0].attachments.length).toBe(2);
    expect(ticket.messages[0].attachments[0].name).toBe('Чек об оплате СБП.pdf');
    expect(ticket.messages[0].attachments[1].name).toBe('Скриншот экрана.png');
  });

  it('5. Rejects webhook request with missing or invalid secret with 401', async () => {
    const { POST } = await import('@/app/api/webhooks/inbound-email/route');
    const { NextRequest } = await import('next/server');

    const req = new NextRequest('http://localhost:3000/api/webhooks/inbound-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer wrong-secret'
      },
      body: JSON.stringify({
        From: 'unauthorized@test.com',
        To: 'support@smmplan.pro',
        Subject: 'Test',
        TextBody: 'Test'
      })
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('6. Successfully accepts authorized webhook and creates a new ticket', async () => {
    const { POST } = await import('@/app/api/webhooks/inbound-email/route');
    const { NextRequest } = await import('next/server');

    const testSender = `webhook-client-${Date.now()}@example.com`;
    const payload = {
      From: `Клиент Тестовый <${testSender}>`,
      To: 'support@smmplan.pro',
      Subject: 'Не приходят лайки в VK',
      TextBody: 'Здравствуйте! Заказ #777 висит уже 2 часа. Проверьте, пожалуйста.'
    };

    const req = new NextRequest('http://localhost:3000/api/webhooks/inbound-email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer test-secret-12345'
      },
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe('created');
    expect(json.ticketId).toBeDefined();

    const createdTicket = await db.ticket.findUnique({
      where: { id: json.ticketId },
      include: { user: true, messages: true }
    });

    expect(createdTicket).toBeDefined();
    expect(createdTicket?.subject).toBe('Не приходят лайки в VK');
    expect(createdTicket?.source).toBe('EMAIL');
    expect(createdTicket?.user.email).toBe(testSender.toLowerCase());
  });
});

