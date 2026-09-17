import { describe, it, expect } from 'vitest';
import { 
  resolveOrderEnvironmentMode, 
  normalizeEnvironmentMode,
  ORDER_ENV_CONFIG, 
  type OrderEnvironmentMode 
} from '@/utils/order-environment';

describe('Order Environment Mode Resolver & Visual Isolation Suite', () => {
  describe('resolveOrderEnvironmentMode', () => {
    it('correctly resolves explicit SANDBOX and legacy MOCK modes', () => {
      expect(resolveOrderEnvironmentMode({ environmentMode: 'SANDBOX' })).toBe('SANDBOX');
      expect(resolveOrderEnvironmentMode({ environmentMode: 'sandbox' })).toBe('SANDBOX');
      expect(resolveOrderEnvironmentMode({ environmentMode: ' MOCK ' })).toBe('SANDBOX');
      expect(resolveOrderEnvironmentMode({ environmentMode: 'mock' })).toBe('SANDBOX');
    });

    it('correctly resolves explicit HYBRID mode', () => {
      expect(resolveOrderEnvironmentMode({ environmentMode: 'HYBRID' })).toBe('HYBRID');
      expect(resolveOrderEnvironmentMode({ environmentMode: 'hybrid' })).toBe('HYBRID');
    });

    it('correctly resolves explicit ACQUIRING_TEST mode', () => {
      expect(resolveOrderEnvironmentMode({ environmentMode: 'ACQUIRING_TEST' })).toBe('ACQUIRING_TEST');
      expect(resolveOrderEnvironmentMode({ environmentMode: 'acquiring_test' })).toBe('ACQUIRING_TEST');
    });

    it('correctly detects Test Acquiring from payment gateway signatures', () => {
      // payment.gateway === 'test'
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'test', gatewayId: 'any_id' }
      })).toBe('ACQUIRING_TEST');

      // mock_ prefix
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'yookassa', gatewayId: 'mock_123456' }
      })).toBe('ACQUIRING_TEST');

      // yoo_test_mock_ prefix
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'yookassa', gatewayId: 'yoo_test_mock_987654321' }
      })).toBe('ACQUIRING_TEST');

      // robo_test_mock_ prefix
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'robokassa', gatewayId: 'robo_test_mock_inv_42' }
      })).toBe('ACQUIRING_TEST');

      // test_ prefix
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'yookassa', gatewayId: 'test_inv_482910' }
      })).toBe('ACQUIRING_TEST');

      // gateway === 'mock'
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'mock', gatewayId: 'abc123' }
      })).toBe('ACQUIRING_TEST');

      // gateway === 'sandbox'
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        payment: { gateway: 'sandbox', gatewayId: 'tx_777' }
      })).toBe('ACQUIRING_TEST');
    });

    it('resolves standard PRODUCTION orders', () => {
      expect(resolveOrderEnvironmentMode({ environmentMode: 'PRODUCTION' })).toBe('PRODUCTION');
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        isTest: false,
        payment: { gateway: 'yookassa', gatewayId: '2b4c1945-000f-5000-8000-117a3a8309a6' }
      })).toBe('PRODUCTION');
      expect(resolveOrderEnvironmentMode({})).toBe('PRODUCTION');
      expect(resolveOrderEnvironmentMode({ environmentMode: null, isTest: false })).toBe('PRODUCTION');
    });

    it('correctly resolves mock sandbox orders even when they have mock payment signatures', () => {
      // Sandbox orders in test mode have isTest = true AND payment.gatewayId = mock_...
      // They MUST resolve to SANDBOX, not ACQUIRING_TEST!
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'SANDBOX',
        isTest: true,
        payment: { gateway: 'yookassa', gatewayId: 'mock_12345' }
      })).toBe('SANDBOX');

      expect(resolveOrderEnvironmentMode({
        isTest: true,
        payment: { gateway: 'yookassa', gatewayId: 'mock_12345' }
      })).toBe('SANDBOX');
    });

    it('falls back to SANDBOX for legacy orders with isTest = true without other flags', () => {
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'PRODUCTION',
        isTest: true,
      })).toBe('SANDBOX');

      expect(resolveOrderEnvironmentMode({
        isTest: true,
      })).toBe('SANDBOX');
    });

    it('preserves HYBRID precedence over legacy isTest flag and payment signatures', () => {
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'HYBRID',
        isTest: true,
        payment: { gateway: 'yookassa', gatewayId: 'mock_123' }
      })).toBe('HYBRID');
    });

    it('preserves ACQUIRING_TEST precedence over legacy isTest flag', () => {
      expect(resolveOrderEnvironmentMode({
        environmentMode: 'ACQUIRING_TEST',
        isTest: true,
      })).toBe('ACQUIRING_TEST');
    });
  });

  describe('normalizeEnvironmentMode', () => {
    it('normalizes valid modes and aliases case-insensitively', () => {
      expect(normalizeEnvironmentMode('SANDBOX')).toBe('SANDBOX');
      expect(normalizeEnvironmentMode('sandbox')).toBe('SANDBOX');
      expect(normalizeEnvironmentMode('MOCK')).toBe('SANDBOX');
      expect(normalizeEnvironmentMode('mock')).toBe('SANDBOX');
      expect(normalizeEnvironmentMode('HYBRID')).toBe('HYBRID');
      expect(normalizeEnvironmentMode('hybrid')).toBe('HYBRID');
      expect(normalizeEnvironmentMode('ACQUIRING_TEST')).toBe('ACQUIRING_TEST');
      expect(normalizeEnvironmentMode('acquiring_test')).toBe('ACQUIRING_TEST');
      expect(normalizeEnvironmentMode('PRODUCTION')).toBe('PRODUCTION');
      expect(normalizeEnvironmentMode('production')).toBe('PRODUCTION');
    });

    it('returns null for empty, null, or unrecognized modes', () => {
      expect(normalizeEnvironmentMode(null)).toBeNull();
      expect(normalizeEnvironmentMode(undefined)).toBeNull();
      expect(normalizeEnvironmentMode('')).toBeNull();
      expect(normalizeEnvironmentMode('unknown_mode')).toBeNull();
    });
  });

  describe('ORDER_ENV_CONFIG Metadata Completeness', () => {
    const requiredModes: OrderEnvironmentMode[] = ['SANDBOX', 'HYBRID', 'ACQUIRING_TEST', 'PRODUCTION'];

    for (const mode of requiredModes) {
      it(`defines valid and complete styling metadata for ${mode}`, () => {
        const meta = ORDER_ENV_CONFIG[mode];
        expect(meta).toBeDefined();
        expect(meta.id).toBe(mode);
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.shortLabel.length).toBeGreaterThan(0);
        expect(meta.badgeClass.length).toBeGreaterThan(0);
        expect(meta.rowBorderClass.length).toBeGreaterThan(0);
        expect(meta.description.length).toBeGreaterThan(0);
      });
    }

    it('uses distinguishable short labels matching business domain', () => {
      expect(ORDER_ENV_CONFIG.SANDBOX.shortLabel).toBe('Песочница');
      expect(ORDER_ENV_CONFIG.HYBRID.shortLabel).toBe('Гибрид');
      expect(ORDER_ENV_CONFIG.ACQUIRING_TEST.shortLabel).toBe('Тест эквайринга');
      expect(ORDER_ENV_CONFIG.PRODUCTION.shortLabel).toBe('Продакшн');
    });
  });
});
