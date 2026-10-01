/**
 * DePIN Admin Actions Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockNodeFindMany, mockNodeCount, mockNodeAggregate, mockNodeUpdate,
  mockTargetFindMany, mockTargetCount, mockTargetCreate,
  mockUserFindMany, mockAuditAdminAwaitable,
} = vi.hoisted(() => ({
  mockNodeFindMany: vi.fn(),
  mockNodeCount: vi.fn(),
  mockNodeAggregate: vi.fn(),
  mockNodeUpdate: vi.fn(),
  mockTargetFindMany: vi.fn(),
  mockTargetCount: vi.fn(),
  mockTargetCreate: vi.fn(),
  mockUserFindMany: vi.fn(),
  mockAuditAdminAwaitable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({
  db: {
    dePinNode: {
      findMany: mockNodeFindMany,
      count: mockNodeCount,
      aggregate: mockNodeAggregate,
      update: mockNodeUpdate,
    },
    dePinTarget: {
      findMany: mockTargetFindMany,
      count: mockTargetCount,
      create: mockTargetCreate,
    },
    user: {
      findMany: mockUserFindMany,
    },
  },
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (_section: string, _perm: string, callback: (admin: { id: string; email: string; role: string }) => Promise<unknown>) => {
    return callback({ id: 'admin_1', email: 'owner@smmplan.pro', role: 'OWNER' });
  }),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: mockAuditAdminAwaitable,
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  getDePinAdminDataAction,
  updateDePinNodeAction,
  createDePinTargetAdminAction,
} from '@/actions/admin/depin/depin-admin-actions';

describe('DePIN Admin Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDePinAdminDataAction', () => {
    it('returns aggregated network stats, nodes with user links, and targets', async () => {
      mockNodeCount
        .mockResolvedValueOnce(24) // totalNodes
        .mockResolvedValueOnce(18); // activeNodes24h

      mockNodeAggregate.mockResolvedValueOnce({
        _sum: {
          creditsBalance: 2500,
          escrowCredits: 350,
          totalCompletedTasks: 140,
          tasksFailed: 2,
        },
      });

      mockTargetCount.mockResolvedValueOnce(7);

      const fakeNodes = [
        {
          id: 'node_f41jtnu_muoaoeqq',
          creditsBalance: 695,
          escrowCredits: 0,
          totalCompletedTasks: 110,
          tasksFailed: 0,
          reputation: 100,
          lastActiveAt: new Date(),
          acceptsViewTasks: true,
          acceptsReactTasks: true,
          acceptsFollowTasks: false,
        },
        {
          id: 'tg_268747191',
          creditsBalance: 1200,
          escrowCredits: 100,
          totalCompletedTasks: 50,
          tasksFailed: 1,
          reputation: 95,
          lastActiveAt: new Date(),
          acceptsViewTasks: true,
          acceptsReactTasks: true,
          acceptsFollowTasks: true,
        },
      ];
      mockNodeFindMany.mockResolvedValueOnce(fakeNodes);

      mockUserFindMany.mockResolvedValueOnce([
        {
          id: 'user_1',
          email: 'tg_268747191@telegram.omnismm.internal',
          telegramId: '268747191',
          balance: BigInt(50000), // 500.00 RUB
        },
      ]);

      mockTargetFindMany.mockResolvedValueOnce([
        {
          id: 'target_1',
          channel: 'testnews69',
          postId: 4,
          type: 'VIEW_POST',
          status: 'QUEUED',
          targetViews: 25,
          completedViews: 10,
          createdAt: new Date(),
        },
      ]);

      const result = await getDePinAdminDataAction();

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats?.totalNodes).toBe(24);
      expect(result.stats?.activeNodes24h).toBe(18);
      expect(result.stats?.totalCreditsIssued).toBe(2500);
      expect(result.stats?.totalRublesEquivalent).toBe(25); // 2500 / 100 = 25 RUB
      expect(result.stats?.totalEscrowCredits).toBe(350);
      expect(result.stats?.totalTasksCompleted).toBe(140);
      expect(result.stats?.activeTargetsCount).toBe(7);

      expect(result.nodes).toHaveLength(2);
      expect(result.nodes?.[1].telegramId).toBe('268747191');
      expect(result.nodes?.[1].linkedUserEmail).toBe('tg_268747191@telegram.omnismm.internal');
      expect(result.nodes?.[1].rublesEquivalent).toBe(12); // 1200 / 100

      expect(result.targets).toHaveLength(1);
      expect(result.targets?.[0].channel).toBe('testnews69');
    });
  });

  describe('updateDePinNodeAction', () => {
    it('updates node reputation and audits change', async () => {
      mockNodeUpdate.mockResolvedValueOnce({
        id: 'node_test',
        reputation: 85,
        tasksFailed: 0,
      });

      const res = await updateDePinNodeAction({
        nodeId: 'node_test',
        reputation: 85,
        resetFailedTasks: true,
      });

      expect(res.success).toBe(true);
      expect(mockNodeUpdate).toHaveBeenCalledWith({
        where: { id: 'node_test' },
        data: expect.objectContaining({
          reputation: 85,
          tasksFailed: 0,
        }),
      });
      expect(mockAuditAdminAwaitable).toHaveBeenCalled();
    });
  });

  describe('createDePinTargetAdminAction', () => {
    it('creates a target channel/post for distributed view tasks', async () => {
      mockTargetCreate.mockResolvedValueOnce({
        id: 'target_new',
        channel: 'smmMarket69',
        postId: 45,
        type: 'VIEW_POST',
        targetViews: 50,
        status: 'QUEUED',
      });

      const res = await createDePinTargetAdminAction({
        channel: 'smmMarket69',
        postId: 45,
        type: 'VIEW_POST',
        targetViews: 50,
      });

      expect(res.success).toBe(true);
      expect(mockTargetCreate).toHaveBeenCalled();
      expect(mockAuditAdminAwaitable).toHaveBeenCalled();
    });
  });
});
