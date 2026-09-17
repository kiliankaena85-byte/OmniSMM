import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { 
  saveTelegramMenuConfigAction,
  saveTelegramRatingReasonsAction,
  saveTelegramTemplatesAction,
  getTicketFeedbackStatsAction,
  getTicketFeedbackListAction,
} from '@/actions/admin/telegram-bot';
import {
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_RATING_REASONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  type TelegramMenuButton
} from '@/types/telegram';

// Mock RBAC to simulate staff session
vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (resource, action, callback) => {
    const mockAdmin = { id: 'admin_123', email: 'admin@smmplan.pro', role: 'OWNER' };
    return callback(mockAdmin);
  })
}));

describe('Telegram Bot Server Actions & RBAC Suite', () => {
  beforeEach(async () => {
    // Ensure tenant and systemSettings exist
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.pro' },
      update: {}
    });

    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      create: { id: 'smmplan', siteName: 'SMMplan' },
      update: {}
    });

    await db.ticketFeedback.deleteMany();
  });

  describe('1. Menu Config Action Validation', () => {
    it('should save valid custom menu buttons configuration', async () => {
      const customButtons: TelegramMenuButton[] = [
        { id: 'b1', label: '🛍 Каталог', action: 'CATALOG', row: 0, col: 0, isActive: true },
        { id: 'b2', label: '🌐 Наш сайт', action: 'URL', row: 0, col: 1, value: 'https://smmplan.pro', isActive: true },
      ];

      const res = await saveTelegramMenuConfigAction(customButtons);
      expect(res.success).toBe(true);

      const settings = await db.systemSettings.findUnique({ where: { id: 'smmplan' } });
      const saved = settings?.telegramMenuConfig as unknown as TelegramMenuButton[];
      expect(saved).toHaveLength(2);
      expect(saved[1].value).toBe('https://smmplan.pro');
    });

    it('should reject buttons with empty labels', async () => {
      const invalidButtons = [
        { id: 'b1', label: '', action: 'CATALOG', row: 0, col: 0, isActive: true }
      ] as any;

      const res = await saveTelegramMenuConfigAction(invalidButtons);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('should reject buttons with invalid action type', async () => {
      const invalidButtons = [
        { id: 'b1', label: 'Кнопка', action: 'NON_EXISTENT_ACTION', row: 0, col: 0, isActive: true }
      ] as any;

      const res = await saveTelegramMenuConfigAction(invalidButtons);
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('2. Rating Reasons Action Validation', () => {
    it('should save valid 3-tier rating reasons', async () => {
      const customReasons = {
        negative: ['Долгий ответ', 'Не помогли'],
        neutral: ['Нормально'],
        positive: ['Супер сервис', 'Быстро']
      };

      const res = await saveTelegramRatingReasonsAction(customReasons);
      expect(res.success).toBe(true);

      const settings = await db.systemSettings.findUnique({ where: { id: 'smmplan' } });
      const saved = settings?.telegramRatingReasons as unknown as typeof customReasons;
      expect(saved.positive).toContain('Супер сервис');
    });

    it('should reject empty rating reason categories', async () => {
      const invalidReasons = {
        negative: [],
        neutral: ['Нормально'],
        positive: ['Отлично']
      };

      const res = await saveTelegramRatingReasonsAction(invalidReasons as any);
      expect(res.success).toBe(false);
      expect(res.error).toContain('хотя бы одну причину');
    });
  });

  describe('3. Message Templates Action Validation', () => {
    it('should save valid message templates', async () => {
      const customTemplates = {
        ...DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
        welcome: 'Привет в {siteName}! Ваш баланс: {balance} ₽.'
      };

      const res = await saveTelegramTemplatesAction(customTemplates);
      expect(res.success).toBe(true);

      const settings = await db.systemSettings.findUnique({ where: { id: 'smmplan' } });
      const saved = settings?.telegramTemplates as unknown as typeof customTemplates;
      expect(saved.welcome).toContain('Привет в {siteName}!');
    });
  });

  describe('4. Feedback Stats & List Retrieval', () => {
    it('should return default 5.0 score when no feedback records exist', async () => {
      const res = await getTicketFeedbackStatsAction();
      expect(res.success).toBe(true);
      expect(res.stats?.totalCount).toBe(0);
      expect(res.stats?.avgScore).toBe(5.0);
    });

    it('should return paginated feedbacks and calculate distribution', async () => {
      const user = await db.user.create({
        data: { email: `admin_test_${Date.now()}@smmplan.pro`, tenantId: 'smmplan' }
      });

      const ticket = await db.ticket.create({
        data: { userId: user.id, subject: 'Тестовый тикет #1', status: 'CLOSED', tenantId: 'smmplan' }
      });

      await db.ticketFeedback.create({
        data: {
          ticketId: ticket.id,
          userId: user.id,
          score: 4,
          reasons: ['Быстрый ответ'],
          comment: 'Всё хорошо',
          source: 'TELEGRAM',
          tenantId: 'smmplan'
        }
      });

      // Get stats
      const statsRes = await getTicketFeedbackStatsAction();
      expect(statsRes.success).toBe(true);
      expect(statsRes.stats?.totalCount).toBe(1);
      expect(statsRes.stats?.avgScore).toBe(4.0);
      expect(statsRes.stats?.scoreBreakdown[4]).toBe(1);

      // Get list
      const listRes = await getTicketFeedbackListAction({ page: 1, pageSize: 10 });
      expect(listRes.success).toBe(true);
      expect(listRes.items).toHaveLength(1);
      expect(listRes.items![0].ticketSubject).toBe('Тестовый тикет #1');
      expect(listRes.items![0].score).toBe(4);
    });
  });
});
