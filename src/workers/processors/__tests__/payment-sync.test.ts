import { describe, it, expect, vi, beforeEach } from 'vitest';
import paymentSyncProcessor from '../payment-sync';
import { db } from '../../../lib/db';
import { SettingsManager } from '../../../lib/settings';
import { paymentService } from '../../../services/financial/payment.service';

vi.mock('../../../lib/db', () => ({
  db: {
    payment: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    order: { updateMany: vi.fn() },
    $transaction: vi.fn((cb) => cb(db))
  }
}));

vi.mock('../../../lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn(),
    getPaymentSecrets: vi.fn()
  }
}));

vi.mock('../../../services/financial/payment.service', () => ({
  paymentService: {
    confirmPayment: vi.fn().mockResolvedValue(true)
  }
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Payment Sync Processor', () => {
  const mockJob = { name: 'payment-sync' } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.$transaction).mockImplementation((cb: any) => cb(db));
  });

  it('Test mode early exit', async () => {
    vi.mocked(db.payment.findMany).mockResolvedValueOnce([]) // stale
      .mockResolvedValueOnce([{ id: 'p1' }] as any); // yookassa
    vi.mocked(SettingsManager.isTestMode).mockResolvedValue(true);

    await paymentSyncProcessor(mockJob);

    expect(SettingsManager.getPaymentSecrets).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('Succeeded remote payment (confirms locally)', async () => {
    vi.mocked(db.payment.findMany).mockResolvedValueOnce([]) // stale
      .mockResolvedValueOnce([{
        id: 'p1',
        gatewayId: 'yoo1',
        userId: 'u1'
      }] as any); // yookassa
    vi.mocked(SettingsManager.isTestMode).mockResolvedValue(false);
    vi.mocked(SettingsManager.getPaymentSecrets).mockResolvedValue({
      yookassaShopId: 'shop1',
      yookassaSecretKey: 'secret1'
    } as any);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'succeeded',
        amount: { value: '10.50' }
      })
    });

    await paymentSyncProcessor(mockJob);

    expect(mockFetch).toHaveBeenCalledWith('https://api.yookassa.ru/v3/payments/yoo1', expect.any(Object));
    expect(paymentService.confirmPayment).toHaveBeenCalledWith('yoo1', 1050, 'u1', false, 'yookassa', 'p1');
  });

  it('Canceled remote payment (WRK-01: cascades to basket orders)', async () => {
    vi.mocked(db.payment.findMany).mockResolvedValueOnce([]) // stale
      .mockResolvedValueOnce([{
        id: 'p1',
        gatewayId: 'yoo1',
        userId: 'u1'
      }] as any); // yookassa
    vi.mocked(SettingsManager.isTestMode).mockResolvedValue(false);
    vi.mocked(SettingsManager.getPaymentSecrets).mockResolvedValue({
      yookassaShopId: 'shop1',
      yookassaSecretKey: 'secret1'
    } as any);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'canceled'
      })
    });

    await paymentSyncProcessor(mockJob);

    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { status: 'CANCELED' }
    });
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 'p1', status: 'AWAITING_PAYMENT' },
      data: { status: 'CANCELED', error: 'Платёж отменён на стороне шлюза (auto-sync)' }
    });
  });

  it('WRK-01: Stale 24h path with basket orders expires payment and all awaiting basket orders', async () => {
    // Stale payment without orderId (basket checkout)
    vi.mocked(db.payment.findMany).mockResolvedValueOnce([{
      id: 'stale-basket-p1',
      orderId: null,
    }] as any).mockResolvedValueOnce([]); // no pending yookassa

    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(db.order.updateMany).mockResolvedValue({ count: 2 });

    await paymentSyncProcessor(mockJob);

    expect(db.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'stale-basket-p1', status: 'PENDING' },
      data: { status: 'CANCELED' }
    });
    // Basket orders updated
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: { paymentId: 'stale-basket-p1', status: 'AWAITING_PAYMENT' },
      data: { status: 'CANCELED', error: 'Оплата не поступила в течение 24ч (auto-expire)' }
    });
  });

  it('WRK-01: Regression guard — activated PENDING orders are NOT touched during cancellation', async () => {
    vi.mocked(db.payment.findMany).mockResolvedValueOnce([{
      id: 'stale-p2',
      orderId: null,
    }] as any).mockResolvedValueOnce([]);

    vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 });

    await paymentSyncProcessor(mockJob);

    // Verify where clause strictly checks status: 'AWAITING_PAYMENT'
    const orderUpdateCalls = vi.mocked(db.order.updateMany).mock.calls;
    expect(orderUpdateCalls.length).toBeGreaterThan(0);
    for (const call of orderUpdateCalls) {
      expect(call[0].where).toMatchObject({ status: 'AWAITING_PAYMENT' });
    }
  });
});
