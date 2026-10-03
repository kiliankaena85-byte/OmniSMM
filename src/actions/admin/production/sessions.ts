'use server';

import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import {
  TelegramSessionPoolManager,
  TelegramSessionProfile,
  TelegramDC,
} from '@/services/production/telegram-session-pool';
import {
  createStringSessionFromAuthKey,
  parseTelegramProxy,
} from '@/services/production/telegram-mtproto-executor';

export const RawSessionItemSchema = z
  .object({
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Некорректный номер телефона E.164'),
    authKeyHex: z.string().length(512, 'AuthKey должен быть hex-строкой ровно 256 байт (512 символов)').optional(),
    sessionString: z.string().min(50, 'Слишком короткая StringSession').optional(),
    dcId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).default(2),
    appId: z.number().int().positive().default(2040),
    appHash: z.string().min(10).default('b18441a1ff607e10a989891a5462e627'),
    deviceModel: z.string().default('Samsung SM-S918B'),
    systemVersion: z.string().default('Android 14'),
    appVersion: z.string().default('10.14.0'),
    hasPremium: z.boolean().default(true),
    proxyUrl: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.authKeyHex || data.sessionString, {
    message: 'Необходимо указать либо authKeyHex (512 hex), либо sessionString',
  });

export const BulkSessionImportSchema = z.object({
  sessions: z.array(RawSessionItemSchema).min(1, 'Минимум 1 сессия для импорта').max(500, 'Максимум 500 сессий за один раз'),
  testConnectionBeforeSave: z.boolean().default(true),
});

export type BulkSessionImportDto = z.infer<typeof BulkSessionImportSchema>;

export interface ImportedSessionSummary {
  id: string;
  phoneMasked: string;
  dcId: number;
  hasPremium: boolean;
  hasProxy: boolean;
  success: boolean;
  error?: string;
}

/**
 * FR-6: Безопасный пакетный импорт купленных Telegram-сессий (Session+Json / SQLite AuthKey)
 * Доступен сотрудникам с правом управления провайдерами и инфраструктурой (OWNER / MANAGERS)
 */
export async function importTelegramSessionsAction(rawInput: unknown) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const parseResult = BulkSessionImportSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return {
        success: false as const,
        error: 'Ошибки валидации входных данных',
        fieldErrors: parseResult.error.flatten().fieldErrors,
      };
    }

    const { sessions } = parseResult.data;
    const pool = TelegramSessionPoolManager.getInstance();
    const results: ImportedSessionSummary[] = [];
    const phonesAudit: string[] = [];

    for (const item of sessions) {
      const cleanPhone = item.phone.trim();
      const phoneDigits = cleanPhone.replace(/\D/g, '');
      const sessionId = `tg_${phoneDigits}`;
      const maskedPhone = cleanPhone.length > 6
        ? `${cleanPhone.slice(0, 4)}***${cleanPhone.slice(-2)}`
        : '***';

      try {
        let stringSession = item.sessionString;
        if (!stringSession && item.authKeyHex) {
          const authKeyBuffer = Buffer.from(item.authKeyHex, 'hex');
          stringSession = createStringSessionFromAuthKey(authKeyBuffer, item.dcId as TelegramDC);
        }

        if (item.proxyUrl && item.proxyUrl.trim()) {
          const parsedProxy = parseTelegramProxy(item.proxyUrl.trim());
          if (!parsedProxy) {
            results.push({
              id: sessionId,
              phoneMasked: maskedPhone,
              dcId: item.dcId,
              hasPremium: item.hasPremium,
              hasProxy: false,
              success: false,
              error: 'Некорректный формат прокси (поддерживается socks5://user:pass@host:port или host:port:user:pass)',
            });
            continue;
          }
        }

        const profile: TelegramSessionProfile = {
          id: sessionId,
          phoneNumber: cleanPhone,
          sessionString: stringSession,
          appId: item.appId,
          appHash: item.appHash,
          dcId: item.dcId as TelegramDC,
          state: 'READY',
          hasPremium: item.hasPremium,
          interactionHealthScore: 90,
          deviceModel: item.deviceModel,
          appVersion: item.appVersion,
          systemVersion: item.systemVersion,
          proxyUrl: item.proxyUrl?.trim() || undefined,
          lastActionAt: Date.now(),
          boostSlots: [
            { slotIndex: 0 },
            { slotIndex: 1 },
            { slotIndex: 2 },
            { slotIndex: 3 },
          ],
        };

        pool.registerSession(profile);
        await pool.syncSessionToDb(sessionId);

        results.push({
          id: sessionId,
          phoneMasked: maskedPhone,
          dcId: item.dcId,
          hasPremium: item.hasPremium,
          hasProxy: Boolean(item.proxyUrl?.trim()),
          success: true,
        });

        phonesAudit.push(maskedPhone);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        results.push({
          id: sessionId,
          phoneMasked: maskedPhone,
          dcId: item.dcId,
          hasPremium: item.hasPremium,
          hasProxy: Boolean(item.proxyUrl?.trim()),
          success: false,
          error: errorMsg,
        });
      }
    }

    const successfulCount = results.filter((r) => r.success).length;

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_SESSIONS_BULK_IMPORT',
      target: `bulk_import_${Date.now()}`,
      targetType: 'TELEGRAM_SESSION',
      newValue: {
        totalRequested: sessions.length,
        successfulCount,
        phonesMasked: phonesAudit,
      },
    });

    return {
      success: true as const,
      total: sessions.length,
      successfulCount,
      results,
    };
  });
}

