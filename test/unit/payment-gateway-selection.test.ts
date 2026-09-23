import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { VaultService } from '@/lib/vault';

describe('Payment Gateway Selection & Credential Fallback (R2)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let targetTenantId = 'smmplan';
  
  const testParams = {
    paymentId: 'pay-test-123',
    userId: 'usr-test-123',
    amountRub: 150.00,
    email: 'client@example.com',
    successUrl: 'https://smmplan.pro/success',
    description: 'Balance Top-up'
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const resolved = await SettingsProvider.resolveTenantRecordId('smmplan');
    if (resolved) targetTenantId = resolved;
    
    // Reset DB settings to clean defaults before each test
    await db.systemSettings.upsert({
      where: { id: targetTenantId },
      update: {
        yookassaShopId: null,
        yookassaSecretKey: null,
        yookassaTestShopId: null,
        yookassaTestSecretKey: null,
        robokassaLogin: null,
        robokassaPassword: null,
        cryptoBotToken: null,
        isTestMode: false,
      },
      create: {
        id: targetTenantId,
        taxRate: 6.0,
        opexMonthly: 0,
        maintenanceMode: false,
        isTestMode: false,
        siteName: 'Smmplan',
        exchangeRateUSD: 95.0
      }
    });
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  describe('YooKassa Gateway fallback and real call', () => {
    it('should fall back to mock-payment URL when credentials are dummy', async () => {
      // 1. Seed dummy credentials
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          yookassaShopId: 'test_shop_id',
          yookassaSecretKey: VaultService.encrypt('test_secret'),
        }
      });

      // Mock production node env
      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const gateway = PaymentGatewayFactory.getGateway('yookassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('/api/dev/mock-payment');
      expect(result.remoteGatewayId).toContain('mock_');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should fall back to mock-payment URL when credentials are empty/null', async () => {
      // 1. Seed null credentials
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          yookassaShopId: null,
          yookassaSecretKey: null,
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const gateway = PaymentGatewayFactory.getGateway('yookassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('/api/dev/mock-payment');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should make real API request when non-dummy credentials are configured', async () => {
      // 1. Seed real credentials
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          yookassaShopId: 'real_shop_123',
          yookassaSecretKey: VaultService.encrypt('real_secret_key_abc'),
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      // Mock successful YooKassa API response
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          confirmation: { confirmation_url: 'https://confirmation-yookassa-url' },
          id: 'yoo_remote_id_123'
        })
      } as any);

      const gateway = PaymentGatewayFactory.getGateway('yookassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toBe('https://confirmation-yookassa-url');
      expect(result.remoteGatewayId).toBe('yoo_remote_id_123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Basic ' + Buffer.from('real_shop_123:real_secret_key_abc').toString('base64')
          })
        })
      );
    });

    it('should fall back to Sandbox/Test keys when production credentials are dummy but test keys are configured', async () => {
      // 1. Seed dummy production credentials but real test/sandbox credentials
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          yookassaShopId: 'test_shop_id',
          yookassaSecretKey: VaultService.encrypt('test_secret'),
          yookassaTestShopId: 'sandbox_shop_555',
          yookassaTestSecretKey: VaultService.encrypt('sandbox_secret_999'),
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          confirmation: { confirmation_url: 'https://sandbox-yookassa-url' },
          id: 'sandbox_remote_id_555'
        })
      } as any);

      const gateway = PaymentGatewayFactory.getGateway('yookassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toBe('https://sandbox-yookassa-url');
      expect(result.remoteGatewayId).toBe('sandbox_remote_id_555');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.yookassa.ru/v3/payments',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Basic ' + Buffer.from('sandbox_shop_555:sandbox_secret_999').toString('base64')
          })
        })
      );
    });
  });

  describe('Robokassa Gateway fallback and URL construction', () => {
    it('should fall back to mock-payment URL when credentials are dummy', async () => {
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          robokassaLogin: 'test_login',
          robokassaPassword: VaultService.encrypt('test_pass'),
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const gateway = PaymentGatewayFactory.getGateway('robokassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('/api/dev/mock-payment');
    });

    it('should fall back to mock-payment URL when credentials are empty/null', async () => {
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          robokassaLogin: null,
          robokassaPassword: null,
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const gateway = PaymentGatewayFactory.getGateway('robokassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('/api/dev/mock-payment');
    });

    it('should construct correct redirect URL when non-dummy credentials are configured', async () => {
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          robokassaLogin: 'real_robo_login',
          robokassaPassword: VaultService.encrypt('real_robo_password'),
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const gateway = PaymentGatewayFactory.getGateway('robokassa');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('https://auth.robokassa.ru/Merchant/Index.aspx');
      expect(result.paymentUrl).toContain('MerchantLogin=real_robo_login');
      expect(result.paymentUrl).toContain('shp_paymentId=pay-test-123');
    });
  });

  describe('CryptoBot Gateway fallback and real call', () => {
    it('should fall back to mock-payment URL when credentials are dummy', async () => {
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          cryptoBotToken: VaultService.encrypt('test_token'),
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const gateway = PaymentGatewayFactory.getGateway('cryptobot');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('/api/dev/mock-payment');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should fall back to mock-payment URL when credentials are empty/null', async () => {
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          cryptoBotToken: null,
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const gateway = PaymentGatewayFactory.getGateway('cryptobot');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toContain('/api/dev/mock-payment');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should make real API request when non-dummy credentials are configured', async () => {
      await db.systemSettings.update({
        where: { id: targetTenantId },
        data: {
          cryptoBotToken: VaultService.encrypt('real_crypto_token_val'),
        }
      });

      (process.env as any).NODE_ENV = 'production';
      vi.spyOn(SettingsProvider, 'isTestEnvironment').mockReturnValue(false);
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          result: {
            pay_url: 'https://t.me/CryptoBot?start=pay_invoice_123',
            invoice_id: 112233
          }
        })
      } as any);

      const gateway = PaymentGatewayFactory.getGateway('cryptobot');
      const result = await gateway.createPayment(testParams);

      expect(result.paymentUrl).toBe('https://t.me/CryptoBot?start=pay_invoice_123');
      expect(result.remoteGatewayId).toBe('112233');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://pay.crypt.bot/api/createInvoice',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Crypto-Pay-API-Token': 'real_crypto_token_val'
          })
        })
      );
    });
  });
});
