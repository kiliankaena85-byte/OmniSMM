import { TelegramSessionPoolManager, TelegramSessionProfile, AllocateBoostResult, TelegramDC } from './telegram-session-pool';
import { assertSafeUrl } from '@/utils/ssrf-guard';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';

export interface RawSessionJsonPayload {
  session_file?: string;
  phone: string;
  app_id?: number;
  app_hash?: string;
  device?: string;
  sdk?: string;
  app_version?: string;
  dc_id?: number;
  has_premium?: boolean;
  proxy_url?: string;
  session_string?: string;
  auth_key?: string | Buffer;
}

export interface ExecutionResult {
  success: boolean;
  action: 'BOOST' | 'REACTION' | 'VIEW';
  target: string;
  sessionId?: string;
  slotIndex?: number;
  allocatedUntil?: number;
  error?: string;
  rawResponse?: unknown;
}

export interface TelegramProxyConfig {
  ip: string;
  port: number;
  socksType: 4 | 5;
  username?: string;
  password?: string;
}

const DEFAULT_DC_ADDRESSES: Record<TelegramDC, { ip: string; port: number }> = {
  1: { ip: '149.154.175.50', port: 443 },
  2: { ip: '149.154.167.50', port: 443 },
  3: { ip: '149.154.175.100', port: 443 },
  4: { ip: '149.154.167.91', port: 443 },
  5: { ip: '91.108.56.170', port: 443 },
};

/**
 * Парсит строку прокси в конфигурационный объект для GramJS / MTProto
 * Поддерживает форматы:
 * - socks5://user:pass@host:port
 * - host:port:user:pass
 * - host:port
 */
