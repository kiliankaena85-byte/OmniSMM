import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailableGatewaysAction } from '@/actions/order/checkout';
import { PaymentGatewayFactory, BasePaymentGateway } from '@/services/financial/payment-gateway.service';
import { SettingsProvider } from '@/lib/settings';
import { db } from '@/lib/db';

describe('Payment System Deep Audit & Dynamic Gateway Filtering E2E', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Dynamic Gateway Availability Filtering', () => {
    it('only returns active gateways when unconfigured gateways have dummy or missing credentials', async () => {
      // Mock settings where YooKassa is configured, but Robokassa and CryptoBot have dummy/missing keys
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '1155075',
        yookassaSecretKey: 'test_Bz5eSTzvWGA92wbksyOApJbxi-sfJ67LLgMTZSSOulA',
        robokassaLogin: '',
        robokassaPassword: '',
        robokassaWebhookPassword: '',
        yookassaWebhookSecret: '',
        cryptoBotToken: 'test_bot_token', // dummy token
      });
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(true);

      const result = await getAvailableGatewaysAction();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.yookassa).toBe(true);
      expect(typeof result.data?.sbp).toBe('boolean');
      expect(result.data?.robokassa).toBe(false);
      expect(result.data?.cryptobot).toBe(false);
      expect(typeof result.data?.api).toBe('boolean');
    });

    it('identifies valid Robokassa and CryptoBot when actual production/test credentials are provided', async () => {
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '1155075',
        yookassaSecretKey: 'live_secret_key_12345',
        robokassaLogin: 'merchant_live_login',
        robokassaPassword: 'merchant_live_password',
        robokassaWebhookPassword: 'merchant_webhook_pass',
        yookassaWebhookSecret: 'wh_secret_123',
        cryptoBotToken: '12345:AAH_real_cryptobot_token_abc',
      });
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const result = await getAvailableGatewaysAction();

      expect(result.success).toBe(true);
      expect(result.data?.yookassa).toBe(true);
      expect(result.data?.robokassa).toBe(true);
      expect(result.data?.cryptobot).toBe(true);
    });

    it('strictly marks all external gateways false when all secrets are missing or placeholder', async () => {
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: 'test_shop_id',
        yookassaSecretKey: 'test_secret',
        robokassaLogin: 'test_login',
        robokassaPassword: '',
        robokassaWebhookPassword: '',
        yookassaWebhookSecret: '',
        cryptoBotToken: 'test_token',
      });

      const result = await getAvailableGatewaysAction();

      expect(result.success).toBe(true);
      expect(result.data?.yookassa).toBe(false);
      expect(result.data?.robokassa).toBe(false);
      expect(result.data?.cryptobot).toBe(false);
      expect(typeof result.data?.api).toBe('boolean');
    });
  });

  describe('2. Gateway Invocation & Fail-Closed Protection', () => {
    it('throws clear descriptive error when calling unconfigured Robokassa', async () => {
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '1155075',
        yookassaSecretKey: 'valid_key',
        robokassaLogin: '',
        robokassaPassword: '',
        robokassaWebhookPassword: '',
        yookassaWebhookSecret: '',
        cryptoBotToken: '',
      });

      const roboGateway = PaymentGatewayFactory.getGateway('robokassa');
      await expect(roboGateway.createPayment({
        paymentId: 'pay_test_1',
        userId: 'user_1',
        amountRub: 500,
        email: 'test@example.com',
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Test payment'
      })).rejects.toThrow(/Робокасса не настроен/i);
    });

    it('throws clear descriptive error when calling unconfigured CryptoBot', async () => {
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '1155075',
        yookassaSecretKey: 'valid_key',
        robokassaLogin: '',
        robokassaPassword: '',
        robokassaWebhookPassword: '',
        yookassaWebhookSecret: '',
        cryptoBotToken: '',
      });

      const cryptoGateway = PaymentGatewayFactory.getGateway('cryptobot');
      await expect(cryptoGateway.createPayment({
        paymentId: 'pay_test_2',
        userId: 'user_1',
        amountRub: 500,
        email: 'test@example.com',
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Test payment'
      })).rejects.toThrow(/CryptoBot не настроен/i);
    });

    it('generates a valid external Robokassa URL when real credentials are configured', async () => {
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '',
        yookassaSecretKey: '',
        robokassaLogin: 'my_merchant_login',
        robokassaPassword: 'my_merchant_pass_1',
        robokassaWebhookPassword: 'my_merchant_webhook_pass',
        yookassaWebhookSecret: '',
        cryptoBotToken: '',
      });
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const roboGateway = PaymentGatewayFactory.getGateway('robokassa');
      const res = await roboGateway.createPayment({
        paymentId: 'pay_test_3',
        userId: 'user_1',
        amountRub: 1500,
        email: '  test@example.com  ',
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Оплата услуг'
      });

      expect(res.paymentUrl).toContain('https://auth.robokassa.ru/Merchant/Index.aspx?');
      expect(res.paymentUrl).toContain('MerchantLogin=my_merchant_login');
      expect(res.paymentUrl).toContain('OutSum=1500.00');
      expect(res.paymentUrl).toContain('shp_paymentId=pay_test_3');
      expect(res.paymentUrl).not.toContain('/payment-redirect');

      const parsedUrl = new URL(res.paymentUrl);
      expect(parsedUrl.searchParams.get('Email')).toBe('test@example.com');
      const parsedReceipt = JSON.parse(parsedUrl.searchParams.get('Receipt') || '{}');
      expect(parsedReceipt.client).toEqual({ email: 'test@example.com' });
      expect(parsedReceipt.items).toHaveLength(1);
      expect(parsedReceipt.items[0].sum).toBe('1500.00');
    });

    it('omits client email block from Robokassa receipt and queryParams when email is empty or whitespace', async () => {
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '',
        yookassaSecretKey: '',
        robokassaLogin: 'my_merchant_login',
        robokassaPassword: 'my_merchant_pass_1',
        robokassaWebhookPassword: 'my_merchant_webhook_pass',
        yookassaWebhookSecret: '',
        cryptoBotToken: '',
      });
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const roboGateway = PaymentGatewayFactory.getGateway('robokassa');
      const res = await roboGateway.createPayment({
        paymentId: 'pay_test_no_email',
        userId: 'user_1',
        amountRub: 500,
        email: '   ',
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Оплата без email'
      });

      const parsedUrl = new URL(res.paymentUrl);
      expect(parsedUrl.searchParams.has('Email')).toBe(false);
      const parsedReceipt = JSON.parse(parsedUrl.searchParams.get('Receipt') || '{}');
      expect(parsedReceipt.client).toBeUndefined();
      expect(parsedReceipt.items).toHaveLength(1);
    });

    it('omits client email block and Email queryParam when email is null, undefined, or non-string', async () => {
      vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockResolvedValue({
        yookassaShopId: '',
        yookassaSecretKey: '',
        robokassaLogin: 'my_merchant_login',
        robokassaPassword: 'my_merchant_pass_1',
        robokassaWebhookPassword: 'my_merchant_webhook_pass',
        yookassaWebhookSecret: '',
        cryptoBotToken: '',
      });
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const roboGateway = PaymentGatewayFactory.getGateway('robokassa');

      // 1. null email
      const resNull = await roboGateway.createPayment({
        paymentId: 'pay_test_null_email',
        userId: 'user_1',
        amountRub: 500,
        email: null,
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Оплата с null email'
      });
      const urlNull = new URL(resNull.paymentUrl);
      expect(urlNull.searchParams.has('Email')).toBe(false);
      expect(JSON.parse(urlNull.searchParams.get('Receipt') || '{}').client).toBeUndefined();

      // 2. undefined / omitted email
      const resUndef = await roboGateway.createPayment({
        paymentId: 'pay_test_undef_email',
        userId: 'user_1',
        amountRub: 500,
        email: undefined as unknown as string,
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Оплата с undefined email'
      });
      const urlUndef = new URL(resUndef.paymentUrl);
      expect(urlUndef.searchParams.has('Email')).toBe(false);
      expect(JSON.parse(urlUndef.searchParams.get('Receipt') || '{}').client).toBeUndefined();

      // 3. non-string email (defensive runtime protection against invalid data)
      const resNonStr = await roboGateway.createPayment({
        paymentId: 'pay_test_num_email',
        userId: 'user_1',
        amountRub: 500,
        email: 12345 as unknown as string,
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Оплата с non-string email'
      });
      const urlNonStr = new URL(resNonStr.paymentUrl);
      expect(urlNonStr.searchParams.has('Email')).toBe(false);
      expect(JSON.parse(urlNonStr.searchParams.get('Receipt') || '{}').client).toBeUndefined();
    });
  });

  describe('3. Payment Redirection Protection & Zero Infinite Loops', () => {
    it('verifies that mock or unconfigured gateways never return self-referencing /payment-redirect loops', async () => {
      const mockGateway = PaymentGatewayFactory.getGateway('mock');
      const res = await mockGateway.createPayment({
        paymentId: 'pay_test_mock',
        userId: 'user_1',
        amountRub: 100,
        email: 'test@example.com',
        successUrl: 'http://localhost:3000/dashboard',
        description: 'Mock'
      });

      // The returned URL must NOT point to /payment-redirect
      expect(res.paymentUrl).not.toContain('/payment-redirect');
    });
  });
});
