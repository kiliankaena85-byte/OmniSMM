import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutAction } from '@/actions/order/checkout';
import { createTopUpPaymentAction } from '@/actions/user/top-up.action';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn()
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ 'user-agent': 'Vitest' })),
  cookies: vi.fn().mockReturnValue({ get: vi.fn() })
}));

vi.mock('@/utils/ip', () => ({
  getClientIp: vi.fn().mockResolvedValue('127.0.0.1')
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: { check: vi.fn().mockResolvedValue(true) }
}));

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn().mockReturnValue({
      createPayment: vi.fn().mockResolvedValue({ paymentUrl: 'https://pay.mock/123' })
    })
  }
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: { isTestMode: vi.fn().mockResolvedValue(true) }
}));

describe('SEC-05: 15,000 RUB Anti-Fraud Limit for Robokassa & Exemption for CryptoBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks Top-Up > 15 000 RUB via Robokassa for users without Telegram', async () => {
    vi.mocked(verifySession).mockResolvedValueOnce({
      userId: 'u-no-tg',
      role: 'USER',
      tenantId: 'smmplan'
    });

    vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
      id: 'u-no-tg',
      telegramId: null,
      isActive: true,
      isDeleted: false,
      email: 'notg@test.com',
      tenantId: 'smmplan'
    } as any);

    await expect(createTopUpPaymentAction(20000, 'robokassa')).rejects.toThrow(
      'Для пополнения баланса свыше 15 000 ₽ картой или СБП, пожалуйста, привяжите ваш Telegram-аккаунт'
    );
  });

  it('allows Top-Up > 15 000 RUB via Robokassa for users WITH Telegram', async () => {
    vi.mocked(verifySession).mockResolvedValueOnce({
      userId: 'u-with-tg',
      role: 'USER',
      tenantId: 'smmplan'
    });

    vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
      id: 'u-with-tg',
      telegramId: '123456789',
      isActive: true,
      isDeleted: false,
      email: 'withtg@test.com',
      tenantId: 'smmplan'
    } as any);

    vi.spyOn(db.payment, 'findFirst').mockResolvedValueOnce(null);
    vi.spyOn(db.payment, 'create').mockResolvedValueOnce({ id: 'pay-123' } as any);
    vi.spyOn(db.payment, 'update').mockResolvedValueOnce({ id: 'pay-123' } as any);
    vi.spyOn(db.contentItem, 'findUnique').mockResolvedValueOnce({ updatedAt: new Date() } as any);

    const result = await createTopUpPaymentAction(20000, 'robokassa');
    expect(result.success).toBe(true);
    expect(result.paymentUrl).toBe('https://pay.mock/123');
  });

  it('exempts CryptoBot from 15 000 RUB Telegram requirement (Zero Chargeback Risk)', async () => {
    vi.mocked(verifySession).mockResolvedValueOnce({
      userId: 'u-crypto',
      role: 'USER',
      tenantId: 'smmplan'
    });

    vi.spyOn(db.user, 'findUnique').mockResolvedValueOnce({
      id: 'u-crypto',
      telegramId: null, // No Telegram linked!
      isActive: true,
      isDeleted: false,
      email: 'crypto@test.com',
      tenantId: 'smmplan'
    } as any);

    vi.spyOn(db.payment, 'findFirst').mockResolvedValueOnce(null);
    vi.spyOn(db.payment, 'create').mockResolvedValueOnce({ id: 'pay-crypto' } as any);
    vi.spyOn(db.payment, 'update').mockResolvedValueOnce({ id: 'pay-crypto' } as any);
    vi.spyOn(db.contentItem, 'findUnique').mockResolvedValueOnce({ updatedAt: new Date() } as any);

    const result = await createTopUpPaymentAction(50000, 'cryptobot');
    expect(result.success).toBe(true);
  });
});
