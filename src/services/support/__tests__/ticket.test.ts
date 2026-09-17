import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { sendMail } from '@/lib/smtp';
import { ticketService } from '../ticket.service';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    }
  }
}));

vi.mock('@/lib/smtp', () => ({
  sendMail: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmplan.pro'),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({ COMPANY_NAME: 'SMMplan' })
  }
}));

vi.mock('@/services/support/support-bot.service', () => ({
  supportBotService: {
    sendSupportReply: vi.fn().mockResolvedValue('tg_12345'),
  }
}));

describe('TicketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addMessage', () => {
    it('should correctly fallback to Email if user has no Telegram', async () => {
      // Setup Mock Data
      const mockTicket = {
        id: 'ticket-1',
        subject: 'Test Subject',
        source: 'WEB',
        user: { id: 'user-1', email: 'test@smmplan.pro', telegramId: null }
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({
        id: 'msg-1',
        ticketId: 'ticket-1',
        sender: 'STAFF',
        text: 'Hello via Email',
        ticket: mockTicket
      } as any);

      await ticketService.addMessage('ticket-1', 'STAFF', 'Hello via Email');

      // Assertions
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledWith(
        'test@smmplan.pro',
        'Support Reply: Test Subject',
        expect.stringContaining('Hello via Email'),
        'support+ticket-1@smmplan.pro'
      );
    });

    it('should NOT send email if user has Telegram', async () => {
      const mockTicket = {
        id: 'ticket-2',
        subject: 'Test Subject',
        source: 'TELEGRAM',
        user: { id: 'user-2', email: 'test2@smmplan.pro', telegramId: '123456789' }
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({
        id: 'msg-2',
        ticketId: 'ticket-2',
        sender: 'STAFF',
        text: 'Hello via Telegram',
        ticket: mockTicket
      } as any);

      await ticketService.addMessage('ticket-2', 'STAFF', 'Hello via Telegram');

      // Should not send email
      expect(sendMail).not.toHaveBeenCalled();
      
      // Should save telegramMsgId into the message
      expect(db.ticketMessage.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          telegramMsgId: 'tg_12345'
        })
      }));
    });

    it('should correctly map replyToId to telegramMsgId if provided', async () => {
      const mockTicket = {
        id: 'ticket-3',
        user: { id: 'u3', telegramId: '999' }
      };
      const mockRepliedMsg = {
        id: 'msg-old',
        telegramMsgId: 'tg_old_999'
      };

      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.findUnique).mockResolvedValueOnce(mockRepliedMsg as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({ ticket: mockTicket } as any);

      const { supportBotService } = await import('@/services/support/support-bot.service');

      await ticketService.addMessage('ticket-3', 'STAFF', 'Quoted reply', undefined, undefined, 'msg-old');

      expect(supportBotService.sendSupportReply).toHaveBeenCalledWith(
        '999', 
        'Quoted reply', 
        'tg_old_999',
        undefined,
        undefined,
        'smmplan'
      );
    });
    
    it('should pass orderId to database create call if provided', async () => {
      const mockTicket = {
        id: 'ticket-4',
        user: { id: 'u4', telegramId: null }
      };
      
      vi.mocked(db.ticket.findUnique).mockResolvedValueOnce(mockTicket as any);
      vi.mocked(db.ticketMessage.create).mockResolvedValueOnce({ ticket: mockTicket } as any);
      
      await ticketService.addMessage('ticket-4', 'STAFF', 'Message with order', undefined, undefined, undefined, undefined, undefined, 'order-123');
      
      expect(db.ticketMessage.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-123'
        })
      }));
    });
  });
});
