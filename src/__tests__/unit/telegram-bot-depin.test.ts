import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockSystemSettingsFindUnique,
  mockUserFindFirst,
} = vi.hoisted(() => ({
  mockSystemSettingsFindUnique: vi.fn(),
  mockUserFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    systemSettings: {
      findUnique: mockSystemSettingsFindUnique,
    },
    user: {
      findFirst: mockUserFindFirst,
    },
    dePinNode: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    dePinTarget: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    authToken: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnValue({
      subscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    }),
  },
}));

vi.mock('@/lib/telegram-agent', () => ({
  getTelegramProxyAgent: vi.fn().mockReturnValue(undefined),
  resolveActiveTelegramProxyUrl: vi.fn().mockResolvedValue(null),
  reportTelegramProxyFailure: vi.fn().mockResolvedValue(undefined),
}));

import { getBotDepinUrl, getDynamicInlineKeyboard, sendDepinAppPrompt } from '@/bot/index';
import { saveTelegramMenuConfigAction } from '@/actions/admin/telegram-bot/bot-enterprise-config-actions';

describe('Telegram Bot DePIN Mini App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSystemSettingsFindUnique.mockResolvedValue(null);
    mockUserFindFirst.mockResolvedValue(null);
  });

  it('getBotDepinUrl должен корректно резолвить URL мини-приложения /depin', () => {
    const originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://smmplan.pro';

    try {
      const url = getBotDepinUrl();
      expect(url).toBe('https://smmplan.pro/depin');
    } finally {
      if (originalAppUrl !== undefined) process.env.APP_URL = originalAppUrl;
      else delete process.env.APP_URL;
    }
  });

  it('getDynamicInlineKeyboard должен содержать кнопку запуска DePIN Mini App на 1-й строке', async () => {
    const originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://smmplan.pro';

    try {
      const keyboard = await getDynamicInlineKeyboard();
      expect(keyboard).toBeDefined();
      expect(keyboard.reply_markup).toBeDefined();

      const inlineKeyboard = keyboard.reply_markup.inline_keyboard;
      expect(inlineKeyboard.length).toBeGreaterThan(0);

      // Первая строка обязана содержать кнопку DePIN Mini App
      const firstRow = inlineKeyboard[0];
      const depinButton = firstRow.find(
        (btn) =>
          btn.text.includes('DePIN') ||
          ('web_app' in btn && typeof btn.web_app.url === 'string' && btn.web_app.url.includes('/depin'))
      );

      expect(depinButton).toBeDefined();
      expect(depinButton?.text).toContain('DePIN');
      if (depinButton && 'web_app' in depinButton) {
        expect(depinButton.web_app.url).toBe('https://smmplan.pro/depin');
      } else {
        throw new Error('depinButton must be WebAppButton');
      }
    } finally {
      if (originalAppUrl !== undefined) process.env.APP_URL = originalAppUrl;
      else delete process.env.APP_URL;
    }
  });

  it('sendDepinAppPrompt должен отправлять приветственное сообщение и WebApp кнопку запуска', async () => {
    const originalAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://smmplan.pro';

    const mockReply = vi.fn().mockResolvedValue({ message_id: 123 });
    const ctxMock = {
      reply: mockReply,
    } as unknown as Parameters<typeof sendDepinAppPrompt>[0];

    try {
      await sendDepinAppPrompt(ctxMock);

      expect(mockReply).toHaveBeenCalledTimes(1);
      const [replyText, replyOptions] = mockReply.mock.calls[0];

      expect(replyText).toContain('DePIN Биржа микро-заданий SMMplan');
      expect(replyText).toContain('Пакетный просмотр:</b> 3 поста подряд (+15 PTS)');
      expect(replyText).toContain('Умные комментарии:</b> ИИ-генерация органичных мнений (+35 PTS)');
      expect(replyText).toContain('Trust Score:</b> защита аккаунта от спам-блока');

      const inlineKeyboard = replyOptions.reply_markup.inline_keyboard;
      expect(inlineKeyboard).toBeDefined();
      const launchBtn = inlineKeyboard[0][0];
      expect(launchBtn.text).toContain('Запустить DePIN Mini App');
      if ('web_app' in launchBtn) {
        expect(launchBtn.web_app.url).toBe('https://smmplan.pro/depin');
      } else {
        throw new Error('launchBtn must be WebAppButton');
      }
    } finally {
      if (originalAppUrl !== undefined) process.env.APP_URL = originalAppUrl;
      else delete process.env.APP_URL;
    }
  });

  it('saveTelegramMenuConfigAction должен поддерживать тип действия DEPIN', async () => {
    // Проверяем Zod схему валидации кнопок админ панели
    const testMenuButtons = [
      {
        id: 'btn_depin_custom',
        label: '⚡ DePIN Задания',
        action: 'DEPIN' as const,
        row: 0,
        col: 0,
        isActive: true,
      },
    ];

    // Mock permissions and tenant enforcer
    mockSystemSettingsFindUnique.mockResolvedValue({ id: 'smmplan' });

    const result = await saveTelegramMenuConfigAction(testMenuButtons);
    // В тестовой среде без сессии вернется ошибка авторизации, но НЕ ошибка валидации схемы Zod
    expect(result.error).not.toContain('Invalid enum value');
  });
});