/**
 * Возвращает статистику пула сессий для операторов панели
 */
export async function getTelegramPoolStatsAction() {
  return requireStaffPermission('providers', 'view', async () => {
    const pool = TelegramSessionPoolManager.getInstance();
    const stats = pool.getPoolStatistics();
    return {
      success: true as const,
      stats,
    };
  });
}

export interface SessionListItem {
  id: string;
  phoneNumber: string;
  phoneMasked: string;
  dcId: number;
  state: string;
  hasPremium: boolean;
  interactionHealthScore: number;
  deviceModel: string;
  hasProxy: boolean;
  proxyUrl?: string;
  totalBoostSlots: number;
  freeBoostSlots: number;
  boostSlots: Array<{
    slotIndex: number;
    assignedChannelId?: string;
    expiresAt?: number;
    cooldownUntil?: number;
  }>;
  lastActionAt: number;
}

/**
 * Возвращает список всех сессий с подробным статусом и слотами
 */
export async function listTelegramSessionsAction(filter?: {
  state?: string;
  search?: string;
}) {
  return requireStaffPermission('providers', 'view', async () => {
    const pool = TelegramSessionPoolManager.getInstance();
    await pool.loadAllFromDb();
    let all = pool.getAllSessions();

    if (filter?.state && filter.state !== 'ALL') {
      all = all.filter((s) => s.state === filter.state);
    }

    if (filter?.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      all = all.filter((s) => s.phoneNumber.includes(q) || s.id.toLowerCase().includes(q));
    }

    const now = Date.now();
    const items: SessionListItem[] = all.map((s) => {
      const masked = s.phoneNumber.length > 6
        ? `${s.phoneNumber.slice(0, 4)}***${s.phoneNumber.slice(-2)}`
        : s.phoneNumber;

      let freeSlots = 0;
      const slots = s.boostSlots.map((sl) => {
        const isFree = !sl.assignedChannelId || (sl.expiresAt && sl.expiresAt <= now);
        const isCooledDown = !sl.cooldownUntil || sl.cooldownUntil <= now;
        if (isFree && isCooledDown && s.hasPremium && s.state !== 'BANNED') {
          freeSlots++;
        }
        return {
          slotIndex: sl.slotIndex,
          assignedChannelId: sl.assignedChannelId,
          expiresAt: sl.expiresAt,
          cooldownUntil: sl.cooldownUntil,
        };
      });

      return {
        id: s.id,
        phoneNumber: s.phoneNumber,
        phoneMasked: masked,
        dcId: s.dcId,
        state: s.state,
        hasPremium: s.hasPremium,
        interactionHealthScore: s.interactionHealthScore,
        deviceModel: s.deviceModel,
        hasProxy: Boolean(s.proxyUrl),
        proxyUrl: s.proxyUrl,
        totalBoostSlots: s.boostSlots.length,
        freeBoostSlots: freeSlots,
        boostSlots: slots,
        lastActionAt: s.lastActionAt,
      };
    });

    return {
      success: true as const,
      sessions: items,
      total: items.length,
    };
  });
}

