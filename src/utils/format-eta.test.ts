import { describe, it, expect } from 'vitest';
import { formatEta } from '@/utils/format-eta';

describe('formatEta — Human-Readable Duration Formatter', () => {

  // ── Sub-minute ──
  it('returns "< 1 мин" for 0 seconds', () => {
    expect(formatEta(0)).toBe('< 1 мин');
  });

  it('returns "< 1 мин" for 30 seconds', () => {
    expect(formatEta(30)).toBe('< 1 мин');
  });

  it('returns "< 1 мин" for 59 seconds', () => {
    expect(formatEta(59)).toBe('< 1 мин');
  });

  // ── Minutes ──
  it('returns "1 мин" for exactly 60 seconds', () => {
    expect(formatEta(60)).toBe('1 мин');
  });

  it('returns "15 мин" for 900 seconds', () => {
    expect(formatEta(900)).toBe('15 мин');
  });

  it('returns "30 мин" for 1800 seconds (FAST threshold)', () => {
    expect(formatEta(1800)).toBe('30 мин');
  });

  it('returns "59 мин" for 3540 seconds', () => {
    expect(formatEta(3540)).toBe('59 мин');
  });

  // ── Hours ──
  it('returns "1ч" for exactly 3600 seconds', () => {
    expect(formatEta(3600)).toBe('1ч');
  });

  it('returns "2ч 30м" for 9000 seconds', () => {
    expect(formatEta(9000)).toBe('2ч 30м');
  });

  it('returns "6ч" for 21600 seconds (MEDIUM threshold)', () => {
    expect(formatEta(21600)).toBe('6ч');
  });

  it('returns "23ч 59м" for 86340 seconds', () => {
    expect(formatEta(86340)).toBe('23ч 59м');
  });

  // ── Days ──
  it('returns "1д" for exactly 86400 seconds', () => {
    expect(formatEta(86400)).toBe('1д');
  });

  it('returns "1д 6ч" for 108000 seconds', () => {
    expect(formatEta(108000)).toBe('1д 6ч');
  });

  it('returns "2д" for 172800 seconds (SLOW threshold)', () => {
    expect(formatEta(172800)).toBe('2д');
  });

  it('returns "7д" for 604800 seconds (ULTRA_SLOW range)', () => {
    expect(formatEta(604800)).toBe('7д');
  });

  // ── Boundary values ──
  it('handles fractional seconds by rounding', () => {
    // 90.5 seconds → Math.round(90.5/60) = 2
    expect(formatEta(90.5)).toBe('2 мин');
  });

  it('handles large values without overflow', () => {
    // 30 days = 2592000 seconds
    expect(formatEta(2592000)).toBe('30д');
  });
});
