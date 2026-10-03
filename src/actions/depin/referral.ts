'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import type { PrismaClient, Prisma } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

// ── 1. Схемы валидации ────────────────────────────────────────────────────────

const ProcessReferralSchema = z.object({
  refereeNodeId: z.string().trim().min(3, 'Некорректный nodeId реферала'),
  refereeTelegramId: z.string().trim().min(1, 'Некорректный telegramId реферала'),
  startParam: z.string().trim().max(128).optional().nullable(),
  ipAddress: z.string().max(64).optional().nullable(),
  userAgent: z.string().max(256).optional().nullable(),
});

export type ProcessReferralDto = z.infer<typeof ProcessReferralSchema>;

const GetReferralStatsSchema = z.object({
  nodeId: z.string().trim().min(3, 'Некорректный идентификатор узла'),
  telegramId: z.string().trim().optional().nullable(),
});

export type GetReferralStatsDto = z.infer<typeof GetReferralStatsSchema>;

const ShareCampaignSchema = z.object({
  type: z.enum(['INVITE_FRIEND', 'SQUAD_BOOST']),
  referrerTelegramId: z.string().trim().min(1),
  targetId: z.string().trim().optional(),
  customText: z.string().max(300).optional(),
});

export type ShareCampaignDto = z.infer<typeof ShareCampaignSchema>;

export interface ReferralStatsResponse {
  referralCode: string;
  shareUrl: string;
  totalInvited: number;
  qualifiedFriends: number;
  pendingFriends: number;
  earnedBonusCredits: number;
  earnedRoyaltyCredits: number;
  welcomeBonusClaimed: boolean;
}

// ── 2. Обработка реферального перехода при старте TMA ──────────────────────────

/**
 * Обрабатывает вход по реферальной ссылке (start_param = ref_<referrerTelegramId>).
 * Начисляет Welcome-бонус (+50 PTS) новому пользователю и регистрирует связь для Proof-of-Activity гейта.
 */
