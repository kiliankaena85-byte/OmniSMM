import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  importTelegramSessionsAction,
  getTelegramPoolStatsAction,
  BulkSessionImportSchema,
  RawSessionItemSchema,
} from '@/actions/admin/production/sessions';
import { TelegramSessionPoolManager } from '@/services/production/telegram-session-pool';
import { auditAdminAwaitable } from '@/lib/admin-audit';

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn().mockImplementation(async (_section, _action, fn) => {
    return fn({ id: 'admin_test_1', email: 'owner@smmplan.ru', role: 'OWNER' });
  }),
}));

describe('Telegram Sessions Admin Action (FR-6 Bulk Ingestion)', () => {
  beforeEach(() => {
    TelegramSessionPoolManager.resetInstance();
    vi.clearAllMocks();
  });

  describe('Zod DTO Validation (BulkSessionImportSchema)', () => {
    it('должен валидировать корректную запись с authKeyHex', () => {
      const validItem = {
        phone: '+79991234567',
        authKeyHex: 'ab'.repeat(256), // 512 символов
        dcId: 2,
        hasPremium: true,
      };

      const result = RawSessionItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('должен валидировать запись с StringSession', () => {
      const validItem = {
        phone: '+79998887766',
        sessionString: '1BQ1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        hasPremium: false,
      };

      const result = RawSessionItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('должен отклонять запись без authKeyHex и без sessionString', () => {
      const invalidItem = {
        phone: '+79991234567',
      };

      const result = RawSessionItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('должен отклонять некорректный телефон', () => {
      const invalidItem = {
        phone: 'invalid-phone',
        authKeyHex: 'ff'.repeat(256),
      };

      const result = RawSessionItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });
  });

  describe('importTelegramSessionsAction Execution', () => {
    it('должен успешно импортировать пачку сессий и фиксировать аудит с маскировкой', async () => {
      const payload = {
        sessions: [
          {
            phone: '+79991112233',
            authKeyHex: '01'.repeat(256),
            dcId: 2,
            hasPremium: true,
            proxyUrl: 'socks5://user:pass@127.0.0.1:1080',
          },
          {
            phone: '+79994445566',
            sessionString: '1abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            dcId: 4,
            hasPremium: false,
          },
        ],
        testConnectionBeforeSave: false,
      };

      const res = await importTelegramSessionsAction(payload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.total).toBe(2);
        expect(res.successfulCount).toBe(2);
        expect(res.results[0].phoneMasked).toBe('+799***33');
        expect(res.results[1].phoneMasked).toBe('+799***66');
      }

      const pool = TelegramSessionPoolManager.getInstance();
      expect(pool.getTotalCount()).toBe(2);
      expect(pool.getSession('tg_79991112233')?.hasPremium).toBe(true);
      expect(pool.getSession('tg_79994445566')?.hasPremium).toBe(false);

      expect(auditAdminAwaitable).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TELEGRAM_SESSIONS_BULK_IMPORT',
          targetType: 'TELEGRAM_SESSION',
          newValue: expect.objectContaining({
            totalRequested: 2,
            successfulCount: 2,
            phonesMasked: ['+799***33', '+799***66'],
          }),
        })
      );
    });

    it('должен возвращать ошибку валидации при некорректном DTO', async () => {
      const res = await importTelegramSessionsAction({
        sessions: [], // Пустой массив
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Ошибки валидации входных данных');
      }
    });

    it('должен корректно возвращать статистику пула через getTelegramPoolStatsAction', async () => {
      const pool = TelegramSessionPoolManager.getInstance();
      pool.registerSession({
        id: 'tg_stat_1',
        phoneNumber: '+79991110001',
        dcId: 2,
        state: 'READY',
        hasPremium: true,
        interactionHealthScore: 95,
        deviceModel: 'Pixel 8',
        appVersion: '10.0',
        systemVersion: 'Android 14',
        lastActionAt: Date.now(),
      });

      const res = await getTelegramPoolStatsAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.stats.totalSessions).toBe(1);
        expect(res.stats.activeSessions).toBe(1);
        expect(res.stats.premiumAccounts).toBe(1);
        expect(res.stats.availableBoostSlots).toBe(4);
      }
    });
  });
});
