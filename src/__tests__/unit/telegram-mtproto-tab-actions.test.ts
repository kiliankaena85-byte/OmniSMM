import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listTelegramSessionsAction,
  executeManualBoostAction,
  executeManualReactionAction,
  sweepExpiredBoostsAction,
} from '@/actions/admin/production/sessions';
import { TelegramSessionPoolManager } from '@/services/production/telegram-session-pool';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (_section: string, _perm: string, callback: (admin: unknown) => Promise<unknown>) => {
    return callback({ id: 'admin_test_1', email: 'owner@smmplan.pro' });
  }),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue({ id: 'audit_1' }),
}));

describe('MTProto Cluster Admin Tab Actions', () => {
  beforeEach(() => {
    TelegramSessionPoolManager.resetInstance();
    const pool = TelegramSessionPoolManager.getInstance();

    pool.registerSession({
      id: 'tg_79991112233',
      phoneNumber: '+79991112233',
      dcId: 2,
      state: 'READY',
      hasPremium: true,
      interactionHealthScore: 95,
      deviceModel: 'Samsung S24',
      appVersion: '10.14.0',
      systemVersion: 'Android 14',
      lastActionAt: Date.now(),
      boostSlots: [
        { slotIndex: 0 },
        { slotIndex: 1 },
        { slotIndex: 2 },
        { slotIndex: 3 },
      ],
    });
  });

  describe('listTelegramSessionsAction', () => {
    it('returns formatted session list with masked phones and free slot counts', async () => {
      const res = await listTelegramSessionsAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.sessions.length).toBeGreaterThanOrEqual(1);
        const item = res.sessions.find(s => s.id === 'tg_79991112233');
        expect(item).toBeDefined();
        expect(item?.phoneMasked).toContain('***');
        expect(item?.freeBoostSlots).toBe(4);
        expect(item?.hasPremium).toBe(true);
        expect(item?.interactionHealthScore).toBe(95);
      }
    });

    it('filters sessions by state', async () => {
      const res = await listTelegramSessionsAction({ state: 'BANNED' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.sessions.length).toBe(0);
      }
    });
  });

  describe('executeManualBoostAction', () => {
    it('successfully allocates boost slot for valid target', async () => {
      const res = await executeManualBoostAction({
        channel: 'durov_channel',
        durationDays: 7,
      });

      expect(res.success).toBe(true);
      if (res.success && 'action' in res) {
        expect(res.action).toBe('BOOST');
        expect(res.sessionId).toBe('tg_79991112233');
        expect(res.slotIndex).toBe(0);
      }
    });

    it('rejects empty channel input with validation error', async () => {
      const res = await executeManualBoostAction({
        channel: '',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('executeManualReactionAction', () => {
    it('successfully executes reaction using healthy session', async () => {
      const res = await executeManualReactionAction({
        channel: 'telegram',
        postId: 100,
        reaction: '🔥',
      });

      expect(res.success).toBe(true);
      if (res.success && 'action' in res) {
        expect(res.action).toBe('REACTION');
        expect(res.sessionId).toBe('tg_79991112233');
      }
    });
  });

  describe('sweepExpiredBoostsAction', () => {
    it('sweeps expired slots and returns audit stats', async () => {
      const res = await sweepExpiredBoostsAction();
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.expiredSlotsFreed).toBeDefined();
        expect(res.cooledDownSlotsReset).toBeDefined();
        expect(res.sessionsRestored).toBeDefined();
      }
    });
  });
});
