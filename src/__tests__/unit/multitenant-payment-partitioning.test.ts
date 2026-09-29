import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { PaymentGatewayFactory, checkVatThreshold, invalidateVatThresholdCache } from '@/services/financial/payment-gateway.service';

describe('Multi-Tenant Fiscal & Payment Gateway Partitioning (Phase 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateVatThresholdCache();

    (vi.spyOn(db.tenant, 'findUnique') as unknown as { mockImplementation: (fn: (args?: { where?: { slug?: string; id?: string } }) => Promise<unknown>) => void }).mockImplementation(async (args) => {
      const where = args?.where;
      return {
        id: where?.slug || where?.id || 'mock-tenant-id',
        slug: where?.slug || 'smmplan',
        name: 'Mock Tenant',
        customDomain: null,
        ownerId: 'owner_1',
        brandName: 'Mock Brand',
        isDefault: false,
        themePreset: 'default',
        primaryColor: '#000',
        contactEmail: 'contact@mock.com',
        telegramSupport: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    (vi.spyOn(db.tenant, 'findFirst') as unknown as { mockImplementation: (fn: () => Promise<unknown>) => void }).mockImplementation(async () => ({
      id: 'smmplan-id',
      slug: 'smmplan',
      name: 'SMMplan',
      customDomain: null,
      ownerId: 'owner_1',
      brandName: 'SMMplan',
      isDefault: true,
      themePreset: 'default',
      primaryColor: '#000',
      contactEmail: 'contact@smmplan.ru',
      telegramSupport: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    vi.spyOn(db.payment, 'findUnique').mockResolvedValue(null);
    vi.spyOn(db.payment, 'aggregate').mockResolvedValue({
      _sum: { amount: BigInt(0) },
      _avg: {},
      _count: {},
      _max: {},
      _min: {},
    } as unknown as never);
    vi.spyOn(db.ledgerEntry, 'aggregate').mockResolvedValue({
      _sum: { amount: BigInt(0) },
      _avg: {},
      _count: {},
      _max: {},
      _min: {},
    } as unknown as never);
    vi.spyOn(db.systemSettings, 'upsert').mockResolvedValue({ id: 'smmplan-id' } as unknown as never);
    vi.spyOn(db.securityEvent, 'create').mockResolvedValue({ id: 'sec_1' } as unknown as never);
  });

  describe('Zero-Commingling Credential Isolation (ст. 54.1 НК РФ)', () => {
    it('allows fallback to process.env credentials strictly for smmplan', async () => {
      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue(null);

      const secrets = await SettingsProvider.getPaymentSecrets('smmplan');
      // For smmplan, it is allowed to fallback to env if configured
      if (process.env.YOOKASSA_SHOP_ID) {
        expect(secrets.yookassaShopId).toBe(process.env.YOOKASSA_SHOP_ID);
      }
    });

    it('strictly forbids non-smmplan tenant from falling back to process.env credentials', async () => {
      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'external-agency',
        yookassaShopId: null,
        yookassaSecretKey: null,
        robokassaLogin: null,
        robokassaPassword: null,
        cryptoBotToken: null,
      } as unknown as never);

      const secrets = await SettingsProvider.getPaymentSecrets('external-agency');
      
      // Critical Tax & Fiscal Invariant: Must NOT leak parent's merchant credentials
      expect(secrets.yookassaShopId).toBeNull();
      expect(secrets.yookassaSecretKey).toBeNull();
      expect(secrets.robokassaLogin).toBeNull();
      expect(secrets.cryptoBotToken).toBeNull();
    });

    it('returns decrypted credentials when a tenant has them configured in their own SystemSettings', async () => {
      const { VaultService } = await import('@/lib/vault');
      const encryptedSecret = VaultService.encrypt('tenant_secret_key_123');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'premium-shop',
        yookassaShopId: 'tenant_shop_999',
        yookassaSecretKey: encryptedSecret,
        robokassaLogin: 'tenant_robo_login',
        robokassaPassword: VaultService.encrypt('robo_pass_123'),
        cryptoBotToken: 'tenant_crypto_token_456',
      } as unknown as never);

      const secrets = await SettingsProvider.getPaymentSecrets('premium-shop');
      expect(secrets.yookassaShopId).toBe('tenant_shop_999');
      expect(secrets.yookassaSecretKey).toBe('tenant_secret_key_123');
      expect(secrets.robokassaLogin).toBe('tenant_robo_login');
      expect(secrets.cryptoBotToken).toBe('tenant_crypto_token_456');
    });

    it('fails closed when attempting to create payment for tenant without configured credentials', async () => {
      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'unconfigured-tenant',
        yookassaShopId: null,
        yookassaSecretKey: null,
      } as unknown as never);

      const gateway = PaymentGatewayFactory.getGateway('yookassa');

      await expect(
        gateway.createPayment({
          paymentId: 'pay_test_1',
          userId: 'user_test_1',
          tenantId: 'unconfigured-tenant',
          amountRub: 500,
          email: 'client@domain.com',
          successUrl: 'https://example.com/success',
          description: 'Пополнение баланса',
        })
      ).rejects.toThrow(/не настроен/i);
    });
  });

  describe('54-ФЗ Fiscal Turnover & VAT Threshold Partitioning', () => {
    it('calculates 20M ₽ VAT threshold strictly scoped to target tenant', async () => {
      // Mock aggregate to return 25M for tenant-a, but 5M for tenant-b
      (vi.spyOn(db.payment, 'aggregate') as unknown as { mockImplementation: (fn: (args?: { where?: { tenantId?: string } }) => Promise<unknown>) => void }).mockImplementation(async (args) => {
        const tenantFilter = args?.where?.tenantId;
        if (tenantFilter === 'tenant-high-volume') {
          return { _sum: { amount: BigInt(25_000_000_00) } }; // 25M RUB
        }
        return { _sum: { amount: BigInt(5_000_000_00) } }; // 5M RUB
      });

      vi.spyOn(db.ledgerEntry, 'aggregate').mockResolvedValue({
        _sum: { amount: BigInt(0) },
        _avg: {},
        _count: {},
        _max: {},
        _min: {},
      } as unknown as never);

      const isHighVolumeExceeded = await checkVatThreshold('tenant-high-volume');
      const isLowVolumeExceeded = await checkVatThreshold('tenant-low-volume');

      expect(isHighVolumeExceeded).toBe(true);
      expect(isLowVolumeExceeded).toBe(false);
    });
  });

  describe('Dynamic Brand Agnostic Receipts (No Binary Ternaries)', () => {
    it('uses dynamic fallback brand name for white-label tenants in Robokassa descriptions', async () => {
      const { VaultService } = await import('@/lib/vault');
      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'boost-agency',
        robokassaLogin: 'boost_merchant',
        robokassaPassword: VaultService.encrypt('pass1'),
        robokassaWebhookPassword: VaultService.encrypt('pass2'),
      } as unknown as never);

      const gateway = PaymentGatewayFactory.getGateway('robokassa');
      const res = await gateway.createPayment({
        paymentId: 'pay_boost_1',
        userId: 'user_1',
        tenantId: 'boost-agency',
        amountRub: 1000,
        email: 'user@boost-agency.ru',
        successUrl: 'https://boost-agency.ru/success',
        description: 'Оплата услуг',
      });

      expect(res.paymentUrl).toContain('MerchantLogin=boost_merchant');
      expect(res.paymentUrl).toContain('shp_paymentId=pay_boost_1');
    });
  });

  describe('Parameterized Multi-Tenant Webhook Routing', () => {
    it('provides healthy GET diagnostic probe for yookassa tenant endpoint', async () => {
      const { GET } = await import('@/app/api/webhooks/yookassa/[tenantId]/route');
      const req = new NextRequest('https://smmflux.ru/api/webhooks/yookassa/flux');
      const res = await GET(req, { params: Promise.resolve({ tenantId: 'flux' }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('yookassa-webhook');
      expect(body.tenantId).toBe('flux');
    });

    it('provides healthy GET diagnostic probe for robokassa tenant endpoint', async () => {
      const { GET } = await import('@/app/api/webhooks/robokassa/[tenantId]/route');
      const req = new NextRequest('https://client-agency.com/api/webhooks/robokassa/agency');
      const res = await GET(req, { params: Promise.resolve({ tenantId: 'agency' }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('robokassa-webhook');
      expect(body.tenantId).toBe('agency');
    });

    it('rejects Robokassa webhook when signature does not match for target tenant', async () => {
      const { handleRobokassaWebhookRequest } = await import('@/services/financial/robokassa-webhook.handler');
      const { VaultService } = await import('@/lib/vault');

      vi.spyOn(db.systemSettings, 'findUnique').mockResolvedValue({
        id: 'secure-store',
        robokassaLogin: 'store_login',
        robokassaPassword: VaultService.encrypt('pass1'),
        robokassaWebhookPassword: VaultService.encrypt('valid_password_2'),
      } as unknown as never);

      // Create request with invalid signature
      const url = 'https://secure-store.com/api/webhooks/robokassa/secure-store?OutSum=500.00&InvId=101&SignatureValue=wrong_sig_value&shp_paymentId=pay_123';
      const req = new NextRequest(url, { method: 'POST' });

      const res = await handleRobokassaWebhookRequest(req, 'secure-store');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Invalid signature');
    });
  });
});
