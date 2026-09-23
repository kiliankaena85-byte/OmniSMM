import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

const mockHeadersStore = new Headers({
  'x-forwarded-for': '127.0.0.1',
  'user-agent': 'vitest',
});

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => mockHeadersStore),
  cookies: vi.fn(async () => mockCookieStore),
}));

vi.mock('@/services/financial/payment-gateway.service', () => ({
  PaymentGatewayFactory: {
    getGateway: vi.fn(() => ({
      createPayment: vi.fn(async () => ({
        paymentUrl: 'https://test-gateway.mock/pay',
        remoteGatewayId: 'demo-remote-123'
      })),
    })),
  },
}));

let mockIsTestMode = false;
vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    isTestMode: vi.fn(async () => mockIsTestMode),
  },
}));

import { db } from '@/lib/db';
import { createDemoPaymentAction } from '@/actions/order/demo-payment.action';

describe('D0.5: Demo Payment Guard (CHK-03 + CHK-08)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockIsTestMode = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks demo payments in production when test mode is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockIsTestMode = false;

    await expect(
      createDemoPaymentAction({
        amountRub: 100,
        email: 'attacker@example.com',
      })
    ).rejects.toThrow('Демо-платежи доступны только в тестовом режиме');
  });

  it('allows demo payments in production when test mode is explicitly enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mockIsTestMode = true;

    const email = `demo-test-enabled-${Date.now()}@smmplan.pro`;
    const res = await createDemoPaymentAction({
      amountRub: 100,
      email,
    });

    expect(res.success).toBe(true);
    expect(res.paymentUrl).toBeDefined();

    // Verify demo user has no DEMO_USER_NO_PASSWORD passwordHash (CHK-08)
    const user = await db.user.findFirst({ where: { email } });
    expect(user).toBeDefined();
    expect(user?.passwordHash).toBeNull();
  });

  it('allows demo payments in development / test environments', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockIsTestMode = false;

    const email = `demo-dev-${Date.now()}@smmplan.pro`;
    const res = await createDemoPaymentAction({
      amountRub: 100,
      email,
    });

    expect(res.success).toBe(true);
  });
});