/**
 * Выполняет ручной тестовый буст канала из панели оператора
 */
export async function executeManualBoostAction(rawInput: unknown) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const Schema = z.object({
      channel: z.string().min(1, 'Укажите канал для буста'),
      durationDays: z.number().int().min(1).max(90).default(30),
    });

    const parsed = Schema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Неверные параметры' };
    }

    const { getSharedTelegramExecutor } = await import('@/workers/processors/order/in-house-order-dispatcher');
    const executor = getSharedTelegramExecutor();
    const result = await executor.executeBoostChannel(parsed.data.channel, parsed.data.durationDays);

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_MANUAL_BOOST',
      target: parsed.data.channel,
      targetType: 'TELEGRAM_CHANNEL',
      newValue: result,
    });

    return {
      success: result.success,
      action: result.action,
      sessionId: result.sessionId,
      slotIndex: result.slotIndex,
      allocatedUntil: result.allocatedUntil,
      error: result.error,
    };
  });
}

/**
 * Выполняет ручную тестовую реакцию из панели оператора
 */
export async function executeManualReactionAction(rawInput: unknown) {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const Schema = z.object({
      channel: z.string().min(1, 'Укажите канал'),
      postId: z.number().int().positive('Укажите ID поста'),
      reaction: z.string().default('👍'),
    });

    const parsed = Schema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Неверные параметры' };
    }

    const { getSharedTelegramExecutor } = await import('@/workers/processors/order/in-house-order-dispatcher');
    const executor = getSharedTelegramExecutor();
    const postUrl = `https://t.me/${parsed.data.channel.replace(/^@/, '')}/${parsed.data.postId}`;
    const result = await executor.executePostReaction(postUrl, parsed.data.reaction);

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_MANUAL_REACTION',
      target: `${parsed.data.channel}/${parsed.data.postId}`,
      targetType: 'TELEGRAM_POST',
      newValue: result,
    });

    return {
      success: result.success,
      action: result.action,
      sessionId: result.sessionId,
      error: result.error,
    };
  });
}

/**
 * Очищает просроченные бусты и разблокирует кулдауны
 */
export async function sweepExpiredBoostsAction() {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const pool = TelegramSessionPoolManager.getInstance();
    const result = await pool.sweepExpiredBoostsAndCooldowns();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_BOOSTS_SWEEP',
      target: 'global_sweep',
      targetType: 'TELEGRAM_SESSION_POOL',
      newValue: result,
    });

    return {
      success: true as const,
      ...result,
    };
  });
}

/**
 * FR-7: Генерация виртуального пула сессий для симулятора (Scenario 2 / Dry-Run Mode)
 * Создает 5 реалистичных Telegram Premium сессий с 20 слотами бустов
 */
