/**
 * DePIN Task Dispatcher — Persistent Edition
 *
 * [BUG-3 FIX] Migrated from in-memory Maps to PostgreSQL + Redis:
 *   - DePinNode credits/stats → PostgreSQL (survives restarts, works in serverless)
 *   - activeTasks              → Redis (TTL 60s, atomic across multiple instances)
 *   - DePinTarget commercial   → PostgreSQL (admin-managed)
 *
 * Architecture:
 *   acquireTasks()  → SELECT incomplete DePinTargets + SETEX in Redis per task
 *   reportTask()    → DEL Redis key + UPDATE DePinNode credits + UPDATE DePinTarget.completedViews
 *   claimCredits()  → UPDATE DePinNode creditsBalance with CHECK (>= 0)
 *   getNodeCredits() → SELECT from DePinNode
 */
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export type DePinTaskType = 'VIEW_POST' | 'REACT_POST' | 'FOLLOW_CHANNEL' | 'UNFOLLOW_CHANNEL' | 'STREAM_PING';

export interface DePinTaskItem {
  taskId: string;
  type: DePinTaskType;
  targetUrl: string;
  channel: string;
  postId?: number;
  creditsReward: number;
  expiresAt: number;
}

/** Кредитные награды по типу задания (чем выше риск — тем выше награда) */
const TASK_REWARDS: Record<DePinTaskType, number> = {
  VIEW_POST:        5,   // 👁  ~0% риска для аккаунта
  REACT_POST:       8,   // 👍  ~1% риска для аккаунта
  FOLLOW_CHANNEL:   50,  // 👥  ~5% риска, только opt-in
  UNFOLLOW_CHANNEL: 5,   // ↩️  вспомогательное
  STREAM_PING:      2,
};

const TASK_TTL_SECONDS = 60;
const DEMO_CHANNELS = [
  { channel: 'telegram', postId: 100 },
  { channel: 'durov', postId: 300 },
] as const;

// Redis key helpers
const taskKey = (taskId: string) => `depin:task:${taskId}`;
const nodeAssignedKey = (nodeId: string, targetId: string) =>
  `depin:assigned:${nodeId}:${targetId}`;

export class DePinTaskDispatcher {
  private static instance: DePinTaskDispatcher | null = null;

  public static getInstance(): DePinTaskDispatcher {
    if (!DePinTaskDispatcher.instance) {
      DePinTaskDispatcher.instance = new DePinTaskDispatcher();
    }
    return DePinTaskDispatcher.instance;
  }

  /** For test isolation only */
  public static resetInstance(): void {
    DePinTaskDispatcher.instance = null;
  }

  // ─── Upsert node (кэш: lastActiveAt) ──────────────────────────────────────
  private async touchNode(nodeId: string): Promise<void> {
    await db.dePinNode.upsert({
      where: { id: nodeId },
      create: { id: nodeId },
      update: { lastActiveAt: new Date() },
    });
  }

  /**
   * Добавляет или увеличивает коммерческую цель.
   * Вызывается из Admin Panel при создании заказа на просмотры.
   */
  public async addTarget(channel: string, postId: number, targetViews: number): Promise<void> {
    const cleanChannel = channel.replace(/^https?:\/\/t\.me\//, '').replace(/^@/, '').trim();
    await db.dePinTarget.upsert({
      where: { channel_postId: { channel: cleanChannel, postId } },
      create: { channel: cleanChannel, postId, targetViews },
      update: { targetViews: { increment: targetViews } },
    });
  }

  /**
   * Выдаёт пачку микро-заданий для узла.
   * Антидублирование: Redis SETNX ключ depin:assigned:{nodeId}:{targetId} с TTL 24h.
   */
  public async acquireTasks(nodeId: string, limit = 3): Promise<DePinTaskItem[]> {
    await this.touchNode(nodeId);

    // Читаем предпочтения ноды из PostgreSQL
    const node = await db.dePinNode.findUnique({
      where: { id: nodeId },
      select: { acceptsViewTasks: true, acceptsReactTasks: true, acceptsFollowTasks: true },
    });

    const acceptedTypes: DePinTaskType[] = [];
    if (node?.acceptsViewTasks !== false)  acceptedTypes.push('VIEW_POST');
    if (node?.acceptsReactTasks !== false) acceptedTypes.push('REACT_POST');
    if (node?.acceptsFollowTasks === true) acceptedTypes.push('FOLLOW_CHANNEL');

    // Ищем незавершённые коммерческие цели из PostgreSQL (только принятые типы)
    const targets = await db.dePinTarget.findMany({
      where: {
        completedViews: { lt: db.dePinTarget.fields.targetViews },
        status: { in: ['QUEUED', 'ASSIGNED'] },
        type: { in: acceptedTypes.length > 0 ? acceptedTypes : ['VIEW_POST'] },
      },
      orderBy: { createdAt: 'asc' },
      take: limit * 3,
    });

    const now = Date.now();
    const tasks: DePinTaskItem[] = [];

    for (const target of targets) {
      if (tasks.length >= limit) break;

      const assignedRedisKey = nodeAssignedKey(nodeId, target.id);
      const alreadyAssigned = await redis.exists(assignedRedisKey);
      if (alreadyAssigned) continue;

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expiresAt = now + TASK_TTL_SECONDS * 1000;
      const taskType = (target.type as DePinTaskType) ?? 'VIEW_POST';

      await redis.setex(
        taskKey(taskId),
        TASK_TTL_SECONDS,
        JSON.stringify({ targetId: target.id, nodeId, targetKey: `${target.channel}:${target.postId}`, type: taskType })
      );
      await redis.setex(assignedRedisKey, 86_400, '1');

      tasks.push({
        taskId,
        type: taskType,
        targetUrl: `https://t.me/s/${target.channel}/${target.postId}`,
        channel: target.channel,
        postId: target.postId,
        creditsReward: TASK_REWARDS[taskType] ?? 5,
        expiresAt,
      });
    }

    // Fallback демо-задачи (только VIEW — нулевой риск)
    if (tasks.length === 0 && node?.acceptsViewTasks !== false) {
      for (const demo of DEMO_CHANNELS) {
        if (tasks.length >= limit) break;
        const taskId = `task_demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        tasks.push({
          taskId,
          type: 'VIEW_POST',
          targetUrl: `https://t.me/s/${demo.channel}/${demo.postId}`,
          channel: demo.channel,
          postId: demo.postId,
          creditsReward: TASK_REWARDS.VIEW_POST,
          expiresAt: now + TASK_TTL_SECONDS * 1000,
        });
      }
    }

