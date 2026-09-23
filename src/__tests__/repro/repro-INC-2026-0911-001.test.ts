import { describe, it, expect } from 'vitest';
import { ExactMath } from '@/lib/financial/exact-math';

/**
 * Auto-generated Incident Reproduction Test
 * Incident ID: INC-2026-0911-001
 * Target: src/lib/financial/exact-math.ts
 */
describe('Self-Healing Reproduction Suite [INC-2026-0911-001]', () => {
  it('reproduces edge-case: validates strict bounds and floor protection', () => {
    // Инцидент: расчет стоимости при экстремально малом положительном объеме
    // Вызов обязан вернуть как минимум 1 коп (защитный пол), не выбрасывая сбой
    const cost = ExactMath.calculateOrderCostKopecks(1, BigInt(1), BigInt(0), BigInt(1));
    expect(cost).toBeGreaterThanOrEqual(BigInt(1));
    expect(cost).toBe(BigInt(1));
  });
});
