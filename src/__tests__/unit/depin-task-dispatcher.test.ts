/**
 * DePinTaskDispatcher Tests — Persistent Edition
 *
 * [BUG-3] Dispatcher async с PostgreSQL (db) + Redis.
 * Моки декларируются через vi.hoisted() чтобы избежать TDZ-ошибки при vi.mock hoisting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock factories (должны быть выше vi.mock) ─────────────────────────
const {
  mockNodeUpsert, mockNodeFindUnique, mockNodeUpdate, mockNodeCount, mockNodeAggregate,
  mockTargetFindMany, mockTargetFindUnique, mockTargetUpdate, mockTargetUpsert, mockTargetUpdateMany, mockTargetCount,
  mockRedisExists, mockRedisSetex, mockRedisDel, mockRedisGet,
  mockRedisSismember, mockRedisSadd, mockRedisExpire,
} = vi.hoisted(() => ({
  mockNodeUpsert:      vi.fn(),
  mockNodeFindUnique:  vi.fn(),
  mockNodeUpdate:      vi.fn(),
  mockNodeCount:       vi.fn(),
  mockNodeAggregate:   vi.fn(),
  mockTargetFindMany:  vi.fn(),
  mockTargetFindUnique: vi.fn(),
  mockTargetUpdate:    vi.fn(),
  mockTargetUpsert:    vi.fn(),
  mockTargetUpdateMany: vi.fn(),
  mockTargetCount:     vi.fn(),
  mockRedisExists:     vi.fn(),
  mockRedisSetex:      vi.fn(),
  mockRedisDel:        vi.fn(),
  mockRedisGet:        vi.fn(),
  mockRedisSismember:  vi.fn(),
  mockRedisSadd:       vi.fn(),
  mockRedisExpire:     vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    dePinNode: {
      upsert:    mockNodeUpsert,
      findUnique: mockNodeFindUnique,
      update:    mockNodeUpdate,
      count:     mockNodeCount,
      aggregate: mockNodeAggregate,
      fields:    { targetViews: 'targetViews' },
    },
    dePinTarget: {
      findMany:   mockTargetFindMany,
      findUnique: mockTargetFindUnique,
      update:     mockTargetUpdate,
      upsert:     mockTargetUpsert,
      updateMany: mockTargetUpdateMany,
      count:      mockTargetCount,
      fields:     { targetViews: 'targetViews' },
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    exists:    mockRedisExists,
    setex:     mockRedisSetex,
    del:       mockRedisDel,
    get:       mockRedisGet,
    sismember: mockRedisSismember,
    sadd:      mockRedisSadd,
    expire:    mockRedisExpire,
  },
}));

import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';

// ─── Хелпер дефолтных моков ───────────────────────────────────────────────────
function setupDefaultMocks() {
  mockNodeUpsert.mockResolvedValue({ id: 'node_test', creditsBalance: 0, totalCompletedTasks: 0 });
  mockNodeFindUnique.mockResolvedValue({ id: 'node_test', creditsBalance: 0 });
  mockNodeUpdate.mockResolvedValue({ id: 'node_test', creditsBalance: 10, totalCompletedTasks: 1 });
  mockNodeCount.mockResolvedValue(1);
  mockNodeAggregate.mockResolvedValue({ _sum: { totalCompletedTasks: 1 } });
  mockTargetFindMany.mockResolvedValue([]);
  mockTargetFindUnique.mockResolvedValue(null);
  mockTargetUpdate.mockResolvedValue({});
  mockTargetUpsert.mockResolvedValue({});
  mockTargetUpdateMany.mockResolvedValue({ count: 1 });
  mockTargetCount.mockResolvedValue(2);
  mockRedisExists.mockResolvedValue(0);
  mockRedisSetex.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  mockRedisGet.mockResolvedValue(null);
  mockRedisSismember.mockResolvedValue(0);
  mockRedisSadd.mockResolvedValue(1);
  mockRedisExpire.mockResolvedValue(1);
}

describe('DePinTaskDispatcher (P2P DePIN Queue — PostgreSQL + Redis edition)', () => {
  let dispatcher: DePinTaskDispatcher;

  beforeEach(() => {
    DePinTaskDispatcher.resetInstance();
    dispatcher = DePinTaskDispatcher.getInstance();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // ── Singleton ────────────────────────────────────────────────────────────────
  it('должен возвращать singleton-экземпляр и корректно сбрасываться', () => {
    const inst1 = DePinTaskDispatcher.getInstance();
    const inst2 = DePinTaskDispatcher.getInstance();
    expect(inst1).toBe(inst2);

    DePinTaskDispatcher.resetInstance();
    const inst3 = DePinTaskDispatcher.getInstance();
    expect(inst3).not.toBe(inst1);
  });

  // ── addTarget ────────────────────────────────────────────────────────────────
  it('должен делать upsert в DePinTarget при добавлении цели', async () => {
    await dispatcher.addTarget('smmplan_official', 42, 100);
    expect(mockTargetUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channel_postId: { channel: 'smmplan_official', postId: 42 } },
        create: expect.objectContaining({ channel: 'smmplan_official', postId: 42, targetViews: 100 }),
      })
    );
  });

  // ── acquireTasks → demo fallback ─────────────────────────────────────────────
  it('должен выдавать демо-задачи если нет коммерческих целей', async () => {
    mockTargetFindMany.mockResolvedValue([]);
    const tasks = await dispatcher.acquireTasks('node_alpha_1', 2);
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].taskId).toMatch(/^task_demo_/);
    expect(tasks[0].creditsReward).toBe(5);
  });

  // ── acquireTasks → commercial ────────────────────────────────────────────────
  it('должен выдавать коммерческую задачу при наличии незавершённых целей', async () => {
    mockTargetFindMany.mockResolvedValue([
      { id: 'tgt_1', channel: 'smmplan_official', postId: 42, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0 },
    ]);
    mockRedisExists.mockResolvedValue(0);

    const tasks = await dispatcher.acquireTasks('node_alpha_1', 2);
    const task = tasks.find((t) => t.channel === 'smmplan_official' && t.postId === 42);
    expect(task).toBeDefined();
    expect(task?.creditsReward).toBe(5); // VIEW_POST reward = 5 (Sprint 3: risk-tiered rewards)
    expect(task?.targetUrl).toBe('https://t.me/s/smmplan_official/42');
  });


  // ── acquireTasks → anti-dup Redis ────────────────────────────────────────────
  it('не должен выдавать одну и ту же цель узлу дважды (Redis EXISTS)', async () => {
    mockTargetFindMany.mockResolvedValue([
      { id: 'tgt_2', channel: 'my_exclusive_channel', postId: 99, targetViews: 10, completedViews: 0 },
    ]);
    mockRedisExists.mockResolvedValue(1); // уже назначена

    const tasks = await dispatcher.acquireTasks('node_user_1', 5);
    expect(tasks.some((t) => t.channel === 'my_exclusive_channel')).toBe(false);
  });

  // ── reportTask → +10 credits ─────────────────────────────────────────────────
  it('должен засчитывать выполнение и начислять 10 OmniCredits', async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({ targetId: 'tgt_3', nodeId: 'node_worker_777', targetKey: 'chan:55' })
    );
    mockNodeUpsert.mockImplementation(async ({ where, update }: { where: { id: string }; update?: { creditsBalance?: { increment?: number } } }) => {
      if (update?.creditsBalance?.increment) {
        return { id: where.id, creditsBalance: 10, totalCompletedTasks: 1 };
      }
      return { id: where.id, creditsBalance: 0, totalCompletedTasks: 0 };
    });

    const result = await dispatcher.reportTask({
      nodeId: 'node_worker_777',
      taskId: 'task_abc123',
      target: 'https://t.me/s/chan/55',
      success: true,
    });

    expect(result.success).toBe(true);
    expect(result.creditsAwarded).toBe(10);
    expect(result.totalNodeCredits).toBe(10);
    expect(mockRedisDel).toHaveBeenCalledWith('depin:task:task_abc123');
    expect(mockTargetUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tgt_3' } })
    );
    expect(mockNodeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'node_worker_777' },
        update: expect.objectContaining({
          creditsBalance: { increment: 10 },
        }),
      })
    );
  });

  // ── reportTask → task expired ────────────────────────────────────────────────
  it('должен отклонять отчёт по истёкшей задаче (Redis TTL = null)', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockNodeFindUnique.mockResolvedValue({ creditsBalance: 0 });

    const result = await dispatcher.reportTask({
      nodeId: 'node_slow',
      taskId: 'task_expired_xyz',
      target: 'https://t.me/s/chan/1',
      success: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('TASK_EXPIRED_OR_NOT_FOUND');
    expect(mockNodeUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          creditsBalance: expect.anything(),
        }),
      })
    );
  });

  // ── reportTask → success: false ──────────────────────────────────────────────
  it('не должен начислять кредиты при success: false', async () => {
    mockNodeFindUnique.mockResolvedValue({ creditsBalance: 0 });

    const result = await dispatcher.reportTask({
      nodeId: 'node_failing',
      taskId: 'task_fail_001',
      target: 'https://t.me/s/chan/11',
      success: false,
    });

    expect(result.success).toBe(false);
    expect(result.creditsAwarded).toBe(0);
    expect(mockNodeUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          creditsBalance: expect.anything(),
        }),
      })
    );
  });

  // ── claimCredits → insufficient ──────────────────────────────────────────────
  it('должен отклонять списание при недостаточном балансе', async () => {
    mockNodeFindUnique.mockResolvedValue({ id: 'node_poor', creditsBalance: 5 });

    const result = await dispatcher.claimCredits('node_poor', 50);
    expect(result.success).toBe(false);
    expect(result.error).toBe('INSUFFICIENT_CREDITS');
    expect(mockNodeUpdate).not.toHaveBeenCalled();
  });

  // ── MULTI_POST & SMART_COMMENT ──────────────────────────────────────────────
  it('должен формировать задание MULTI_POST с 3 постами и наградой 15 PTS', async () => {
    mockTargetFindMany.mockResolvedValue([
      { id: 'tgt_multi_1', channel: 'news_channel', postId: 10, type: 'MULTI_POST', status: 'QUEUED', targetViews: 50, completedViews: 0 },
    ]);
    mockRedisExists.mockResolvedValue(0);

    const tasks = await dispatcher.acquireTasks('node_worker_multi', 1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('MULTI_POST');
    expect(tasks[0].creditsReward).toBe(15);
    expect(tasks[0].postIds).toEqual([8, 9, 10]);
    expect(tasks[0].postUrls).toEqual([
      'https://t.me/news_channel/8',
      'https://t.me/news_channel/9',
      'https://t.me/news_channel/10',
    ]);
  });

  it('должен формировать ровно 3 поста для MULTI_POST даже если postId = 1', async () => {
    mockTargetFindMany.mockResolvedValue([
      { id: 'tgt_multi_edge', channel: 'news_channel', postId: 1, type: 'MULTI_POST', status: 'QUEUED', targetViews: 50, completedViews: 0 },
    ]);
    mockRedisExists.mockResolvedValue(0);

    const tasks = await dispatcher.acquireTasks('node_worker_edge', 1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('MULTI_POST');
    expect(tasks[0].postIds).toEqual([1, 2, 3]);
    expect(tasks[0].postUrls).toEqual([
      'https://t.me/news_channel/1',
      'https://t.me/news_channel/2',
      'https://t.me/news_channel/3',
    ]);
  });

  it('должен исключать уже выполненные демо-задачи узла и ротировать контент', async () => {
    mockTargetFindMany.mockResolvedValue([]);
    mockRedisExists.mockResolvedValue(0);

    const tasks = await dispatcher.acquireTasks('node_demo_rot', 2);
    expect(tasks.length).toBeGreaterThanOrEqual(1);

    const firstTask = tasks[0];
    mockRedisGet.mockResolvedValue(
      JSON.stringify({ targetId: firstTask.targetId, nodeId: 'node_demo_rot', type: firstTask.type })
    );

    const reportRes = await dispatcher.reportTask({
      nodeId: 'node_demo_rot',
      taskId: firstTask.taskId,
      target: firstTask.targetUrl,
      success: true,
    });
    expect(reportRes.success).toBe(true);

    mockRedisExists.mockImplementation(async (key: string) => {
      return firstTask.targetId && key.includes(firstTask.targetId) ? 1 : 0;
    });

    const nextTasks = await dispatcher.acquireTasks('node_demo_rot', 2);
    expect(nextTasks.every((t) => t.targetId !== firstTask.targetId)).toBe(true);
  });

  it('должен начислять 15 кредитов за выполнение MULTI_POST', async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({ targetId: 'tgt_multi_1', nodeId: 'node_worker_multi', type: 'MULTI_POST' })
    );
    mockNodeUpsert.mockResolvedValue({ id: 'node_worker_multi', creditsBalance: 15, totalCompletedTasks: 1 });

    const result = await dispatcher.reportTask({
      nodeId: 'node_worker_multi',
      taskId: 'task_multi_123',
      target: 'https://t.me/s/news_channel/10',
      success: true,
    });

    expect(result.success).toBe(true);
    expect(result.creditsAwarded).toBe(15);
    expect(mockNodeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          creditsBalance: { increment: 15 },
        }),
      })
    );
  });

  it('должен начислять 35 кредитов за выполнение SMART_COMMENT', async () => {
    mockRedisGet.mockResolvedValue(
      JSON.stringify({ targetId: 'tgt_comment_1', nodeId: 'node_worker_comment', type: 'SMART_COMMENT' })
    );
    mockNodeUpsert.mockResolvedValue({ id: 'node_worker_comment', creditsBalance: 35, totalCompletedTasks: 1 });

    const result = await dispatcher.reportTask({
      nodeId: 'node_worker_comment',
      taskId: 'task_comment_123',
      target: 'https://t.me/s/news_channel/10',
      success: true,
    });

    expect(result.success).toBe(true);
    expect(result.creditsAwarded).toBe(35);
    expect(mockNodeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          creditsBalance: { increment: 35 },
        }),
      })
    );
  });

  it('должен возвращать Trust Score (reputation) узла', async () => {
    mockNodeFindUnique.mockResolvedValue({ id: 'node_trusted', reputation: 98 });
    const score = await dispatcher.getNodeTrustScore('node_trusted');
    expect(score).toBe(98);
  });

  // ── getNetworkStats → PostgreSQL aggregation ─────────────────────────────────
  it('должен возвращать агрегированную статистику из PostgreSQL', async () => {
    mockNodeCount.mockResolvedValue(3);
    mockNodeAggregate.mockResolvedValue({ _sum: { totalCompletedTasks: 42 } });
    mockTargetCount.mockResolvedValue(5);

    const stats = await dispatcher.getNetworkStats();
    expect(stats.activeNodesCount).toBe(3);
    expect(stats.totalCompletedTasks).toBe(42);
    expect(stats.activeTargetsCount).toBe(5);
  });

  // ── Skip Task & Multi-factor Exclusion ───────────────────────────────────────
  describe('skipTask & multi-factor exclusion', () => {
    it('должен успешно пропускать задание и сохранять исключение в Redis с 30-дневным TTL', async () => {
      mockRedisGet.mockResolvedValue(
        JSON.stringify({ targetId: 'tgt_skip_1', channel: 'skip_news', postId: 10, type: 'VIEW_POST' })
      );

      const res = await dispatcher.skipTask({
        nodeId: 'node_skip_user',
        taskId: 'task_skip_123',
        targetId: 'tgt_skip_1',
        channel: 'skip_news',
        postId: 10,
        reason: 'ALREADY_VIEWED',
      });

      expect(res.success).toBe(true);
      expect(res.skippedTaskId).toBe('task_skip_123');
      expect(mockRedisDel).toHaveBeenCalledWith('depin:task:task_skip_123');
      expect(mockRedisSetex).toHaveBeenCalledWith(
        'depin:assigned:node_skip_user:tgt_skip_1',
        2_592_000,
        'skipped'
      );
      expect(mockRedisSadd).toHaveBeenCalledWith(
        'depin:node:node_skip_user:skipped_targets',
        'tgt_skip_1'
      );
    });

    it('при причине OWN_POST должен сохранять весь канал в owned_channels узла', async () => {
      const res = await dispatcher.skipTask({
        nodeId: 'node_own_author',
        taskId: 'task_own_123',
        channel: 'MyOwnChannel',
        postId: 55,
        reason: 'OWN_POST',
      });

      expect(res.success).toBe(true);
      expect(mockRedisSadd).toHaveBeenCalledWith(
        'depin:node:node_own_author:owned_channels',
        'myownchannel'
      );
    });

    it('не должен выдавать автору цели, созданные им самим (через nodeId или orderId)', async () => {
      mockTargetFindMany.mockResolvedValue([
        { id: 'tgt_own_1', channel: 'author_ch', postId: 1, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0, nodeId: 'node_author_99' },
        { id: 'tgt_own_2', channel: 'author_ch_2', postId: 2, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0, nodeId: 'tg_12345' },
        { id: 'tgt_own_3', channel: 'author_ch_3', postId: 3, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0, orderId: 'p2p:12345:VIEW' },
        { id: 'tgt_foreign', channel: 'other_ch', postId: 4, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0, nodeId: 'stranger_node' },
      ]);

      // Узел авторизован как tg_12345
      const tasksTg = await dispatcher.acquireTasks('tg_12345', 5, false);
      expect(tasksTg.every((t) => t.channel !== 'author_ch_2')).toBe(true);
      expect(tasksTg.every((t) => t.channel !== 'author_ch_3')).toBe(true);
      expect(tasksTg.some((t) => t.channel === 'other_ch')).toBe(true);

      // Узел как node_author_99
      const tasksAuthor = await dispatcher.acquireTasks('node_author_99', 5, false);
      expect(tasksAuthor.every((t) => t.channel !== 'author_ch')).toBe(true);
    });

    it('не должен выдавать цели из skipped_targets или completed_targets', async () => {
      mockTargetFindMany.mockResolvedValue([
        { id: 'tgt_skipped', channel: 'ch_skip', postId: 10, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0 },
        { id: 'tgt_good', channel: 'ch_good', postId: 20, type: 'VIEW_POST', status: 'QUEUED', targetViews: 100, completedViews: 0 },
      ]);

      mockRedisSismember.mockImplementation(async (key: string, member: string) => {
        if (key.includes('skipped_targets') && member === 'tgt_skipped') return 1;
        return 0;
      });

      const tasks = await dispatcher.acquireTasks('node_filter_test', 5, false);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].channel).toBe('ch_good');
    });

    it('не должен выдавать демо-задачи, если канал находится в owned_channels', async () => {
      mockTargetFindMany.mockResolvedValue([]);
      mockRedisSismember.mockImplementation(async (key: string, member: string) => {
        if (key.includes('owned_channels') && member === 'testnews69') return 1;
        return 0;
      });

      const tasks = await dispatcher.acquireTasks('node_owned_ch_test', 3, true);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.channel !== 'testnews69')).toBe(true);
    });
  });
});
