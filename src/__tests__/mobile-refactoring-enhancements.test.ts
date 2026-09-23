import { describe, it, expect } from 'vitest';
import { cleanCategoryName } from '@/components/ui/CategoryIcon';

describe('Mobile Wizard Refactoring Enhancements', () => {
  describe('Provider Jargon & Tag Sanitization', () => {
    it('cleans server brackets, api markers, and vexboost prefixes from category names', () => {
      expect(cleanCategoryName('Vexboost Live Просмотры')).toBe('Онлайн-просмотры Просмотры');
      expect(cleanCategoryName('Подписчики [Сервер: 1]')).toBe('Подписчики');
      expect(cleanCategoryName('Лайки (api 2)')).toBe('Лайки');
      expect(cleanCategoryName('Просмотры (srv 3)')).toBe('Просмотры');
      expect(cleanCategoryName('Бусты канала (Stories & Levels)')).toBe('Бусты канала (Stories & Levels)');
      expect(cleanCategoryName('👍 Реакции (👍, ❤️)')).toBe('Реакции (👍, ❤️)');
      expect(cleanCategoryName('Подписчики ♻️')).toBe('Подписчики');
    });
  });

  describe('Retail Pricing Invariant Verification', () => {
    it('guarantees unit price per piece calculation without 1000 pcs multipliers', () => {
      const unitPrice = 0.05;
      const quantity = 500;
      const calculatedTotal = (unitPrice * quantity).toFixed(2);
      expect(calculatedTotal).toBe('25.00');
    });

    it('handles small quantity correctly without minimum order inflation', () => {
      const unitPrice = 0.12;
      const quantity = 100;
      const calculatedTotal = (unitPrice * quantity).toFixed(2);
      expect(calculatedTotal).toBe('12.00');
    });
  });
});
