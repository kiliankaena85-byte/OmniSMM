/**
 * QA-2: FinTech QA Tester
 * Test Suite: Currency Hedge (D-2)
 * Standards: BABOK v3 (Financial Integrity), TOGAF
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { CurrencyService } from '@/services/financial/currency.service';

describe('Financial Mechanics: Currency Hedge (D-2)', () => {

  it('TC-FIN-HEDGE-001: Correctly isolates value risk on stable FX market', () => {
    // 1 USD cost, 100 RUB rate, 1.20 markup, NO volatility
    // Expected: 1 * 100 * 1.00 * 1.20 = 120 RUB (12000 Cents)
    const priceCents = CurrencyService.calculatePricing(1.00, 100, 1.20, false);
    
    expect(priceCents).toBe(12000); // Integer match up to strict 120 RUB = 12000 Cop
  });

  it('TC-FIN-HEDGE-002: Applies +5% margin safety net on Volatile FX market', () => {
    // 1 USD cost, 100 RUB rate, 1.20 markup, YES volatility
    // Expected: Math.floor(10000 * 1.05) = 10500 
    // Math.floor(10500 * 1.20) = 12600 Cents (126 RUB)
    const priceCents = CurrencyService.calculatePricing(1.00, 100, 1.20, true);
    
    expect(priceCents).toBe(12600); // 126.00 RUB
  });

  it('TC-FIN-HEDGE-003: Gracefully handles complex fractions via pure Integer floor', () => {
    // 1.03 USD cost, 93.45 RUB rate, 1.15 markup, YES volatility
    // base: 1.03 * 93.45 * 100 = 9625.35 -> 9625
    // hedge: 9625 * 1.05 = 10106.25 -> 10106
    // markup: 10106 * 1.15 = 11621.9 -> 11621 Cents
    const priceCents = CurrencyService.calculatePricing(1.03, 93.45, 1.15, true);
    expect(priceCents).toBe(11621);
    expect(Number.isInteger(priceCents)).toBe(true);
  });
});
