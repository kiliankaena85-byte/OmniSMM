import { describe, it, expect } from 'vitest';
import { extractOrderIds } from './ticket-parser';

describe('extractOrderIds', () => {
  it('should return empty array for null, undefined or empty string', () => {
    expect(extractOrderIds(null)).toEqual([]);
    expect(extractOrderIds(undefined)).toEqual([]);
    expect(extractOrderIds('')).toEqual([]);
  });

  it('should extract simple numeric order IDs', () => {
    const text = 'Привет, сделайте докрут по заказам 4501 и 89211';
    expect(extractOrderIds(text)).toEqual(['4501', '89211']);
  });

  it('should extract order IDs prefixed with hash symbol (#)', () => {
    const text = 'У меня списались подписчики по заказам #4501 и #89211. Пожалуйста, посмотрите.';
    expect(extractOrderIds(text)).toEqual(['4501', '89211']);
  });

  it('should return unique order IDs, removing duplicates', () => {
    const text = 'Заказ 10245 не работает. Повторяю: 10245 и #10245. Сделайте докрутку.';
    expect(extractOrderIds(text)).toEqual(['10245']);
  });

  it('should filter out numbers that are too short (< 4 digits) or too long (> 12 digits)', () => {
    const text = 'Мой заказ 123 (слишком короткий) и заказ 99999999999999 (слишком длинный). Нужен 8822 (валидный).';
    expect(extractOrderIds(text)).toEqual(['8822']);
  });

  it('should extract ID when adjacent to punctuation marks', () => {
    const text = 'ID:8823, ID:8824. Заказы: 8825; 8826?';
    expect(extractOrderIds(text)).toEqual(['8823', '8824', '8825', '8826']);
  });
});
