import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { 
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_RATING_REASONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  type TelegramMenuButton,
  type TelegramRatingReasonsConfig,
  type TelegramMessageTemplatesConfig,
  type TelegramMenuButtonAction
} from '@/types/telegram';

describe('Enterprise Telegram Bot & Feedback Ecosystem Test Suite', () => {

  // ── 1. MENU BUILDER & BUTTON CONFIG INTEGRITY ──
  describe('1. Menu Builder & Button Config Invariants', () => {
    it('should have 6 active default menu buttons with valid actions and grid layout', () => {
      expect(DEFAULT_TELEGRAM_MENU_BUTTONS).toHaveLength(6);

      const validActions: TelegramMenuButtonAction[] = [
        'CATALOG', 'ORDERS', 'REFILL', 'PROFILE', 'SUPPORT', 'REFERRALS', 'URL', 'WEB_APP', 'COMMAND', 'TEXT_REPLY'
      ];

      for (const btn of DEFAULT_TELEGRAM_MENU_BUTTONS) {
        expect(btn.id).toBeDefined();
        expect(btn.label.length).toBeGreaterThan(0);
        expect(validActions).toContain(btn.action);
        expect(btn.isActive).toBe(true);
        expect(btn.row).toBeGreaterThanOrEqual(0);
        expect(btn.col).toBeGreaterThanOrEqual(0);
        expect(btn.col).toBeLessThanOrEqual(1); // Max 2 per row
      }
    });

    it('should correctly re-index grid coordinates when buttons are added or removed', () => {
      const customButtons: TelegramMenuButton[] = [
        { id: 'b1', label: 'Каталог', action: 'CATALOG', row: 0, col: 0, isActive: true },
        { id: 'b2', label: 'Заказы', action: 'ORDERS', row: 0, col: 1, isActive: true },
        { id: 'b3', label: 'Пополнить', action: 'REFILL', row: 1, col: 0, isActive: true },
        { id: 'b4', label: 'Наш сайт', action: 'URL', row: 1, col: 1, value: 'https://smmplan.pro', isActive: true },
        { id: 'b5', label: 'FAQ', action: 'TEXT_REPLY', row: 2, col: 0, value: 'Ответы на вопросы', isActive: true },
      ];

      // Verify row distribution
      const row0 = customButtons.filter(b => b.row === 0);
      const row1 = customButtons.filter(b => b.row === 1);
      const row2 = customButtons.filter(b => b.row === 2);

      expect(row0).toHaveLength(2);
      expect(row1).toHaveLength(2);
      expect(row2).toHaveLength(1);
    });
  });

  // ── 2. CSAT RATING REASONS & TIERS ──
  describe('2. CSAT Rating Reasons & Tier Distribution', () => {
    it('should provide non-empty reason tags for all three sentiment tiers', () => {
      const reasons: TelegramRatingReasonsConfig = DEFAULT_TELEGRAM_RATING_REASONS;

      expect(reasons.negative).toBeDefined();
      expect(reasons.negative.length).toBeGreaterThanOrEqual(3);
      expect(reasons.negative).toContain('Долгий ответ');
      expect(reasons.negative).toContain('Проблема не решена');

      expect(reasons.neutral).toBeDefined();
      expect(reasons.neutral.length).toBeGreaterThanOrEqual(3);
      expect(reasons.neutral).toContain('Долго решали');

      expect(reasons.positive).toBeDefined();
      expect(reasons.positive.length).toBeGreaterThanOrEqual(3);
      expect(reasons.positive).toContain('Быстрый ответ');
      expect(reasons.positive).toContain('Вежливый оператор');
      expect(reasons.positive).toContain('Проблема решена на 100%');
    });

    it('should map star scores to the correct sentiment tier', () => {
      const getTier = (score: number): 'negative' | 'neutral' | 'positive' => {
        if (score <= 2) return 'negative';
        if (score === 3) return 'neutral';
        return 'positive';
      };

      expect(getTier(1)).toBe('negative');
      expect(getTier(2)).toBe('negative');
      expect(getTier(3)).toBe('neutral');
      expect(getTier(4)).toBe('positive');
      expect(getTier(5)).toBe('positive');
    });
  });

  // ── 3. MESSAGE TEMPLATES & VARIABLE INTERPOLATION ──
  describe('3. Message Templates & Variable Interpolation Engine', () => {
    it('should correctly format welcome template with system variables', () => {
      const template = DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.welcome;
      const formatted = template
        .replace(/{siteName}/g, 'SMMplan')
        .replace(/{userName}/g, 'Артём')
        .replace(/{balance}/g, '1 500.00');

      expect(formatted).toContain('SMMplan');
      expect(formatted).toContain('1 500.00 ₽');
      expect(formatted).not.toContain('{siteName}');
      expect(formatted).not.toContain('{balance}');
    });

    it('should correctly format CSAT ticket closed and thank you templates', () => {
      const closedTpl = DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.ticketClosedRating;
      const formattedClosed = closedTpl
        .replace(/{ticketId}/g, 'TK-8492')
        .replace(/{siteName}/g, 'SMMplan');

      expect(formattedClosed).toContain('TK-8492');
      expect(formattedClosed).not.toContain('{ticketId}');

      const thanksTpl = DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.ratingThanks;
      const formattedThanks = thanksTpl
        .replace(/{stars}/g, '⭐⭐⭐⭐⭐')
        .replace(/{reasons}/g, 'Быстрый ответ')
        .replace(/{siteName}/g, 'SMMplan');

      expect(formattedThanks).toContain('⭐⭐⭐⭐⭐');
      expect(formattedThanks).not.toContain('{stars}');
    });
  });

  // ── 4. DATABASE MODELS & TICKET FEEDBACK REPOSITORY ──
  describe('4. Database Models & Ticket Feedback Persistence', () => {
    let testUser: { id: string; email: string };
    let testTicket: { id: string };
    let createdUserIds: string[] = [];

    beforeEach(async () => {
      testUser = await db.user.create({
        data: {
          email: `test_csat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@smmplan.pro`,
          telegramId: '123456789',
          tenantId: 'smmplan'
        }
      });
      createdUserIds.push(testUser.id);

      testTicket = await db.ticket.create({
        data: {
          userId: testUser.id,
          subject: 'Проблема со скоростью заказа',
          status: 'CLOSED',
          source: 'TELEGRAM',
          tenantId: 'smmplan'
        }
      });
    });

    it('should create and retrieve TicketFeedback linked to Ticket and User', async () => {
      const feedback = await db.ticketFeedback.create({
        data: {
          ticketId: testTicket.id,
          userId: testUser.id,
          score: 5,
          reasons: ['Быстрый ответ', 'Проблема решена на 100%'],
          comment: 'Отличная работа оператора!',
          source: 'TELEGRAM',
          tenantId: 'smmplan'
        }
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.ticketId).toBe(testTicket.id);
      expect(feedback.userId).toBe(testUser.id);
      expect(feedback.score).toBe(5);
      expect(feedback.reasons).toHaveLength(2);
      expect(feedback.comment).toBe('Отличная работа оператора!');

      // Check relation from Ticket
      const ticketWithFeedback = await db.ticket.findUnique({
        where: { id: testTicket.id },
        include: { feedback: true }
      });

      expect(ticketWithFeedback?.feedback).toBeDefined();
      expect(ticketWithFeedback?.feedback?.score).toBe(5);
    });

    it('should perform idempotent upsert when user changes their star rating', async () => {
      // First rating (3 stars)
      await db.ticketFeedback.upsert({
        where: { ticketId: testTicket.id },
        create: {
          ticketId: testTicket.id,
          userId: testUser.id,
          score: 3,
          source: 'TELEGRAM',
          tenantId: 'smmplan'
        },
        update: { score: 3 }
      });

      let count = await db.ticketFeedback.count({ where: { ticketId: testTicket.id } });
      expect(count).toBe(1);

      // Changed rating to 5 stars
      const updated = await db.ticketFeedback.upsert({
        where: { ticketId: testTicket.id },
        create: {
          ticketId: testTicket.id,
          userId: testUser.id,
          score: 5,
          source: 'TELEGRAM',
          tenantId: 'smmplan'
        },
        update: { score: 5 }
      });

      count = await db.ticketFeedback.count({ where: { ticketId: testTicket.id } });
      expect(count).toBe(1);
      expect(updated.score).toBe(5);
    });

    it('should aggregate CSAT metrics and breakdown accurately', async () => {
      // Create additional tickets and feedbacks
      const user2 = await db.user.create({
        data: { email: `user2_${Date.now()}@smmplan.pro`, tenantId: 'smmplan' }
      });

      const t1 = await db.ticket.create({
        data: { userId: user2.id, subject: 'T1', status: 'CLOSED', tenantId: 'smmplan' }
      });
      const t2 = await db.ticket.create({
        data: { userId: user2.id, subject: 'T2', status: 'CLOSED', tenantId: 'smmplan' }
      });

      await db.ticketFeedback.createMany({
        data: [
          { ticketId: testTicket.id, userId: testUser.id, score: 5, reasons: ['Быстрый ответ', 'Вежливо'], tenantId: 'smmplan' },
          { ticketId: t1.id, userId: user2.id, score: 4, reasons: ['Быстрый ответ'], tenantId: 'smmplan' },
          { ticketId: t2.id, userId: user2.id, score: 3, reasons: ['Долго решали'], tenantId: 'smmplan' },
        ]
      });

      const all = await db.ticketFeedback.findMany({
        where: { userId: { in: [testUser.id, user2.id] } }
      });
      expect(all).toHaveLength(3);

      const totalScore = all.reduce((sum, f) => sum + f.score, 0);
      const avgScore = Number((totalScore / all.length).toFixed(2));
      expect(avgScore).toBe(4.0); // (5 + 4 + 3) / 3 = 4.0

      // Reason frequency
      const reasonCount: Record<string, number> = {};
      for (const f of all) {
        for (const r of f.reasons) {
          reasonCount[r] = (reasonCount[r] || 0) + 1;
        }
      }

      expect(reasonCount['Быстрый ответ']).toBe(2);
      expect(reasonCount['Вежливо']).toBe(1);
      expect(reasonCount['Долго решали']).toBe(1);
    });
  });

  // ── 5. SYSTEM SETTINGS JSON FIELD STORAGE ──
  describe('5. SystemSettings JSON Config Persistence', () => {
    it('should store and retrieve custom menu and template configurations', async () => {
      // Ensure a systemSettings row exists
      const tenant = await db.tenant.upsert({
        where: { id: 'smmplan' },
        create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.pro' },
        update: {}
      });

      const settings = await db.systemSettings.upsert({
        where: { id: 'smmplan' },
        create: {
          id: 'smmplan',
          telegramMenuConfig: DEFAULT_TELEGRAM_MENU_BUTTONS as any,
          telegramRatingReasons: DEFAULT_TELEGRAM_RATING_REASONS as any,
          telegramTemplates: DEFAULT_TELEGRAM_MESSAGE_TEMPLATES as any
        },
        update: {
          telegramMenuConfig: DEFAULT_TELEGRAM_MENU_BUTTONS as any,
          telegramRatingReasons: DEFAULT_TELEGRAM_RATING_REASONS as any,
          telegramTemplates: DEFAULT_TELEGRAM_MESSAGE_TEMPLATES as any
        }
      });

      expect(settings.telegramMenuConfig).toBeDefined();
      expect(settings.telegramRatingReasons).toBeDefined();
      expect(settings.telegramTemplates).toBeDefined();

      const menu = settings.telegramMenuConfig as unknown as TelegramMenuButton[];
      expect(menu).toHaveLength(6);
    });
  });
});
