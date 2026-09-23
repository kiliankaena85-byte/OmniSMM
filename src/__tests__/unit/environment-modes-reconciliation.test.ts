import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';
import { SettingsProvider, EnvironmentMode } from '@/lib/settings';

describe('Environment Modes & Reconciliation Hardening (CDD-TDD 2026)', () => {
  describe('PaymentGatewayFactory with isMockPayment option', () => {
    it('returns YooKassaGateway when gateway is yookassa in any mode', () => {
      const gateway = PaymentGatewayFactory.getGateway('yookassa');
      expect(gateway.constructor.name).toBe('YooKassaGateway');
    });

    it('returns MockGateway only for explicit mock gateway', () => {
      const gateway = PaymentGatewayFactory.getGateway('mock');
      expect(gateway.constructor.name).toBe('MockGateway');
    });

    it('returns Real Gateway when isMockPayment is false', () => {
      const gateway = PaymentGatewayFactory.getGateway('yookassa', { isMockPayment: false });
      expect(gateway.constructor.name).toBe('YooKassaGateway');
    });

    it('returns BalanceGateway even if isMockPayment is true', () => {
      const gateway = PaymentGatewayFactory.getGateway('balance', { isMockPayment: true });
      expect(gateway.constructor.name).toBe('BalanceGateway');
    });
  });

  describe('SettingsProvider mode semantic invariants', () => {
    it('disables mock payment for all modes so real YooKassa is always used', async () => {
      const isMockPayment = await SettingsProvider.isMockPaymentEnabled('smmplan');
      expect(isMockPayment).toBe(false);
    });

    it('correctly maps isTestMode based on environmentMode', async () => {
      const modes: { mode: EnvironmentMode; expectedTestMode: boolean }[] = [
        { mode: 'SANDBOX', expectedTestMode: true },
        { mode: 'HYBRID', expectedTestMode: true },
        { mode: 'ACQUIRING_TEST', expectedTestMode: true },
        { mode: 'PRODUCTION', expectedTestMode: false }
      ];

      for (const { mode, expectedTestMode } of modes) {
        vi.spyOn(SettingsProvider, 'get').mockResolvedValueOnce({
          environmentMode: mode,
          isTestMode: expectedTestMode
        } as any);

        const isTest = await SettingsProvider.isTestMode('smmplan');
        expect(isTest).toBe(expectedTestMode);
      }
    });

    it('falls back to main credentials in test mode if test credentials are not set', async () => {
      vi.spyOn(SettingsProvider, 'get').mockResolvedValue({
        environmentMode: 'HYBRID',
        isTestMode: true,
        yookassaShopId: '123456',
        yookassaSecretKey: 'test_custom_secret',
        yookassaTestShopId: null,
        yookassaTestSecretKey: null,
      } as any);

      const secrets = await SettingsProvider.getPaymentSecrets('smmplan');
      expect(secrets.yookassaShopId).toBe('123456');
      expect(secrets.yookassaSecretKey).toBe('test_custom_secret');
    });
  });
});
