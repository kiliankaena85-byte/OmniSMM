import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processReferralAction,
  getReferralStatsAction,
  evaluateProofOfActivityGate,
  awardReferralRoyalty,
} from '@/actions/depin/referral';

interface MockReferral {
  id?: string;
  referrerTelegramId?: string;
  referrerNodeId?: string;
  refereeTelegramId?: string;
  refereeNodeId?: string;
  status?: string;
  welcomeBonusGranted?: boolean;
  activationBonusGranted?: boolean;
  tapsRecorded?: number;
  tasksCompleted?: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  qualifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MockEarning {
  id?: string;
  referralId: string;
  earningType: string;
  amountCredits: number;
  sourceTaskId?: string;
  createdAt?: Date;
}

let mockReferrals: MockReferral[] = [];
let mockEarnings: MockEarning[] = [];
let mockNodes: Record<string, { id: string; creditsBalance: number }> = {};

vi.mock('@/lib/db', () => {
  const dbMock = {
    dePinReferral: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.refereeTelegramId) {
          return mockReferrals.find((r) => r.refereeTelegramId === where.refereeTelegramId) || null;
        }
        if (where.refereeNodeId) {
          return mockReferrals.find((r) => r.refereeNodeId === where.refereeNodeId) || null;
        }
        if (where.id) {
          return mockReferrals.find((r) => r.id === where.id) || null;
        }
        return null;
      }),
      findMany: vi.fn(async ({ where }) => {
        return mockReferrals.filter(
          (r) =>
            r.referrerTelegramId === where?.OR?.[0]?.referrerTelegramId ||
            r.referrerNodeId === where?.OR?.[1]?.referrerNodeId
        ).map((r) => ({
          ...r,
          earnings: mockEarnings.filter((e) => e.referralId === r.id),
        }));
      }),
      create: vi.fn(async ({ data }) => {
        const item = { id: `ref_row_${Date.now()}`, ...data };
        mockReferrals.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }) => {
        const idx = mockReferrals.findIndex((r) => r.id === where.id);
        if (idx !== -1) {
          mockReferrals[idx] = { ...mockReferrals[idx], ...data };
          return mockReferrals[idx];
        }
        return null;
      }),
    },
    dePinNode: {
      findUnique: vi.fn(async ({ where }) => {
        return mockNodes[where.id] || null;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        if (!mockNodes[where.id]) {
          mockNodes[where.id] = { id: where.id, creditsBalance: create.creditsBalance ?? 0 };
        } else if (update.creditsBalance?.increment) {
          mockNodes[where.id].creditsBalance += update.creditsBalance.increment;
        }
        return mockNodes[where.id];
      }),
      update: vi.fn(async ({ where, data }) => {
        if (!mockNodes[where.id]) {
          mockNodes[where.id] = { id: where.id, creditsBalance: 0 };
        }
        if (data.creditsBalance?.increment) {
          mockNodes[where.id].creditsBalance += data.creditsBalance.increment;
        }
        return mockNodes[where.id];
      }),
    },
    dePinReferralEarning: {
      create: vi.fn(async ({ data }) => {
        const earning = { id: `earning_${Date.now()}`, ...data, createdAt: new Date() };
        mockEarnings.push(earning);
        return earning;
      }),
    },
    $transaction: vi.fn(async (cb) => cb(dbMock)),
  };

  return { db: dbMock };
});

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  },
}));

