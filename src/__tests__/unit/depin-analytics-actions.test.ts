/**
 * DePIN Mini App Analytics Action Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockNodeFindMany, mockNodeCount, mockNodeAggregate,
  mockExecutionGroupBy, mockExecutionFindMany, mockExecutionCount,
  mockReferralCount, mockLedgerAggregate,
} = vi.hoisted(() => ({
  mockNodeFindMany: vi.fn(),
  mockNodeCount: vi.fn(),
  mockNodeAggregate: vi.fn(),
  mockExecutionGroupBy: vi.fn(),
  mockExecutionFindMany: vi.fn(),
  mockExecutionCount: vi.fn(),
  mockReferralCount: vi.fn(),
  mockLedgerAggregate: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    dePinNode: {
      findMany: mockNodeFindMany,
      count: mockNodeCount,
      aggregate: mockNodeAggregate,
    },
    dePinTaskExecution: {
      groupBy: mockExecutionGroupBy,
      findMany: mockExecutionFindMany,
      count: mockExecutionCount,
    },
    dePinReferral: {
      count: mockReferralCount,
    },
    ledgerEntry: {
      aggregate: mockLedgerAggregate,
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (_section: string, _perm: string, callback: (admin: { id: string; email: string; role: string }) => Promise<unknown>) => {
    return callback({ id: 'admin_1', email: 'owner@smmplan.pro', role: 'OWNER' });
  }),
}));

import { getDePinMiniAppAnalyticsAction } from '@/actions/admin/depin/depin-analytics-actions';

describe('DePIN Mini App Analytics Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates DAU, total taps, funnel, task distribution and leaderboards', async () => {
    // Total nodes, DAU (24h), WAU (7d)
    mockNodeCount
      .mockResolvedValueOnce(24) // totalUsers
      .mockResolvedValueOnce(18) // dau
      .mockResolvedValueOnce(22) // wau
      .mockResolvedValueOnce(15) // tappersCount (totalTapsCount > 0)
      .mockResolvedValueOnce(12); // performersCount (totalCompletedTasks > 0)

    // Aggregates
    mockNodeAggregate.mockResolvedValueOnce({
      _sum: {
        totalTapsCount: 4500,
        creditsBalance: 2500,
        totalCompletedTasks: 133,
      },
    });

    // Ledger payouts
    mockLedgerAggregate.mockResolvedValueOnce({
      _sum: {
        amount: 15000, // 150.00 RUB
      },
      _count: {
        id: 5,
      },
    });

    // Referrers count
    mockReferralCount.mockResolvedValueOnce(3);

    // Leaderboards
    const fakeTappers = [
      { id: 'node_1', totalTapsCount: 2000, creditsBalance: 2000, totalCompletedTasks: 50, reputation: 100 },
      { id: 'node_2', totalTapsCount: 1500, creditsBalance: 1500, totalCompletedTasks: 20, reputation: 95 },
    ];
    const fakePerformers = [
      { id: 'node_1', totalTapsCount: 2000, creditsBalance: 2000, totalCompletedTasks: 50, reputation: 100 },
    ];
    const fakeEarners = [
      { id: 'node_1', totalTapsCount: 2000, creditsBalance: 2000, totalCompletedTasks: 50, reputation: 100 },
    ];

    mockNodeFindMany
      .mockResolvedValueOnce(fakeTappers)
      .mockResolvedValueOnce(fakePerformers)
      .mockResolvedValueOnce(fakeEarners);

    // Task distribution
    mockExecutionGroupBy.mockResolvedValueOnce([
      { type: 'VIEW_POST', _count: { id: 80 } },
      { type: 'REACT_POST', _count: { id: 35 } },
      { type: 'SMART_COMMENT', _count: { id: 18 } },
    ]);

    const result = await getDePinMiniAppAnalyticsAction('7d');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    // Key metrics
    expect(result.data?.kpis.totalUsers).toBe(24);
    expect(result.data?.kpis.dau).toBe(18);
    expect(result.data?.kpis.wau).toBe(22);
    expect(result.data?.kpis.totalTaps).toBe(4500);
    expect(result.data?.kpis.totalTasksCompleted).toBe(133);
    expect(result.data?.kpis.totalRublesWithdrawn).toBe(150);

    // Funnel
    expect(result.data?.funnel.visitors).toBe(24);
    expect(result.data?.funnel.tappers).toBe(15);
    expect(result.data?.funnel.performers).toBe(12);
    expect(result.data?.funnel.referrers).toBe(3);
    expect(result.data?.funnel.converters).toBe(5);

    // Task breakdown
    expect(result.data?.taskBreakdown).toHaveLength(3);
    expect(result.data?.taskBreakdown[0].type).toBe('VIEW_POST');
    expect(result.data?.taskBreakdown[0].count).toBe(80);

    // Leaderboards
    expect(result.data?.leaderboards.topTappers).toHaveLength(2);
    expect(result.data?.leaderboards.topPerformers).toHaveLength(1);
    expect(result.data?.leaderboards.topEarners).toHaveLength(1);
  });
});
