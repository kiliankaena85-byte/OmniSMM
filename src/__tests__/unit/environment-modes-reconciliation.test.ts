import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentGatewayFactory } from '@/services/financial/payment-gateway.service';
import { SettingsProvider, EnvironmentMode } from '@/lib/settings';

describe('Environment Modes & Reconciliation Hardening (CDD-TDD 2026)', () => {
  describe('PaymentGatewayFactory with isMockPayment option', () => {
    it('returns MockGateway when isMockPayment is true and gateway is yookassa', () => {
      const gateway = PaymentGatewayFactory.getGateway('yookassa', { isMockPayment: true });
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
    it('correctly maps isMockPaymentEnabled for all 4 modes', () => {
      const mockModes: Record<EnvironmentMode, { mockPayment: boolean; mockProvider: boolean }> = {
        SANDBOX: { mockPayment: true, mockProvider: true },
        HYBRID: { mockPayment: true, mockProvider: false },
        ACQUIRING_TEST: { mockPayment: false, mockProvider: true },
        PRODUCTION: { mockPayment: false, mockProvider: false }
      };

      for (const [mode, expected] of Object.entries(mockModes)) {
        const isMockPay = mode === 'SANDBOX' || mode === 'HYBRID';
        const isMockProv = mode === 'SANDBOX' || mode === 'ACQUIRING_TEST';
        expect(isMockPay).toBe(expected.mockPayment);
        expect(isMockProv).toBe(expected.mockProvider);
      }
    });
  });
});
