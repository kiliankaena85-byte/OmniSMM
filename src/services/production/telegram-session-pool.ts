
export type TelegramDC = 1 | 2 | 3 | 4 | 5;

export type SessionState = 'READY' | 'WARMING' | 'BUSY' | 'COOLDOWN' | 'BANNED';

export interface TelegramBoostSlot {
  slotIndex: number; // 0, 1, 2, 3 (всего 4 слота на Premium-аккаунт)
  assignedChannelId?: string;
  assignedAt?: number; // timestamp ms
  expiresAt?: number; // timestamp ms
  cooldownUntil?: number; // 24-часовой кулдаун после смены канала
}

export interface TelegramSessionProfile {
  id: string; // уникальный идентификатор сессии
  phoneNumber: string;
  sessionString?: string; // GramJS / Telethon StringSession (содержит 256-битный AuthKey)
  appId?: number; // Telegram API ID (дефолт: 2040)
  appHash?: string; // Telegram API Hash
  dcId: TelegramDC;
  state: SessionState;
  hasPremium: boolean;
  premiumExpiresAt?: number;
  interactionHealthScore: number; // 0..100 (при < 70 отправляется на отлежку)
  floodWaitUntil?: number; // timestamp ms
  deviceModel: string;
  appVersion: string;
  systemVersion: string;
  proxyUrl?: string; // SOCKS5/HTTP адрес персонального прокси (socks5://user:pass@host:port)
  boostSlots: TelegramBoostSlot[];
  lastActionAt: number;
}

export interface AllocateBoostResult {
  success: boolean;
  sessionId?: string;
  slotIndex?: number;
  channelId: string;
  allocatedUntil: number;
  error?: string;
}

/**
 * Менеджер пула сессий Telegram MTProto (Tier-0 Infrastructure)
 * Управляет жизненным циклом сессий, здоровьем аккаунтов (Interaction Health),
 * привязкой к датацентрам (DC1-DC5) и распределением слотов бустов каналов (Level Boosts).
 */
export class TelegramSessionPoolManager {
  private static instance: TelegramSessionPoolManager | null = null;
  private sessions: Map<string, TelegramSessionProfile> = new Map();

  /**
   * Возвращает singleton-экземпляр пула сессий для использования во всем процессе воркера
   */
  public static getInstance(): TelegramSessionPoolManager {
    if (!TelegramSessionPoolManager.instance) {
      TelegramSessionPoolManager.instance = new TelegramSessionPoolManager();
    }
    return TelegramSessionPoolManager.instance;
  }

  /**
   * Сбрасывает singleton (используется для изоляции в тестах)
   */
  public static resetInstance(): void {
    TelegramSessionPoolManager.instance = null;
  }

  /**
   * Добавляет или обновляет сессию в пуле
   */
  public registerSession(session: Omit<TelegramSessionProfile, 'boostSlots'> & { boostSlots?: TelegramBoostSlot[] }): void {
    const slots: TelegramBoostSlot[] = session.boostSlots || [
      { slotIndex: 0 },
      { slotIndex: 1 },
      { slotIndex: 2 },
      { slotIndex: 3 },
    ];

    this.sessions.set(session.id, {
      ...session,
      boostSlots: slots,
    });
  }

  /**
   * Возвращает сессию по ID
   */
  public getSession(id: string): TelegramSessionProfile | undefined {
    return this.sessions.get(id);
  }

  /**
   * Возвращает общее количество сессий в пуле
   */
  public getTotalCount(): number {
    return this.sessions.size;
  }

  /**
   * Находит готовую сессию для обычных действий (просмотры, реакции, голосования)
   * Учитывает DC, состояние здоровья (Health Score >= 70) и отсутствие активного FloodWait.
   */
  public acquireSessionForAction(options?: {
    preferredDc?: TelegramDC;
    minHealthScore?: number;
    nowMs?: number;
  }): TelegramSessionProfile | null {
    const now = options?.nowMs ?? Date.now();
    const minHealth = options?.minHealthScore ?? 70;

    for (const session of this.sessions.values()) {
      if (session.state === 'BANNED' || session.state === 'WARMING') {
        continue;
      }

      if (session.floodWaitUntil && session.floodWaitUntil > now) {
        continue;
      }

      if (session.interactionHealthScore < minHealth) {
        continue;
      }

      if (options?.preferredDc && session.dcId !== options.preferredDc) {
        continue;
      }

      // Сессия найдена и готова к работе
      session.lastActionAt = now;
      return session;
    }

    return null;
  }

