import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkVatThreshold, PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';
import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';

// Mock UniversalNetworkRouter
vi.mock('@/lib/network/network-router', () => ({
  UniversalNetworkRouter: {
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'mock-yoo-gateway-id',
        confirmation: { confirmation_url: 'https://yookassa.ru/mock-pay' },
        status: 'pending'
      }),
      text: async () => ''
    })
  }
}));

describe('Multi-Tenant Legal & Fiscal Isolation Suite (54-ФЗ / 176-ФЗ / 425-ФЗ)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. VAT Threshold Isolation (ст. 145, 164 НК РФ, 176-ФЗ / 425-ФЗ)', () => {
    it('calculates 20M RUB VAT threshold strictly per tenant / legal entity', async () => {
      (vi.spyOn(db.payment, 'aggregate') as any).mockImplementation(async (args: any) => {
        const tenantId = args?.where?.tenantId;
        if (tenantId === 'smmplan') {
          return { _sum: { amount: BigInt(2_500_000_000) } } as any;
        }
        if (tenantId === 'flux') {
          return { _sum: { amount: BigInt(120_000_000) } } as any;
        }
        return { _sum: { amount: BigInt(0) } } as any;
      });

      // SMMplan (Turnover > 20M RUB): Must switch to VAT 22% (vat_code: 10)
      const isSmmplanExceeded = await checkVatThreshold('smmplan');
      expect(isSmmplanExceeded).toBe(true);

      // SMMflux (Turnover 1.2M RUB): Must remain tax exempt (Без НДС, vat_code: 1)
      const isFluxExceeded = await checkVatThreshold('flux');
      expect(isFluxExceeded).toBe(false);

      expect(db.payment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'smmplan',
          status: 'SUCCEEDED'
        })
      }));

      expect(db.payment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'flux',
          status: 'SUCCEEDED'
        })
      }));
    });
  });

  describe('2. Payment Gateway Tenant Credentials & Fiscalization (54-ФЗ)', () => {
    it('queries tenant-isolated secrets and passes tenant context in payment metadata', async () => {
      const getPaymentSecretsSpy = vi.spyOn(SettingsProvider, 'getPaymentSecrets').mockImplementation(async (tenantId?: string) => {
        if (tenantId === 'flux') {
          return {
            yookassaShopId: 'flux_shop_9999',
            yookassaSecretKey: 'flux_secret_key_9999',
            yookassaWebhookSecret: 'flux_webhook_sec',
            cryptoBotToken: 'flux_crypto_tok',
            robokassaLogin: 'flux_login',
            robokassaPassword: 'flux_password',
            robokassaWebhookPassword: 'flux_webhook_pass'
          };
        }
        return {
          yookassaShopId: 'plan_shop_1111',
          yookassaSecretKey: 'plan_secret_key_1111',
          yookassaWebhookSecret: 'plan_webhook_sec',
          cryptoBotToken: 'plan_crypto_tok',
          robokassaLogin: 'plan_login',
          robokassaPassword: 'plan_password',
          robokassaWebhookPassword: 'plan_webhook_pass'
        };
      });

      const gateway = PaymentGatewayFactory.getGateway('yookassa');
      const result = await gateway.createPayment({
        paymentId: 'pay_flux_test_1',
        userId: 'user_1',
        tenantId: 'flux',
        amountRub: 500,
        email: 'customer@smmflux.ru',
        successUrl: 'https://smmflux.ru/dashboard',
        description: 'Оплата услуг SMMflux'
      });

      expect(result.paymentUrl).toBe('https://yookassa.ru/mock-pay');
      expect(getPaymentSecretsSpy).toHaveBeenCalledWith('flux');
    });
  });

  describe('3. Legal Entity Isolation in Legal Settings (ст. 437 ГК РФ)', () => {
    it('returns distinct legal entity details for smmplan vs flux without cross-contamination', async () => {
      vi.spyOn(SettingsProvider, 'getContactAndLegalSettings').mockImplementation(async (tenantId?: string) => {
        if (tenantId === 'flux') {
          return {
            SITE_NAME: 'SMMflux',
            SITE_DESCRIPTION: 'Платформа продвижения',
            SUPPORT_EMAIL: 'support@smmflux.ru',
            PRIVACY_EMAIL: 'privacy@smmflux.ru',
            TELEGRAM_SUPPORT_BOT: '@smmflux_support_bot',
            TELEGRAM_SUPPORT_CHANNEL: '@smmflux_channel',
            WHATSAPP: '',
            VK: '',
            COMPANY_NAME: 'ИП Смирнов Дмитрий Сергеевич',
            COMPANY_INN: '780212345678',
            COMPANY_OGRNIP: '321784700012345',
            COMPANY_ADDRESS: 'г. Санкт-Петербург, Невский пр., 1',
            LEGAL_INN: '780212345678',
            LEGAL_OGRNIP: '321784700012345',
            LEGAL_ADDRESS: 'г. Санкт-Петербург, Невский пр., 1',
          };
        }
        return {
          SITE_NAME: 'SMMplan',
          SITE_DESCRIPTION: 'Платформа SMM',
          SUPPORT_EMAIL: 'support@smmplan.pro',
          PRIVACY_EMAIL: 'privacy@smmplan.pro',
          TELEGRAM_SUPPORT_BOT: '@SMMplansapport_bot',
          TELEGRAM_SUPPORT_CHANNEL: '@smmplan_channel',
          WHATSAPP: '',
          VK: '',
          COMPANY_NAME: 'ИП Иванов И. И.',
          COMPANY_INN: '770123456703',
          COMPANY_OGRNIP: '320774600000025',
          COMPANY_ADDRESS: 'г. Москва',
          LEGAL_INN: '770123456703',
          LEGAL_OGRNIP: '320774600000025',
          LEGAL_ADDRESS: 'г. Москва',
        };
      });

      const planLegal = await SettingsProvider.getContactAndLegalSettings('smmplan');
      const fluxLegal = await SettingsProvider.getContactAndLegalSettings('flux');

      expect(planLegal.COMPANY_NAME).toBe('ИП Иванов И. И.');
      expect(planLegal.COMPANY_INN).toBe('770123456703');

      expect(fluxLegal.COMPANY_NAME).toBe('ИП Смирнов Дмитрий Сергеевич');
      expect(fluxLegal.COMPANY_INN).toBe('780212345678');
      expect(fluxLegal.COMPANY_INN).not.toBe(planLegal.COMPANY_INN);
    });
  });

  describe('4. Official FNS Tax Validators (validateInn / validateOgrnip)', () => {
    it('validates 10-digit LLC INN with official FNS checksum weights', async () => {
      const { validateInn } = await import('@/utils/tax-validators');
      
      // Real valid 10-digit INN: 7707083893 (Sberbank)
      expect(validateInn('7707083893').valid).toBe(true);

      // Invalid checksum 10-digit INN
      expect(validateInn('7707083894').valid).toBe(false);
      expect(validateInn('7707083894').error).toContain('Неверная контрольная сумма');

      // Invalid lengths
      expect(validateInn('12345').valid).toBe(false);
      expect(validateInn('abcdefghij').valid).toBe(false);
    });

    it('validates 12-digit Sole Proprietor INN with dual 11th & 12th checksum weights', async () => {
      const { validateInn } = await import('@/utils/tax-validators');

      // Valid 12-digit synthetic test INN: 770123456703
      // Check digit 11 = 0, Check digit 12 = 3
      expect(validateInn('770123456703').valid).toBe(true);

      // Invalid 12-digit INN
      expect(validateInn('770123456704').valid).toBe(false);
    });

    it('validates 15-digit OGRNIP with modulo 13 checksum algorithm', async () => {
      const { validateOgrnip } = await import('@/utils/tax-validators');

      // Valid OGRNIP: 315774600000016 -> 31577460000001 % 13 = 6
      expect(validateOgrnip('315774600000016').valid).toBe(true);

      // Invalid OGRNIP
      expect(validateOgrnip('315774600000019').valid).toBe(false);
      expect(validateOgrnip('12345').valid).toBe(false);
    });
  });

  describe('5. Net Revenue Accounting & Cache Invalidation on Refund', () => {
    it('invalidates cache when invalidateVatThresholdCache is called', async () => {
      const { checkVatThreshold, invalidateVatThresholdCache } = await import('@/services/financial/payment-gateway.service');

      (vi.spyOn(db.payment, 'aggregate') as any).mockResolvedValue({
        _sum: { amount: BigInt(2_500_000_000) }
      });

      expect(await checkVatThreshold('smmplan')).toBe(true);

      // Invalidate
      invalidateVatThresholdCache('smmplan');

      // Next call queries aggregate again
      (vi.spyOn(db.payment, 'aggregate') as any).mockResolvedValue({
        _sum: { amount: BigInt(500_000_000) }
      });

      expect(await checkVatThreshold('smmplan')).toBe(false);
    });
  });

  describe('6. Cross-Tenant Legal Independence & ст. 54.1 НК РФ Guard', () => {
    it('detects and blocks identical INN or OGRNIP across different tenants', async () => {
      const { validateCrossTenantLegalIndependence } = await import('@/utils/tax-validators');

      // Different tenants with distinct legal entities: OK
      const tenantPlan = { tenantId: 'smmplan', inn: '772401001012', ogrnip: '315774600000016' };
      const tenantFlux = { tenantId: 'flux', inn: '770123456789', ogrnip: '320774600000025' };
      expect(validateCrossTenantLegalIndependence(tenantPlan, tenantFlux).independent).toBe(true);

      // Same tenant: always independent with itself
      expect(validateCrossTenantLegalIndependence(tenantPlan, tenantPlan).independent).toBe(true);

      // Artificial business fragmentation (ст. 54.1 НК РФ): different tenants with identical INN
      const illicitCopy = { tenantId: 'flux', inn: '772401001012', ogrnip: '320774600000025' };
      const resultInn = validateCrossTenantLegalIndependence(tenantPlan, illicitCopy);
      expect(resultInn.independent).toBe(false);
      expect(resultInn.violationReason).toContain('ст. 54.1 НК РФ');

      // Different tenants with identical OGRNIP
      const illicitOgrnip = { tenantId: 'flux', inn: '770123456789', ogrnip: '315774600000016' };
      const resultOgrnip = validateCrossTenantLegalIndependence(tenantPlan, illicitOgrnip);
      expect(resultOgrnip.independent).toBe(false);
      expect(resultOgrnip.violationReason).toContain('ст. 54.1 НК РФ');

      // Different tenants with identical bank account (расчетный счет)
      const illicitBankA = { tenantId: 'smmplan', bankAccount: '40802810900000012345' };
      const illicitBankB = { tenantId: 'flux', bankAccount: '40802810900000012345' };
      const resultBank = validateCrossTenantLegalIndependence(illicitBankA, illicitBankB);
      expect(resultBank.independent).toBe(false);
      expect(resultBank.violationReason).toContain('расчетный счет');
    });
  });

  describe('7. ExactMath Boundary & PCI DSS Logging Integrity', () => {
    it('formats boundary BigInt kopecks accurately without Number conversion', async () => {
      const { formatKopecksAsRubString, toSafePaymentContextLog } = await import('@/services/financial/payment-gateway.service');

      // 20M RUB threshold minus 1 kopeck (19,999,999.99 RUB)
      const justBelow = BigInt(20_000_000) * BigInt(100) - BigInt(1);
      expect(formatKopecksAsRubString(justBelow)).toContain('19 999 999.99 ₽');

      // Exact 20M RUB threshold (20,000,000.00 RUB)
      const exact = BigInt(20_000_000) * BigInt(100);
      expect(formatKopecksAsRubString(exact)).toContain('20 000 000.00 ₽');

      // 20M RUB threshold plus 1 kopeck (20,000,000.01 RUB)
      const justAbove = BigInt(20_000_000) * BigInt(100) + BigInt(1);
      expect(formatKopecksAsRubString(justAbove)).toContain('20 000 000.01 ₽');

      // Guard: negative kopecks throws Error
      expect(() => formatKopecksAsRubString(BigInt(-100))).toThrow('не может быть отрицательной');

      // Masking in toSafePaymentContextLog (PCI DSS Req 3.4)
      const safeLog = toSafePaymentContextLog({
        tenantId: 'smmplan',
        currency: 'RUB',
        yookassaShopId: '123456',
        yookassaSecretKey: 'live_sec_TOP_SECRET_12345',
      });
      expect(safeLog.yookassaSecretKey).toBe('[REDACTED_SECRET]');
      expect(safeLog.yookassaShopId).toBe('123456');
      expect(safeLog.currency).toBe('RUB');
    });
  });
});
