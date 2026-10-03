import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createP2PBoostAction, updateNodePreferencesAction } from '@/actions/depin/ai-assistant';

// Mock DB and Redis
vi.mock('@/lib/db', () => {
  const mockNode = {
    id: 'test_node_123',
    creditsBalance: 100,
    lastActiveAt: new Date(),
  };

  const mockTarget = {
    id: 'target_p2p_456',
    channel: 'testchannel',
    postId: 42,
    targetViews: 20,
    completedViews: 0,
  };

  const txMock = {
    dePinNode: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id === 'test_node_123') return { ...mockNode };
        if (where.id === 'poor_node') return { id: 'poor_node', creditsBalance: 2 };
        return null;
      }),
      update: vi.fn(async ({ data }) => {
        const decrement = (data.creditsBalance as { decrement: number }).decrement;
        return {
          id: 'test_node_123',
          creditsBalance: mockNode.creditsBalance - decrement,
        };
      }),
    },
    dePinTarget: {
      upsert: vi.fn(async () => mockTarget),
    },
  };

  return {
    db: {
      $transaction: vi.fn(async (cb) => cb(txMock)),
    },
  };
});

vi.mock('@/lib/redis', () => ({
  redis: {
    hset: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    get: vi.fn(async () => null),
    setex: vi.fn(async () => 'OK'),
  },
}));

describe('DePIN P2P Boost & Preferences Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateNodePreferencesAction', () => {
    it('saves custom reactions and telegram premium status', async () => {
      const res = await updateNodePreferencesAction({
        nodeId: 'test_node_123',
        acceptsReactTasks: true,
        allowedReactions: ['👍', '🔥', '❤️'],
        hasTelegramPremium: true,
      });

      expect(res.success).toBe(true);
    });

    it('rejects invalid reaction emoji', async () => {
      const res = await updateNodePreferencesAction({
        nodeId: 'test_node_123',
        allowedReactions: ['INVALID_EMOJI' as unknown as '👍'],
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('createP2PBoostAction', () => {
    it('validates Telegram post URL format (OWASP A03 / A05)', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'test_node_123',
        postUrl: 'http://malicious-site.com/hack',
        boostType: 'VIEW',
        count: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('формата https://t.me/channel/123');
    });

    it('requires reactionEmoji when boostType is REACT', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'test_node_123',
        postUrl: 'https://t.me/mychannel/15',
        boostType: 'REACT',
        count: 10,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Выберите конкретную реакцию');
    });

    it('rejects when node has insufficient credits (ExactMath)', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'poor_node',
        postUrl: 'https://t.me/mychannel/15',
        boostType: 'VIEW',
        count: 10, // requires 20 credits, poor_node only has 2
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Недостаточно очков (PTS)');
    });

    it('successfully creates P2P VIEW boost and deducts credits atomically', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'test_node_123',
        postUrl: 'https://t.me/mychannel/15',
        boostType: 'VIEW',
        count: 20, // requires 40 credits
      });

      expect(res.success).toBe(true);
      expect(res.targetId).toBe('target_p2p_456');
      expect(res.remainingCredits).toBe(60); // 100 - 40
    });

    it('successfully creates P2P REACT boost with custom emoji 🔥', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'test_node_123',
        postUrl: 'https://t.me/mychannel/15',
        boostType: 'REACT',
        reactionEmoji: '🔥',
        count: 10, // requires 50 credits
      });

      expect(res.success).toBe(true);
      expect(res.targetId).toBe('target_p2p_456');
      expect(res.remainingCredits).toBe(50); // 100 - 50
    });

    it('successfully creates P2P MULTI_POST boost (5 PTS per item)', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'test_node_123',
        postUrl: 'https://t.me/mychannel/20',
        boostType: 'MULTI_POST',
        count: 10, // requires 50 credits
      });

      expect(res.success).toBe(true);
      expect(res.targetId).toBe('target_p2p_456');
      expect(res.remainingCredits).toBe(50); // 100 - 50
    });

    it('successfully creates P2P SMART_COMMENT boost (15 PTS per item)', async () => {
      const res = await createP2PBoostAction({
        nodeId: 'test_node_123',
        postUrl: 'https://t.me/mychannel/25',
        boostType: 'SMART_COMMENT',
        count: 5, // requires 75 credits (5 * 15)
      });

      expect(res.success).toBe(true);
      expect(res.targetId).toBe('target_p2p_456');
      expect(res.remainingCredits).toBe(25); // 100 - 75
    });
  });
});
