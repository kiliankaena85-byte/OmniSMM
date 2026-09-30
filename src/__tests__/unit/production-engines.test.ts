import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramSessionPoolManager } from '@/services/production/telegram-session-pool';
import { HeadlessStreamEngine } from '@/services/production/headless-stream-engine';

vi.mock('@/utils/ssrf-guard', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
}));

describe('TelegramSessionPoolManager (Tier-0 Infrastructure)', () => {
  let pool: TelegramSessionPoolManager;

  beforeEach(() => {
    pool = new TelegramSessionPoolManager();
  });

  it('должен регистрировать сессию и инициализировать 4 слота бустов', () => {
    pool.registerSession({
      id: 'tg_session_1',
      phoneNumber: '+79991234567',
      dcId: 2,
      state: 'READY',
      hasPremium: true,
      interactionHealthScore: 90,
      deviceModel: 'Samsung Galaxy S24',
      appVersion: '10.14.0',
      systemVersion: 'Android 14',
      lastActionAt: Date.now(),
    });

    expect(pool.getTotalCount()).toBe(1);
    const session = pool.getSession('tg_session_1');
    expect(session).toBeDefined();
    expect(session?.boostSlots.length).toBe(4);
    expect(session?.hasPremium).toBe(true);
  });

  it('должен корректно выбирать сессию с учетом DC и Health Score', () => {
    pool.registerSession({
      id: 'session_dc1_bad',
      phoneNumber: '+10000000001',
      dcId: 1,
      state: 'READY',
      hasPremium: false,
      interactionHealthScore: 50, // Слишком низкий скор
      deviceModel: 'Pixel 7',
      appVersion: '10.14.0',
      systemVersion: 'Android 13',
      lastActionAt: Date.now(),
    });

    pool.registerSession({
      id: 'session_dc2_good',
      phoneNumber: '+10000000002',
      dcId: 2,
      state: 'READY',
      hasPremium: false,
      interactionHealthScore: 95,
      deviceModel: 'Pixel 8',
      appVersion: '10.14.0',
      systemVersion: 'Android 14',
      lastActionAt: Date.now(),
    });

    // Запрос сессии с DC2 и минимальным здоровьем 70
    const acquired = pool.acquireSessionForAction({ preferredDc: 2, minHealthScore: 70 });
    expect(acquired).toBeDefined();
    expect(acquired?.id).toBe('session_dc2_good');

    // Для DC1 подходящих сессий нет (здоровье 50 < 70)
    const acquiredDc1 = pool.acquireSessionForAction({ preferredDc: 1, minHealthScore: 70 });
    expect(acquiredDc1).toBeNull();
  });

  it('должен выделять и освобождать слот буста с 24-часовым кулдауном', () => {
    const now = 1700000000000;
    pool.registerSession({
      id: 'session_premium',
      phoneNumber: '+79998887766',
      dcId: 2,
      state: 'READY',
      hasPremium: true,
      interactionHealthScore: 100,
      deviceModel: 'iPhone 15 Pro',
      appVersion: '10.14.0',
      systemVersion: 'iOS 17.5',
      lastActionAt: now,
    });

    // 1-й буст на 30 дней
    const result1 = pool.allocateBoostSlot('https://t.me/durov', 30, now);
    expect(result1.success).toBe(true);
    expect(result1.slotIndex).toBe(0);
    expect(result1.channelId).toBe('https://t.me/durov');

    // 2-й буст в другой канал
    const result2 = pool.allocateBoostSlot('https://t.me/telegram', 30, now);
    expect(result2.success).toBe(true);
    expect(result2.slotIndex).toBe(1);

    // Освобождаем 1-й слот
    const released = pool.releaseBoostSlot('session_premium', 0, now);
    expect(released).toBe(true);

    // Слот свободен, но находится на 24-часовом кулдауне, поэтому сразу не выдается
    const session = pool.getSession('session_premium');
    expect(session?.boostSlots[0].cooldownUntil).toBeGreaterThan(now);
  });

  it('должен понижать скор при FloodWait и помечать BANNED', () => {
    pool.registerSession({
      id: 'session_flood',
      phoneNumber: '+79990001122',
      dcId: 4,
      state: 'READY',
      hasPremium: false,
      interactionHealthScore: 60,
      deviceModel: 'Xiaomi 13',
      appVersion: '10.14.0',
      systemVersion: 'Android 13',
      lastActionAt: Date.now(),
    });

    pool.reportFloodWait('session_flood', 300);
    const session = pool.getSession('session_flood');
    expect(session?.interactionHealthScore).toBe(45);
    expect(session?.state).toBe('COOLDOWN');

    pool.markBanned('session_flood');
    expect(session?.state).toBe('BANNED');
    expect(session?.interactionHealthScore).toBe(0);
  });

  it('должен корректно рассчитывать статистику пула', () => {
    pool.registerSession({
      id: 's1',
      phoneNumber: '+1',
      dcId: 2,
      state: 'READY',
      hasPremium: true,
      interactionHealthScore: 100,
      deviceModel: 'm1',
      appVersion: 'v1',
      systemVersion: 's1',
      lastActionAt: Date.now(),
    });

    pool.registerSession({
      id: 's2',
      phoneNumber: '+2',
      dcId: 4,
      state: 'READY',
      hasPremium: false,
      interactionHealthScore: 80,
      deviceModel: 'm2',
      appVersion: 'v2',
      systemVersion: 's2',
      lastActionAt: Date.now(),
    });

    const stats = pool.getPoolStatistics();
    expect(stats.totalSessions).toBe(2);
    expect(stats.activeSessions).toBe(2);
    expect(stats.premiumAccounts).toBe(1);
    expect(stats.totalBoostSlots).toBe(8); // 2 сессии * 4 слота
    expect(stats.availableBoostSlots).toBe(4); // Только у Premium сессии
    expect(stats.averageHealthScore).toBe(90); // (100 + 80) / 2
  });
});

