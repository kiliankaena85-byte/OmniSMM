import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnifiedPaymentService } from './unified-payment.service';
import { db } from '@/lib/db';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    payment: {
      create: vi.fn().mockResolvedValue({ id: 'payment-123' }),
      update: vi.fn().mockResolvedValue({}),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
    }
  }
}));

// Mock SettingsManager and SettingsProvider
vi.mock('@/lib/settings', () => ({
  SettingsManager: {
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaShopId: 'shop-1',
      yookassaSecretKey: 'secret-1',
      cryptoBotToken: 'token-1'
    }),
    isTestMode: vi.fn().mockResolvedValue(false),
  },
  SettingsProvider: {
    getPaymentSecrets: vi.fn().mockResolvedValue({
      yookassaShopId: 'shop-1',
      yookassaSecretKey: 'secret-1',
      cryptoBotToken: 'token-1'
    }),
    getContactAndLegalSettings: vi.fn().mockResolvedValue({
      COMPANY_NAME: 'DynamicBrand',
    }),
    getSupportEmailDomain: vi.fn().mockResolvedValue('smmflux.ru'),
    isTestMode: vi.fn().mockResolvedValue(false),
  }
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('UnifiedPaymentService', () => {
  let originalNodeEnv: string | undefined;
  let originalAppUrl: string | undefined;
  let originalWebappUrl: string | undefined;
  let originalNextPublicAppUrl: string | undefined;
  let originalBaseUrl: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    originalAppUrl = process.env.APP_URL;
    originalWebappUrl = process.env.WEBAPP_URL;
    originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    originalBaseUrl = process.env.BASE_URL;

    process.env.NEXT_PUBLIC_APP_URL = 'https://smmflux.ru';
    delete process.env.APP_URL;
    delete process.env.WEBAPP_URL;
    delete process.env.BASE_URL;

    global.fetch = vi.fn();
    (process.env as any).NODE_ENV = 'production';
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalAppUrl !== undefined) process.env.APP_URL = originalAppUrl; else delete process.env.APP_URL;
    if (originalWebappUrl !== undefined) process.env.WEBAPP_URL = originalWebappUrl; else delete process.env.WEBAPP_URL;
    if (originalNextPublicAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl; else delete process.env.NEXT_PUBLIC_APP_URL;
    if (originalBaseUrl !== undefined) process.env.BASE_URL = originalBaseUrl; else delete process.env.BASE_URL;
  });

  it('YooKassa gateway uses dynamic brand domain for success return_url', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL; // Force fallback to supportDomain
    delete process.env.APP_URL;
    delete process.env.WEBAPP_URL;
    delete process.env.BASE_URL;

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'remote-1',
        confirmation: { confirmation_url: 'https://yookassa.ru/pay' }
      })
    });

    const result = await UnifiedPaymentService.createPayment(
      undefined, 'user1', 500, 'Test Deposit', {}, 'yookassa'
    );

    expect(result.success).toBe(true);
    
    // Check fetch call to ensure return_url used dynamic domain
    const fetchArgs = (global.fetch as any).mock.calls[0];
    const payload = JSON.parse(fetchArgs[1].body);
    expect(payload.confirmation.return_url).toBe('https://smmflux.ru/dashboard');
  });

  it('CryptoBot gateway uses dynamic brand name for hidden_message', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          invoice_id: 'invoice-1',
          pay_url: 'https://pay.crypt.bot/pay'
        }
      })
    });

    const result = await UnifiedPaymentService.createPayment(
      undefined, 'user1', 500, 'Test Deposit', {}, 'cryptobot'
    );

    expect(result.success).toBe(true);

    // Check fetch call to ensure hidden_message contains the dynamic brand
    const fetchArgs = (global.fetch as any).mock.calls[0];
    const payload = JSON.parse(fetchArgs[1].body);
    expect(payload.hidden_message).toBe('DynamicBrand Deposit');
  });
});