  /**
   * Выделяет свободный слот буста (channels.boostChannel) для целевого канала
   * Проверяет наличие Premium-подписки, кулдаун слота (24 часа) и текущий статус.
   */
  public allocateBoostSlot(
    channelId: string,
    durationDays: number = 30,
    nowMs?: number
  ): AllocateBoostResult {
    const now = nowMs ?? Date.now();
    const durationMs = durationDays * 24 * 60 * 60 * 1000;

    for (const session of this.sessions.values()) {
      if (session.state === 'BANNED' || !session.hasPremium) {
        continue;
      }

      if (session.premiumExpiresAt && session.premiumExpiresAt <= now) {
        session.hasPremium = false;
        continue;
      }

      if (session.floodWaitUntil && session.floodWaitUntil > now) {
        continue;
      }

      // Ищем свободный слот без активного кулдауна
      for (const slot of session.boostSlots) {
        const isFree = !slot.assignedChannelId || (slot.expiresAt && slot.expiresAt <= now);
        const isCooledDown = !slot.cooldownUntil || slot.cooldownUntil <= now;

        if (isFree && isCooledDown) {
          slot.assignedChannelId = channelId;
          slot.assignedAt = now;
          slot.expiresAt = now + durationMs;
          // Устанавливаем 24-часовой кулдаун на повторное переключение слота
          slot.cooldownUntil = now + 24 * 60 * 60 * 1000;
          session.lastActionAt = now;

          return {
            success: true,
            sessionId: session.id,
            slotIndex: slot.slotIndex,
            channelId,
            allocatedUntil: slot.expiresAt,
          };
        }
      }
    }

    return {
      success: false,
      channelId,
      allocatedUntil: 0,
      error: 'NO_AVAILABLE_BOOST_SLOTS: Все доступные слоты Telegram Premium заняты или на кулдауне',
    };
  }

  /**
   * Освобождает слот буста (при завершении или отмене заказа)
   */
  public releaseBoostSlot(sessionId: string, slotIndex: number, nowMs?: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const slot = session.boostSlots.find((s) => s.slotIndex === slotIndex);
    if (!slot || !slot.assignedChannelId) return false;

    const now = nowMs ?? Date.now();
    slot.assignedChannelId = undefined;
    slot.expiresAt = undefined;
    // Кулдаун 24 часа сохраняется от момента смены
    if (!slot.cooldownUntil || slot.cooldownUntil < now) {
      slot.cooldownUntil = now + 24 * 60 * 60 * 1000;
    }

    return true;
  }

  /**
   * FR-5: Фоновый процесс очистки слотов бустов и кулдаунов сессий (TelegramBoostSweeperCron)
   * 1. Освобождает слоты с истекшим сроком действия (expiresAt <= NOW());
   * 2. Снимает 24-часовой кулдаун с переключенных слотов (cooldownUntil <= NOW());
   * 3. Восстанавливает сессии из COOLDOWN в READY при истечении FloodWait;
   * 4. Проводит автоматическую реконсиляцию с базой данных PostgreSQL.
   */
  public async sweepExpiredBoostsAndCooldowns(nowMs?: number): Promise<{
    expiredSlotsFreed: number;
    cooledDownSlotsReset: number;
    sessionsRestored: number;
  }> {
    const now = nowMs ?? Date.now();
    let expiredSlotsFreed = 0;
    let cooledDownSlotsReset = 0;
    let sessionsRestored = 0;

    for (const session of this.sessions.values()) {
      let sessionUpdated = false;

      for (const slot of session.boostSlots) {
        if (slot.assignedChannelId && slot.expiresAt && slot.expiresAt <= now) {
          slot.assignedChannelId = undefined;
          slot.expiresAt = undefined;
          expiredSlotsFreed++;
          sessionUpdated = true;
        }

        if (slot.cooldownUntil && slot.cooldownUntil <= now) {
          slot.cooldownUntil = undefined;
          cooledDownSlotsReset++;
          sessionUpdated = true;
        }
      }

      if (session.state === 'COOLDOWN') {
        const floodWaitPassed = !session.floodWaitUntil || session.floodWaitUntil <= now;
        if (floodWaitPassed && session.interactionHealthScore >= 50) {
          session.state = 'READY';
          session.floodWaitUntil = undefined;
          sessionsRestored++;
          sessionUpdated = true;
        }
      }

      if (sessionUpdated) {
        await this.syncSessionToDb(session.id);
      }
    }

    if (!(process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_DB)) {
      try {
        const { db } = await import('@/lib/db');
        const nowDate = new Date(now);

        await db.telegramBoostSlot.updateMany({
          where: {
            expiresAt: { lte: nowDate },
            assignedChannelId: { not: null },
          },
          data: {
            assignedChannelId: null,
            expiresAt: null,
          },
        });

        await db.telegramBoostSlot.updateMany({
          where: {
            cooldownUntil: { lte: nowDate },
          },
          data: {
            cooldownUntil: null,
          },
        });

        await db.telegramSession.updateMany({
          where: {
            state: 'COOLDOWN',
            floodWaitUntil: { lte: nowDate },
            interactionHealthScore: { gte: 50 },
          },
          data: {
            state: 'READY',
            floodWaitUntil: null,
          },
        });
      } catch {
        // Fallback gracefully on DB connection errors in background
      }
    }

    return {
      expiredSlotsFreed,
      cooledDownSlotsReset,
      sessionsRestored,
    };
  }

