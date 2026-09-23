import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotSettingsService } from '../services/bot-settings.service';
import { dispatchDynamicMenuAction } from '../index';
import {
  DEFAULT_TELEGRAM_MENU_BUTTONS,
  DEFAULT_TELEGRAM_MESSAGE_TEMPLATES,
  DEFAULT_TELEGRAM_RATING_REASONS,
  type TelegramMenuButton
} from '@/types/telegram';

vi.mock('@/lib/db', () => ({
  db: {
    systemSettings: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'u-1', balance: BigInt(50000) }),
      findUnique: vi.fn().mockResolvedValue({ id: 'u-1', balance: BigInt(50000) }),
      upsert: vi.fn().mockResolvedValue({ id: 'u-1', balance: BigInt(50000) }),
    },
    order: {
      count: vi.fn().mockResolvedValue(3),
      findMany: vi.fn().mockResolvedValue([]),
    },
    ticketFeedback: {
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  },
}));

vi.mock('../services/bot-catalog.service', () => ({
  BotCatalogService: {
    getVisibleNetworks: vi.fn().mockResolvedValue([{ id: 'net_tg', name: 'Telegram' }]),
    getVisibleCategories: vi.fn().mockResolvedValue([{ id: 'cat_sub', name: 'Подписчики' }]),
    findNetworkByPlatform: vi.fn().mockResolvedValue({ id: 'net_tg', name: 'Telegram' }),
  },
}));

