import { describe, it, expect } from 'vitest';
import { classifyOrderError } from '@/lib/order-error-classifier';
import { OrderTriageAlertService } from '@/services/orders/order-triage-alert.service';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';

describe('Order Error Classifier & SSRF Disambiguation (RAC-2026 CDD-TDD)', () => {
  describe('1. Disambiguation: Private IP (SSRF) vs Private Content/Channel', () => {
    const ssrfErrors = [
      'Private IP blocked',
      'SSRF blocked: ip-127.0.0.1-private',
      'SSRF blocked: ip-10.0.0.5-private',
      'Private IP address is not allowed',
      'Blocked URL: private network',
      'Access to private network forbidden',
    ];

    it('must NOT classify Private IP / SSRF errors as ERR_LINK_PRIVATE in order-error-classifier', () => {
      for (const err of ssrfErrors) {
        const classified = classifyOrderError(err);
        expect(classified).not.toBeNull();
        expect(classified?.code).not.toBe('ERR_LINK_PRIVATE');
        expect(classified?.category).not.toBe('LINK');
        // Should be classified as GATEWAY or SYSTEM
        expect(['GATEWAY', 'SYSTEM']).toContain(classified?.category);
      }
    });

    it('must NOT classify Private IP / SSRF errors as PRIVATE_ACCOUNT in OrderTriageAlertService', () => {
      for (const err of ssrfErrors) {
        const triage = OrderTriageAlertService.classifyError(err);
        expect(triage.type).not.toBe('PRIVATE_ACCOUNT');
        expect(triage.tag).not.toBe('[PRIVATE_ACCOUNT]');
        expect(triage.supportAction).not.toContain('попросите открыть профиль/канал');
      }
    });
  });

  describe('2. Preservation of True Private Channel / Account Errors', () => {
    const truePrivateErrors = [
      'Account is private',
      'This channel is private',
      'Profile is private or closed',
      'Target account is private',
      'Закрытый профиль',
      'Приватный канал',
      'Заказ не может быть выполнен: закрытый аккаунт',
    ];

    it('accurately classifies true private channels as ERR_LINK_PRIVATE', () => {
      for (const err of truePrivateErrors) {
        const classified = classifyOrderError(err);
        expect(classified?.code).toBe('ERR_LINK_PRIVATE');
        expect(classified?.category).toBe('LINK');
      }
    });

    it('accurately classifies true private channels as PRIVATE_ACCOUNT in OrderTriageAlertService', () => {
      for (const err of truePrivateErrors) {
        const triage = OrderTriageAlertService.classifyError(err);
        expect(triage.type).toBe('PRIVATE_ACCOUNT');
        expect(triage.tag).toBe('[PRIVATE_ACCOUNT]');
        expect(triage.supportAction).toContain('Свяжитесь с клиентом');
      }
    });
  });

  describe('3. SSRF Guard Provider Host Resolution', () => {
    it('permits official provider domains even under Fake-IP / proxy routing', async () => {
      const result = await assertSafeOutboundUrl('https://vexboost.ru/api/v2/');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.hostname).toBe('vexboost.ru');
      }
    });
  });
});
