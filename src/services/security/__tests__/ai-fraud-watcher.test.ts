import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiFraudWatcherService } from '../ai-fraud-watcher.service';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { sendAdminAlert } from '@/lib/notifications';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/services/security/security-alert.service', () => ({
  SecurityAlertService: {
    record: vi.fn().mockResolvedValue({ id: 'alert-1' }),
  },
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));

describe('AiFraudWatcherService (Enterprise Security Test Suite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1: Detects referral ring fraud (5+ empty referred accounts) and generates SecurityEvent', async () => {
    const mockReferredUsers = [
      { id: 'child-1', email: 'c1@test.com', referredById: 'ref-boss', createdAt: new Date(), orders: [] },
      { id: 'child-2', email: 'c2@test.com', referredById: 'ref-boss', createdAt: new Date(), orders: [] },
      { id: 'child-3', email: 'c3@test.com', referredById: 'ref-boss', createdAt: new Date(), orders: [] },
      { id: 'child-4', email: 'c4@test.com', referredById: 'ref-boss', createdAt: new Date(), orders: [] },
      { id: 'child-5', email: 'c5@test.com', referredById: 'ref-boss', createdAt: new Date(), orders: [] },
    ];

    vi.mocked(db.user.findMany).mockResolvedValue(mockReferredUsers as any);
    vi.mocked(db.order.findMany).mockResolvedValue([]);

    const report = await AiFraudWatcherService.runFraudAudit({ windowHours: 24 });

    expect(report.referralFraudCount).toBe(1);
    expect(report.anomaliesDetected).toBe(1);
    expect(report.alerts[0].type).toBe('REFERRAL_RING');
    expect(report.alerts[0].userId).toBe('ref-boss');

    expect(SecurityAlertService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'REFERRAL_FRAUD_DETECTED',
        severity: 'HIGH',
      })
    );

    expect(sendAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('AI Fraud Watcher Alert'),
      'WARNING'
    );
  });

  it('Test 2: Detects abnormal order burst (>=50 orders) from a single user', async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([]);

    // 55 orders by user 'bot-user-99'
    const mockOrders = Array.from({ length: 55 }, (_, i) => ({
      id: `ord-${i}`,
      userId: 'bot-user-99',
      createdAt: new Date(),
    }));

    vi.mocked(db.order.findMany).mockResolvedValue(mockOrders as any);

    const report = await AiFraudWatcherService.runFraudAudit({ windowHours: 24 });

    expect(report.orderVelocityAlertsCount).toBe(1);
    expect(report.anomaliesDetected).toBe(1);
    expect(report.alerts[0].type).toBe('ORDER_BURST');
    expect(report.alerts[0].userId).toBe('bot-user-99');

    expect(SecurityAlertService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'ABNORMAL_ORDER_BURST',
        severity: 'HIGH',
      })
    );
  });

  it('Test 3: Clean traffic with organic behavior generates zero alerts', async () => {
    vi.mocked(db.user.findMany).mockResolvedValue([
      { id: 'child-1', email: 'c1@test.com', referredById: 'legit-ref', createdAt: new Date(), orders: [{ id: 'ord-1' }] },
      { id: 'child-2', email: 'c2@test.com', referredById: 'legit-ref', createdAt: new Date(), orders: [{ id: 'ord-2' }] },
    ] as any);

    vi.mocked(db.order.findMany).mockResolvedValue([
      { id: 'ord-1', userId: 'user-a', createdAt: new Date() },
      { id: 'ord-2', userId: 'user-b', createdAt: new Date() },
    ] as any);

    const report = await AiFraudWatcherService.runFraudAudit({ windowHours: 24 });

    expect(report.anomaliesDetected).toBe(0);
    expect(report.referralFraudCount).toBe(0);
    expect(report.orderVelocityAlertsCount).toBe(0);
    expect(report.alerts).toHaveLength(0);
    expect(SecurityAlertService.record).not.toHaveBeenCalled();
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });
});