describe('Telegram Bot: Admin Panel Management & Ecosystem Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BotSettingsService.invalidate();
  });

  describe('1. Multi-Tenant Isolation & Cache Management', () => {
    it('1.1 should query SystemSettings strictly with tenant ID (where: { id: tenantId })', async () => {
      const { db } = await import('@/lib/db');
      (db.systemSettings.findUnique as any).mockResolvedValueOnce({
        id: 'smmplan',
        telegramMenuConfig: null,
        telegramTemplates: null,
      });

      await BotSettingsService.getSettings('smmplan');

      expect(db.systemSettings.findUnique).toHaveBeenCalledWith({
        where: { id: 'smmplan' }
      });
    });

    it('1.2 should cache settings and avoid repeated DB hits within TTL', async () => {
      const { db } = await import('@/lib/db');
      (db.systemSettings.findUnique as any).mockResolvedValueOnce({
        id: 'smmplan',
        telegramMaintenanceMode: false,
      });

      const res1 = await BotSettingsService.getSettings('smmplan');
      const res2 = await BotSettingsService.getSettings('smmplan');

      expect(res1).toEqual(res2);
      expect(db.systemSettings.findUnique).toHaveBeenCalledTimes(1);
    });

    it('1.3 should immediately refetch from DB after cache invalidation', async () => {
      const { db } = await import('@/lib/db');
      (db.systemSettings.findUnique as any)
        .mockResolvedValueOnce({ id: 'smmplan', telegramMaintenanceMode: false })
        .mockResolvedValueOnce({ id: 'smmplan', telegramMaintenanceMode: true });

      await BotSettingsService.getSettings('smmplan');
      BotSettingsService.invalidate('smmplan');
      const fresh = await BotSettingsService.getSettings('smmplan');

      expect(fresh?.telegramMaintenanceMode).toBe(true);
      expect(db.systemSettings.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. Dynamic Templates & Fallback Mechanism', () => {
    it('2.1 should merge custom templates over defaults when configured in Admin Panel', async () => {
      const { db } = await import('@/lib/db');
      (db.systemSettings.findUnique as any).mockResolvedValueOnce({
        id: 'smmplan',
        telegramTemplates: {
          welcome: 'Привет {userName}! Специальная скидка для {siteName}: баланс {balance} ₽',
          ticketClosedRating: 'Тикет {ticketId} закрыт, оцените пожалуйста!'
        }
      });

      const templates = await BotSettingsService.getTemplates('smmplan');
      expect(templates.welcome).toContain('Специальная скидка');
      expect(templates.ticketClosedRating).toContain('Тикет {ticketId} закрыт');
      // Non-overridden templates should remain defaults
      expect(templates.ratingThanks).toBe(DEFAULT_TELEGRAM_MESSAGE_TEMPLATES.ratingThanks);
    });

    it('2.2 should fall back to welcomeMessage if telegramTemplates.welcome is unset', async () => {
      const { db } = await import('@/lib/db');
      (db.systemSettings.findUnique as any).mockResolvedValueOnce({
        id: 'smmplan',
        welcomeMessage: 'Добро пожаловать через legacy welcomeMessage!',
        telegramTemplates: null
      });

      const templates = await BotSettingsService.getTemplates('smmplan');
      expect(templates.welcome).toBe('Добро пожаловать через legacy welcomeMessage!');
    });
  });

  describe('3. Dynamic Menu Buttons & Action Dispatcher', () => {
    it('3.1 should return configured buttons and filter out inactive ones', async () => {
      const { db } = await import('@/lib/db');
      const customButtons: TelegramMenuButton[] = [
        { id: 'b1', label: '🛍 Каталог услуг', action: 'CATALOG', row: 0, col: 0, isActive: true },
        { id: 'b2', label: '❌ Скрытая кнопка', action: 'ORDERS', row: 0, col: 1, isActive: false },
        { id: 'b3', label: '🌐 Наш сайт', action: 'URL', value: 'https://smmplan.pro', row: 1, col: 0, isActive: true },
      ];

      (db.systemSettings.findUnique as any).mockResolvedValueOnce({
        id: 'smmplan',
        telegramMenuConfig: customButtons
      });

      const activeButtons = await BotSettingsService.getMenuButtons('smmplan');
      expect(activeButtons.length).toBe(2);
      expect(activeButtons.map(b => b.id)).toEqual(['b1', 'b3']);
    });

    it('3.2 should match button by text regardless of leading emojis or casing', async () => {
      const { db } = await import('@/lib/db');
      const customButtons: TelegramMenuButton[] = [
        { id: 'b1', label: '🛍 Витрина услуг', action: 'CATALOG', row: 0, col: 0, isActive: true },
        { id: 'b2', label: '💬 Частые вопросы', action: 'TEXT_REPLY', value: 'Ответ на FAQ', row: 1, col: 0, isActive: true }
      ];

      (db.systemSettings.findUnique as any).mockResolvedValue({
        id: 'smmplan',
        telegramMenuConfig: customButtons
      });

      const match1 = await BotSettingsService.findButtonByText('🛍 Витрина услуг', 'smmplan');
      expect(match1?.action).toBe('CATALOG');

      const match2 = await BotSettingsService.findButtonByText('витрина услуг', 'smmplan');
      expect(match2?.action).toBe('CATALOG');

      const match3 = await BotSettingsService.findButtonByText('Частые вопросы', 'smmplan');
      expect(match3?.action).toBe('TEXT_REPLY');
    });

    it('3.3 should dispatch custom URL action with interactive button', async () => {
      const { db } = await import('@/lib/db');
      const customButtons: TelegramMenuButton[] = [
        { id: 'b_url', label: '🌐 Наш блог', action: 'URL', value: 'https://smmplan.pro/blog', row: 0, col: 0, isActive: true }
      ];

      (db.systemSettings.findUnique as any).mockResolvedValue({
        id: 'smmplan',
        telegramMenuConfig: customButtons
      });

      const mockCtx: any = {
        scene: { leave: vi.fn().mockResolvedValue(true) },
        reply: vi.fn().mockResolvedValue({}),
        from: { id: 12345678 }
      };

      const handled = await dispatchDynamicMenuAction(mockCtx, '🌐 Наш блог');
      expect(handled).toBe(true);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Наш блог'),
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('3.4 should dispatch custom TEXT_REPLY (FAQ) action directly', async () => {
      const { db } = await import('@/lib/db');
      const customButtons: TelegramMenuButton[] = [
        { id: 'b_faq', label: '❓ Как сделать заказ', action: 'TEXT_REPLY', value: '<b>Инструкция:</b> отправьте ссылку!', row: 0, col: 0, isActive: true }
      ];

      (db.systemSettings.findUnique as any).mockResolvedValue({
        id: 'smmplan',
        telegramMenuConfig: customButtons
      });

      const mockCtx: any = {
        scene: { leave: vi.fn().mockResolvedValue(true) },
        reply: vi.fn().mockResolvedValue({}),
        from: { id: 12345678 }
      };

      const handled = await dispatchDynamicMenuAction(mockCtx, '❓ Как сделать заказ');
      expect(handled).toBe(true);
      expect(mockCtx.reply).toHaveBeenCalledWith(
        '<b>Инструкция:</b> отправьте ссылку!',
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });
  });

  describe('4. Security & Maintenance Mode Control', () => {
    it('4.1 should detect active maintenance mode from DB settings', async () => {
      const { db } = await import('@/lib/db');
      (db.systemSettings.findUnique as any).mockResolvedValueOnce({
        id: 'smmplan',
        telegramMaintenanceMode: true,
        telegramMaxMessageLength: 2000,
        telegramRateLimitPerMin: 20
      });

      const isMaint = await BotSettingsService.isMaintenanceActive('smmplan');
      const sec = await BotSettingsService.getSecurityConfig('smmplan');

      expect(isMaint).toBe(true);
      expect(sec.maxMessageLength).toBe(2000);
      expect(sec.rateLimitPerMin).toBe(20);
    });
  });
});