    return tasks;
  }


  /**
   * Принимает отчёт и начисляет OmniCredits.
   * Атомарно: DEL Redis task key + UPDATE PostgreSQL node credits.
   */
  public async reportTask(report: {
    nodeId: string;
    taskId: string;
    target: string;
    success: boolean;
    durationMs?: number;
  }): Promise<{ success: boolean; creditsAwarded: number; totalNodeCredits: number; error?: string }> {
    await this.touchNode(report.nodeId);

    if (!report.success) {
      return { success: false, creditsAwarded: 0, totalNodeCredits: await this.getNodeCredits(report.nodeId), error: 'TASK_EXECUTION_FAILED' };
    }

    const isDemoTask = report.taskId.startsWith('task_demo_');
    let reward = isDemoTask ? 5 : 10;

    if (!isDemoTask) {
      // Читаем метаданные задачи из Redis
      const taskData = await redis.get(taskKey(report.taskId));
      if (!taskData) {
        // Задача истекла (TTL 60s) или не существует
        return { success: false, creditsAwarded: 0, totalNodeCredits: await this.getNodeCredits(report.nodeId), error: 'TASK_EXPIRED_OR_NOT_FOUND' };
      }

      const parsed = JSON.parse(taskData) as { targetId: string; nodeId: string };
      if (parsed.nodeId !== report.nodeId) {
        return { success: false, creditsAwarded: 0, totalNodeCredits: await this.getNodeCredits(report.nodeId), error: 'NODE_MISMATCH' };
      }

      // Удаляем активную задачу из Redis
      await redis.del(taskKey(report.taskId));

      // Инкрементируем completedViews в PostgreSQL
      await db.dePinTarget.updateMany({
        where: { id: parsed.targetId },
        data: { completedViews: { increment: 1 }, updatedAt: new Date() },
      });
    }

    // Начисляем кредиты и обновляем статистику узла в PostgreSQL
    const updatedNode = await db.dePinNode.update({
      where: { id: report.nodeId },
      data: {
        creditsBalance: { increment: reward },
        totalCompletedTasks: { increment: 1 },
        lastActiveAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      creditsAwarded: reward,
      totalNodeCredits: updatedNode.creditsBalance,
    };
  }

  /**
   * Возвращает текущий баланс кредитов узла из PostgreSQL.
   */
  public async getNodeCredits(nodeId: string): Promise<number> {
    const node = await db.dePinNode.findUnique({ where: { id: nodeId }, select: { creditsBalance: true } });
    return node?.creditsBalance ?? 0;
  }

  /**
   * Списывает кредиты при выводе на основной баланс.
   * Использует CHECK constraint в PostgreSQL как последний барьер против отрицательного баланса.
   */
  public async claimCredits(
    nodeId: string,
    amount: number
  ): Promise<{ success: boolean; claimedCredits: number; remainingCredits: number; error?: string }> {
    try {
      const node = await db.dePinNode.findUnique({ where: { id: nodeId } });
      if (!node || node.creditsBalance < amount) {
        return {
          success: false,
          claimedCredits: 0,
          remainingCredits: node?.creditsBalance ?? 0,
          error: 'INSUFFICIENT_CREDITS',
        };
      }

      const updated = await db.dePinNode.update({
        where: { id: nodeId },
        data: {
          creditsBalance: { decrement: amount },
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        claimedCredits: amount,
        remainingCredits: updated.creditsBalance,
      };
    } catch (err: unknown) {
      // CHECK constraint violated (creditsBalance < 0) — race condition защита
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, claimedCredits: 0, remainingCredits: 0, error: `DB_CONSTRAINT: ${msg}` };
    }
  }

  /**
   * Сводная статистика сети DePIN.
   */
  public async getNetworkStats(): Promise<{
    activeNodesCount: number;
    totalCompletedTasks: number;
    activeTargetsCount: number;
  }> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [activeNodes, totalTasks, activeTargets] = await Promise.all([
      db.dePinNode.count({ where: { lastActiveAt: { gte: fiveMinutesAgo } } }),
      db.dePinNode.aggregate({ _sum: { totalCompletedTasks: true } }),
      db.dePinTarget.count({ where: { completedViews: { lt: db.dePinTarget.fields.targetViews } } }),
    ]);

    return {
      activeNodesCount: activeNodes,
      totalCompletedTasks: totalTasks._sum.totalCompletedTasks ?? 0,
      activeTargetsCount: activeTargets,
    };
  }
}
