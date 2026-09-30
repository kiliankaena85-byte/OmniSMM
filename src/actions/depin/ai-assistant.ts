'use server';

import { z } from 'zod';
import { GeminiClient } from '@/services/ai/gemini-client';
import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';
import { verifySession } from '@/lib/session';

export const AskOmniAiSchema = z.object({
  prompt: z.string().trim().min(1, 'Промпт не может быть пустым').max(4000, 'Слишком длинный запрос (максимум 4000 символов)'),
  mode: z.enum(['CHAT', 'SMM_POST', 'SUMMARIZE', 'REWRITE']).default('CHAT'),
  systemPrompt: z.string().max(1000).optional(),
});

export type AskOmniAiDto = z.infer<typeof AskOmniAiSchema>;

export const DePinTaskReportSchema = z.object({
  nodeId: z.string().trim().min(3, 'Некорректный идентификатор узла'),
  taskId: z.string().trim().min(3),
  target: z.string().trim().min(3),
  success: z.boolean(),
  durationMs: z.number().int().nonnegative().optional(),
});

export const ConvertCreditsSchema = z.object({
  nodeId: z.string().trim().min(3),
  credits: z.number().int().min(100, 'Минимум 100 кредитов для конвертации (1.00 ₽)'),
  userId: z.string().optional(),
});

const SYSTEM_PROMPTS: Record<string, string> = {
  SMM_POST:
    'Ты профессиональный SMM-копирайтер высшего класса. Пиши виральные, структурированные посты для Telegram-каналов с ярким заголовком-хуком, форматированием абзацев, вовлекающими эмодзи, сильным призывом к действию (CTA) и 3-5 точными хештегами. Пиши строго на чистом русском языке без шаблонных фраз.',
  SUMMARIZE:
    'Ты экспертный аналитик данных. Сделай краткую, емкую выжимку переданного текста в виде 3-5 главных тезисов. Выдели самую суть без лишней воды.',
  REWRITE:
    'Ты профессиональный редактор. Перепиши предложенный текст более живо, динамично, авторитетно и убедительно, полностью сохраняя исходный смысл.',
  CHAT:
    'Ты OmniAI — сверхбыстрый, интеллектуальный и полезный ИИ-помощник платформы OmniSMM. Отвечай точно, профессионально, дружелюбно и практично.',
};

/**
 * Бесплатный AI-Ассистент на базе Gemini 3 Flash для пользователей Telegram Mini App
 */
export async function askOmniAiAction(rawInput: unknown): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  try {
    const parsed = AskOmniAiSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'Ошибка валидации запроса',
      };
    }

    const { prompt, mode, systemPrompt } = parsed.data;
    const finalSystemPrompt = systemPrompt || SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.CHAT;

    const candidateText = await GeminiClient.generateContent({
      systemInstruction: finalSystemPrompt,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      temperature: mode === 'SMM_POST' ? 0.8 : 0.4,
      maxOutputTokens: 2048,
    });

    if (!candidateText || !candidateText.trim()) {
      return {
        success: false,
        error: 'ИИ-модель вернула пустой ответ. Попробуйте сформулировать запрос иначе.',
      };
    }

    return {
      success: true,
      text: candidateText.trim(),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Сбой генерации ответа: ${message}`,
    };
  }
}

/**
 * Получение пачки микро-заданий для клиентского DePIN узла
 */
export async function fetchDePinTasksAction(rawInput: { nodeId: string; limit?: number }) {
  try {
    if (!rawInput.nodeId || rawInput.nodeId.length < 3) {
      return { success: false as const, error: 'Некорректный nodeId', tasks: [] };
    }

    const dispatcher = DePinTaskDispatcher.getInstance();
    const [tasks, currentCredits] = await Promise.all([
      dispatcher.acquireTasks(rawInput.nodeId, rawInput.limit || 3),
      dispatcher.getNodeCredits(rawInput.nodeId),
    ]);

    return {
      success: true as const,
      tasks,
      currentCredits,
    };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'FAILED_TO_FETCH_TASKS',
      tasks: [],
    };
  }
}

/**
 * Отчет клиентского узла о выполнении микро-просмотра
 * [P0 BUG-1 FIX] Добавлен rate-limit через Redis: максимум 360 задач в час с одного узла
 */
export async function reportDePinTaskAction(rawInput: unknown) {
  try {
    const parsed = DePinTaskReportSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || 'INVALID_REPORT',
      };
    }

    // [BUG-1 FIX] Rate-limit: максимум 360 задач в час с одного nodeId (1 задача каждые 10 секунд)
    const { redis: redisClient } = await import('@/lib/redis');
    const rateLimitKey = `depin:rate:${parsed.data.nodeId}`;
    const current = await redisClient.incr(rateLimitKey);
    if (current === 1) {
      await redisClient.expire(rateLimitKey, 3600); // сбрасывается каждый час
    }
    if (current > 360) {
      return {
        success: false as const,
        error: 'RATE_LIMIT_EXCEEDED — максимум 360 заданий в час',
      };
    }

    const dispatcher = DePinTaskDispatcher.getInstance();
    const result = await dispatcher.reportTask(parsed.data);

    return {
      success: result.success,
      creditsAwarded: result.creditsAwarded,
      totalCredits: result.totalNodeCredits,
      error: result.error,
    };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'REPORT_PROCESSING_ERROR',
    };
  }
}


/**
 * Конвертация заработанных кредитов в баланс платформы OmniSMM
 * Курс: 100 OmniCredits = 1.00 ₽ (100 копеек)
 */
export async function convertCreditsToBalanceAction(rawInput: unknown) {
  try {
    const parsed = ConvertCreditsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.issues[0]?.message || 'INVALID_CONVERSION_REQUEST',
      };
    }

    const { nodeId, credits, userId } = parsed.data;
    const dispatcher = DePinTaskDispatcher.getInstance();

    const claimResult = await dispatcher.claimCredits(nodeId, credits);
    if (!claimResult.success) {
      return {
        success: false as const,
        error: claimResult.error || 'INSUFFICIENT_CREDITS',
      };
    }

    const rublesToAdd = Math.floor(credits / 100);
    const kopecksToAdd = BigInt(rublesToAdd * 100);

    // Если указан или авторизован конкретный пользователь — зачисляем в реальный леджер
    let targetUserId = userId;
    if (!targetUserId) {
      const session = await verifySession();
      if (session) targetUserId = session.userId;
    }

    if (targetUserId && rublesToAdd > 0) {
      const { WalletOps } = await import('@/services/financial/wallet-ops');
      const { runSerializableTransaction } = await import('@/lib/transactions');

      await runSerializableTransaction(async (tx) => {
        await WalletOps.credit(
          tx,
          targetUserId!,
          Number(kopecksToAdd),
          `Вознаграждение за участие в DePIN сети узлов (${credits} OmniCredits)`,
          {
            idempotencyKey: `depin_reward_${nodeId}_${Math.floor(Date.now() / 60_000)}`,
            transactionType: 'COMPENSATION',
          }
        );
      });
    }

    return {
      success: true as const,
      rublesCredited: rublesToAdd,
      remainingCredits: claimResult.remainingCredits,
    };
  } catch (err: unknown) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'CONVERSION_FAILED',
    };
  }
}
