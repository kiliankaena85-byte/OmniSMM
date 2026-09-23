import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BOT_PRESETS, type TelegramBotRole } from '@/types/telegram-builder';
import { multiBotManager } from '../manager/multi-bot-manager';
import { attachRoleHandlers } from '../constructors/role-handlers';
import {
  listTelegramBotsAction,
  createTelegramBotAction,
  toggleTelegramBotStatusAction,
  testTelegramBotTokenAction
} from '@/actions/admin/telegram-bots-manager';

// Mock DB
vi.mock('@/lib/db', () => {
  const botsStore: any[] = [];
  return {
    db: {
      telegramBotInstance: {
        findMany: vi.fn().mockImplementation(async ({ where }: any) => {
          return botsStore.filter((b) => !where?.tenantId || b.tenantId === where.tenantId);
        }),
        findUnique: vi.fn().mockImplementation(async ({ where }: any) => {
          return botsStore.find((b) => b.id === where.id) || null;
        }),
        count: vi.fn().mockImplementation(async ({ where }: any) => {
          return botsStore.filter((b) => !where?.tenantId || b.tenantId === where.tenantId).length;
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          const item = { id: data.id || `bot_${Date.now()}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          botsStore.push(item);
          return item;
        }),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          const idx = botsStore.findIndex((b) => b.id === where.id);
          if (idx !== -1) {
            botsStore[idx] = { ...botsStore[idx], ...data, updatedAt: new Date() };
            return botsStore[idx];
          }
          return null;
        }),
        delete: vi.fn().mockImplementation(async ({ where }: any) => {
          const idx = botsStore.findIndex((b) => b.id === where.id);
          if (idx !== -1) botsStore.splice(idx, 1);
          return true;
        }),
      },
      systemSettings: {
        findUnique: vi.fn().mockResolvedValue({
          contactTelegramBot: 'smmplan_support_bot',
          telegramMaintenanceMode: false,
          welcomeMessage: 'Привет!',
          telegramMenuConfig: [],
          telegramTemplates: {}
        }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'u_test', telegramId: '123' }),
        count: vi.fn().mockResolvedValue(100),
      },
      order: {
        count: vi.fn().mockResolvedValue(500),
      }
    },
  };
});

// Mock RBAC
vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn().mockImplementation((_sec: string, _perm: string, cb: Function) => {
    return cb({ id: 'admin_1', email: 'admin@smmplan.pro' });
  }),
}));

// Mock VaultService
vi.mock('@/lib/vault', () => ({
  VaultService: {
    encrypt: vi.fn((val: string) => `encrypted_${val}`),
    decrypt: vi.fn((val: string) => val.replace('encrypted_', '')),
  }
}));

// Mock Audit
vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(true),
}));

// Mock Next.js cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('OmniSMM Telegram Bot Constructor & Multi-Bot Platform Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Presets Integrity & Completeness', () => {
    const roles: TelegramBotRole[] = ['STORE_FULL', 'SUPPORT_ONLY', 'NEWS_BROADCAST', 'STAFF_ADMIN', 'CUSTOM_BUILDER'];

    it.each(roles)('1.%# should have valid configuration for preset %s', (role) => {
      const preset = BOT_PRESETS[role];
      expect(preset).toBeDefined();
      expect(preset.title).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.welcomeMessage).toContain('{userName}');
      expect(Array.isArray(preset.menuConfig)).toBe(true);
      expect(preset.menuConfig.length).toBeGreaterThan(0);
    });

    it('1.6 should have valid step transitions in CUSTOM_BUILDER preset', () => {
      const custom = BOT_PRESETS.CUSTOM_BUILDER;
      expect(custom.flowConfig.length).toBeGreaterThanOrEqual(2);
      const entry = custom.flowConfig.find((s) => s.triggerType === 'entry');
      expect(entry).toBeDefined();
      expect(entry?.buttons.some((b) => b.action === 'next_step')).toBe(true);
    });
  });

  describe('2. MultiBotManager Core Daemon', () => {
    it('2.1 should validate raw bot token format', async () => {
      const emptyRes = await multiBotManager.verifyToken('');
      expect(emptyRes.valid).toBe(false);

      const shortRes = await multiBotManager.verifyToken('123:abc');
      expect(shortRes.valid).toBe(false);
    });

    it('2.2 should track bot active state accurately', () => {
      expect(multiBotManager.isBotRunning('fake_id')).toBe(false);
      expect(typeof multiBotManager.getActiveCount()).toBe('number');
    });
  });

  describe('3. Role Pipeline Handlers Generation', () => {
    it('3.1 should attach role handlers to telegraf bot instance without error', () => {
      const mockBot: any = {
        use: vi.fn(),
        start: vi.fn(),
        on: vi.fn(),
        command: vi.fn(),
        action: vi.fn(),
      };

      expect(() => {
        attachRoleHandlers(mockBot, 'SUPPORT_ONLY', {
          botId: 'bot_supp',
          tenantId: 'smmplan',
          botName: 'Support Bot',
          menuConfig: BOT_PRESETS.SUPPORT_ONLY.menuConfig,
        });
      }).not.toThrow();

      expect(mockBot.start).toHaveBeenCalled();
      expect(mockBot.on).toHaveBeenCalled();
    });

    it('3.2 should attach STAFF_ADMIN auth guards and commands (/health, /balances)', () => {
      const mockBot: any = {
        use: vi.fn(),
        start: vi.fn(),
        on: vi.fn(),
        command: vi.fn(),
        action: vi.fn(),
      };

      attachRoleHandlers(mockBot, 'STAFF_ADMIN', {
        botId: 'bot_admin',
        tenantId: 'smmplan',
        botName: 'Staff Admin Hub',
        allowedUserIds: ['268747191'],
      });

      expect(mockBot.command).toHaveBeenCalledWith(['health', 'status'], expect.any(Function));
      expect(mockBot.command).toHaveBeenCalledWith('balances', expect.any(Function));
    });

    it('3.3 should attach CUSTOM_BUILDER dynamic flow callback routes', () => {
      const mockBot: any = {
        use: vi.fn(),
        start: vi.fn(),
        on: vi.fn(),
        command: vi.fn(),
        action: vi.fn(),
      };

      attachRoleHandlers(mockBot, 'CUSTOM_BUILDER', {
        botId: 'bot_custom',
        tenantId: 'smmplan',
        botName: 'Custom Bot',
        flowConfig: BOT_PRESETS.CUSTOM_BUILDER.flowConfig,
      });

      expect(mockBot.action).toHaveBeenCalledWith(expect.any(RegExp), expect.any(Function));
      expect(mockBot.on).toHaveBeenCalledWith('text', expect.any(Function));
    });
  });

  describe('4. Server Actions Management', () => {
    it('4.1 should auto-seed existing primary bot into constructor on first list call', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '7123456789:AAH_test_valid_token_string';

      const res = await listTelegramBotsAction('smmplan');
      expect(res.success).toBe(true);
      expect(res.bots).toBeDefined();
      expect(res.bots!.length).toBeGreaterThan(0);

      const primary = res.bots![0];
      expect(primary.role).toBe('STORE_FULL');
      expect(primary.tokenMasked).toContain('****');
    });

    it('4.2 should toggle bot active status in constructor', async () => {
      const list = await listTelegramBotsAction('smmplan');
      const bot = list.bots![0];

      const toggleRes = await toggleTelegramBotStatusAction(bot.id, false);
      expect(toggleRes.success).toBe(true);
    });

    it('4.3 should reject creation with invalid token', async () => {
      const res = await createTelegramBotAction({
        name: 'Bad Token Bot',
        token: 'invalid',
        role: 'SUPPORT_ONLY',
        tenantId: 'smmplan'
      });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