describe('HeadlessStreamEngine (Tier-0 Infrastructure)', () => {
  let engine: HeadlessStreamEngine;

  beforeEach(() => {
    engine = new HeadlessStreamEngine();
    vi.restoreAllMocks();
  });

  it('должен парсить .m3u8 манифест и извлекать URL чанков', () => {
    const sampleManifest = `
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXTINF:4.000,
chunk_001.ts
#EXTINF:4.000,
chunk_002.ts
#EXTINF:4.000,
https://cdn.kick.com/stream/chunk_003.ts
    `.trim();

    const baseUrl = 'https://video-edge.twitch.tv/live/';
    const chunks = engine.parseM3u8Manifest(sampleManifest, baseUrl);

    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe('https://video-edge.twitch.tv/live/chunk_001.ts');
    expect(chunks[1]).toBe('https://video-edge.twitch.tv/live/chunk_002.ts');
    expect(chunks[2]).toBe('https://cdn.kick.com/stream/chunk_003.ts');
  });

  it('должен симулировать частичное скачивание чанка (Range request 64KB)', async () => {
    const mockArrayBuffer = new ArrayBuffer(65536);
    const mockFetch = vi.fn().mockResolvedValue({
      status: 206,
      arrayBuffer: () => Promise.resolve(mockArrayBuffer),
    });
    global.fetch = mockFetch;

    const result = await engine.simulateChunkPlayback({
      chunkUrl: 'https://video-edge.twitch.tv/live/chunk_test.ts',
    });

    expect(result.success).toBe(true);
    expect(result.bytesFetched).toBe(65536);
    expect(result.statusCode).toBe(206);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Range']).toBe('bytes=0-65535');
  });

  it('должен управлять жизненным циклом задачи зрителей стрима', () => {
    const task = engine.createStreamTask({
      targetUrl: 'https://twitch.tv/shroud',
      platform: 'TWITCH',
      viewersTarget: 500,
      durationMinutes: 60,
    });

    expect(task.status).toBe('PENDING');
    expect(task.viewersTarget).toBe(500);

    const started = engine.startStreamTask(task.id);
    expect(started).toBe(true);
    expect(engine.getTask(task.id)?.status).toBe('RUNNING');
    expect(engine.getTask(task.id)?.activeViewersCount).toBe(500);

    const activeList = engine.getActiveTasks();
    expect(activeList.length).toBe(1);

    const stopped = engine.stopStreamTask(task.id);
    expect(stopped).toBe(true);
    expect(engine.getTask(task.id)?.status).toBe('STOPPED');
    expect(engine.getTask(task.id)?.activeViewersCount).toBe(0);
    expect(engine.getActiveTasks().length).toBe(0);
  });
});
