import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileStalePayments } from '@/workers/payment-reconciliation';
import { db } from '@/lib/db';
import { paymentService } from '@/services/financial/payment.service';
import { sendAdminAlert } from '@/lib/notifications';

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
  sendAdminAlertSync: vi.fn(),
}));

vi.mock('@/services/financial/payment.service', () => ({
  paymentService: {
    confirmPayment: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaShopId: 'mock_shop_123',
      yookassaSecretKey: 'mock_secret_key',
    }),
  },
}));

describe('Webhook Latency, Drift Analytics & Safe Auto-Reconciliation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[Auto-Reconciliation] Successfully reconciles and confirms stale payment when webhook dropped', async () => {
    // 1. Create a dummy test user and payment in DB
    const user = await db.user.create({
      data: {
        email: `reconcile_test_${Date.now()}@yandex.ru`,
        passwordHash: 'dummy_hash',
        role: 'USER',
      },
    });

    const payment = await db.payment.create({
      data: {
        userId: user.id,
        amount: BigInt(1500_00), // 1500.00 RUB
        currency: 'RUB',
        status: 'PENDING',
        gateway: 'yookassa',
        gatewayId: `mock_yoo_${Date.now()}`,
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago (dropped webhook)
      },
    });

    // 2. Mock safeFetch to return YooKassa succeeded response
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: payment.gatewayId,
        status: 'succeeded',
        amount: { value: '1500.00', currency: 'RUB' },
      }),
    });

    // 3. Run reconciliation
    const report = await reconcileStalePayments();

    expect(report.reconciledSuccess).toBeGreaterThanOrEqual(1);
    expect(paymentService.confirmPayment).toHaveBeenCalledWith(
      payment.gatewayId,
      150000,
      user.id,
      false,
      'yookassa',
      payment.id
    );

    // 4. Verify structured alert for support was triggered
    expect(sendAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('[Авто-сверка]'),
      'WARNING'
    );

    // Cleanup
    await db.payment.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    global.fetch = originalFetch;
  });
});
