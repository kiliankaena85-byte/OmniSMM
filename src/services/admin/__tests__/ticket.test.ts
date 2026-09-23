import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminTicketService } from '../../admin/ticket.service';

vi.mock('@/lib/db', () => ({
  db: {
    ticket: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    }
  }
}));

describe('AdminTicketService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTicketDetails', () => {
    it('should limit historical messages to 15 per ticket to prevent DOM freeze', async () => {
      // Mock current ticket
      const currentTicket = {
        id: 'ticket-current',
        userId: 'user-1',
        user: { 
          id: 'user-1',
          createdAt: new Date(),
          orders: [],
          payments: []
        },
        messages: []
      };

      // Mock historical tickets
      const histTicket1 = {
        id: 'hist-1',
        createdAt: new Date('2026-05-10T10:00:00Z'),
        messages: Array.from({ length: 50 }).map((_, i) => ({
          id: `hist-msg-${i}`,
          createdAt: new Date(`2026-05-10T10:0${i % 10}:00Z`)
        }))
      };

      vi.mocked(db.ticket.findFirst).mockResolvedValueOnce(currentTicket as any);
      vi.mocked(db.ticket.findMany).mockResolvedValueOnce([histTicket1] as any);

      await adminTicketService.getTicketDetails('ticket-current');

      // The key assertion: did we pass take: 15 to Prisma?
      expect(db.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            messages: expect.objectContaining({
              take: 15,
              orderBy: { createdAt: 'desc' }
            })
          })
        })
      );
    });

    it('should expose originalText for deleted messages to STAFF (Audit Visibility)', async () => {
      const currentTicket = {
        id: 'ticket-audit',
        userId: 'user-1',
        user: { 
          id: 'user-1',
          createdAt: new Date(),
          orders: [],
          payments: []
        },
        messages: [
          {
            id: 'msg-deleted-1',
            text: '[Сообщение удалено пользователем]',
            originalText: 'Настоящий текст до удаления',
            isDeleted: true,
            createdAt: new Date(),
            sender: 'USER'
          }
        ]
      };

      vi.mocked(db.ticket.findFirst).mockResolvedValueOnce(currentTicket as any);
      vi.mocked(db.ticket.findMany).mockResolvedValueOnce([] as any);

      const res = await adminTicketService.getTicketDetails('ticket-audit');

      expect(res).not.toBeNull();
      expect(res!.messages[0].originalText).toBe('Настоящий текст до удаления');
      expect(res!.messages[0].isDeleted).toBe(true);
    });
  });
});
