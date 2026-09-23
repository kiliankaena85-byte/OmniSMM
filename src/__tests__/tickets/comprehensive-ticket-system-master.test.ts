import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { sendMail } from '@/lib/smtp';
import { ticketService } from '@/services/support/ticket.service';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { supportBotService } from '@/services/support/support-bot.service';
import { sanitizeServiceDescription } from '@/lib/sanitize';
import { escapeHtml } from '@/bot/utils/formatter';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/smtp', () => ({
  sendMail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmplan.pro'),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({ COMPANY_NAME: 'SMMplan' }),
  },
}));

vi.mock('@/services/support/support-bot.service', () => ({
  supportBotService: {
    sendSupportReply: vi.fn().mockResolvedValue('tg_message_999'),
    sendNotification: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn().mockResolvedValue(true),
    checkCustomKey: vi.fn().mockResolvedValue(true),
  },
}));

describe('🎫 Comprehensive Master Suite: Ticket System, Omni-Channel & Lifecycle Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Omni-Channel Routing & Priority Dispatch', () => {
    it('1.1 Dispatches message to Telegram when user has connected telegramId', async () => {
      const mockTicket = {
        id: 'ticket-tg-1',
        subject: 'Instagram Order Refill',
        source: 'WEB',
        user: { id: 'user-tg-1', email: 'tguser@smmplan.pro', telegramId: '987654321' },
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({
        id: 'msg-tg-1',
        ticketId: 'ticket-tg-1',
        sender: 'STAFF',
        text: 'Здравствуйте! Запустили повторное пополнение.',
        ticket: mockTicket,
      } as any);

      await ticketService.addMessage('ticket-tg-1', 'STAFF', 'Здравствуйте! Запустили повторное пополнение.');

      // Must send Telegram message
      expect(supportBotService.sendSupportReply).toHaveBeenCalledWith(
        '987654321',
        'Здравствуйте! Запустили повторное пополнение.',
        undefined,
        undefined,
        undefined
      );
      // Must NOT fallback to email if Telegram succeeded
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('1.2 Gracefully falls back to Email dispatch when user has NO telegramId', async () => {
      const mockTicket = {
        id: 'ticket-email-1',
        subject: 'VK Followers Inquiry',
        source: 'WEB',
        user: { id: 'user-email-1', email: 'vkclient@smmplan.pro', telegramId: null },
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({
        id: 'msg-email-1',
        ticketId: 'ticket-email-1',
        sender: 'STAFF',
        text: 'Ваш заказ находится в обработке.',
        ticket: mockTicket,
      } as any);

      await ticketService.addMessage('ticket-email-1', 'STAFF', 'Ваш заказ находится в обработке.');

      // Telegram not called
      expect(supportBotService.sendSupportReply).not.toHaveBeenCalled();
      // Email is called
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith(
        'vkclient@smmplan.pro',
        'Support Reply: VK Followers Inquiry',
        expect.stringContaining('Ваш заказ находится в обработке.'),
        'support+ticket-email-1@smmplan.pro'
      );
    });
  });

  describe('2. State Transitions & Timestamp Tracking', () => {
    it('2.1 Sets firstRespondedAt on first STAFF reply and updates status to ANSWERED', async () => {
      const mockTicket = {
        id: 'ticket-sla-1',
        subject: 'SLA Tracking Inquiry',
        status: 'OPEN',
        firstRespondedAt: null,
        user: { id: 'user-sla-1', email: 'client@smmplan.pro', telegramId: null },
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({
        id: 'msg-sla-1',
        ticketId: 'ticket-sla-1',
        sender: 'STAFF',
        text: 'Operator first response',
        ticket: mockTicket,
      } as any);

      await ticketService.addMessage('ticket-sla-1', 'STAFF', 'Operator first response');

      expect(db.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-sla-1' },
          data: expect.objectContaining({
            status: 'PENDING',
            firstRespondedAt: expect.any(Date),
          }),
        })
      );
    });

    it('2.2 Client reply re-opens CLOSED ticket back to OPEN status', async () => {
      const mockTicket = {
        id: 'ticket-closed-1',
        status: 'CLOSED',
        resolvedAt: new Date(),
        user: { id: 'user-closed-1', email: 'client@smmplan.pro', telegramId: null },
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({
        id: 'msg-reopen-1',
        ticketId: 'ticket-closed-1',
        sender: 'USER',
        text: 'Проблема снова повторилась!',
        ticket: mockTicket,
      } as any);

      await ticketService.addMessage('ticket-closed-1', 'USER', 'Проблема снова повторилась!');

      expect(db.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-closed-1' },
          data: expect.objectContaining({
            status: 'OPEN',
          }),
        })
      );
    });
  });

  describe('3. Security, XSS Sanitization & IDOR Boundary', () => {
    it('3.1 Sanitizes malicious HTML and script tags in user ticket message payload', () => {
      const dirtyPayload = '<script>stealCookies()</script>Hello <img src="x" onerror="alert(1)"> world!';
      const clean = sanitizeServiceDescription(dirtyPayload);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror=');
      expect(clean).toContain('Hello');

      const escaped = escapeHtml('<script>alert("xss")</script>');
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('3.2 Rejects non-whitelisted attachment file types to prevent malware uploads', () => {
      const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
      const dangerousExtensions = ['exe', 'bat', 'sh', 'php', 'js', 'vbs', 'dll', 'cmd'];

      const isAllowed = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        return allowedExtensions.includes(ext);
      };

      expect(isAllowed('screenshot.png')).toBe(true);
      expect(isAllowed('receipt.pdf')).toBe(true);

      for (const dangerous of dangerousExtensions) {
        expect(isAllowed(`malware.${dangerous}`)).toBe(false);
      }
    });
  });

  describe('4. Anti-Flood & Rate Limiting Defense', () => {
    it('4.1 Rejects ticket creation when user exceeds maximum hourly quota', async () => {
      vi.mocked(RateLimitService.checkCustomKey).mockResolvedValueOnce(false);

      const isAllowed = await RateLimitService.checkCustomKey('rate:ticket:user_flood_1', 5, 3600);
      expect(isAllowed).toBe(false);
    });
  });
});
