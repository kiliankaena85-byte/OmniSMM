import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  askOmniAiAction,
  fetchDePinTasksAction,
  reportDePinTaskAction,
  convertCreditsToBalanceAction,
  skipDePinTaskAction,
} from '@/actions/depin/ai-assistant';
import { GeminiClient } from '@/services/ai/gemini-client';
import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(3599),
    exists: vi.fn().mockResolvedValue(0),
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(JSON.stringify({ targetId: 't1', nodeId: 'node_live_99' })),
    del: vi.fn().mockResolvedValue(1),
    sismember: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/services/ai/gemini-client', () => ({
  GeminiClient: {
    generateContent: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue({ userId: 'usr_mock_123' }),
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    credit: vi.fn().mockResolvedValue({ id: 'led_1' }),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'usr_mock_123', tenantId: 'smmplan' }),
      create: vi.fn().mockResolvedValue({ id: 'usr_mock_123', tenantId: 'smmplan' }),
    },
    dePinNode: {
      upsert: vi.fn().mockResolvedValue({ id: 'node_live_1' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'node_live_1', creditsBalance: 10 }),
      update: vi.fn().mockResolvedValue({ id: 'node_live_1', creditsBalance: 20 }),
    },
    dePinTarget: {
      fields: { targetViews: 'targetViews' },
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

vi.mock('@/lib/transactions', () => ({
  runSerializableTransaction: vi.fn().mockImplementation(async (callback) => {
    return callback({
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'usr_mock_123', tenantId: 'smmplan' }),
        create: vi.fn().mockResolvedValue({ id: 'usr_mock_123', tenantId: 'smmplan' }),
      },
    });
  }),
}));

describe('DePIN AI Assistant & Task Actions', () => {
  beforeEach(() => {
    DePinTaskDispatcher.resetInstance();
    vi.clearAllMocks();
  });

  describe('askOmniAiAction', () => {
    it('должен отклонять пустой запрос', async () => {
      const res = await askOmniAiAction({ prompt: '   ' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('должен успешно генерировать SMM-пост через Gemini 3 Flash', async () => {
      vi.mocked(GeminiClient.generateContent).mockResolvedValueOnce(
        '🔥 Открытие лучшей кофейни! Заходи за круассаном #кофе #акция'
      );

      const res = await askOmniAiAction({
        prompt: 'Напиши пост про кофейню',
        mode: 'SMM_POST',
      });

      expect(res.success).toBe(true);
      expect(res.text).toContain('🔥 Открытие лучшей кофейни!');
      expect(GeminiClient.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: expect.stringContaining('SMM-копирайтер'),
          temperature: 0.8,
        })
      );
    });

    it('должен генерировать осмысленные комментарии в режиме SMART_COMMENT', async () => {
      vi.mocked(GeminiClient.generateContent).mockResolvedValueOnce(
        '1. Отличная мысль, полностью согласен!\n2. Интересный подход к продвижению.\n3. Ждем продолжения поста!'
      );

      const res = await askOmniAiAction({
        prompt: 'Пост про DePIN',
        mode: 'SMART_COMMENT',
      });

      expect(res.success).toBe(true);
      expect(res.text).toContain('1. Отличная мысль');
      expect(GeminiClient.generateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: expect.stringContaining('активный подписчик'),
          temperature: 0.7,
        })
      );
    });

    it('должен корректно обрабатывать ошибку генерации от модели', async () => {
      vi.mocked(GeminiClient.generateContent).mockRejectedValueOnce(
        new Error('QUOTA_EXCEEDED_429')
      );

      const res = await askOmniAiAction({
        prompt: 'Тестовый промпт',
        mode: 'CHAT',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('QUOTA_EXCEEDED_429');
    });
  });

  describe('fetchDePinTasksAction & reportDePinTaskAction', () => {
    it('должен отклонять запрос задач с невалидным nodeId', async () => {
      const res = await fetchDePinTasksAction({ nodeId: 'ab' });
      expect(res.success).toBe(false);
      expect(res.tasks).toHaveLength(0);
    });

    it('должен выдавать задачи, trustScore и принимать отчеты с начислением кредитов', async () => {
      const fetchRes = await fetchDePinTasksAction({ nodeId: 'node_live_99', limit: 2 });
      expect(fetchRes.success).toBe(true);
      expect(fetchRes.tasks.length).toBeGreaterThan(0);
      expect(fetchRes.trustScore).toBeDefined();

      const firstTask = fetchRes.tasks[0];
      const reportRes = await reportDePinTaskAction({
        nodeId: 'node_live_99',
        taskId: firstTask.taskId,
        target: firstTask.targetUrl,
        success: true,
      });

      expect(reportRes.success).toBe(true);
      expect(reportRes.creditsAwarded).toBeGreaterThan(0);
    });
  });

  describe('convertCreditsToBalanceAction', () => {
    it('должен отклонять конвертацию менее 100 кредитов', async () => {
      const res = await convertCreditsToBalanceAction({
        nodeId: 'node_test',
        credits: 50,
      });

      expect(res.success).toBe(false);
    });

    it('должен успешно конвертировать 200 кредитов в 2.00 ₽ на баланс', async () => {
      // claimCredits теперь идёт в PostgreSQL — мокируем через singleton
      vi.spyOn(DePinTaskDispatcher.prototype, 'claimCredits').mockResolvedValueOnce({
        success: true,
        claimedCredits: 200,
        remainingCredits: 50,
      });

      const res = await convertCreditsToBalanceAction({
        nodeId: 'node_rich',
        credits: 200,
        userId: 'usr_mock_123',
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.rublesCredited).toBe(2);
        expect(res.remainingCredits).toBe(50);
      }
    });
  });

  describe('skipDePinTaskAction', () => {
    it('должен валидировать и отклонять пустые входные данные', async () => {
      const res = await skipDePinTaskAction({ nodeId: '', taskId: '' });
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('должен успешно пропускать задание и возвращать свежее задание на замену', async () => {
      const res = await skipDePinTaskAction({
        nodeId: 'node_live_99',
        taskId: 'task_to_skip_1',
        targetId: 't1',
        channel: 'durov',
        postId: 100,
        reason: 'ALREADY_VIEWED',
      });

      expect(res.success).toBe(true);
      expect(res.skippedTaskId).toBe('task_to_skip_1');
    });

    it('должен поддерживать причину OWN_POST для исключения своего контента', async () => {
      const res = await skipDePinTaskAction({
        nodeId: 'node_live_99',
        taskId: 'task_own_1',
        channel: 'my_own_chan',
        postId: 12,
        reason: 'OWN_POST',
      });

      expect(res.success).toBe(true);
      expect(res.skippedTaskId).toBe('task_own_1');
    });
  });
});