export async function processReferralAction(rawInput: unknown): Promise<{
  success: boolean;
  welcomeBonusAwarded?: boolean;
  creditsAwarded?: number;
  referrerId?: string;
  squadTargetId?: string;
  error?: string;
}> {
  try {
    const parsed = ProcessReferralSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_REFERRAL_PAYLOAD' };
    }

    const { refereeNodeId, refereeTelegramId, startParam, ipAddress, userAgent } = parsed.data;

    // Проверяем IP Rate-Limit в Redis (не более 5 рефералов с одного IP в час)
    if (ipAddress && redis) {
      try {
        const ipKey = `depin:ref:ip:${ipAddress}`;
        const currentCount = await redis.incr(ipKey);
        if (currentCount === 1) {
          await redis.expire(ipKey, 3600);
        } else if (currentCount > 5) {
          return { success: false, error: 'IP_RATE_LIMIT_EXCEEDED: Слишком много регистраций с одного IP' };
        }
      } catch {
        // Best-effort при недоступности Redis
      }
    }

    // Если нет startParam или он пуст — проверяем, есть ли уже связь
    if (!startParam) {
      const existingRef = await db.dePinReferral.findUnique({
        where: { refereeTelegramId },
      });
      return {
        success: true,
        welcomeBonusAwarded: false,
        referrerId: existingRef?.referrerTelegramId,
      };
    }

    // Извлекаем referrerTelegramId из startParam (поддерживаем форматы: ref_12345678, sq_targetId_12345678, squad_targetId_12345678)
    let referrerTelegramId: string | null = null;
    let squadTargetId: string | undefined;
    if (startParam.startsWith('ref_')) {
      referrerTelegramId = startParam.replace('ref_', '').trim();
    } else if (startParam.startsWith('sq_') || startParam.startsWith('squad_')) {
      const prefix = startParam.startsWith('squad_') ? 'squad_' : 'sq_';
      const remainder = startParam.substring(prefix.length).trim();
      const parts = remainder.split('_');
      if (parts.length >= 2) {
        squadTargetId = parts[0].trim();
        referrerTelegramId = parts[1].trim();
      } else if (parts.length === 1 && parts[0]) {
        squadTargetId = parts[0].trim();
      }
    }

    if (!referrerTelegramId) {
      // Это squad_xxx без реферера или другой параметр
      return { success: true, welcomeBonusAwarded: false, squadTargetId };
    }

    // Инвариант OWASP A01: Защита от самореферала
    if (referrerTelegramId === refereeTelegramId || `tg_${referrerTelegramId}` === refereeNodeId) {
      return { success: false, error: 'CANNOT_REFER_SELF: Нельзя быть рефералом самого себя' };
    }

    // Проверяем, не зарегистрирован ли уже этот друг
    const existingReferral = await db.dePinReferral.findUnique({
      where: { refereeTelegramId },
    });

    if (existingReferral) {
      return {
        success: true,
        welcomeBonusAwarded: false,
        referrerId: existingReferral.referrerTelegramId,
      };
    }

    // Находим или создаем ноду реферера
    const referrerNodeId = `tg_${referrerTelegramId}`;
    await db.dePinNode.upsert({
      where: { id: referrerNodeId },
      create: { id: referrerNodeId, creditsBalance: 0 },
      update: {},
    });

    // Транзакция: создание связи и начисление Welcome-бонуса (+50 PTS) новому пользователю
    await db.$transaction(async (tx) => {
      // 1. Создаем запись реферала со статусом PENDING_QUALIFICATION
      await tx.dePinReferral.create({
        data: {
          referrerTelegramId,
          referrerNodeId,
          refereeTelegramId,
          refereeNodeId,
          status: 'PENDING_QUALIFICATION',
          welcomeBonusGranted: true,
          activationBonusGranted: false,
          tapsRecorded: 0,
          tasksCompleted: 0,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      // 2. Начисляем другу Welcome-бонус +50 PTS
      await tx.dePinNode.upsert({
        where: { id: refereeNodeId },
        create: {
          id: refereeNodeId,
          creditsBalance: 50,
        },
        update: {
          creditsBalance: { increment: 50 },
        },
      });
    });

    return {
      success: true,
      welcomeBonusAwarded: true,
      creditsAwarded: 50,
      referrerId: referrerTelegramId,
      squadTargetId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_PROCESS_REFERRAL',
    };
  }
}

// ── 3. Получение реферальной статистики пользователя ──────────────────────────

export async function getReferralStatsAction(rawInput: unknown): Promise<{
  success: boolean;
  stats?: ReferralStatsResponse;
  error?: string;
}> {
  try {
    const parsed = GetReferralStatsSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'INVALID_INPUT' };
    }

    const { nodeId, telegramId } = parsed.data;
    const rawTgId = telegramId || (nodeId.startsWith('tg_') ? nodeId.replace('tg_', '') : null);

    if (!rawTgId) {
      return {
        success: true,
        stats: {
          referralCode: nodeId,
          shareUrl: `https://t.me/SMMplansapport_bot/tap?startapp=ref_${nodeId}`,
          totalInvited: 0,
          qualifiedFriends: 0,
          pendingFriends: 0,
          earnedBonusCredits: 0,
          earnedRoyaltyCredits: 0,
          welcomeBonusClaimed: false,
        },
      };
    }

    // Запрашиваем всех приглашенных друзей
    const referrals = await db.dePinReferral.findMany({
      where: {
        OR: [
          { referrerTelegramId: rawTgId },
          { referrerNodeId: nodeId },
        ],
      },
      include: {
        earnings: {
          select: {
            earningType: true,
            amountCredits: true,
          },
        },
      },
    });

    const totalInvited = referrals.length;
    const qualifiedFriends = referrals.filter((r) => r.status === 'QUALIFIED').length;
    const pendingFriends = referrals.filter((r) => r.status === 'PENDING_QUALIFICATION').length;

    let earnedBonusCredits = 0;
    let earnedRoyaltyCredits = 0;

    for (const r of referrals) {
      for (const e of r.earnings) {
        if (e.earningType === 'ACTIVATION_BONUS') {
          earnedBonusCredits += e.amountCredits;
        } else if (e.earningType === 'TASK_ROYALTY') {
          earnedRoyaltyCredits += e.amountCredits;
        }
      }
    }

    // Проверяем, забирал ли сам пользователь Welcome-бонус
    const selfReferral = await db.dePinReferral.findUnique({
      where: { refereeTelegramId: rawTgId },
      select: { welcomeBonusGranted: true },
    });

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'SMMplansapport_bot';

    return {
      success: true,
      stats: {
        referralCode: `ref_${rawTgId}`,
        shareUrl: `https://t.me/${botUsername}/tap?startapp=ref_${rawTgId}`,
        totalInvited,
        qualifiedFriends,
        pendingFriends,
        earnedBonusCredits,
        earnedRoyaltyCredits,
        welcomeBonusClaimed: !!selfReferral?.welcomeBonusGranted,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_GET_REFERRAL_STATS',
    };
  }
}

// ── 4. Proof-of-Activity Gate (Гейт проверки активности друга) ────────────────

/**
 * Проверяет выполнение условий активности приглашенным другом:
 * Минимум 20 тапов или 1 выполненное задание.
 * При первом выполнении условий атомарно начисляет +100 PTS пригласителю.
 */
export async function evaluateProofOfActivityGate(
  prismaClient: DbClient,
  refereeNodeId: string,
  addedTaps: number = 0,
  addedTasks: number = 0
): Promise<boolean> {
  try {
    const referral = await prismaClient.dePinReferral.findUnique({
      where: { refereeNodeId },
    });

    if (!referral || referral.status !== 'PENDING_QUALIFICATION') {
      return false; // Уже квалифицирован, заблокирован или не имеет реферера
    }

    const updatedTaps = referral.tapsRecorded + addedTaps;
    const updatedTasks = referral.tasksCompleted + addedTasks;
    const isQualified = updatedTaps >= 20 || updatedTasks >= 1;

    if (isQualified) {
      // 1. Атомарно переводим статус в QUALIFIED
      await prismaClient.dePinReferral.update({
        where: { id: referral.id },
        data: {
          status: 'QUALIFIED',
          tapsRecorded: updatedTaps,
          tasksCompleted: updatedTasks,
          activationBonusGranted: true,
          qualifiedAt: new Date(),
        },
      });

      // 2. Начисляем +100 PTS рефереру
      await prismaClient.dePinNode.upsert({
        where: { id: referral.referrerNodeId },
        create: {
          id: referral.referrerNodeId,
          creditsBalance: 100,
        },
        update: {
          creditsBalance: { increment: 100 },
          lastActiveAt: new Date(),
        },
      });

      // 3. Записываем проводку начисления активационного бонуса
      await prismaClient.dePinReferralEarning.create({
        data: {
          referralId: referral.id,
          earningType: 'ACTIVATION_BONUS',
          amountCredits: 100,
        },
      });

      return true;
    }

    // Если порог еще не достигнут — обновляем счетчики тапов/задач
    await prismaClient.dePinReferral.update({
      where: { id: referral.id },
      data: {
        tapsRecorded: updatedTaps,
        tasksCompleted: updatedTasks,
      },
    });

    return false;
  } catch {
    return false;
  }
}

// ── 5. Начисление 10% роялти за выполнение задания ───────────────────────────

/**
 * Начисляет 10% роялти рефереру от очков, заработанных другом на задании
 */
export async function awardReferralRoyalty(
  prismaClient: DbClient,
  refereeNodeId: string,
  sourceTaskId: string,
  taskCreditsAwarded: number
): Promise<number> {
  try {
    if (taskCreditsAwarded <= 0) return 0;

    const referral = await prismaClient.dePinReferral.findUnique({
      where: { refereeNodeId },
    });

    if (!referral || referral.status !== 'QUALIFIED') {
      return 0; // Начисляется только если друг уже квалифицирован
    }

    const royaltyAmount = Math.max(1, Math.floor(taskCreditsAwarded * 0.10));

    // Начисляем рефереру через upsert (исключает сбой Record to update not found)
    await prismaClient.dePinNode.upsert({
      where: { id: referral.referrerNodeId },
      create: {
        id: referral.referrerNodeId,
        creditsBalance: royaltyAmount,
        lastActiveAt: new Date(),
      },
      update: {
        creditsBalance: { increment: royaltyAmount },
        lastActiveAt: new Date(),
      },
    });

    // Фиксируем в журнале начислений
    await prismaClient.dePinReferralEarning.create({
      data: {
        referralId: referral.id,
        earningType: 'TASK_ROYALTY',
        amountCredits: royaltyAmount,
        sourceTaskId,
      },
    });

    return royaltyAmount;
  } catch {
    return 0;
  }
}
