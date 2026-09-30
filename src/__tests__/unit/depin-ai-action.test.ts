import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  askOmniAiAction,
  fetchDePinTasksAction,
  reportDePinTaskAction,
  convertCreditsToBalanceAction,
} from '@/actions/depin/ai-assistant';
import { GeminiClient } from '@/services/ai/gemini-client';
import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(3599),
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

vi.mock('@/lib/transactions', () => ({
  runSerializableTransaction: vi.fn().mockImplementation(async (callback) => {
    return callback({});
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

    it('должен выдавать задачи и принимать отчеты с начислением кредитов', async () => {
      const fetchRes = await fetchDePinTasksAction({ nodeId: 'node_live_99', limit: 2 });
      expect(fetchRes.success).toBe(true);
      expect(fetchRes.tasks.length).toBeGreaterThan(0);

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
});
