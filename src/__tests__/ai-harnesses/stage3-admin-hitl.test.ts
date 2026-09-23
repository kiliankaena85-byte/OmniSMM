import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyAiRecommendationAction,
  bulkApplyAiRecommendationsAction,
  rejectAiRecommendationAction,
} from '@/actions/admin/economics/recommendations';
import { db } from '@/lib/db';
import * as rbac from '@/lib/server/rbac';

describe('Stage 3: Admin Console, Server Actions & 1-Click HITL Approval Queue', () => {
  const mockAdminUser = {
    id: 'usr_admin_test',
    email: 'admin@smmplan.pro',
    role: 'ADMIN',
    tenantId: 'smmplan',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(rbac, 'requireStaffPermission').mockImplementation(async (_res, _act, callback) => {
      return callback(mockAdminUser as any);
    });
  });

  describe('1. applyAiRecommendationAction', () => {
    it('applies single recommendation, updates service price and price history in transaction', async () => {
      const mockRec = {
        id: 'rec_101',
        snapshotId: 'snap_1',
        serviceId: 'srv_1',
        proposedMarkup: 2.2,
        currentMarkup: 1.2,
        proposedPriceRub: 220.0,
        currentPriceRub: 120.0,
        projectedMonthlyGainRub: 1500,
        status: 'PENDING',
        service: {
          id: 'srv_1',
          name: 'Telegram Followers',
          rate: 1.0,
          providerCurrency: 'USD',
        },
      };

      vi.spyOn(db.aiPricingRecommendation, 'findUnique').mockResolvedValue(mockRec as any);

      const updateServiceMock = vi.fn().mockResolvedValue({});
      const createPriceHistoryMock = vi.fn().mockResolvedValue({});
      const updateRecMock = vi.fn().mockResolvedValue({});
      const countPendingMock = vi.fn().mockResolvedValue(0);
      const updateSnapshotMock = vi.fn().mockResolvedValue({});
      const createAuditLogMock = vi.fn().mockResolvedValue({});

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          service: { update: updateServiceMock },
          servicePriceHistory: { create: createPriceHistoryMock },
          aiPricingRecommendation: { update: updateRecMock, count: countPendingMock },
          economicOptimizationSnapshot: { update: updateSnapshotMock },
          adminAuditLog: { create: createAuditLogMock },
        });
      });

      const res = await applyAiRecommendationAction('rec_101');

      expect(res.success).toBe(true);
      expect(res.data?.newPriceRub).toBe(220.0);
      expect(res.data?.newMarkup).toBe(2.2);
      expect(updateServiceMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'srv_1' },
          data: expect.objectContaining({ markup: 2.2 }),
        })
      );
      expect(createPriceHistoryMock).toHaveBeenCalled();
      expect(updateRecMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec_101' },
          data: expect.objectContaining({ status: 'APPROVED' }),
        })
      );
    });

    it('rejects duplicate application if status is already APPROVED', async () => {
      vi.spyOn(db.aiPricingRecommendation, 'findUnique').mockResolvedValue({
        id: 'rec_already_approved',
        status: 'APPROVED',
        service: {},
      } as any);

      const res = await applyAiRecommendationAction('rec_already_approved');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Рекомендация уже была применена');
    });
  });

  describe('2. bulkApplyAiRecommendationsAction', () => {
    it('applies multiple recommendations in a single atomic transaction', async () => {
      const mockRecs = [
        {
          id: 'rec_1',
          serviceId: 'srv_1',
          proposedMarkup: 2.0,
          service: { id: 'srv_1', rate: 1.0, providerCurrency: 'USD' },
        },
        {
          id: 'rec_2',
          serviceId: 'srv_2',
          proposedMarkup: 3.0,
          service: { id: 'srv_2', rate: 2.0, providerCurrency: 'USD' },
        },
      ];

      vi.spyOn(db.aiPricingRecommendation, 'findMany').mockResolvedValue(mockRecs as any);

      const updateServiceMock = vi.fn().mockResolvedValue({});
      const createPriceHistoryMock = vi.fn().mockResolvedValue({});
      const updateRecMock = vi.fn().mockResolvedValue({});
      const countPendingMock = vi.fn().mockResolvedValue(0);
      const updateSnapshotMock = vi.fn().mockResolvedValue({});
      const createAuditLogMock = vi.fn().mockResolvedValue({});

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          service: { update: updateServiceMock },
          servicePriceHistory: { create: createPriceHistoryMock },
          aiPricingRecommendation: { update: updateRecMock, count: countPendingMock },
          economicOptimizationSnapshot: { update: updateSnapshotMock },
          adminAuditLog: { create: createAuditLogMock },
        });
      });

      const res = await bulkApplyAiRecommendationsAction('snap_1', ['rec_1', 'rec_2']);

      expect(res.success).toBe(true);
      expect(res.data?.appliedCount).toBe(2);
      expect(updateServiceMock).toHaveBeenCalledTimes(2);
      expect(updateRecMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('3. rejectAiRecommendationAction', () => {
    it('records rejection with reason and persists audit trail', async () => {
      vi.spyOn(db.aiPricingRecommendation, 'findUnique').mockResolvedValue({
        id: 'rec_to_reject',
        status: 'PENDING',
      } as any);

      const updateSpy = vi.spyOn(db.aiPricingRecommendation, 'update').mockResolvedValue({} as any);

      const res = await rejectAiRecommendationAction('rec_to_reject', 'Seasonal discount planned');

      expect(res.success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rec_to_reject' },
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectionReason: 'Seasonal discount planned',
          }),
        })
      );
    });
  });
});