  /**
   * Фиксирует ошибку FloodWait от Telegram MTProto
   * Временно отправляет сессию в сон на указанное количество секунд.
   */
  public reportFloodWait(sessionId: string, waitSeconds: number, nowMs?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const now = nowMs ?? Date.now();
    session.floodWaitUntil = now + waitSeconds * 1000;
    session.interactionHealthScore = Math.max(0, session.interactionHealthScore - 15);

    if (session.interactionHealthScore < 50) {
      session.state = 'COOLDOWN';
    }
  }

  /**
   * Фиксирует успешное действие, повышая Health Score сессии
   */
  public reportSuccess(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.interactionHealthScore = Math.min(100, session.interactionHealthScore + 2);
    if (session.state === 'COOLDOWN' && session.interactionHealthScore >= 70) {
      session.state = 'READY';
    }
  }

  /**
   * Помечает скомпрометированную сессию как BANNED
   */
  public markBanned(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.state = 'BANNED';
    session.interactionHealthScore = 0;
    for (const slot of session.boostSlots) {
      slot.assignedChannelId = undefined;
      slot.expiresAt = undefined;
    }
  }

  /**
   * Сводная статистика пула для дашборда B2B провайдера
   */
  public getPoolStatistics(): {
    totalSessions: number;
    activeSessions: number;
    premiumAccounts: number;
    totalBoostSlots: number;
    availableBoostSlots: number;
    averageHealthScore: number;
  } {
    let active = 0;
    let premium = 0;
    let totalSlots = 0;
    let availableSlots = 0;
    let healthSum = 0;
    const now = Date.now();

    for (const session of this.sessions.values()) {
      if (session.state === 'READY') active++;
      if (session.hasPremium && (!session.premiumExpiresAt || session.premiumExpiresAt > now)) {
        premium++;
      }
      healthSum += session.interactionHealthScore;

      for (const slot of session.boostSlots) {
        totalSlots++;
        const isFree = !slot.assignedChannelId || (slot.expiresAt && slot.expiresAt <= now);
        const isCooledDown = !slot.cooldownUntil || slot.cooldownUntil <= now;
        if (isFree && isCooledDown && session.hasPremium && session.state !== 'BANNED') {
          availableSlots++;
        }
      }
    }

    const total = this.sessions.size;
    const avgHealth = total > 0 ? Math.round(healthSum / total) : 0;

    return {
      totalSessions: total,
      activeSessions: active,
      premiumAccounts: premium,
      totalBoostSlots: totalSlots,
      availableBoostSlots: availableSlots,
      averageHealthScore: avgHealth,
    };
  }

