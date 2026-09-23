import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';
import { SettingsProvider } from '@/lib/settings';
import { VaultService } from '@/lib/vault';
import { db } from '@/lib/db';
import crypto from 'crypto';

describe('Payment Gateways Integration Tests', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    // Unstub globals for integration tests to start clean
    vi.unstubAllGlobals();

    // Ensure we start with clean settings rows
    await db.systemSettings.updateMany({
      data: {
        isTestMode: false,
        yookassaShopId: null,
        yookassaSecretKey: null,
        yookassaTestShopId: null,
        yookassaTestSecretKey: null,
        cryptoBotToken: null,
        robokassaLogin: null,
        robokassaPassword: null,
        robokassaWebhookPassword: null
      }
    });
  });

  afterEach(() => {
    // Restore environment and mocks
    (process.env as any).NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('Test Case 1: Empty/Default Credentials Fallback', () => {
    it('should fallback to mock payment URLs when credentials are empty or contain default placeholders', async () => {
      // Configure default placeholders and empty values in database settings
      await db.systemSettings.updateMany({
        data: {
          yookassaShopId: 'test_shop_id',
          yookassaSecretKey: VaultService.encrypt('test_secret'),
          robokassaLogin: 'test_login',
          robokassaPassword: VaultService.encrypt('test_password'),
          cryptoBotToken: null,
        }
      });

      // Force NODE_ENV to production to verify that dummy credentials trigger mock URL fallback even in "production"
      (process.env as any).NODE_ENV = 'production';

      const yookassa = PaymentGatewayFactory.getGateway('yookassa');
      const robokassa = PaymentGatewayFactory.getGateway('robokassa');
      const cryptobot = PaymentGatewayFactory.getGateway('cryptobot');

      const params = {
        paymentId: 'pay_123',
        userId: 'usr_123',
        amountRub: 100.0,
        email: 'user@example.com',
        successUrl: 'http://localhost:3000/success',
        description: 'Test payment description',
        isTestMode: false
      };

      // YooKassa has dummy keys -> returns mock URL
      const yooResult = await yookassa.createPayment(params);
      expect(yooResult.paymentUrl).toContain('/api/dev/mock-payment');
      expect(yooResult.paymentUrl).toContain('paymentId=pay_123');
      expect(yooResult.remoteGatewayId.startsWith('mock_')).toBe(true);

      // Robokassa has dummy keys -> returns mock URL
      const roboResult = await robokassa.createPayment(params);
      expect(roboResult.paymentUrl).toContain('/api/dev/mock-payment');
      expect(roboResult.paymentUrl).toContain('paymentId=pay_123');
      expect(roboResult.remoteGatewayId.startsWith('mock_')).toBe(true);

      // CryptoBot is not configured (token is null) -> returns mock URL
      const cryptoResult = await cryptobot.createPayment(params);
      expect(cryptoResult.paymentUrl).toContain('/api/dev/mock-payment');
      expect(cryptoResult.paymentUrl).toContain('paymentId=pay_123');
      expect(cryptoResult.remoteGatewayId.startsWith('mock_')).toBe(true);
    });
  });

  describe('Test Case 2: Configured Keys Execution', () => {
    it('should call real APIs and build correct payloads when valid keys are configured', async () => {
      // 1. Set up valid non-default credentials in database settings
      await db.systemSettings.updateMany({
        data: {
          yookassaShopId: 'real_shop_id',
          yookassaSecretKey: VaultService.encrypt('real_secret_key'),
          yookassaTestShopId: 'real_test_shop_id',
          yookassaTestSecretKey: VaultService.encrypt('real_test_secret_key'),
          robokassaLogin: 'real_login',
          robokassaPassword: VaultService.encrypt('real_password'),
          cryptoBotToken: VaultService.encrypt('real_cryptobot_token'),
        }
      });

      // Force NODE_ENV to production to avoid E2E-tester mocks and invoke real requests
      (process.env as any).NODE_ENV = 'production';

      const params = {
        paymentId: 'pay_456',
        userId: 'usr_456',
        amountRub: 150.5,
        email: 'user@example.com',
        successUrl: 'http://localhost:3000/success',
        description: 'Test payment description',
        isTestMode: false
      };

      // ── A. YooKassa Gateway ──
      const mockYooKassaResponse = {
        confirmation: { confirmation_url: 'https://yookassa.ru/confirmation-page-456' },
        id: 'yoo_remote_id_456'
      };

      const mockYooFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockYooKassaResponse
      });

      vi.stubGlobal('fetch', mockYooFetch);

      const yookassa = PaymentGatewayFactory.getGateway('yookassa');
      const yooResult = await yookassa.createPayment(params);

      expect(yooResult.paymentUrl).toBe('https://yookassa.ru/confirmation-page-456');
      expect(yooResult.remoteGatewayId).toBe('yoo_remote_id_456');

      // Assert fetch was called correctly
      expect(mockYooFetch).toHaveBeenCalledTimes(1);
      const [yooUrl, yooInit] = mockYooFetch.mock.calls[0];
      expect(yooUrl).toBe('https://api.yookassa.ru/v3/payments');
      expect(yooInit.method).toBe('POST');
      
      // Authorization header basic auth should correspond to test keys (as we are in test environment, isTestMode() returns true)
      const expectedYooAuth = 'Basic ' + Buffer.from('real_test_shop_id:real_test_secret_key').toString('base64');
      expect(yooInit.headers.Authorization).toBe(expectedYooAuth);

      const yooPayload = JSON.parse(yooInit.body);
      expect(yooPayload.amount).toEqual({ value: '150.50', currency: 'RUB' });
      expect(yooPayload.capture).toBe(true);
      expect(yooPayload.confirmation).toEqual({ type: 'redirect', return_url: params.successUrl });
      expect(yooPayload.description).toBe(params.description);
      expect(yooPayload.metadata.paymentId).toBe(params.paymentId);
      expect(yooPayload.metadata.userId).toBe(params.userId);

      // ── B. CryptoBot Gateway ──
      const mockCryptoBotResponse = {
        ok: true,
        result: {
          pay_url: 'https://t.me/CryptoBot?start=pay_456',
          invoice_id: 123456
        }
      };

      const mockCryptoFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCryptoBotResponse
      });

      vi.stubGlobal('fetch', mockCryptoFetch);

      const cryptobot = PaymentGatewayFactory.getGateway('cryptobot');
      const cryptoResult = await cryptobot.createPayment(params);

      expect(cryptoResult.paymentUrl).toBe('https://t.me/CryptoBot?start=pay_456');
      expect(cryptoResult.remoteGatewayId).toBe('123456');

      // Assert fetch was called correctly
      expect(mockCryptoFetch).toHaveBeenCalledTimes(1);
      const [cryptoUrl, cryptoInit] = mockCryptoFetch.mock.calls[0];
      expect(cryptoUrl).toBe('https://pay.crypt.bot/api/createInvoice');
      expect(cryptoInit.method).toBe('POST');
      expect(cryptoInit.headers['Crypto-Pay-API-Token']).toBe('real_cryptobot_token');

      const cryptoPayload = JSON.parse(cryptoInit.body);
      expect(cryptoPayload.currency_type).toBe('fiat');
      expect(cryptoPayload.fiat).toBe('RUB');
      expect(cryptoPayload.amount).toBe('150.50');
      expect(cryptoPayload.description).toBe(params.description);
      expect(cryptoPayload.payload).toBe(params.paymentId);

      // ── C. Robokassa Gateway ──
      const robokassa = PaymentGatewayFactory.getGateway('robokassa');
      const roboResult = await robokassa.createPayment(params);

      expect(roboResult.paymentUrl).toBeDefined();
      expect(roboResult.paymentUrl.startsWith('https://auth.robokassa.ru/Merchant/Index.aspx')).toBe(true);

      const parsedUrl = new URL(roboResult.paymentUrl);
      expect(parsedUrl.searchParams.get('MerchantLogin')).toBe('real_login');
      expect(parsedUrl.searchParams.get('OutSum')).toBe('150.50');
      expect(parsedUrl.searchParams.get('InvId')).toBe('0');
      expect(parsedUrl.searchParams.get('Description')).toBe(params.description);
      expect(parsedUrl.searchParams.get('shp_paymentId')).toBe(params.paymentId);

      // Robokassa signature formula: MerchantLogin:OutSum:InvId:MerchantPassword1:shp_paymentId=paymentId
      const expectedSigStr = `real_login:150.50:0:real_password:shp_paymentId=${params.paymentId}`;
      const expectedSignature = crypto.createHash('sha256').update(expectedSigStr).digest('hex');
      expect(parsedUrl.searchParams.get('SignatureValue')).toBe(expectedSignature);
    });
  });

  describe('Test Case 3: Test Keys Fallback', () => {
    it('should fallback to test credentials when production keys contain placeholders in production-like environment', async () => {
      // 1. Configure settings where production keys are placeholders, but test keys are non-default
      await db.systemSettings.updateMany({
        data: {
          yookassaShopId: 'test_shop_id',
          yookassaSecretKey: VaultService.encrypt('test_secret'),
          yookassaTestShopId: 'real_test_shop_id',
          yookassaTestSecretKey: VaultService.encrypt('real_test_secret_key')
        }
      });

      // Mock isTestMode to return false to simulate production environment
      const isTestModeSpy = vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      // Force NODE_ENV to production so the gateway doesn't E2E mock
      (process.env as any).NODE_ENV = 'production';

      const mockYooKassaResponse = {
        confirmation: { confirmation_url: 'https://yookassa.ru/confirmation-fallback-789' },
        id: 'yoo_remote_id_789'
      };

      const mockYooFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockYooKassaResponse
      });

      vi.stubGlobal('fetch', mockYooFetch);

      const params = {
        paymentId: 'pay_789',
        userId: 'usr_789',
        amountRub: 200.0,
        email: 'user@example.com',
        successUrl: 'http://localhost:3000/success',
        description: 'Test payment description',
        isTestMode: false
      };

      const yookassa = PaymentGatewayFactory.getGateway('yookassa');
      const yooResult = await yookassa.createPayment(params);

      expect(yooResult.paymentUrl).toBe('https://yookassa.ru/confirmation-fallback-789');
      expect(yooResult.remoteGatewayId).toBe('yoo_remote_id_789');

      expect(mockYooFetch).toHaveBeenCalledTimes(1);
      const [yooUrl, yooInit] = mockYooFetch.mock.calls[0];
      expect(yooUrl).toBe('https://api.yookassa.ru/v3/payments');

      // The settings manager should automatically fallback to the test credentials.
      // Basic auth should use real_test_shop_id:real_test_secret_key.
      const expectedYooAuth = 'Basic ' + Buffer.from('real_test_shop_id:real_test_secret_key').toString('base64');
      expect(yooInit.headers.Authorization).toBe(expectedYooAuth);

      isTestModeSpy.mockRestore();
    });
  });
});
