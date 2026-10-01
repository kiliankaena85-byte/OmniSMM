'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { revalidatePath } from 'next/cache';

export interface DePinNodeAdminItem {
  id: string;
  telegramId?: string;
  linkedUserEmail?: string;
  linkedUserBalanceKopecks?: string;
  creditsBalance: number;
  rublesEquivalent: number;
  escrowCredits: number;
  totalCompletedTasks: number;
  tasksFailed: number;
  reputation: number;
  lastActiveAt: Date;
  acceptsViewTasks: boolean;
  acceptsReactTasks: boolean;
  acceptsFollowTasks: boolean;
}

export interface DePinTargetAdminItem {
  id: string;
  channel: string;
  postId: number;
  type: string;
  status: string;
  targetViews: number;
  completedViews: number;
  createdAt: Date;
}

export interface DePinAdminStats {
  totalNodes: number;
  activeNodes24h: number;
  totalCreditsIssued: number;
  totalRublesEquivalent: number;
  totalEscrowCredits: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  activeTargetsCount: number;
}

/**
 * Получить сводные метрики, список узлов DePIN и активных коммерческих заданий
 */
export async function getDePinAdminDataAction(): Promise<{
  success: boolean;
  stats?: DePinAdminStats;
  nodes?: DePinNodeAdminItem[];
  targets?: DePinTargetAdminItem[];
  error?: string;
}> {
  return requireStaffPermission('settings', 'view', async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [
        totalNodes,
        activeNodes24h,
        aggregateStats,
        activeTargetsCount,
        rawNodes,
        rawTargets,
      ] = await Promise.all([
        db.dePinNode.count(),
        db.dePinNode.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
        db.dePinNode.aggregate({
          _sum: {
            creditsBalance: true,
            escrowCredits: true,
            totalCompletedTasks: true,
            tasksFailed: true,
          },
        }),
        db.dePinTarget.count({ where: { status: { in: ['QUEUED', 'ASSIGNED'] } } }),
        db.dePinNode.findMany({
          orderBy: [{ creditsBalance: 'desc' }, { lastActiveAt: 'desc' }],
          take: 100,
        }),
        db.dePinTarget.findMany({
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

      // Резолвим привязанных Telegram пользователей
      const telegramIdsToLookup = new Set<string>();
      rawNodes.forEach((node) => {
        if (node.id.startsWith('tg_')) {
          telegramIdsToLookup.add(node.id.replace('tg_', ''));
        }
      });

      const linkedUsers = telegramIdsToLookup.size > 0
        ? await db.user.findMany({
            where: { telegramId: { in: Array.from(telegramIdsToLookup) } },
            select: { id: true, email: true, telegramId: true, balance: true },
          })
        : [];

      const userByTelegramId = new Map(linkedUsers.map((u) => [u.telegramId!, u]));

      const nodes: DePinNodeAdminItem[] = rawNodes.map((node) => {
        const tgId = node.id.startsWith('tg_') ? node.id.replace('tg_', '') : undefined;
        const linkedUser = tgId ? userByTelegramId.get(tgId) : undefined;

        return {
          id: node.id,
          telegramId: tgId,
          linkedUserEmail: linkedUser?.email,
          linkedUserBalanceKopecks: linkedUser ? linkedUser.balance.toString() : undefined,
          creditsBalance: node.creditsBalance,
          rublesEquivalent: Math.floor(node.creditsBalance / 100),
          escrowCredits: node.escrowCredits,
          totalCompletedTasks: node.totalCompletedTasks,
          tasksFailed: node.tasksFailed,
          reputation: node.reputation,
          lastActiveAt: node.lastActiveAt,
          acceptsViewTasks: node.acceptsViewTasks,
          acceptsReactTasks: node.acceptsReactTasks,
          acceptsFollowTasks: node.acceptsFollowTasks,
        };
      });

      const targets: DePinTargetAdminItem[] = rawTargets.map((t) => ({
        id: t.id,
        channel: t.channel,
        postId: t.postId,
        type: t.type,
        status: t.status,
        targetViews: t.targetViews,
        completedViews: t.completedViews,
        createdAt: t.createdAt,
      }));

      const totalCredits = aggregateStats._sum.creditsBalance ?? 0;

      const stats: DePinAdminStats = {
        totalNodes,
        activeNodes24h,
        totalCreditsIssued: totalCredits,
        totalRublesEquivalent: Math.floor(totalCredits / 100),
        totalEscrowCredits: aggregateStats._sum.escrowCredits ?? 0,
        totalTasksCompleted: aggregateStats._sum.totalCompletedTasks ?? 0,
        totalTasksFailed: aggregateStats._sum.tasksFailed ?? 0,
        activeTargetsCount,
      };

      return {
        success: true,
        stats,
        nodes,
        targets,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Ошибка загрузки DePIN аналитики: ${msg}` };
    }
  });
}

const UpdateNodeSchema = z.object({
  nodeId: z.string().min(3),
  reputation: z.number().int().min(0).max(100).optional(),
  resetFailedTasks: z.boolean().optional(),
  creditsAdjustment: z.number().int().optional(),
});

/**
 * Корректировка параметров узла (репутация, сброс штрафов)
 */
export async function updateDePinNodeAction(rawInput: unknown) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = UpdateNodeSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Некорректные параметры' };
    }

    try {
      const { nodeId, reputation, resetFailedTasks, creditsAdjustment } = parsed.data;

      const dataToUpdate: Record<string, unknown> = {};
      if (reputation !== undefined) dataToUpdate.reputation = reputation;
      if (resetFailedTasks) dataToUpdate.tasksFailed = 0;
      if (creditsAdjustment !== undefined && creditsAdjustment !== 0) {
        dataToUpdate.creditsBalance = { increment: creditsAdjustment };
      }

      const updated = await db.dePinNode.update({
        where: { id: nodeId },
        data: dataToUpdate,
      });

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'DEPIN_NODE_UPDATE',
        target: nodeId,
        targetType: 'DEPIN_NODE',
        ipAddress,
        newValue: {
          reputation: updated.reputation,
          tasksFailed: updated.tasksFailed,
          creditsBalance: updated.creditsBalance,
        },
      });

      revalidatePath('/admin/settings');
      return {
        success: true,
        message: `Узел ${nodeId} успешно обновлен`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Сбой обновления узла: ${msg}` };
    }
  });
}

const CreateTargetSchema = z.object({
  channel: z.string().min(1).transform((s) => s.replace(/^@/, '').trim()),
  postId: z.number().int().positive(),
  type: z.enum(['VIEW_POST', 'REACT_POST', 'MULTI_POST', 'SMART_COMMENT']).default('VIEW_POST'),
  targetViews: z.number().int().positive().min(5).max(100000),
});

/**
 * Создание целевого задания в очереди DePIN для распределенного просмотра/реакций
 */
export async function createDePinTargetAdminAction(rawInput: unknown) {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = CreateTargetSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Некорректные параметры задания' };
    }

    try {
      const { channel, postId, type, targetViews } = parsed.data;

      const target = await db.dePinTarget.create({
        data: {
          channel,
          postId,
          type,
          targetViews,
          status: 'QUEUED',
          tenantId: 'smmplan',
        },
      });

      const ipAddress = await getClientIp();
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'DEPIN_TARGET_CREATE',
        target: target.id,
        targetType: 'DEPIN_TARGET',
        ipAddress,
        newValue: { channel, postId, type, targetViews },
      });

      revalidatePath('/admin/settings');
      return {
        success: true,
        message: `Задание для @${channel} (#${postId}) успешно добавлено в очередь DePIN`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Сбой добавления задания: ${msg}` };
    }
  });
}
