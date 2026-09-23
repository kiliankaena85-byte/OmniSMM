import { describe, it, expect } from 'vitest';
import { validateDripFeedFloor, validateBaseOrderLink } from '@/hooks/useBaseOrderValidation';

describe('useBaseOrderValidation (TDD Unit Tests)', () => {
  describe('validateDripFeedFloor', () => {
    it('returns isValid: true when drip feed is disabled', () => {
      const res = validateDripFeedFloor({
        isDripFeedEnabled: false,
        quantity: 50,
        runs: 5,
        minQty: 100,
      });
      expect(res.isValid).toBe(true);
      expect(res.warningMessage).toBeNull();
    });

    it('returns isValid: true when runs < 2', () => {
      const res = validateDripFeedFloor({
        isDripFeedEnabled: true,
        quantity: 50,
        runs: 1,
        minQty: 100,
      });
      expect(res.isValid).toBe(true);
      expect(res.warningMessage).toBeNull();
    });

    it('returns isValid: false when per-run quantity is below service.minQty', () => {
      // 100 total / 5 runs = 20 per run < 50 minQty
      const res = validateDripFeedFloor({
        isDripFeedEnabled: true,
        quantity: 100,
        runs: 5,
        minQty: 50,
      });
      expect(res.isValid).toBe(false);
      expect(res.minRequiredTotal).toBe(250);
      expect(res.perRunQuantity).toBe(20);
      expect(res.warningMessage).toContain('Минимальный объём на 1 запуск: 50 шт.');
      expect(res.warningMessage).toContain('250');
    });

    it('returns isValid: true when per-run quantity satisfies service.minQty', () => {
      // 250 total / 5 runs = 50 per run >= 50 minQty
      const res = validateDripFeedFloor({
        isDripFeedEnabled: true,
        quantity: 250,
        runs: 5,
        minQty: 50,
      });
      expect(res.isValid).toBe(true);
      expect(res.warningMessage).toBeNull();
      expect(res.perRunQuantity).toBe(50);
    });
  });

  describe('validateBaseOrderLink', () => {
    it('returns error when link is empty or too short', () => {
      expect(validateBaseOrderLink('', 'TELEGRAM', 'CHANNEL')).toBe('Введите корректную ссылку для выполнения заказа');
      expect(validateBaseOrderLink('ab', 'TELEGRAM', 'CHANNEL')).toBe('Введите корректную ссылку для выполнения заказа');
    });

    it('validates a proper Telegram channel link', () => {
      const err = validateBaseOrderLink('https://t.me/durov', 'TELEGRAM', 'CHANNEL');
      expect(err).toBeNull();
    });

    it('rejects an invalid link format for telegram channel', () => {
      const err = validateBaseOrderLink('not-a-valid-url', 'TELEGRAM', 'CHANNEL');
      expect(err).not.toBeNull();
    });
  });
});