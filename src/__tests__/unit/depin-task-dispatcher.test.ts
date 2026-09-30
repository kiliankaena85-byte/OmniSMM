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
  mockTargetFindMany, mockTargetUpsert, mockTargetUpdateMany, mockTargetCount,
  mockRedisExists, mockRedisSetex, mockRedisDel, mockRedisGet,
} = vi.hoisted(() => ({
  mockNodeUpsert:      vi.fn(),
  mockNodeFindUnique:  vi.fn(),
  mockNodeUpdate:      vi.fn(),
  mockNodeCount:       vi.fn(),
  mockNodeAggregate:   vi.fn(),
  mockTargetFindMany:  vi.fn(),
  mockTargetUpsert:    vi.fn(),
  mockTargetUpdateMany: vi.fn(),
  mockTargetCount:     vi.fn(),
  mockRedisExists:     vi.fn(),
  mockRedisSetex:      vi.fn(),
  mockRedisDel:        vi.fn(),
  mockRedisGet:        vi.fn(),
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
      upsert:     mockTargetUpsert,
      updateMany: mockTargetUpdateMany,
      count:      mockTargetCount,
      fields:     { targetViews: 'targetViews' },
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    exists: mockRedisExists,
    setex:  mockRedisSetex,
    del:    mockRedisDel,
    get:    mockRedisGet,
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
  mockTargetUpsert.mockResolvedValue({});
  mockTargetUpdateMany.mockResolvedValue({ count: 1 });
  mockTargetCount.mockResolvedValue(2);
  mockRedisExists.mockResolvedValue(0);
  mockRedisSetex.mockResolvedValue('OK');
  mockRedisDel.mockResolvedValue(1);
  mockRedisGet.mockResolvedValue(null);
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
    mockNodeUpdate.mockResolvedValue({ id: 'node_worker_777', creditsBalance: 10, totalCompletedTasks: 1 });

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
    expect(mockNodeUpdate).not.toHaveBeenCalled();
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
    expect(mockNodeUpdate).not.toHaveBeenCalled();
  });

  // ── claimCredits → insufficient ──────────────────────────────────────────────
  it('должен отклонять списание при недостаточном балансе', async () => {
    mockNodeFindUnique.mockResolvedValue({ id: 'node_poor', creditsBalance: 5 });

    const result = await dispatcher.claimCredits('node_poor', 50);
    expect(result.success).toBe(false);
    expect(result.error).toBe('INSUFFICIENT_CREDITS');
    expect(mockNodeUpdate).not.toHaveBeenCalled();
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
});