describe('DePIN Viral Referral Engine & Proof-of-Activity Gate', () => {
  beforeEach(() => {
    mockReferrals = [];
    mockEarnings = [];
    mockNodes = {};
    vi.clearAllMocks();
  });

  describe('processReferralAction', () => {
    it('блокирует попытку самореферала (OWASP A01: Broken Access Control)', async () => {
      const res = await processReferralAction({
        refereeNodeId: 'tg_111222',
        refereeTelegramId: '111222',
        startParam: 'ref_111222',
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('CANNOT_REFER_SELF');
    });

    it('успешно регистрирует нового друга и начисляет ему Welcome-бонус +50 PTS', async () => {
      const res = await processReferralAction({
        refereeNodeId: 'tg_bob',
        refereeTelegramId: 'bob_123',
        startParam: 'ref_alice_999',
      });

      expect(res.success).toBe(true);
      expect(res.welcomeBonusAwarded).toBe(true);
      expect(res.creditsAwarded).toBe(50);
      expect(mockNodes['tg_bob']?.creditsBalance).toBe(50);
      expect(mockReferrals[0]?.status).toBe('PENDING_QUALIFICATION');
      expect(mockReferrals[0]?.referrerTelegramId).toBe('alice_999');
    });

    it('не начисляет повторный Welcome-бонус уже зарегистрированному другу', async () => {
      mockReferrals.push({
        id: 'ref_existing',
        refereeTelegramId: 'bob_123',
        refereeNodeId: 'tg_bob',
        referrerTelegramId: 'alice_999',
        status: 'PENDING_QUALIFICATION',
        welcomeBonusGranted: true,
      });

      const res = await processReferralAction({
        refereeNodeId: 'tg_bob',
        refereeTelegramId: 'bob_123',
        startParam: 'ref_alice_999',
      });

      expect(res.success).toBe(true);
      expect(res.welcomeBonusAwarded).toBe(false);
    });
  });

  describe('evaluateProofOfActivityGate (Anti-Drain Invariant)', () => {
    it('не начисляет бонус рефереру, если друг сделал меньше 20 тапов', async () => {
      mockReferrals.push({
        id: 'ref_1',
        refereeNodeId: 'tg_bob',
        referrerNodeId: 'tg_alice',
        status: 'PENDING_QUALIFICATION',
        tapsRecorded: 0,
        tasksCompleted: 0,
      });

      const { db } = await import('@/lib/db');
      const isQualified = await evaluateProofOfActivityGate(db, 'tg_bob', 15, 0);

      expect(isQualified).toBe(false);
      expect(mockReferrals[0].tapsRecorded).toBe(15);
      expect(mockReferrals[0].status).toBe('PENDING_QUALIFICATION');
      expect(mockNodes['tg_alice']?.creditsBalance ?? 0).toBe(0);
    });

    it('активирует статус QUALIFIED и начисляет +100 PTS рефереру ровно на 20-м тапе', async () => {
      mockReferrals.push({
        id: 'ref_1',
        refereeNodeId: 'tg_bob',
        referrerNodeId: 'tg_alice',
        status: 'PENDING_QUALIFICATION',
        tapsRecorded: 15,
        tasksCompleted: 0,
      });

      const { db } = await import('@/lib/db');
      // Добавляем еще 5 тапов (суммарно 20 >= 20)
      const isQualified = await evaluateProofOfActivityGate(db, 'tg_bob', 5, 0);

      expect(isQualified).toBe(true);
      expect(mockReferrals[0].status).toBe('QUALIFIED');
      expect(mockNodes['tg_alice']?.creditsBalance).toBe(100);
      expect(mockEarnings.length).toBe(1);
      expect(mockEarnings[0].earningType).toBe('ACTIVATION_BONUS');
      expect(mockEarnings[0].amountCredits).toBe(100);
    });

    it('активирует статус QUALIFIED при выполнении 1 задания', async () => {
      mockReferrals.push({
        id: 'ref_2',
        refereeNodeId: 'tg_charlie',
        referrerNodeId: 'tg_alice',
        status: 'PENDING_QUALIFICATION',
        tapsRecorded: 0,
        tasksCompleted: 0,
      });

      const { db } = await import('@/lib/db');
      const isQualified = await evaluateProofOfActivityGate(db, 'tg_charlie', 0, 1);

      expect(isQualified).toBe(true);
      expect(mockReferrals[0].status).toBe('QUALIFIED');
      expect(mockNodes['tg_alice']?.creditsBalance).toBe(100);
    });
  });

  describe('awardReferralRoyalty (10% Task Royalty)', () => {
    it('начисляет рефереру 10% от заработанных другом очков', async () => {
      mockReferrals.push({
        id: 'ref_active',
        refereeNodeId: 'tg_bob',
        referrerNodeId: 'tg_alice',
        status: 'QUALIFIED',
      });
      mockNodes['tg_alice'] = { id: 'tg_alice', creditsBalance: 100 };

      const { db } = await import('@/lib/db');
      const royalty = await awardReferralRoyalty(db, 'tg_bob', 'task_view_999', 10);

      expect(royalty).toBe(1); // 10% от 10 = 1 PTS
      expect(mockNodes['tg_alice'].creditsBalance).toBe(101);
      expect(mockEarnings.length).toBe(1);
      expect(mockEarnings[0].earningType).toBe('TASK_ROYALTY');
      expect(mockEarnings[0].amountCredits).toBe(1);
    });

    it('НЕ начисляет роялти, если друг еще не прошел квалификацию', async () => {
      mockReferrals.push({
        id: 'ref_pending',
        refereeNodeId: 'tg_bob',
        referrerNodeId: 'tg_alice',
        status: 'PENDING_QUALIFICATION',
      });

      const { db } = await import('@/lib/db');
      const royalty = await awardReferralRoyalty(db, 'tg_bob', 'task_view_999', 10);

      expect(royalty).toBe(0);
      expect(mockEarnings.length).toBe(0);
    });
  });

  describe('getReferralStatsAction', () => {
    it('возвращает правильную агрегированную статистику рефералов', async () => {
      mockReferrals.push(
        {
          id: 'ref_1',
          referrerTelegramId: 'alice_123',
          referrerNodeId: 'tg_alice_123',
          status: 'QUALIFIED',
        },
        {
          id: 'ref_2',
          referrerTelegramId: 'alice_123',
          referrerNodeId: 'tg_alice_123',
          status: 'PENDING_QUALIFICATION',
        }
      );
      mockEarnings.push(
        { referralId: 'ref_1', earningType: 'ACTIVATION_BONUS', amountCredits: 100 },
        { referralId: 'ref_1', earningType: 'TASK_ROYALTY', amountCredits: 5 }
      );

      const res = await getReferralStatsAction({
        nodeId: 'tg_alice_123',
        telegramId: 'alice_123',
      });

      expect(res.success).toBe(true);
      expect(res.stats?.totalInvited).toBe(2);
      expect(res.stats?.qualifiedFriends).toBe(1);
      expect(res.stats?.pendingFriends).toBe(1);
      expect(res.stats?.earnedBonusCredits).toBe(100);
      expect(res.stats?.earnedRoyaltyCredits).toBe(5);
    });
  });
});
