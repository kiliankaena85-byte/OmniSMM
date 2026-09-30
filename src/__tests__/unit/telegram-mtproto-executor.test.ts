import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TelegramMtprotoExecutor,
  parseTelegramProxy,
  createStringSessionFromAuthKey,
} from '@/services/production/telegram-mtproto-executor';
import {
  TelegramSessionPoolManager,
} from '@/services/production/telegram-session-pool';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';

vi.mock('@/utils/ssrf-guard', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

describe('TelegramMtprotoExecutor (Tier-0 In-House Robot)', () => {
  let executor: TelegramMtprotoExecutor;

  beforeEach(() => {
    TelegramSessionPoolManager.resetInstance();
    executor = new TelegramMtprotoExecutor(new TelegramSessionPoolManager());
    vi.restoreAllMocks();
  });

  it('должен импортировать сессию из JSON (формат Zelenka Market / Darkstore)', () => {
    const profile = executor.importSessionFromJson({
      session_file: '79991234567.session',
      phone: '+79991234567',
      app_id: 2040,
      app_hash: 'b18441a1ff607e10a989891a5462e627',
      has_premium: true,
      dc_id: 2,
    });

    expect(profile.id).toBe('tg_79991234567');
    expect(profile.hasPremium).toBe(true);
    expect(profile.dcId).toBe(2);
    expect(executor.getPool().getTotalCount()).toBe(1);
  });

  it('должен успешно исполнять буст канала при наличии Premium сессии', async () => {
    executor.importSessionFromJson({
      session_file: 'premium.session',
      phone: '+79990000001',
      app_id: 2040,
      app_hash: 'abc',
      has_premium: true,
      dc_id: 2,
    });

    const result = await executor.executeBoostChannel('https://t.me/durov', 30);
    expect(result.success).toBe(true);
    expect(result.action).toBe('BOOST');
    expect(result.target).toBe('durov');
    expect(result.slotIndex).toBe(0);
    expect(result.sessionId).toBe('tg_79990000001');
  });

  it('должен возвращать ошибку при отсутствии свободных слотов буста', async () => {
    // В пуле нет Premium-аккаунтов
    const result = await executor.executeBoostChannel('https://t.me/telegram');
    expect(result.success).toBe(false);
    expect(result.error).toContain('NO_AVAILABLE_BOOST_SLOTS');
  });

  it('должен успешно ставить реакцию на пост', async () => {
    executor.importSessionFromJson({
      session_file: 'regular.session',
      phone: '+79990000002',
      app_id: 2040,
      app_hash: 'abc',
      has_premium: false,
      dc_id: 2,
    });

    const result = await executor.executePostReaction('https://t.me/durov/100', '🔥');
    expect(result.success).toBe(true);
    expect(result.action).toBe('REACTION');
  });

  it('должен исполнять просмотр поста через публичный веб-шлюз', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await executor.executePublicPostView('https://t.me/durov/300');
    expect(result.success).toBe(true);
    expect(result.action).toBe('VIEW');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://t.me/s/durov/300',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('должен корректно парсить форматы SOCKS5 и HTTP прокси через parseTelegramProxy', () => {
    const socksUrl = parseTelegramProxy('socks5://proxyuser:secretpass@185.220.101.5:1080');
    expect(socksUrl).toEqual({
      ip: '185.220.101.5',
      port: 1080,
      socksType: 5,
      username: 'proxyuser',
      password: 'secretpass',
    });

    const hostPort = parseTelegramProxy('192.168.1.100:9050:myuser:mypass');
    expect(hostPort).toEqual({
      ip: '192.168.1.100',
      port: 9050,
      socksType: 5,
      username: 'myuser',
      password: 'mypass',
    });

    expect(parseTelegramProxy('')).toBeUndefined();
    expect(parseTelegramProxy('invalid-format')).toBeUndefined();
  });

  it('должен генерировать валидную StringSession из бинарного AuthKey (256 байт)', () => {
    const rawKey = Buffer.alloc(256, 7);
    const sessionStr = createStringSessionFromAuthKey(rawKey, 2, '149.154.167.50', 443);

    expect(sessionStr.startsWith('1')).toBe(true);

    const parsedSession = new StringSession(sessionStr);
    expect(parsedSession.dcId).toBe(2);
    expect(parsedSession.serverAddress).toBe('149.154.167.50');
    expect(parsedSession.port).toBe(443);
  });

  it('должен импортировать сессию с персональным прокси и auth_key', () => {
    const rawKey = Buffer.alloc(256, 42);
    const profile = executor.importSessionFromJson({
      phone: '+79997778899',
      has_premium: true,
      dc_id: 2,
      proxy_url: 'socks5://user:pass@127.0.0.1:7897',
      auth_key: rawKey,
    });

    expect(profile.proxyUrl).toBe('socks5://user:pass@127.0.0.1:7897');
    expect(profile.sessionString).toBeDefined();
    expect(profile.sessionString?.startsWith('1')).toBe(true);
  });

  it('должен корректно очищать соединения через disconnectAll', async () => {
    await expect(executor.disconnectAll()).resolves.toBeUndefined();
  });

  describe('FR-4: Private Channel Resolver (t.me/+hash & joinchat)', () => {
    it('должен точно извлекать инвайт-хэши из различных ссылок', () => {
      expect(executor.extractInviteHash('https://t.me/+AbCdEf123')).toBe('AbCdEf123');
      expect(executor.extractInviteHash('http://t.me/+xyz_99')).toBe('xyz_99');
      expect(executor.extractInviteHash('t.me/+alpha_beta')).toBe('alpha_beta');
      expect(executor.extractInviteHash('+shortInvite')).toBe('shortInvite');
      expect(executor.extractInviteHash('https://t.me/joinchat/OldStyle123')).toBe('OldStyle123');
      expect(executor.extractInviteHash('joinchat/OldStyle123')).toBe('OldStyle123');
      expect(executor.extractInviteHash('https://t.me/public_channel')).toBeNull();
      expect(executor.extractInviteHash('@public_channel')).toBeNull();
      expect(executor.extractInviteHash('durov')).toBeNull();
    });

    it('должен разрешать peer для приватного инвайта через CheckChatInvite / ImportChatInvite', async () => {
      const mockChat = { id: 12345, title: 'Secret VIP Channel' };
      const mockClient = {
        invoke: vi.fn().mockImplementation(async (request: unknown) => {
          if (request instanceof Api.messages.CheckChatInvite) {
            return new Api.ChatInviteAlready({ chat: mockChat as unknown as Api.TypeChat });
          }
          return {};
        }),
        getEntity: vi.fn(),
      } as unknown as import('telegram').TelegramClient;

      const peer = await executor.resolveTargetChannelPeer(mockClient, 'https://t.me/+SecretHash123');
      expect(peer).toBe(mockChat);
      expect(mockClient.invoke).toHaveBeenCalledWith(
        expect.any(Api.messages.CheckChatInvite)
      );
      expect(mockClient.getEntity).not.toHaveBeenCalled();
    });

    it('должен разрешать peer для публичного канала через getEntity', async () => {
      const mockPublicChat = { id: 999, username: 'smmplan_official' };
      const mockClient = {
        invoke: vi.fn(),
        getEntity: vi.fn().mockResolvedValue(mockPublicChat),
      } as unknown as import('telegram').TelegramClient;

      const peer = await executor.resolveTargetChannelPeer(mockClient, 'https://t.me/smmplan_official');
      expect(peer).toBe(mockPublicChat);
      expect(mockClient.getEntity).toHaveBeenCalledWith('smmplan_official');
      expect(mockClient.invoke).not.toHaveBeenCalled();
    });
  });

  describe('FR-5: TelegramBoostSweeper (Кулдауны и экспирация слотов)', () => {
    it('должен освобождать просроченные слоты буста и сбрасывать 24-часовой кулдаун', async () => {
      const pool = executor.getPool();
      const now = 1000000000000;

      pool.registerSession({
        id: 'tg_sweep_test',
        phoneNumber: '+79998881122',
        dcId: 2,
        state: 'COOLDOWN',
        hasPremium: true,
        interactionHealthScore: 80,
        floodWaitUntil: now - 1000, // FloodWait уже прошел
        deviceModel: 'Test Device',
        appVersion: '10.0',
        systemVersion: 'Android 14',
        lastActionAt: now - 5000,
        boostSlots: [
          {
            slotIndex: 0,
            assignedChannelId: 'expired_channel',
            expiresAt: now - 5000, // Срок буста истек
          },
          {
            slotIndex: 1,
            cooldownUntil: now - 1000, // 24-часовой кулдаун истек
          },
          {
            slotIndex: 2,
            assignedChannelId: 'active_channel',
            expiresAt: now + 86400000, // Активный буст (не трогать)
            cooldownUntil: now + 3600000, // Активный кулдаун (не трогать)
          },
        ],
      });

      const sweepResult = await pool.sweepExpiredBoostsAndCooldowns(now);

      expect(sweepResult.expiredSlotsFreed).toBe(1);
      expect(sweepResult.cooledDownSlotsReset).toBe(1);
      expect(sweepResult.sessionsRestored).toBe(1);

      const session = pool.getSession('tg_sweep_test');
      expect(session?.state).toBe('READY');
      expect(session?.floodWaitUntil).toBeUndefined();

      // Слот 0 освобожден
      expect(session?.boostSlots[0].assignedChannelId).toBeUndefined();
      expect(session?.boostSlots[0].expiresAt).toBeUndefined();

      // Слот 1 сбросил кулдаун
      expect(session?.boostSlots[1].cooldownUntil).toBeUndefined();

      // Слот 2 остался нетронутым
      expect(session?.boostSlots[2].assignedChannelId).toBe('active_channel');
    });
  });
});
