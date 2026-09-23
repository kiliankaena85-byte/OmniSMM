import { describe, it, expect } from 'vitest';

function rubToKopecks(value: unknown): bigint {
  if (typeof value !== 'string') {
    throw new Error('INVALID_AMOUNT_FORMAT');
  }

  const normalized = value.trim();

  const decimalMatch = /^(\d+)\.(\d{2})$/.exec(normalized);
  if (decimalMatch) {
    return BigInt(decimalMatch[1]) * BigInt(100) + BigInt(decimalMatch[2]);
  }

  const integerMatch = /^(\d+)$/.exec(normalized);
  if (integerMatch) {
    return BigInt(integerMatch[1]) * BigInt(100);
  }

  throw new Error('INVALID_AMOUNT_FORMAT');
}

describe('rubToKopecks Safe BigInt Parsing', () => {
  it('correctly converts integer RUB string to kopecks BigInt', () => {
    expect(rubToKopecks('100')).toBe(BigInt(10000));
    expect(rubToKopecks('0')).toBe(BigInt(0));
    expect(rubToKopecks('5000')).toBe(BigInt(500000));
  });

  it('correctly converts 2-decimal RUB string to kopecks BigInt', () => {
    expect(rubToKopecks('100.00')).toBe(BigInt(10000));
    expect(rubToKopecks('100.50')).toBe(BigInt(10050));
    expect(rubToKopecks('0.99')).toBe(BigInt(99));
  });

  it('throws INVALID_AMOUNT_FORMAT for invalid formats', () => {
    expect(() => rubToKopecks('100.5')).toThrow('INVALID_AMOUNT_FORMAT');
    expect(() => rubToKopecks('100.555')).toThrow('INVALID_AMOUNT_FORMAT');
    expect(() => rubToKopecks('-100.00')).toThrow('INVALID_AMOUNT_FORMAT');
    expect(() => rubToKopecks('abc')).toThrow('INVALID_AMOUNT_FORMAT');
    expect(() => rubToKopecks(100)).toThrow('INVALID_AMOUNT_FORMAT');
  });
});
