import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTicket, addTicketMessage } from '@/actions/support/ticket';
import { verifySession } from '@/lib/session';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { ticketService } from '@/services/support/ticket.service';
import { db } from '@/lib/db';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(),
    checkCustomKey: vi.fn(),
  }
}));

vi.mock('@/services/support/ticket.service', () => ({
  ticketService: {
    getOrCreateTicket: vi.fn(),
    addMessage: vi.fn(),
  }
}));

vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    }
  }
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Ticket Actions Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTicket', () => {
    it('should throw an error if user is rate limited', async () => {
      vi.mocked(verifySession).mockResolvedValueOnce({ userId: 'u1' } as any);
      // Mock user key rate limit as blocked
      vi.mocked(RateLimitService.checkCustomKey).mockResolvedValueOnce(false);
      vi.mocked(RateLimitService.check).mockResolvedValueOnce(true);

      const formData = new FormData();
      formData.append('subject', 'Test subject');
      formData.append('message', 'Test message');

      await expect(createTicket(formData)).rejects.toThrow('Вы создаете слишком много обращений. Пожалуйста, подождите некоторое время.');
      expect(ticketService.getOrCreateTicket).not.toHaveBeenCalled();
    });

    it('should proceed to create ticket if not rate limited', async () => {
      vi.mocked(verifySession).mockResolvedValueOnce({ userId: 'u1' } as any);
      vi.mocked(RateLimitService.checkCustomKey).mockResolvedValueOnce(true);
      vi.mocked(RateLimitService.check).mockResolvedValueOnce(true);
      vi.mocked(ticketService.getOrCreateTicket).mockResolvedValueOnce({ id: 't1' } as any);

      const formData = new FormData();
      formData.append('subject', 'Test subject');
      formData.append('message', 'Test message');

      // We expect redirect to be called (which vitest handles or will throw/reject with redirect logic)
      try {
        await createTicket(formData);
      } catch (err: unknown) {
        // expect redirect to have been called
      }

      expect(RateLimitService.checkCustomKey).toHaveBeenCalledWith('create_ticket_user:u1', 5, 3600);
      expect(RateLimitService.check).toHaveBeenCalledWith('create_ticket_ip', 10, 3600);
      expect(ticketService.getOrCreateTicket).toHaveBeenCalledWith('u1', 'Test subject');
      expect(ticketService.addMessage).toHaveBeenCalledWith('t1', 'USER', 'Test message');
    });
  });

  describe('addTicketMessage', () => {
    it('should throw an error if message sending is rate limited', async () => {
      vi.mocked(verifySession).mockResolvedValueOnce({ userId: 'u1' } as any);
      vi.mocked(RateLimitService.checkCustomKey).mockResolvedValueOnce(false);
      vi.mocked(RateLimitService.check).mockResolvedValueOnce(true);

      const formData = new FormData();
      formData.append('ticketId', 't1');
      formData.append('message', 'Test reply');

      await expect(addTicketMessage(formData)).rejects.toThrow('Слишком много сообщений. Пожалуйста, подождите перед следующим ответом.');
      expect(ticketService.addMessage).not.toHaveBeenCalled();
    });

    it('should proceed to send message if not rate limited', async () => {
      vi.mocked(verifySession).mockResolvedValueOnce({ userId: 'u1' } as any);
      vi.mocked(RateLimitService.checkCustomKey).mockResolvedValueOnce(true);
      vi.mocked(RateLimitService.check).mockResolvedValueOnce(true);
      vi.mocked(db.ticket.findFirst).mockResolvedValueOnce({ id: 't1', userId: 'u1' } as any);

      const formData = new FormData();
      formData.append('ticketId', 't1');
      formData.append('message', 'Test reply');

      await addTicketMessage(formData);

      expect(RateLimitService.checkCustomKey).toHaveBeenCalledWith('add_message_user:u1', 60, 60);
      expect(RateLimitService.check).toHaveBeenCalledWith('add_message_ip', 100, 60);
      expect(ticketService.addMessage).toHaveBeenCalledWith('t1', 'USER', 'Test reply', undefined, undefined, undefined, undefined, undefined, undefined);
    });
  });
});