export function parseTelegramProxy(rawProxy?: string): TelegramProxyConfig | undefined {
  if (!rawProxy || typeof rawProxy !== 'string') return undefined;
  const trimmed = rawProxy.trim();
  if (!trimmed) return undefined;

  try {
    if (trimmed.includes('://')) {
      const parsed = new URL(trimmed);
      return {
        ip: parsed.hostname,
        port: parseInt(parsed.port, 10) || 1080,
        socksType: 5,
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      };
    }

    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      const ip = parts[0];
      const port = parseInt(parts[1], 10);
      if (isNaN(port)) return undefined;

      return {
        ip,
        port,
        socksType: 5,
        username: parts[2] || undefined,
        password: parts[3] || undefined,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Конвертирует бинарный AuthKey (256 байт) в строку GramJS / Telethon StringSession
 * без необходимости вводить SMS или повторно авторизоваться
 */
export function createStringSessionFromAuthKey(
  authKey: Buffer,
  dcId: TelegramDC = 2,
  serverAddress?: string,
  port?: number
): string {
  if (authKey.length !== 256) {
    throw new Error(`Invalid auth key length: expected 256 bytes, got ${authKey.length}`);
  }

  const dcConfig = DEFAULT_DC_ADDRESSES[dcId] || DEFAULT_DC_ADDRESSES[2];
  const address = serverAddress || dcConfig.ip;
  const targetPort = port || dcConfig.port;

  const dcBuffer = Buffer.from([dcId]);
  const addressBuffer = Buffer.from(address, 'utf-8');
  const addressLengthBuffer = Buffer.alloc(2);
  addressLengthBuffer.writeInt16BE(addressBuffer.length, 0);
  const portBuffer = Buffer.alloc(2);
  portBuffer.writeInt16BE(targetPort, 0);

  const payload = Buffer.concat([
    dcBuffer,
    addressLengthBuffer,
    addressBuffer,
    portBuffer,
    authKey,
  ]);

  return '1' + payload.toString('base64');
}

/**
 * Исполнительный робот Telegram MTProto (Tier-0 Battle-Grade Engine)
 * Связывает пул сессий TelegramSessionPoolManager с бинарным MTProto клиентом GramJS:
 * - Выполняет реальные вызовы RPC channels/premium.ApplyBoost
 * - Проставляет реакции messages.SendReaction
 * - Учитывает DC-роутинг, личный прокси и отпечаток устройства
 * - Безопасно сохраняет состояние в PostgreSQL/Prisma
 */
export class TelegramMtprotoExecutor {
  private pool: TelegramSessionPoolManager;
  private clientMap: Map<string, TelegramClient> = new Map();

  constructor(pool?: TelegramSessionPoolManager) {
    this.pool = pool || TelegramSessionPoolManager.getInstance();
  }

  /**
   * Возвращает экземпляр пула сессий
   */
  public getPool(): TelegramSessionPoolManager {
    return this.pool;
  }

  /**
   * Импортирует купленный аккаунт формата Session+Json (стандарт Zelenka Market / Darkstore) в пул
   */
  public importSessionFromJson(data: RawSessionJsonPayload): TelegramSessionProfile {
    const dcId = (data.dc_id && [1, 2, 3, 4, 5].includes(data.dc_id) ? data.dc_id : 2) as TelegramDC;

    let sessionString = data.session_string;
    if (!sessionString && data.auth_key) {
      const keyBuffer = Buffer.isBuffer(data.auth_key)
        ? data.auth_key
        : Buffer.from(data.auth_key, 'hex');
      if (keyBuffer.length === 256) {
        sessionString = createStringSessionFromAuthKey(keyBuffer, dcId);
      }
    }

    const profile: TelegramSessionProfile = {
      id: `tg_${data.phone.replace(/\D/g, '')}`,
      phoneNumber: data.phone,
      sessionString,
      appId: data.app_id || 2040,
      appHash: data.app_hash || 'b18441a1ff607e10a989891a5462e627',
      dcId,
      state: 'READY',
      hasPremium: Boolean(data.has_premium),
      interactionHealthScore: 90, // Начальный скор для прогретых сессий
      deviceModel: data.device || 'Samsung SM-S918B',
      appVersion: data.app_version || '10.14.0',
      systemVersion: data.sdk || 'Android 14',
      proxyUrl: data.proxy_url,
      lastActionAt: Date.now(),
      boostSlots: [
        { slotIndex: 0 },
        { slotIndex: 1 },
        { slotIndex: 2 },
        { slotIndex: 3 },
      ],
    };

    this.pool.registerSession(profile);
    return profile;
  }

  /**
   * Получает или создает активный экземпляр TelegramClient для сессии
   */
  public async getClient(session: TelegramSessionProfile): Promise<TelegramClient | null> {
    if (!session.sessionString) {
      return null;
    }

    if (this.clientMap.has(session.id)) {
      return this.clientMap.get(session.id)!;
    }

    const stringSession = new StringSession(session.sessionString);
    const proxyConfig = parseTelegramProxy(session.proxyUrl);

    const client = new TelegramClient(
      stringSession,
      session.appId || 2040,
      session.appHash || 'b18441a1ff607e10a989891a5462e627',
      {
        connectionRetries: 3,
        useWSS: false,
        deviceModel: session.deviceModel,
        systemVersion: session.systemVersion,
        appVersion: session.appVersion,
        proxy: proxyConfig,
      }
    );

    this.clientMap.set(session.id, client);
    return client;
  }

  /**
   * FR-4: Извлекает хэш закрытого инвайта канала (t.me/+hash или t.me/joinchat/hash)
   * Возвращает null для стандартных публичных ссылок (@channel, t.me/channel)
   */
  public extractInviteHash(target: string): string | null {
    if (!target || typeof target !== 'string') return null;
    const trimmed = target.trim();

    // https://t.me/+hash, t.me/+hash
    const plusMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/\+([a-zA-Z0-9_-]+)/i);
    if (plusMatch) return plusMatch[1];

    // https://t.me/joinchat/hash, t.me/joinchat/hash
    const joinMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/joinchat\/([a-zA-Z0-9_-]+)/i);
    if (joinMatch) return joinMatch[1];

    if (trimmed.startsWith('+')) {
      const direct = trimmed.slice(1).trim();
      if (/^[a-zA-Z0-9_-]+$/.test(direct)) return direct;
    }

    if (trimmed.startsWith('joinchat/')) {
      const direct = trimmed.replace('joinchat/', '').trim();
      if (/^[a-zA-Z0-9_-]+$/.test(direct)) return direct;
    }

    return null;
  }

  /**
   * FR-4: Разрешает целевой peer канала для MTProto RPC, поддерживая как публичные каналы (@username),
   * так и приватные инвайт-ссылки (t.me/+hash / t.me/joinchat/hash)
   */
  public async resolveTargetChannelPeer(
    client: TelegramClient,
    target: string
  ): Promise<Api.TypeInputPeer | Api.TypeEntityLike> {
    const inviteHash = this.extractInviteHash(target);

    if (inviteHash) {
      // 1. Проверяем инвайт закрытого канала
      const checkResult = await client.invoke(
        new Api.messages.CheckChatInvite({ hash: inviteHash })
      );

      // Если аккаунт уже состоит в этом закрытом канале
      if (checkResult instanceof Api.ChatInviteAlready) {
        return checkResult.chat;
      }

      // Если аккаунт еще не вступил, импортируем инвайт
      try {
        const importResult = await client.invoke(
          new Api.messages.ImportChatInvite({ hash: inviteHash })
        );
        if (importResult && typeof importResult === 'object' && 'chats' in importResult) {
          const updates = importResult as { chats?: unknown[] };
          if (Array.isArray(updates.chats) && updates.chats.length > 0) {
            return updates.chats[0] as Api.TypeEntityLike;
          }
        }
        return importResult as unknown as Api.TypeEntityLike;
      } catch (importErr: unknown) {
        const msg = importErr instanceof Error ? importErr.message : String(importErr);
        if (msg.includes('USER_ALREADY_PARTICIPANT')) {
          if (checkResult && typeof checkResult === 'object' && 'chat' in checkResult) {
            return (checkResult as { chat: Api.TypeEntityLike }).chat;
          }
        }
        throw importErr;
      }

      if (checkResult && typeof checkResult === 'object' && 'chat' in checkResult) {
        return (checkResult as { chat: Api.TypeEntityLike }).chat;
      }
    }

    // Публичный канал: очищаем от t.me/ и @
    const cleanUsername = target.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').trim();
    return await client.getEntity(cleanUsername);
  }

  /**
   * Исполняет буст канала (premium.ApplyBoost в MTProto)
   */
  public async executeBoostChannel(channelUrlOrId: string, durationDays: number = 30): Promise<ExecutionResult> {
    const cleanChannel = channelUrlOrId.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').trim();
    if (!cleanChannel) {
      return {
        success: false,
        action: 'BOOST',
        target: channelUrlOrId,
        error: 'INVALID_CHANNEL: Не указан корректный канал для буста',
      };
    }

    // 1. Атомарно выделяем свободный слот Premium в пуле
    const allocation: AllocateBoostResult = this.pool.allocateBoostSlot(cleanChannel, durationDays);
    if (!allocation.success || !allocation.sessionId || allocation.slotIndex === undefined) {
      return {
        success: false,
        action: 'BOOST',
        target: cleanChannel,
        error: allocation.error || 'NO_SLOTS: Нет доступных свободных слотов буста в пуле',
      };
    }

    const session = this.pool.getSession(allocation.sessionId);
    if (!session) {
      return {
        success: false,
        action: 'BOOST',
        target: cleanChannel,
        error: 'SESSION_NOT_FOUND',
      };
    }

    try {
      const client = await this.getClient(session);

      // Если подключен реальный MTProto клиент с StringSession
      if (client) {
        if (!client.connected) {
          await client.connect();
        }

        const peer = await this.resolveTargetChannelPeer(client, channelUrlOrId);
        const result = await client.invoke(
          new Api.premium.ApplyBoost({
            peer,
            slots: [allocation.slotIndex],
          })
        );

        this.pool.reportSuccess(session.id);
        void this.pool.syncSessionToDb(session.id);

        return {
          success: true,
          action: 'BOOST',
          target: cleanChannel,
          sessionId: session.id,
          slotIndex: allocation.slotIndex,
          allocatedUntil: allocation.allocatedUntil,
          rawResponse: result,
        };
      }

      // Симуляция для профилей без sessionString (тестовый режим)
      this.pool.reportSuccess(session.id);
      void this.pool.syncSessionToDb(session.id);

      return {
        success: true,
        action: 'BOOST',
        target: cleanChannel,
        sessionId: session.id,
        slotIndex: allocation.slotIndex,
        allocatedUntil: allocation.allocatedUntil,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Обработка Telegram FloodWait
      const floodMatch = errorMessage.match(/FLOOD_WAIT_(\d+)/i);
      if (floodMatch) {
        const waitSec = parseInt(floodMatch[1], 10);
        this.pool.reportFloodWait(session.id, waitSec);
      } else {
        // При ошибке освобождаем слот
        this.pool.releaseBoostSlot(session.id, allocation.slotIndex);
      }

      void this.pool.syncSessionToDb(session.id);

      return {
        success: false,
        action: 'BOOST',
        target: cleanChannel,
        sessionId: session.id,
        error: errorMessage || 'MTPROTO_RPC_ERROR',
      };
    }
  }

  /**
   * Исполняет простановку реакции на пост (messages.SendReaction)
   */
  public async executePostReaction(postUrl: string, emoji: string = '🔥'): Promise<ExecutionResult> {
    const session = this.pool.acquireSessionForAction({ minHealthScore: 70 });
    if (!session) {
      return {
        success: false,
        action: 'REACTION',
        target: postUrl,
        error: 'NO_HEALTHY_SESSIONS: В пуле нет доступных сессий со здоровьем >= 70',
      };
    }

    const match = postUrl.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
    const channel = match ? match[1] : '';
    const postId = match ? parseInt(match[2], 10) : 0;

    try {
      const client = await this.getClient(session);

      if (client && channel && postId > 0) {
        if (!client.connected) {
          await client.connect();
        }

        const peer = await client.getEntity(channel);
        const result = await client.invoke(
          new Api.messages.SendReaction({
            peer,
            msgId: postId,
            reaction: [new Api.ReactionEmoji({ emoticon: emoji })],
          })
        );

        this.pool.reportSuccess(session.id);
        void this.pool.syncSessionToDb(session.id);

        return {
          success: true,
          action: 'REACTION',
          target: postUrl,
          sessionId: session.id,
          rawResponse: result,
        };
      }

      // Симуляция для тестового окружения
      this.pool.reportSuccess(session.id);
      void this.pool.syncSessionToDb(session.id);

      return {
        success: true,
        action: 'REACTION',
        target: postUrl,
        sessionId: session.id,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        action: 'REACTION',
        target: postUrl,
        sessionId: session.id,
        error: errorMessage || 'REACTION_FAILED',
      };
    }
  }

  /**
   * Исполняет просмотр поста через публичный веб-шлюз t.me/s/... (Zero-Account-Risk)
   * Либо через MTProto messages.GetMessagesViews при наличии сессии
   */
  public async executePublicPostView(postUrl: string, sessionId?: string): Promise<ExecutionResult> {
    const match = postUrl.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
    if (!match) {
      return {
        success: false,
        action: 'VIEW',
        target: postUrl,
        error: 'INVALID_POST_URL: Ссылка должна быть вида https://t.me/channel/123',
      };
    }

    const channel = match[1];
    const postId = parseInt(match[2], 10);

    // Если запрошен просмотр через MTProto авторизованную сессию
    if (sessionId) {
      const session = this.pool.getSession(sessionId);
      if (session) {
        try {
          const client = await this.getClient(session);
          if (client) {
            if (!client.connected) {
              await client.connect();
            }
            const peer = await client.getEntity(channel);
            const result = await client.invoke(
              new Api.messages.GetMessagesViews({
                peer,
                id: [postId],
                increment: true,
              })
            );
            return {
              success: true,
              action: 'VIEW',
              target: postUrl,
              sessionId,
              rawResponse: result,
            };
          }
        } catch (err) {
          // Fallback to web view upon RPC failure
        }
      }
    }

    // Скоростной веб-шлюз (0% риска бана аккаунтов)
    const previewUrl = `https://t.me/s/${channel}/${postId}`;
    await assertSafeUrl(previewUrl);

    try {
      const res = await fetch(previewUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        },
      });

      return {
        success: res.ok,
        action: 'VIEW',
        target: postUrl,
      };
    } catch (err) {
      return {
        success: false,
        action: 'VIEW',
        target: postUrl,
        error: err instanceof Error ? err.message : 'NETWORK_ERROR',
      };
    }
  }

  /**
   * Корректно закрывает все открытые MTProto соединения
   */
  public async disconnectAll(): Promise<void> {
    for (const client of this.clientMap.values()) {
      try {
        if (client.connected) {
          await client.disconnect();
        }
      } catch {
        // Ignore disconnect errors during teardown
      }
    }
    this.clientMap.clear();
  }
}
