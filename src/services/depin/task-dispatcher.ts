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

export type DePinTaskType =
  | 'VIEW_POST'
  | 'REACT_POST'
  | 'FOLLOW_CHANNEL'
  | 'UNFOLLOW_CHANNEL'
  | 'STREAM_PING'
  | 'MULTI_POST'
  | 'SMART_COMMENT';

export interface DePinTaskItem {
  taskId: string;
  targetId?: string;
  type: DePinTaskType | string;
  targetUrl: string;
  postUrl: string;
  postUrls?: string[];
  channel: string;
  postId?: number;
  postIds?: number[];
  creditsReward: number;
  expiresAt: number;
  reactionEmoji?: string;
  isSquadTarget?: boolean;
}

/** Кредитные награды по типу задания (чем выше риск/трудоемкость — тем выше награда) */
const TASK_REWARDS: Record<DePinTaskType, number> = {
  VIEW_POST:        5,   // 👁  ~0% риска для аккаунта
  REACT_POST:       8,   // 👍  ~1% риска для аккаунта
  MULTI_POST:       15,  // 📚  ~0% риска, пакетный просмотр 3 постов (+15 PTS)
  SMART_COMMENT:    35,  // 💬  ~2% риска, осмысленный ИИ-комментарий (+35 PTS)
  FOLLOW_CHANNEL:   50,  // 👥  ~5% риска, только opt-in
  UNFOLLOW_CHANNEL: 5,   // ↩️  вспомогательное
  STREAM_PING:      2,
};

