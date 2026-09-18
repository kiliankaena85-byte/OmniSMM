import { describe, it, expect } from 'vitest';
import {
  classifyRefillError,
  isRefillBusinessRejection,
} from '../refill-error-classifier';

describe('Refill Error Classifier (Self-Improving Loop)', () => {
  describe('Deterministic Business Rejections', () => {
    it('classifies Vexboost "is_not_available" as REFILL_NOT_AVAILABLE', () => {
      const res = classifyRefillError('is_not_available');
      expect(res.type).toBe('BUSINESS_REJECTION');
      if (res.type === 'BUSINESS_REJECTION') {
        expect(res.code).toBe('REFILL_NOT_AVAILABLE');
        expect(res.userMessage).toContain('недоступна');
      }
      expect(isRefillBusinessRejection('is_not_available')).toBe(true);
    });

    it('classifies variations of not available', () => {
      const variations = [
        'not_available',
        'not available',
        'Refill is not available',
        'refill not available for this service',
        'Service does not support refill',
      ];
      for (const v of variations) {
        const res = classifyRefillError(v);
        expect(res.type).toBe('BUSINESS_REJECTION');
        if (res.type === 'BUSINESS_REJECTION') {
          expect(res.code).toBe('REFILL_NOT_AVAILABLE');
        }
        expect(isRefillBusinessRejection(v)).toBe(true);
      }
    });

    it('classifies guarantee expired', () => {
      const variations = [
        'guarantee_expired',
        'guarantee expired',
        'warranty_expired',
        'out of guarantee period',
      ];
      for (const v of variations) {
        const res = classifyRefillError(v);
        expect(res.type).toBe('BUSINESS_REJECTION');
        if (res.type === 'BUSINESS_REJECTION') {
          expect(res.code).toBe('GUARANTEE_EXPIRED');
        }
      }
    });

    it('classifies order not completed', () => {
      const variations = [
        'order_must_be_completed',
        'Order must be completed',
        'order is not completed',
        'has not yet ended',
      ];
      for (const v of variations) {
        const res = classifyRefillError(v);
        expect(res.type).toBe('BUSINESS_REJECTION');
        if (res.type === 'BUSINESS_REJECTION') {
          expect(res.code).toBe('ORDER_NOT_COMPLETED');
        }
      }
    });

    it('classifies already refilled', () => {
      const variations = [
        'already_refilled',
        'already refilled',
        'refill already in progress',
        'Refill is already running',
      ];
      for (const v of variations) {
        const res = classifyRefillError(v);
        expect(res.type).toBe('BUSINESS_REJECTION');
        if (res.type === 'BUSINESS_REJECTION') {
          expect(res.code).toBe('ALREADY_REFILLED');
        }
      }
    });

    it('classifies drop not detected', () => {
      const variations = [
        'drop_not_detected',
        'drop not detected',
        'no drop',
        'count not dropped',
      ];
      for (const v of variations) {
        const res = classifyRefillError(v);
        expect(res.type).toBe('BUSINESS_REJECTION');
        if (res.type === 'BUSINESS_REJECTION') {
          expect(res.code).toBe('DROP_NOT_DETECTED');
        }
      }
    });

    it('classifies refill limits and cooldowns', () => {
      expect(classifyRefillError('refill limit reached').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('too soon to refill').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('order canceled').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('incorrect order id').type).toBe('BUSINESS_REJECTION');
    });

    it('classifies extended SMM provider patterns (already submitted, drop not found, private account)', () => {
      expect(classifyRefillError('refill already submitted').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('refill already queued').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('refill period ended').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('drop not found').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('not enough drops').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('no refill for this service').type).toBe('BUSINESS_REJECTION');
      expect(classifyRefillError('refill is disabled').type).toBe('BUSINESS_REJECTION');

      const priv = classifyRefillError('Account is private');
      expect(priv.type).toBe('BUSINESS_REJECTION');
      if (priv.type === 'BUSINESS_REJECTION') {
        expect(priv.code).toBe('TARGET_UNAVAILABLE_OR_PRIVATE');
      }

      const postDel = classifyRefillError('post deleted');
      expect(postDel.type).toBe('BUSINESS_REJECTION');
      if (postDel.type === 'BUSINESS_REJECTION') {
        expect(postDel.code).toBe('TARGET_UNAVAILABLE_OR_PRIVATE');
      }
    });
  });

  describe('Transient Network or Provider Server Failures', () => {
    it('classifies network timeouts and connection errors as TRANSIENT_FAILURE', () => {
      const transientErrors = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        '502 Bad Gateway',
        '503 Service Temporarily Unavailable',
        '504 Gateway Timeout',
        'FetchError: request to https://api.vexboost.com failed',
        'Rate limit reached, please slow down',
      ];

      for (const err of transientErrors) {
        const res = classifyRefillError(err);
        expect(res.type).toBe('TRANSIENT_FAILURE');
        if (res.type === 'TRANSIENT_FAILURE') {
          expect(res.retryable).toBe(true);
        }
        expect(isRefillBusinessRejection(err)).toBe(false);
      }
    });

    it('CRITICAL: correctly classifies Cloudflare / HTTP 502 "web server is not available" as TRANSIENT_FAILURE', () => {
      const serverDownPhrases = [
        '502 Bad Gateway: The web server is not available',
        '503 Service Temporarily Unavailable: Web server is not available',
        'Cloudflare 521: Web server is down',
        '504 Gateway Timeout: upstream request failed',
      ];

      for (const phrase of serverDownPhrases) {
        const res = classifyRefillError(phrase);
        expect(res.type).toBe('TRANSIENT_FAILURE');
        expect(isRefillBusinessRejection(phrase)).toBe(false);
      }
    });

    it('handles empty or null errors gracefully as TRANSIENT_FAILURE', () => {
      expect(classifyRefillError(null).type).toBe('TRANSIENT_FAILURE');
      expect(classifyRefillError(undefined).type).toBe('TRANSIENT_FAILURE');
      expect(classifyRefillError('').type).toBe('TRANSIENT_FAILURE');
    });
  });
});
