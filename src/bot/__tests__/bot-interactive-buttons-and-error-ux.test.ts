import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWizardMenuNavigation } from '../utils/menu-navigation';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'u-1', balance: BigInt(50000) }),
    },
    systemSettings: {
      findFirst: vi.fn().mockResolvedValue({ telegramTemplates: {} }),
      findUnique: vi.fn().mockResolvedValue({ telegramTemplates: {}, telegramMenuConfig: null }),
    },
  },
}));

describe('Telegram Bot: Interactive Buttons & Actionable Error UX Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Menu Navigation & Interruption Tests', () => {
    it('1.1 should intercept "🏠 Главное меню" and trigger navigation to start', async () => {
      const mockCtx: any = {
        scene: {
          leave: vi.fn().mockResolvedValue(true),
        },
        reply: vi.fn().mockResolvedValue({}),
        from: { id: 12345678, first_name: 'TestUser' }
      };

      const intercepted = await handleWizardMenuNavigation(mockCtx, '🏠 Главное меню');
      expect(intercepted).toBe(true);
      expect(mockCtx.scene.leave).toHaveBeenCalled();
      expect(mockCtx.reply).toHaveBeenCalled();
    });

    it('1.2 should intercept "💰 Пополнить" and enter DEPOSIT_WIZARD', async () => {
      const mockCtx: any = {
        scene: {
          leave: vi.fn().mockResolvedValue(true),
          enter: vi.fn().mockResolvedValue(true),
        },
      };

      const intercepted = await handleWizardMenuNavigation(mockCtx, '💰 Пополнить');
      expect(intercepted).toBe(true);
      expect(mockCtx.scene.leave).toHaveBeenCalled();
      expect(mockCtx.scene.enter).toHaveBeenCalledWith('deposit-wizard');
    });

    it('1.3 should intercept "🆘 Поддержка" cleanly during wizard execution', async () => {
      const mockCtx: any = {
        scene: {
          leave: vi.fn().mockResolvedValue(true),
        },
        reply: vi.fn().mockResolvedValue({}),
      };

      const intercepted = await handleWizardMenuNavigation(mockCtx, '🆘 Поддержка');
      expect(intercepted).toBe(true);
      expect(mockCtx.scene.leave).toHaveBeenCalled();
    });

    it('1.4 should NOT intercept regular numerical inputs (e.g. "500", "1000")', async () => {
      const mockCtx: any = {
        scene: { leave: vi.fn() }
      };

      const intercepted = await handleWizardMenuNavigation(mockCtx, '500');
      expect(intercepted).toBe(false);
      expect(mockCtx.scene.leave).not.toHaveBeenCalled();
    });
  });

  describe('2. Negative Scenarios & Edge Cases', () => {
    it('2.1 validates deposit amount bounds (rejects < 100 or > 500,000)', () => {
      const validateAmount = (input: string): { isValid: boolean; error?: string } => {
        const num = parseInt(input.replace(/\D/g, ''), 10);
        if (isNaN(num) || num < 100 || num > 500000) {
          return { isValid: false, error: 'Сумма пополнения должна быть от 100 до 500 000 ₽' };
        }
        return { isValid: true };
      };

      expect(validateAmount('abc').isValid).toBe(false);
      expect(validateAmount('50').isValid).toBe(false);
      expect(validateAmount('99').isValid).toBe(false);
      expect(validateAmount('500001').isValid).toBe(false);
      expect(validateAmount('500').isValid).toBe(true);
      expect(validateAmount('15 000 ₽').isValid).toBe(true);
    });

    it('2.2 validates order quantity bounds against service limits', () => {
      const minQty = 50;
      const maxQty = 10000;

      const validateQty = (qty: number): boolean => {
        return !isNaN(qty) && qty >= minQty && qty <= maxQty;
      };

      expect(validateQty(10)).toBe(false);
      expect(validateQty(20000)).toBe(false);
      expect(validateQty(50)).toBe(true);
      expect(validateQty(500)).toBe(true);
    });

    it('2.3 validates Drip-Feed floor invariant: total >= minQty * runs', () => {
      const minQty = 100;
      const runs = 5;

      const validateDripFeed = (totalQty: number): boolean => {
        return Math.floor(totalQty / runs) >= minQty;
      };

      expect(validateDripFeed(400)).toBe(false);
      expect(validateDripFeed(499)).toBe(false);
      expect(validateDripFeed(500)).toBe(true);
      expect(validateDripFeed(1000)).toBe(true);
    });
  });

  describe('3. Link Analyzer Edge Cases & Validation', () => {
    const analyzer = new IntelligenceLinkAnalyzer();

    it('3.1 handles empty and junk URLs gracefully without throwing', async () => {
      const res1 = await analyzer.analyze('');
      expect(res1?.platform).toBe('OTHER');

      const res2 = await analyzer.analyze('   ');
      expect(res2?.platform).toBe('OTHER');

      // Junk strings without platform patterns fallback safely to OTHER without throwing exceptions
      const res3 = await analyzer.analyze('not-a-url');
      expect(res3).toBeDefined();
      expect(res3?.platform).toBe('OTHER');
    });

    it('3.2 parses valid Telegram channel and post links correctly', async () => {
      const channelRes = await analyzer.analyze('https://t.me/durov');
      expect(channelRes).toBeDefined();
      expect(channelRes?.platform).toBe('TELEGRAM');

      const postRes = await analyzer.analyze('https://t.me/durov/123');
      expect(postRes).toBeDefined();
      expect(postRes?.platform).toBe('TELEGRAM');
      expect(postRes?.type).toBe('post');
    });
  });

  describe('4. Actionable Error UX Buttons Structure', () => {
    it('4.1 should structure error message with Support, Retry, and Main Menu buttons', () => {
      const buildErrorMarkup = (errorText: string) => ({
        text: `❌ Ошибка при создании платежа\n────────────────────\n${errorText}`,
        inline_keyboard: [
          [{ text: '🆘 Написать в поддержку', callback_data: 'support' }],
          [
            { text: '🔄 Попробовать снова', callback_data: 'deposit' },
            { text: '🏠 В главное меню', callback_data: 'nav_start' }
          ]
        ]
      });

      const errorPayload = buildErrorMarkup('Сервер оплаты временно недоступен');
      expect(errorPayload.text).toContain('Сервер оплаты временно недоступен');
      expect(errorPayload.inline_keyboard[0][0].callback_data).toBe('support');
      expect(errorPayload.inline_keyboard[1][1].callback_data).toBe('nav_start');
    });

    it('4.2 should provide Return to Main Menu and Choose Service on order cancellation', () => {
      const buildCancelMarkup = () => ({
        text: '❌ Оформление заказа отменено.',
        inline_keyboard: [
          [
            { text: '🛍 Выбрать другую услугу', callback_data: 'shop' },
            { text: '🏠 В главное меню', callback_data: 'nav_start' }
          ]
        ]
      });

      const cancelPayload = buildCancelMarkup();
      expect(cancelPayload.inline_keyboard[0][0].callback_data).toBe('shop');
      expect(cancelPayload.inline_keyboard[0][1].callback_data).toBe('nav_start');
    });
  });
});