export async function seedMockTelegramSessionsAction() {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const pool = TelegramSessionPoolManager.getInstance();

    const mockProfiles: Array<Omit<TelegramSessionProfile, 'boostSlots'>> = [
      {
        id: 'tg_79165551234',
        phoneNumber: '+79165551234',
        dcId: 2,
        state: 'READY',
        hasPremium: true,
        premiumExpiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        interactionHealthScore: 96,
        deviceModel: 'Samsung Galaxy S24 Ultra',
        appVersion: '10.14.0',
        systemVersion: 'Android 14',
        lastActionAt: Date.now(),
      },
      {
        id: 'tg_79251234567',
        phoneNumber: '+79251234567',
        dcId: 2,
        state: 'READY',
        hasPremium: true,
        premiumExpiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
        interactionHealthScore: 93,
        deviceModel: 'Xiaomi 14 Pro',
        appVersion: '10.14.0',
        systemVersion: 'Android 14',
        lastActionAt: Date.now(),
      },
      {
        id: 'tg_79039876543',
        phoneNumber: '+79039876543',
        dcId: 4,
        state: 'READY',
        hasPremium: true,
        premiumExpiresAt: Date.now() + 120 * 24 * 60 * 60 * 1000,
        interactionHealthScore: 98,
        deviceModel: 'Google Pixel 8 Pro',
        appVersion: '10.14.0',
        systemVersion: 'Android 14',
        lastActionAt: Date.now(),
      },
      {
        id: 'tg_447123456789',
        phoneNumber: '+447123456789',
        dcId: 1,
        state: 'READY',
        hasPremium: true,
        premiumExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        interactionHealthScore: 95,
        deviceModel: 'Apple iPhone 15 Pro Max',
        appVersion: '10.14.0',
        systemVersion: 'iOS 17.5',
        lastActionAt: Date.now(),
      },
      {
        id: 'tg_12125550199',
        phoneNumber: '+12125550199',
        dcId: 5,
        state: 'READY',
        hasPremium: true,
        premiumExpiresAt: Date.now() + 45 * 24 * 60 * 60 * 1000,
        interactionHealthScore: 91,
        deviceModel: 'Nothing Phone (2)',
        appVersion: '10.14.0',
        systemVersion: 'Android 14',
        lastActionAt: Date.now(),
      },
    ];

    for (const p of mockProfiles) {
      pool.registerSession({
        ...p,
        boostSlots: [
          { slotIndex: 0 },
          { slotIndex: 1 },
          { slotIndex: 2 },
          { slotIndex: 3 },
        ],
      });
      await pool.syncSessionToDb(p.id);
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_SEED_MOCK_SESSIONS',
      target: 'simulator_pool',
      targetType: 'TELEGRAM_SESSION_POOL',
      newValue: { count: mockProfiles.length },
    });

    return {
      success: true as const,
      seededCount: mockProfiles.length,
      totalSlots: mockProfiles.length * 4,
    };
  });
}

/**
 * Очищает тестовые виртуальные сессии из пула
 */
export async function clearMockTelegramSessionsAction() {
  return requireStaffPermission('providers', 'edit', async (admin) => {
    const pool = TelegramSessionPoolManager.getInstance();
    const mockIds = [
      'tg_79165551234',
      'tg_79251234567',
      'tg_79039876543',
      'tg_447123456789',
      'tg_12125550199',
    ];

    if (!(process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_DB)) {
      try {
        const { db } = await import('@/lib/db');
        await db.telegramBoostSlot.deleteMany({
          where: { sessionId: { in: mockIds } },
        });
        await db.telegramSession.deleteMany({
          where: { id: { in: mockIds } },
        });
      } catch {
        // Fallback
      }
    }

    for (const id of mockIds) {
      pool.markBanned(id);
    }
    TelegramSessionPoolManager.resetInstance();
    await TelegramSessionPoolManager.getInstance().loadAllFromDb();

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'TELEGRAM_CLEAR_MOCK_SESSIONS',
      target: 'simulator_pool',
      targetType: 'TELEGRAM_SESSION_POOL',
      newValue: { cleared: mockIds.length },
    });

    return {
      success: true as const,
      clearedCount: mockIds.length,
    };
  });
}