const TASK_TTL_SECONDS = 300; // 5 минут (комфортно для перехода в Telegram и возврата)
const DEMO_CHANNELS = [
  { channel: 'testnews69', postId: 4, type: 'VIEW_POST', creditsReward: 10 },
  { channel: 'testnews69', postId: 6, type: 'MULTI_POST', creditsReward: 15 },
  { channel: 'smmMarket69', postId: 32, type: 'SMART_COMMENT', creditsReward: 35 },
  { channel: 'testnews69', postId: 2, type: 'REACT_POST:🔥', creditsReward: 10, reactionEmoji: '🔥' },
  { channel: 'smmMarket69', postId: 30, type: 'VIEW_POST', creditsReward: 10 },
  { channel: 'testnews69', postId: 8, type: 'MULTI_POST', creditsReward: 15 },
  { channel: 'smmMarket69', postId: 34, type: 'SMART_COMMENT', creditsReward: 35 },
  { channel: 'testnews69', postId: 10, type: 'REACT_POST:👍', creditsReward: 10, reactionEmoji: '👍' },
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
      create: { channel: cleanChannel, postId, targetViews, status: 'QUEUED' },
      update: { targetViews: { increment: targetViews }, status: 'QUEUED' },
    });
  }

  /**
   * Обеспечивает наличие базовых коммерческих целей сообщества в DePinTarget
   * (каналы из требований пользователя: testnews69/4, testnews69/2, smmMarket69/30)
   */
  public async ensureDefaultTargets(): Promise<void> {
    try {
      const activeCount = await db.dePinTarget.count({
        where: { status: { in: ['QUEUED', 'ASSIGNED'] } },
      });
      if (activeCount === 0) {
        await db.dePinTarget.upsert({
          where: { channel_postId: { channel: 'testnews69', postId: 4 } },
          create: { channel: 'testnews69', postId: 4, type: 'VIEW_POST', targetViews: 100, completedViews: 0, status: 'QUEUED' },
          update: { status: 'QUEUED' },
        });
        await db.dePinTarget.upsert({
          where: { channel_postId: { channel: 'testnews69', postId: 2 } },
          create: { channel: 'testnews69', postId: 2, type: 'REACT_POST:🔥', targetViews: 100, completedViews: 0, status: 'QUEUED' },
          update: { status: 'QUEUED' },
        });
        await db.dePinTarget.upsert({
          where: { channel_postId: { channel: 'smmMarket69', postId: 30 } },
          create: { channel: 'smmMarket69', postId: 30, type: 'VIEW_POST', targetViews: 100, completedViews: 0, status: 'QUEUED' },
          update: { status: 'QUEUED' },
        });
        await db.dePinTarget.upsert({
          where: { channel_postId: { channel: 'testnews69', postId: 6 } },
          create: { channel: 'testnews69', postId: 6, type: 'MULTI_POST', targetViews: 100, completedViews: 0, status: 'QUEUED' },
          update: { status: 'QUEUED' },
        });
        await db.dePinTarget.upsert({
          where: { channel_postId: { channel: 'smmMarket69', postId: 32 } },
          create: { channel: 'smmMarket69', postId: 32, type: 'SMART_COMMENT', targetViews: 100, completedViews: 0, status: 'QUEUED' },
          update: { status: 'QUEUED' },
        });
      }
    } catch {
      // non-blocking
    }
  }

  /**
   * Выдаёт пачку микро-заданий для узла.
   * Антидублирование: проверяет ключ depin:assigned:{nodeId}:{targetId},
   * который устанавливается только ПОСЛЕ успешного выполнения задания в reportTask.
   */
  public async acquireTasks(
    nodeId: string,
    limit = 3,
    includeDemoFallback = true,
    priorityTargetId?: string
  ): Promise<DePinTaskItem[]> {
    await this.touchNode(nodeId);

    // Читаем предпочтения ноды из PostgreSQL
    const node = await db.dePinNode.findUnique({
      where: { id: nodeId },
      select: { acceptsViewTasks: true, acceptsReactTasks: true, acceptsFollowTasks: true },
    });

    const acceptedTypes: DePinTaskType[] = [];
    if (node?.acceptsViewTasks !== false) {
      acceptedTypes.push('VIEW_POST');
      acceptedTypes.push('MULTI_POST');
    }
    if (node?.acceptsReactTasks !== false) {
      acceptedTypes.push('REACT_POST');
      acceptedTypes.push('SMART_COMMENT');
    }
    if (node?.acceptsFollowTasks === true) {
      acceptedTypes.push('FOLLOW_CHANNEL');
    }

    // Формируем условия по типам для поддержки REACT_POST и конкретных эмодзи REACT_POST:🔥, MULTI_POST, SMART_COMMENT
    const typeConditions: Array<{ type: string } | { type: { startsWith: string } }> = [];
    if (node?.acceptsViewTasks !== false) {
      typeConditions.push({ type: 'VIEW_POST' });
      typeConditions.push({ type: 'MULTI_POST' });
    }
    if (node?.acceptsReactTasks !== false) {
      typeConditions.push({ type: 'REACT_POST' });
      typeConditions.push({ type: { startsWith: 'REACT_POST' } });
      typeConditions.push({ type: 'SMART_COMMENT' });
    }
    if (node?.acceptsFollowTasks === true) {
      typeConditions.push({ type: 'FOLLOW_CHANNEL' });
    }

    // Ищем незавершённые коммерческие цели из PostgreSQL (только принятые типы)
    let targets = await db.dePinTarget.findMany({
      where: {
        status: { in: ['QUEUED', 'ASSIGNED'] },
        ...(typeConditions.length > 0 ? { OR: typeConditions } : { type: { in: acceptedTypes.length > 0 ? acceptedTypes : ['VIEW_POST'] } }),
      },
      orderBy: { createdAt: 'asc' },
      take: limit * 3,
    });

    // Фильтруем те, у кого счетчик еще не заполнен
    targets = targets.filter((t) => t.completedViews < t.targetViews);

    // Если в очереди нет активных задач, пробуем наполнить базовыми целями сообщества
    if (targets.length === 0) {
      await this.ensureDefaultTargets();
      targets = await db.dePinTarget.findMany({
        where: {
          status: { in: ['QUEUED', 'ASSIGNED'] },
          ...(typeConditions.length > 0 ? { OR: typeConditions } : { type: { in: acceptedTypes.length > 0 ? acceptedTypes : ['VIEW_POST'] } }),
        },
        orderBy: { createdAt: 'asc' },
        take: limit * 3,
      });
      targets = targets.filter((t) => t.completedViews < t.targetViews);
    }

    // Если передан приоритетный targetId (например, squad-задание от друга), поднимаем его на самый верх
    if (priorityTargetId) {
      const idx = targets.findIndex((t) => t.id === priorityTargetId);
      if (idx > 0) {
        const [priorityItem] = targets.splice(idx, 1);
        targets.unshift(priorityItem);
      } else if (idx === -1) {
        try {
          const priorityTarget = await db.dePinTarget.findUnique({
            where: { id: priorityTargetId },
          });
          if (
            priorityTarget &&
            priorityTarget.status !== 'COMPLETED' &&
            priorityTarget.status !== 'CANCELLED' &&
            priorityTarget.completedViews < priorityTarget.targetViews
          ) {
            targets.unshift(priorityTarget);
          }
        } catch {
          // non-blocking
        }
      }
    }

    const now = Date.now();
    const tasks: DePinTaskItem[] = [];

    for (const target of targets) {
      if (tasks.length >= limit) break;

      // 1. Не назначаем задание автору (своему же узлу), если target.nodeId задан или совпадает с telegramId
      const isOwner = Boolean(
        (target.nodeId && (
          target.nodeId === nodeId ||
          target.nodeId === `tg_${nodeId}` ||
          nodeId === `tg_${target.nodeId}` ||
          target.nodeId.replace(/^tg_/, '') === nodeId.replace(/^tg_/, '')
        )) ||
        (target.orderId && (
          target.orderId.includes(`:${nodeId}:`) ||
          target.orderId.includes(`:${nodeId.replace(/^tg_/, '')}:`)
        ))
      );
      if (isOwner) continue;

      // 2. Проверяем список исключенных каналов пользователя
      try {
        if (typeof redis.sismember === 'function') {
          const isOwnChannel = await redis.sismember(`depin:node:${nodeId}:owned_channels`, target.channel.toLowerCase());
          if (isOwnChannel) continue;
        }
      } catch {
        // non-blocking
      }

      // 3. Проверяем исключения (уже назначено / выполнено / пропущено)
      const assignedRedisKey = nodeAssignedKey(nodeId, target.id);
      const alreadyAssigned = await redis.exists(assignedRedisKey);
      if (alreadyAssigned) continue;

      const compKey = `${target.channel}:${target.postId}`;
      const alreadyAssignedComp = await redis.exists(nodeAssignedKey(nodeId, compKey));
      if (alreadyAssignedComp) continue;

      try {
        if (typeof redis.sismember === 'function') {
          const isSkipped = await redis.sismember(`depin:node:${nodeId}:skipped_targets`, target.id);
          if (isSkipped) continue;

          const isCompleted = await redis.sismember(`depin:node:${nodeId}:completed_targets`, target.id);
          if (isCompleted) continue;

          const isCompSkipped = await redis.sismember(`depin:node:${nodeId}:skipped_targets`, compKey);
          if (isCompSkipped) continue;

          const isCompCompleted = await redis.sismember(`depin:node:${nodeId}:completed_targets`, compKey);
          if (isCompCompleted) continue;
        }
      } catch {
        // non-blocking
      }

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expiresAt = now + TASK_TTL_SECONDS * 1000;
      const rawType = target.type ?? 'VIEW_POST';

      let reactionEmoji: string | undefined;
      let baseTaskType: DePinTaskType = 'VIEW_POST';
      let postIds: number[] | undefined;
      let postUrls: string[] | undefined;

      if (rawType.startsWith('REACT_POST')) {
        baseTaskType = 'REACT_POST';
        if (rawType.includes(':')) {
          reactionEmoji = rawType.split(':')[1];
        }
      } else if (rawType === 'FOLLOW_CHANNEL') {
        baseTaskType = 'FOLLOW_CHANNEL';
      } else if (rawType === 'MULTI_POST') {
        baseTaskType = 'MULTI_POST';
        const mainPostId = target.postId || 1;
        let p1: number, p2: number, p3: number;
        if (mainPostId >= 3) {
          p1 = mainPostId - 2;
          p2 = mainPostId - 1;
          p3 = mainPostId;
        } else {
          p1 = 1;
          p2 = 2;
          p3 = 3;
        }
        postIds = [p1, p2, p3];
        postUrls = postIds.map((p) => `https://t.me/${target.channel}/${p}`);
      } else if (rawType === 'SMART_COMMENT') {
        baseTaskType = 'SMART_COMMENT';
      }

      await redis.setex(
        taskKey(taskId),
        TASK_TTL_SECONDS,
        JSON.stringify({ targetId: target.id, nodeId, targetKey: `${target.channel}:${target.postId}`, channel: target.channel, postId: target.postId, type: rawType })
      );

      tasks.push({
        taskId,
        targetId: target.id,
        type: rawType,
        targetUrl: `https://t.me/s/${target.channel}/${target.postId || 1}`,
        postUrl: target.postId && target.postId > 0
          ? `https://t.me/${target.channel}/${target.postId}`
          : `https://t.me/${target.channel}`,
        postUrls,
        channel: target.channel,
        postId: target.postId,
        postIds,
        creditsReward: TASK_REWARDS[baseTaskType] ?? 5,
        expiresAt,
        reactionEmoji,
        isSquadTarget: priorityTargetId === target.id,
      });
    }

    // Fallback демо-задачи (если включен fallback)
    if (tasks.length === 0 && includeDemoFallback && node?.acceptsViewTasks !== false) {
      for (const demo of DEMO_CHANNELS) {
        if (tasks.length >= limit) break;
        const rawDemoType = demo.type;
        const demoTargetKey = `demo:${demo.channel}:${demo.postId || 1}:${rawDemoType}`;
        const demoCompKey = `${demo.channel}:${demo.postId || 1}`;

        // Проверяем исключения для демо-задач
        try {
          if (typeof redis.sismember === 'function') {
            const isOwnChannel = await redis.sismember(`depin:node:${nodeId}:owned_channels`, demo.channel.toLowerCase());
            if (isOwnChannel) continue;
            const isSkipped = await redis.sismember(`depin:node:${nodeId}:skipped_targets`, demoTargetKey);
            if (isSkipped) continue;
            const isCompSkipped = await redis.sismember(`depin:node:${nodeId}:skipped_targets`, demoCompKey);
            if (isCompSkipped) continue;
            const isCompleted = await redis.sismember(`depin:node:${nodeId}:completed_targets`, demoTargetKey);
            if (isCompleted) continue;
            const isCompCompleted = await redis.sismember(`depin:node:${nodeId}:completed_targets`, demoCompKey);
            if (isCompCompleted) continue;
          }
        } catch {
          // non-blocking
        }

        const alreadyAssigned = await redis.exists(nodeAssignedKey(nodeId, demoTargetKey));
        if (alreadyAssigned) continue;
        const alreadyAssignedComp = await redis.exists(nodeAssignedKey(nodeId, demoCompKey));
        if (alreadyAssignedComp) continue;

        const isMulti = rawDemoType === 'MULTI_POST';
        const isComment = rawDemoType === 'SMART_COMMENT';
        const taskIdPrefix = isMulti ? 'task_demo_multi_' : isComment ? 'task_demo_comment_' : 'task_demo_';
        const taskId = `${taskIdPrefix}${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        let postIds: number[] | undefined;
        let postUrls: string[] | undefined;
        if (isMulti) {
          const mainPostId = demo.postId || 1;
          let p1: number, p2: number, p3: number;
          if (mainPostId >= 3) {
            p1 = mainPostId - 2;
            p2 = mainPostId - 1;
            p3 = mainPostId;
          } else {
            p1 = 1;
            p2 = 2;
            p3 = 3;
          }
          postIds = [p1, p2, p3];
          postUrls = postIds.map((p) => `https://t.me/${demo.channel}/${p}`);
        }

        const baseReward = rawDemoType === 'VIEW_POST'
          ? TASK_REWARDS.VIEW_POST
          : (demo as { creditsReward?: number }).creditsReward ?? TASK_REWARDS[rawDemoType as DePinTaskType] ?? 5;

        await redis.setex(
          taskKey(taskId),
          TASK_TTL_SECONDS,
          JSON.stringify({
            targetId: demoTargetKey,
            nodeId,
            targetKey: `${demo.channel}:${demo.postId}`,
            channel: demo.channel,
            postId: demo.postId,
            type: rawDemoType,
            isDemo: true,
          })
        );

        tasks.push({
          taskId,
          targetId: demoTargetKey,
          type: rawDemoType,
          targetUrl: `https://t.me/s/${demo.channel}/${demo.postId}`,
          postUrl: `https://t.me/${demo.channel}/${demo.postId}`,
          postUrls,
          channel: demo.channel,
          postId: demo.postId,
          postIds,
          creditsReward: baseReward,
          expiresAt: now + TASK_TTL_SECONDS * 1000,
          reactionEmoji: (demo as { reactionEmoji?: string }).reactionEmoji,
        });
      }
    }

    return tasks;
  }

  /**
   * Принимает отчёт и начисляет OmniCredits.
   * Атомарно: DEL Redis task key + UPSERT PostgreSQL node credits.
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
    let reward = 10;
    const EXPIRE_30_DAYS = 2_592_000;

    if (isDemoTask) {
      if (report.taskId.includes('_multi_')) {
        reward = 15;
      } else if (report.taskId.includes('_comment_')) {
        reward = 35;
      } else {
        reward = 5;
      }

      // Фиксируем выполнение демо-задачи в Redis (защита от повторного выполнения узлом на 30 дней)
      const taskData = await redis.get(taskKey(report.taskId));
      if (taskData) {
        try {
          const parsed = JSON.parse(taskData) as { targetId?: string; targetKey?: string };
          if (parsed.targetId) {
            await redis.setex(nodeAssignedKey(report.nodeId, parsed.targetId), EXPIRE_30_DAYS, 'completed');
            if (typeof redis.sadd === 'function') {
              await redis.sadd(`depin:node:${report.nodeId}:completed_targets`, parsed.targetId);
              if (parsed.targetKey) {
                await redis.sadd(`depin:node:${report.nodeId}:completed_targets`, parsed.targetKey);
              }
              await redis.expire(`depin:node:${report.nodeId}:completed_targets`, EXPIRE_30_DAYS);
            }
          }
        } catch {
          // non-blocking
        }
        await redis.del(taskKey(report.taskId));
      } else if (report.target) {
        await redis.setex(nodeAssignedKey(report.nodeId, `demo:${report.target}`), EXPIRE_30_DAYS, 'completed');
      }
    } else {
      // Читаем метаданные задачи из Redis
      const taskData = await redis.get(taskKey(report.taskId));
      if (!taskData) {
        // Задача истекла (TTL) или не существует
        return { success: false, creditsAwarded: 0, totalNodeCredits: await this.getNodeCredits(report.nodeId), error: 'TASK_EXPIRED_OR_NOT_FOUND' };
      }

      const parsed = JSON.parse(taskData) as { targetId: string; nodeId: string; type?: string; targetKey?: string };
      if (parsed.nodeId !== report.nodeId) {
        return { success: false, creditsAwarded: 0, totalNodeCredits: await this.getNodeCredits(report.nodeId), error: 'NODE_MISMATCH' };
      }

      const rawType = parsed.type || 'VIEW_POST';
      if (rawType === 'MULTI_POST') {
        reward = 15;
      } else if (rawType === 'SMART_COMMENT') {
        reward = 35;
      } else if (rawType === 'FOLLOW_CHANNEL') {
        reward = 50;
      } else {
        reward = 10;
      }

      // Удаляем активную задачу из Redis
      await redis.del(taskKey(report.taskId));

      // Фиксируем выполнение в Redis (защита от повторного выполнения узлом на 30 дней)
      await redis.setex(nodeAssignedKey(report.nodeId, parsed.targetId), EXPIRE_30_DAYS, 'completed');
      if (parsed.targetKey) {
        await redis.setex(nodeAssignedKey(report.nodeId, parsed.targetKey), EXPIRE_30_DAYS, 'completed');
      }
      try {
        if (typeof redis.sadd === 'function') {
          await redis.sadd(`depin:node:${report.nodeId}:completed_targets`, parsed.targetId);
          if (parsed.targetKey) {
            await redis.sadd(`depin:node:${report.nodeId}:completed_targets`, parsed.targetKey);
          }
          await redis.expire(`depin:node:${report.nodeId}:completed_targets`, EXPIRE_30_DAYS);
        }
      } catch {
        // non-blocking
      }

      // Инкрементируем completedViews в PostgreSQL и переводим в COMPLETED при достижении цели
      const target = await db.dePinTarget.findUnique({
        where: { id: parsed.targetId },
        select: { completedViews: true, targetViews: true, status: true },
      });
      if (target) {
        const nextCompleted = target.completedViews + 1;
        const isCompleted = nextCompleted >= target.targetViews;
        await db.dePinTarget.update({
          where: { id: parsed.targetId },
          data: {
            completedViews: { increment: 1 },
            status: isCompleted ? 'COMPLETED' : target.status,
            updatedAt: new Date(),
          },
        });
      } else {
        await db.dePinTarget.updateMany({
          where: { id: parsed.targetId },
          data: { completedViews: { increment: 1 }, updatedAt: new Date() },
        });
      }
    }

    // Начисляем кредиты и обновляем статистику узла в PostgreSQL через upsert
    // [P0 INVARIANT FIX] upsert вместо update исключает ошибку "Record to update not found"
    const updatedNode = await db.dePinNode.upsert({
      where: { id: report.nodeId },
      create: {
        id: report.nodeId,
        creditsBalance: reward,
        totalCompletedTasks: 1,
        lastActiveAt: new Date(),
      },
      update: {
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
   * Пропуск или замена задания (уже просмотрено, свой пост, истекло или пользовательский пропуск).
   * Исключает повторное появление задания у данного узла в течение 30 дней.
   */
  public async skipTask(params: {
    nodeId: string;
    taskId: string;
    targetId?: string;
    channel?: string;
    postId?: number;
    reason?: 'ALREADY_VIEWED' | 'OWN_POST' | 'EXPIRED' | 'USER_SKIP' | string;
  }): Promise<{ success: boolean; skippedTaskId: string }> {
    const { nodeId, taskId, targetId, channel, postId, reason = 'USER_SKIP' } = params;
    await this.touchNode(nodeId);

    let resolvedTargetId = targetId;
    let resolvedChannel = channel;
    let resolvedPostId = postId;

    // Пытаемся достать метаданные задачи из Redis, если они не переданы
    try {
      const taskData = await redis.get(taskKey(taskId));
      if (taskData) {
        const parsed = JSON.parse(taskData) as { targetId?: string; targetKey?: string; channel?: string; postId?: number };
        if (!resolvedTargetId && parsed.targetId) resolvedTargetId = parsed.targetId;
        if (!resolvedChannel && parsed.channel) resolvedChannel = parsed.channel;
        if (!resolvedPostId && parsed.postId) resolvedPostId = parsed.postId;
      }
    } catch {
      // non-blocking
    }

    // Удаляем активную задачу из Redis
    try {
      await redis.del(taskKey(taskId));
    } catch {
      // non-blocking
    }

    const EXPIRE_30_DAYS = 2_592_000;
    try {
      if (resolvedTargetId) {
        await redis.setex(nodeAssignedKey(nodeId, resolvedTargetId), EXPIRE_30_DAYS, 'skipped');
        if (typeof redis.sadd === 'function') {
          await redis.sadd(`depin:node:${nodeId}:skipped_targets`, resolvedTargetId);
          await redis.expire(`depin:node:${nodeId}:skipped_targets`, EXPIRE_30_DAYS);
        }
      }

      if (resolvedChannel && resolvedPostId) {
        const compKey = `${resolvedChannel}:${resolvedPostId}`;
        await redis.setex(nodeAssignedKey(nodeId, compKey), EXPIRE_30_DAYS, 'skipped');
        if (typeof redis.sadd === 'function') {
          await redis.sadd(`depin:node:${nodeId}:skipped_targets`, compKey);
          await redis.expire(`depin:node:${nodeId}:skipped_targets`, EXPIRE_30_DAYS);
        }
      }

      // Если указана причина OWN_POST — исключаем весь канал пользователя
      if (reason === 'OWN_POST' && resolvedChannel && typeof redis.sadd === 'function') {
        await redis.sadd(`depin:node:${nodeId}:owned_channels`, resolvedChannel.toLowerCase());
        await redis.expire(`depin:node:${nodeId}:owned_channels`, EXPIRE_30_DAYS);
      }
    } catch {
      // non-blocking
    }

    return {
      success: true,
      skippedTaskId: taskId,
    };
  }

  /**
   * Возвращает репутацию (Trust Score 0-100) узла из PostgreSQL.
   */
  public async getNodeTrustScore(nodeId: string): Promise<number> {
    try {
      const node = await db.dePinNode.findUnique({
        where: { id: nodeId },
        select: { reputation: true },
      });
      return node?.reputation ?? 100;
    } catch {
      return 100;
    }
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
      db.dePinTarget.count({ where: { status: { in: ['QUEUED', 'ASSIGNED'] } } }),
    ]);

    return {
      activeNodesCount: activeNodes,
      totalCompletedTasks: totalTasks._sum.totalCompletedTasks ?? 0,
      activeTargetsCount: activeTargets,
    };
  }
}
