'use server';

import { z } from 'zod';
import { GeminiClient } from '@/services/ai/gemini-client';
import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';
import { verifySession } from '@/lib/session';

const AskOmniAiSchema = z.object({
  prompt: z.string().trim().min(1, 'Промпт не может быть пустым').max(4000, 'Слишком длинный запрос (максимум 4000 символов)'),
  mode: z.enum(['CHAT', 'SMM_POST', 'SUMMARIZE', 'REWRITE', 'SMART_COMMENT']).default('CHAT'),
  systemPrompt: z.string().max(1000).optional(),
});

export type AskOmniAiDto = z.infer<typeof AskOmniAiSchema>;

const DePinTaskReportSchema = z.object({
  nodeId: z.string().trim().min(3, 'Некорректный идентификатор узла'),
  taskId: z.string().trim().min(3),
  target: z.string().trim().min(3),
  success: z.boolean(),
  durationMs: z.number().int().nonnegative().optional(),
});

const ConvertCreditsSchema = z.object({
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
  SMART_COMMENT:
    'Ты реальный, активный подписчик Telegram-канала. Напиши ровно 3 разных, коротких (1-2 предложения), живых и органичных комментария к посту по заданной теме или ссылке на русском языке. Комментарии должны звучать естественно, по-человечески, вызывать обсуждение или выражать искреннее мнение. Раздели варианты нумерованным списком (1., 2., 3.) без лишних вводных слов и пояснений.',
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
      temperature: mode === 'SMM_POST' ? 0.8 : mode === 'SMART_COMMENT' ? 0.7 : 0.4,
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
export async function fetchDePinTasksAction(rawInput: {
  nodeId: string;
  limit?: number;
  includeDemo?: boolean;
  priorityTargetId?: string;
}) {
  try {
    if (!rawInput.nodeId || rawInput.nodeId.length < 3) {
      return { success: false as const, error: 'Некорректный nodeId', tasks: [] };
    }

    const dispatcher = DePinTaskDispatcher.getInstance();
    const [tasks, currentCredits, trustScore] = await Promise.all([
      dispatcher.acquireTasks(
        rawInput.nodeId,
        rawInput.limit || 3,
        rawInput.includeDemo !== false,
        rawInput.priorityTargetId
      ),
      dispatcher.getNodeCredits(rawInput.nodeId),
      dispatcher.getNodeTrustScore(rawInput.nodeId),
    ]);

    return {
      success: true as const,
      tasks,
      currentCredits,
      trustScore,
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

    // Proof-of-Activity Gate & 10% Royalty hook for referrals
    if (result.success) {
      try {
        const { evaluateProofOfActivityGate, awardReferralRoyalty } = await import('@/actions/depin/referral');
        const { db: dbClient } = await import('@/lib/db');
        await evaluateProofOfActivityGate(dbClient, parsed.data.nodeId, 0, 1);
        if (result.creditsAwarded && result.creditsAwarded > 0) {
          await awardReferralRoyalty(dbClient, parsed.data.nodeId, parsed.data.taskId, result.creditsAwarded);
        }
      } catch {
        // Non-blocking
      }
    }

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

const SkipDePinTaskSchema = z.object({
  nodeId: z.string().trim().min(3, 'Некорректный идентификатор узла'),
  taskId: z.string().trim().min(3),
  targetId: z.string().optional(),
  channel: z.string().optional(),
  postId: z.number().int().optional(),
  reason: z.enum(['ALREADY_VIEWED', 'OWN_POST', 'EXPIRED', 'USER_SKIP']).default('USER_SKIP'),
});

export type SkipDePinTaskDto = z.infer<typeof SkipDePinTaskSchema>;

/**
 * Пропуск задания пользователем или автоматическая замена зависшего задания.
 * Исключает повторное появление контента и возвращает 1 свежее задание на замену.
 */
export async function skipDePinTaskAction(rawInput: unknown): Promise<{
  success: boolean;
  skippedTaskId?: string;
  replacementTask?: import('@/services/depin/task-dispatcher').DePinTaskItem;
  error?: string;
}> {
  try {
    const parsed = SkipDePinTaskSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'INVALID_SKIP_REQUEST',
      };
    }

    const { nodeId, taskId, targetId, channel, postId, reason } = parsed.data;
    const dispatcher = DePinTaskDispatcher.getInstance();

    await dispatcher.skipTask({
      nodeId,
      taskId,
      targetId,
      channel,
      postId,
      reason,
    });

    // Мгновенно подбираем 1 свежее задание взамен пропущенного
    const replacements = await dispatcher.acquireTasks(nodeId, 1, true);
    const replacementTask = replacements[0] ?? undefined;

    return {
      success: true,
      skippedTaskId: taskId,
      replacementTask,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'SKIP_TASK_FAILED',
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
    let rawIdentifier = userId;
    if (!rawIdentifier) {
      const session = await verifySession();
      if (session) rawIdentifier = session.userId;
    }

    if (rawIdentifier && rublesToAdd > 0) {
      const { WalletOps } = await import('@/services/financial/wallet-ops');
      const { runSerializableTransaction } = await import('@/lib/transactions');

      await runSerializableTransaction(async (tx) => {
        // Резолвим пользователя: проверяем по id (CUID) или telegramId
        let resolvedUser = await tx.user.findFirst({
          where: {
            OR: [
              { id: rawIdentifier },
              { telegramId: rawIdentifier },
            ],
          },
          select: { id: true, tenantId: true },
        });

        // Если пользователь с таким telegramId еще не создан — авто-регистрируем профиль
        if (!resolvedUser) {
          resolvedUser = await tx.user.create({
            data: {
              telegramId: rawIdentifier,
              tenantId: 'smmplan',
              role: 'USER',
              email: `tg_${rawIdentifier}@telegram.omnismm.internal`,
              preferredDashboard: 'CLASSIC',
            },
            select: { id: true, tenantId: true },
          });
        }

        await WalletOps.credit(
          tx,
          resolvedUser.id,
          Number(kopecksToAdd),
          `Вознаграждение за участие в DePIN сети узлов (${credits} OmniCredits)`,
          {
            idempotencyKey: `depin_reward_${nodeId}_${Math.floor(Date.now() / 60_000)}`,
            transactionType: 'COMPENSATION',
            tenantId: resolvedUser.tenantId || 'smmplan',
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

// ─── FOLLOW_CHANNEL верификация ────────────────────────────────────────────

const FollowChannelSchema = z.object({
  nodeId: z.string().trim().min(3),
  channel: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/, 'Некорректное имя канала'),
  telegramUserId: z.string().trim().min(1),
});

export async function verifyFollowChannelAction(rawInput: unknown): Promise<{
  success: boolean;
  escrowId?: string;
  creditsLocked?: number;
  error?: string;
}> {
  try {
    const parsed = FollowChannelSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_INPUT' };
    const { nodeId, channel, telegramUserId } = parsed.data;

    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
    let isMember = true;
    if (botToken) {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channel}&user_id=${telegramUserId}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { result?: { status?: string } };
        const st = data.result?.status;
        isMember = st === 'member' || st === 'administrator' || st === 'creator';
      }
    }
    if (!isMember) return { success: false, error: 'NOT_A_MEMBER' };

    const { db: dbClient } = await import('@/lib/db');
    const target = await dbClient.dePinTarget.upsert({
      where: { channel_postId: { channel, postId: 0 } },
      create: { channel, postId: 0, type: 'FOLLOW_CHANNEL', status: 'PENDING_VERIFY', nodeId, targetViews: 1, completedViews: 0, startedAt: new Date() },
      update: {},
    });

    const { DePinEscrowService } = await import('@/services/depin/escrow');
    const { escrowId, amount } = await DePinEscrowService.lockEscrow(nodeId, target.id, 50);
    return { success: true, escrowId, creditsLocked: amount };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'VERIFY_FOLLOW_FAILED' };
  }
}

const CancelDePinOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function cancelDePinOrderAction(rawInput: unknown): Promise<{
  success: boolean;
  cancelledTasks?: number;
  error?: string;
}> {
  try {
    const parsed = CancelDePinOrderSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_INPUT' };
    const { orderId } = parsed.data;
    const { db: dbClient } = await import('@/lib/db');
    const cancelled = await dbClient.dePinTarget.updateMany({
      where: { orderId, status: { in: ['QUEUED', 'ASSIGNED', 'PENDING_VERIFY'] } },
      data: { status: 'CANCELLED' },
    });
    return { success: true, cancelledTasks: cancelled.count };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'CANCEL_ORDER_FAILED' };
  }
}

// ── Настройки предпочтений узла ──────────────────────────────────────────────

const ALLOWED_REACTIONS_LIST = ['👍', '❤️', '🔥', '🎉', '👏', '💩'] as const;

const UpdateNodePreferencesSchema = z.object({
  nodeId: z.string().trim().min(3),
  acceptsViewTasks:   z.boolean().optional(),
  acceptsReactTasks:  z.boolean().optional(),
  acceptsFollowTasks: z.boolean().optional(),
  allowedReactions:   z.array(z.enum(ALLOWED_REACTIONS_LIST)).optional(),
  hasTelegramPremium: z.boolean().optional(),
});

export type UpdateNodePreferencesDto = z.infer<typeof UpdateNodePreferencesSchema>;

/**
 * Сохраняет предпочтения узла (типы задач, которые нода согласна выполнять).
 * Используется вкладкой «Настройки» в DePIN TMA.
 */
export async function updateNodePreferencesAction(rawInput: unknown): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const parsed = UpdateNodePreferencesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_INPUT' };
    const { nodeId, acceptsViewTasks, acceptsReactTasks, acceptsFollowTasks, allowedReactions, hasTelegramPremium } = parsed.data;

    // Best-effort: сохраняем предпочтения в Redis-хэш узла (ttl 30 дней)
    try {
      const { redis } = await import('@/lib/redis');
      if (redis) {
        const key = `depin:node:${nodeId}:prefs`;
        const patch: Record<string, string> = {};
        if (acceptsViewTasks   !== undefined) patch['acceptsViewTasks']   = String(acceptsViewTasks);
        if (acceptsReactTasks  !== undefined) patch['acceptsReactTasks']  = String(acceptsReactTasks);
        if (acceptsFollowTasks !== undefined) patch['acceptsFollowTasks'] = String(acceptsFollowTasks);
        if (allowedReactions   !== undefined) patch['allowedReactions']   = JSON.stringify(allowedReactions);
        if (hasTelegramPremium !== undefined) patch['hasTelegramPremium'] = String(hasTelegramPremium);
        if (Object.keys(patch).length > 0) {
          await redis.hset(key, patch);
          await redis.expire(key, 60 * 60 * 24 * 30);
        }
      }
    } catch {
      // Redis недоступен — настройки действуют только в рамках клиентской сессии
    }

    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'PREFERENCES_UPDATE_FAILED' };
  }
}

// ── P2P Boost Engine (Взаимный обмен заказами за кредиты) ──────────────────

const CreateP2PBoostSchema = z.object({
  nodeId: z.string().trim().min(3),
  postUrl: z.string().trim().regex(
    /^https:\/\/t\.me\/([a-zA-Z0-9_]{4,32})\/(\d+)(?:\?.*)?$/,
    'Ссылка должна быть формата https://t.me/channel/123'
  ),
  boostType: z.enum(['VIEW', 'REACT', 'MULTI_POST', 'SMART_COMMENT']),
  reactionEmoji: z.enum(ALLOWED_REACTIONS_LIST).optional(),
  count: z.number().int().min(5).max(500),
});

export type CreateP2PBoostDto = z.infer<typeof CreateP2PBoostSchema>;

export async function createP2PBoostAction(rawInput: unknown): Promise<{
  success: boolean;
  targetId?: string;
  remainingCredits?: number;
  error?: string;
}> {
  try {
    const parsed = CreateP2PBoostSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_BOOST_INPUT' };
    }

    const { nodeId, postUrl, boostType, reactionEmoji, count } = parsed.data;
    if (boostType === 'REACT' && !reactionEmoji) {
      return { success: false, error: 'Выберите конкретную реакцию для буста' };
    }

    let costPerItem = 2;
    if (boostType === 'REACT' || boostType === 'MULTI_POST') {
      costPerItem = 5;
    } else if (boostType === 'SMART_COMMENT') {
      costPerItem = 15;
    }
    const totalCost = count * costPerItem;

    const match = postUrl.match(/^https:\/\/t\.me\/([a-zA-Z0-9_]{4,32})\/(\d+)/);
    if (!match) {
      return { success: false, error: 'Неверный формат ссылки на пост' };
    }
    const channel = match[1];
    const postId = parseInt(match[2], 10);

    const { db } = await import('@/lib/db');

    const result = await db.$transaction(async (tx) => {
      const node = await tx.dePinNode.findUnique({
        where: { id: nodeId },
        select: { creditsBalance: true },
      });

      if (!node || node.creditsBalance < totalCost) {
        throw new Error(
          `Недостаточно очков (PTS). Требуется: ${totalCost} PTS, на балансе: ${node?.creditsBalance ?? 0} PTS`
        );
      }

      const updatedNode = await tx.dePinNode.update({
        where: { id: nodeId },
        data: {
          creditsBalance: { decrement: totalCost },
          lastActiveAt: new Date(),
        },
        select: { creditsBalance: true },
      });

      let taskType = 'VIEW_POST';
      if (boostType === 'REACT') {
        taskType = `REACT_POST:${reactionEmoji}`;
      } else if (boostType === 'MULTI_POST') {
        taskType = 'MULTI_POST';
      } else if (boostType === 'SMART_COMMENT') {
        taskType = 'SMART_COMMENT';
      }

      const target = await tx.dePinTarget.upsert({
        where: { channel_postId: { channel, postId } },
        create: {
          channel,
          postId,
          type: taskType,
          status: 'QUEUED',
          targetViews: count,
          completedViews: 0,
          nodeId,
          orderId: `p2p:${nodeId}:${boostType}`,
        },
        update: {
          targetViews: { increment: count },
          status: 'QUEUED',
          type: taskType,
          nodeId,
        },
      });

      return {
        targetId: target.id,
        remainingCredits: updatedNode.creditsBalance,
      };
    });

    // [OWN_POST FIX] Автоматически исключаем созданный канал и пост для автора
    try {
      const { redis } = await import('@/lib/redis');
      if (redis && typeof redis.sadd === 'function') {
        const EXPIRE_30_DAYS = 2_592_000;
        await redis.sadd(`depin:node:${nodeId}:owned_channels`, channel.toLowerCase());
        await redis.expire(`depin:node:${nodeId}:owned_channels`, EXPIRE_30_DAYS);
        await redis.sadd(`depin:node:${nodeId}:skipped_targets`, `${channel}:${postId}`);
        if (result.targetId) {
          await redis.sadd(`depin:node:${nodeId}:skipped_targets`, result.targetId);
        }
      }
    } catch {
      // non-blocking
    }

    return {
      success: true,
      targetId: result.targetId,
      remainingCredits: result.remainingCredits,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_CREATE_P2P_BOOST',
    };
  }
}


// ── Batch Tap Sync & Anti-Cheat Engine ──────────────────────────────────────

const SyncTapsSchema = z.object({
  nodeId: z.string().trim().min(3),
  tapCount: z.number().int().min(1).max(100),
  clientTimestamp: z.number().int().positive(),
  durationMs: z.number().int().nonnegative().optional(),
});

export type SyncTapsDto = z.infer<typeof SyncTapsSchema>;

const ENERGY_MAX = 1000;
const ENERGY_REGEN_PER_SEC = 2;
const ENERGY_PER_TAP = 20;

export async function syncTapsAction(rawInput: unknown): Promise<{
  success: boolean;
  creditsAwarded?: number;
  totalCredits?: number;
  remainingEnergy?: number;
  error?: string;
}> {
  try {
    const parsed = SyncTapsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || 'INVALID_SYNC_TAPS_PAYLOAD',
      };
    }

    const { nodeId, tapCount, clientTimestamp } = parsed.data;
    const now = Date.now();

    // 1. Anti-Cheat: Проверка энергии через Redis
    const { redis } = await import('@/lib/redis');
    const energyKey = `depin:energy:${nodeId}`;
    const rawEnergy = await redis.get(energyKey);

    let currentEnergy = ENERGY_MAX;

    if (rawEnergy) {
      try {
        const parsedEnergy = JSON.parse(rawEnergy) as {
          lastSyncTimestamp: number;
          currentEnergy: number;
        };
        const deltaSec = Math.max(0, (now - parsedEnergy.lastSyncTimestamp) / 1000);
        currentEnergy = Math.min(ENERGY_MAX, parsedEnergy.currentEnergy + deltaSec * ENERGY_REGEN_PER_SEC);
      } catch {
        currentEnergy = ENERGY_MAX;
      }
    }

    const requiredEnergy = tapCount * ENERGY_PER_TAP;
    // Допускаем небольшую погрешность сетевого лага в 40 ед. энергии (2 тапа)
    if (currentEnergy + 40 < requiredEnergy) {
      return {
        success: false,
        error: 'ENERGY_EXHAUSTED — Недостаточно энергии для выполнения тапов',
        remainingEnergy: Math.floor(currentEnergy),
      };
    }

    const remainingEnergy = Math.max(0, currentEnergy - requiredEnergy);
    await redis.setex(
      energyKey,
      86400,
      JSON.stringify({ lastSyncTimestamp: now, currentEnergy: remainingEnergy })
    );

    // 2. Атомарное начисление кредитов в PostgreSQL (с безопасным upsert фоллбеком)
    const { db } = await import('@/lib/db');
    let updatedNode;
    try {
      updatedNode = await db.dePinNode.update({
        where: { id: nodeId },
        data: {
          creditsBalance: { increment: tapCount },
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        },
        select: { creditsBalance: true },
      });
    } catch {
      updatedNode = await db.dePinNode.upsert({
        where: { id: nodeId },
        create: {
          id: nodeId,
          creditsBalance: tapCount,
          lastActiveAt: new Date(),
        },
        update: {
          creditsBalance: { increment: tapCount },
          lastActiveAt: new Date(),
          updatedAt: new Date(),
        },
        select: { creditsBalance: true },
      });
    }

    // 3. Proof-of-Activity Gate: проверка активности реферала (20 тапов)
    try {
      const { evaluateProofOfActivityGate } = await import('@/actions/depin/referral');
      await evaluateProofOfActivityGate(db, nodeId, tapCount, 0);
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      creditsAwarded: tapCount,
      totalCredits: updatedNode.creditsBalance,
      remainingEnergy: Math.floor(remainingEnergy),
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_SYNC_TAPS',
    };
  }
}

