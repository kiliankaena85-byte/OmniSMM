import { describe, it, expect } from 'vitest';

describe('Service ID Badge & Smart Search', () => {
  describe('Smart Search query normalization', () => {
    function normalizeSearchQuery(q: string) {
      const normalizedNumericQ = q.replace(/^[#№\s]+/, '').replace(/^id[\s:]*/i, '').trim();
      const numId = parseInt(normalizedNumericQ, 10);
      const isPureNumber = !isNaN(numId) && normalizedNumericQ === String(numId);
      return { normalizedNumericQ, numId, isPureNumber };
    }

    it('correctly extracts numericId from raw numbers', () => {
      const result = normalizeSearchQuery('1643');
      expect(result.isPureNumber).toBe(true);
      expect(result.numId).toBe(1643);
    });

    it('correctly extracts numericId from #1643', () => {
      const result = normalizeSearchQuery('#1643');
      expect(result.isPureNumber).toBe(true);
      expect(result.numId).toBe(1643);
    });

    it('correctly extracts numericId from №1643', () => {
      const result = normalizeSearchQuery('№1643');
      expect(result.isPureNumber).toBe(true);
      expect(result.numId).toBe(1643);
    });

    it('correctly extracts numericId from ID: 1643 and ID 1643', () => {
      const res1 = normalizeSearchQuery('ID: 1643');
      expect(res1.isPureNumber).toBe(true);
      expect(res1.numId).toBe(1643);

      const res2 = normalizeSearchQuery('id 1643');
      expect(res2.isPureNumber).toBe(true);
      expect(res2.numId).toBe(1643);
    });

    it('correctly extracts numericId from queries with spaces like # 1643 and № 1643', () => {
      const res1 = normalizeSearchQuery('# 1643');
      expect(res1.isPureNumber).toBe(true);
      expect(res1.numId).toBe(1643);

      const res2 = normalizeSearchQuery('№ 1643');
      expect(res2.isPureNumber).toBe(true);
      expect(res2.numId).toBe(1643);

      const res3 = normalizeSearchQuery('ID:  1643');
      expect(res3.isPureNumber).toBe(true);
      expect(res3.numId).toBe(1643);
    });

    it('does not treat textual queries as numericId', () => {
      const result = normalizeSearchQuery('Telegram просмотры');
      expect(result.isPureNumber).toBe(false);

      const result2 = normalizeSearchQuery('ID: telegram');
      expect(result2.isPureNumber).toBe(false);

      const result3 = normalizeSearchQuery('#tag');
      expect(result3.isPureNumber).toBe(false);
    });
  });
});