  /**
   * Возвращает все сессии из пула
   */
  public getAllSessions(): TelegramSessionProfile[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Синхронизирует профиль сессии и состояние ее слотов в PostgreSQL через Prisma
   */
  public async syncSessionToDb(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_DB) {
      return true;
    }

    try {
      const { db } = await import('@/lib/db');
      const { encrypt } = await import('@/lib/crypto/encryption');

      let encryptedSessionString = '';
      if (session.sessionString) {
        try {
          encryptedSessionString = encrypt(session.sessionString);
        } catch {
          encryptedSessionString = session.sessionString;
        }
      }

      await db.telegramSession.upsert({
        where: { id: session.id },
        update: {
          phoneNumber: session.phoneNumber,
          sessionString: encryptedSessionString,
          appId: session.appId ?? 2040,
          appHash: session.appHash ?? 'b18441a1ff607e10a989891a5462e627',
          dcId: session.dcId,
          state: session.state,
          hasPremium: session.hasPremium,
          premiumExpiresAt: session.premiumExpiresAt ? new Date(session.premiumExpiresAt) : null,
          interactionHealthScore: session.interactionHealthScore,
          floodWaitUntil: session.floodWaitUntil ? new Date(session.floodWaitUntil) : null,
          deviceModel: session.deviceModel,
          appVersion: session.appVersion,
          systemVersion: session.systemVersion,
          proxyUrl: session.proxyUrl || null,
          lastActionAt: new Date(session.lastActionAt),
        },
        create: {
          id: session.id,
          phoneNumber: session.phoneNumber,
          sessionString: encryptedSessionString,
          appId: session.appId ?? 2040,
          appHash: session.appHash ?? 'b18441a1ff607e10a989891a5462e627',
          dcId: session.dcId,
          state: session.state,
          hasPremium: session.hasPremium,
          premiumExpiresAt: session.premiumExpiresAt ? new Date(session.premiumExpiresAt) : null,
          interactionHealthScore: session.interactionHealthScore,
          floodWaitUntil: session.floodWaitUntil ? new Date(session.floodWaitUntil) : null,
          deviceModel: session.deviceModel,
          appVersion: session.appVersion,
          systemVersion: session.systemVersion,
          proxyUrl: session.proxyUrl || null,
          lastActionAt: new Date(session.lastActionAt),
        },
      });

      // Синхронизируем 4 слота буста
      for (const slot of session.boostSlots) {
        await db.telegramBoostSlot.upsert({
          where: {
            sessionId_slotIndex: {
              sessionId: session.id,
              slotIndex: slot.slotIndex,
            },
          },
          update: {
            assignedChannelId: slot.assignedChannelId || null,
            assignedAt: slot.assignedAt ? new Date(slot.assignedAt) : null,
            expiresAt: slot.expiresAt ? new Date(slot.expiresAt) : null,
            cooldownUntil: slot.cooldownUntil ? new Date(slot.cooldownUntil) : null,
          },
          create: {
            sessionId: session.id,
            slotIndex: slot.slotIndex,
            assignedChannelId: slot.assignedChannelId || null,
            assignedAt: slot.assignedAt ? new Date(slot.assignedAt) : null,
            expiresAt: slot.expiresAt ? new Date(slot.expiresAt) : null,
            cooldownUntil: slot.cooldownUntil ? new Date(slot.cooldownUntil) : null,
          },
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Загружает все сохраненные сессии и их активные слоты из PostgreSQL в оперативный пул
   */
  public async loadAllFromDb(): Promise<number> {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_DB) {
      return 0;
    }

    try {
      const { db } = await import('@/lib/db');
      const { decrypt } = await import('@/lib/crypto/encryption');
      const records = await db.telegramSession.findMany({
        include: { boostSlots: true },
      });

      let loaded = 0;
      for (const rec of records) {
        let decryptedSessionString: string | undefined = undefined;
        if (rec.sessionString) {
          try {
            decryptedSessionString = decrypt(rec.sessionString);
          } catch {
            decryptedSessionString = rec.sessionString;
          }
        }

        const slots: TelegramBoostSlot[] = rec.boostSlots.map((s) => ({
          slotIndex: s.slotIndex,
          assignedChannelId: s.assignedChannelId ?? undefined,
          assignedAt: s.assignedAt ? s.assignedAt.getTime() : undefined,
          expiresAt: s.expiresAt ? s.expiresAt.getTime() : undefined,
          cooldownUntil: s.cooldownUntil ? s.cooldownUntil.getTime() : undefined,
        }));

        const profile: TelegramSessionProfile = {
          id: rec.id,
          phoneNumber: rec.phoneNumber,
          sessionString: decryptedSessionString,
          appId: rec.appId,
          appHash: rec.appHash,
          dcId: (rec.dcId as TelegramDC) || 2,
          state: rec.state as SessionState,
          hasPremium: rec.hasPremium,
          premiumExpiresAt: rec.premiumExpiresAt ? rec.premiumExpiresAt.getTime() : undefined,
          interactionHealthScore: rec.interactionHealthScore,
          floodWaitUntil: rec.floodWaitUntil ? rec.floodWaitUntil.getTime() : undefined,
          deviceModel: rec.deviceModel,
          appVersion: rec.appVersion,
          systemVersion: rec.systemVersion,
          proxyUrl: rec.proxyUrl ?? undefined,
          boostSlots: slots,
          lastActionAt: rec.lastActionAt.getTime(),
        };

        this.registerSession(profile);
        loaded++;
      }
      return loaded;
    } catch {
      return 0;
    }
  }
}
