/**
 * Challenger M1-1: Empirical Stress Test Harness & Adversarial Property Testing
 * Focus: Financial Safety Floor (3.0 markup), Micro-pricing clamping, Beautiful rounding, Discount invariants
 */

import fc from 'fast-check';
import {
  SAFETY_FLOOR_MARKUP,
  TOTAL_MANDATORY_DEDUCTIONS,
  MAX_TOTAL_DISCOUNT,
  calculateSafetyFloorCents,
  applyBeautifulRounding,
  applyPricingLadder,
} from '../src/lib/financial-constants';
import { marketingService } from '../src/services/marketing.service';
import { QuarantineService } from '../src/services/providers/quarantine.service';
import { ServiceAuditEngine } from '../src/services/admin/audit-engine';

interface TestStats {
  suite: string;
  passed: number;
  failed: number;
  details: string[];
}

const stats: TestStats[] = [];

function recordTest(suite: string, name: string, passed: boolean, message?: string) {
  let s = stats.find(x => x.suite === suite);
  if (!s) {
    s = { suite, passed: 0, failed: 0, details: [] };
    stats.push(s);
  }
  if (passed) {
    s.passed++;
  } else {
    s.failed++;
    s.details.push(`FAIL: ${name} -> ${message}`);
  }
}

async function runAdversarialPricingSuite() {
  console.log('================================================================');
  console.log('⚡ STARTING ADVERSARIAL STRESS TEST SUITE FOR MILESTONE M1');
  console.log('================================================================');

  // ===========================================================================
  // TEST SUITE 1: Financial Safety Floor Mathematical Invariants
  // ===========================================================================
  const suite1 = '1. Safety Floor Math Invariants';
  console.log(`\n--- Running ${suite1} ---`);

  // Oracle multiplier: (1 + 3.0) / (1 - 0.145) = 4.0 / 0.855 ≈ 4.678362573
  const EXACT_FLOOR_MULTIPLIER = (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS);
  console.log(`Exact Safety Floor Multiplier: ${EXACT_FLOOR_MULTIPLIER.toFixed(8)} (approx ${EXACT_FLOOR_MULTIPLIER.toFixed(2)}x cost)`);

  try {
    fc.assert(
      fc.property(
        fc.double({ min: 0.000001, max: 100_000_000, noNaN: true }),
        (costCents) => {
          const floor = calculateSafetyFloorCents(costCents);
          // Invariant 1.1: Must be an integer cent (no fractional kopecks/cents)
          if (!Number.isInteger(floor)) return false;
          // Invariant 1.2: Must never be less than exact formula ceil
          const expectedFloor = Math.ceil(costCents * EXACT_FLOOR_MULTIPLIER);
          if (floor !== expectedFloor) return false;
          // Invariant 1.3: Floor must strictly exceed costCents by at least 3.0x markup plus mandatory deductions
          if (floor < costCents * 4.67) return false;
          return true;
        }
      ),
      { numRuns: 100_000 }
    );
    recordTest(suite1, 'calculateSafetyFloorCents 100k random cost asserts', true);
  } catch (err: any) {
    recordTest(suite1, 'calculateSafetyFloorCents 100k random cost asserts', false, err.message);
  }

  // Edge cases: <= 0 cost
  try {
    const zeroFloor = calculateSafetyFloorCents(0);
    const negativeFloor = calculateSafetyFloorCents(-100);
    const pass = zeroFloor === 0 && negativeFloor === 0;
    recordTest(suite1, 'calculateSafetyFloorCents for <= 0 returns 0', pass, `0->${zeroFloor}, -100->${negativeFloor}`);
  } catch (err: any) {
    recordTest(suite1, 'calculateSafetyFloorCents for <= 0 returns 0', false, err.message);
  }

  // ===========================================================================
  // TEST SUITE 2: Micro-pricing and Precision Clamping
  // ===========================================================================
  const suite2 = '2. Micro-pricing and Precision Clamping';
  console.log(`\n--- Running ${suite2} ---`);

  // Provider rates down to 0.000001 USD with exchange rate 100
  const microRates = [0.000001, 0.00001, 0.0001, 0.0005, 0.001, 0.01, 0.05, 0.1];
  const microQuantities = [1, 2, 5, 10, 50, 100, 1000];

  for (const rate of microRates) {
    for (const qty of microQuantities) {
      try {
        const mockService = {
          id: 'micro_srv',
          rate,
          markup: 3.0,
          minQty: 1,
          maxQty: 1_000_000,
          providerCurrency: 'USD',
        };
        const mockUser = {
          id: 'test_user',
          totalSpent: BigInt(0),
          personalDiscount: 0,
        };

        const res = await marketingService.calculatePrice(
          'test_user',
          'micro_srv',
          qty,
          null,
          { user: mockUser, service: mockService }
        );

        const check1 = res.totalCents >= 1; // Minimum 1 cent
        const check2 = res.totalCents >= res.safetyFloorCents;
        const check3 = res.providerCostCents >= 1; // Clamped to 1 cent for qty >= 1
        const check4 = res.safetyFloorCents === 5; // When cost is 1 cent, safety floor is Math.ceil(4/0.855) = 5 cents

        const passed = check1 && check2 && check3 && check4;
        recordTest(
          suite2,
          `Micro-rate $${rate} qty ${qty}`,
          passed,
          `totalCents=${res.totalCents}, floor=${res.safetyFloorCents}, cost=${res.providerCostCents}`
        );
      } catch (err: any) {
        recordTest(suite2, `Micro-rate $${rate} qty ${qty}`, false, err.message);
      }
    }
  }

  // ===========================================================================
  // TEST SUITE 3: Beautiful Rounding Invariants & Floating-Point Stability
  // ===========================================================================
  const suite3 = '3. Beautiful Rounding Invariants';
  console.log(`\n--- Running ${suite3} ---`);

  try {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0001, max: 1_000_000, noNaN: true }),
        (priceRub) => {
          const rounded = applyBeautifulRounding(priceRub);
          // Invariant 3.1: Must be finite integer
          if (!Number.isFinite(rounded) || !Number.isInteger(rounded)) return false;
          // Invariant 3.2: Must never decrease the price
          if (rounded < Math.floor(priceRub)) return false;
          // Invariant 3.3: < 1000 RUB -> multiple of 10
          if (priceRub < 1000 && rounded % 10 !== 0) return false;
          // Invariant 3.4: >= 1000 RUB -> multiple of 100
          if (priceRub >= 1000 && rounded % 100 !== 0) return false;
          // Invariant 3.5: Over-rounding delta must be bounded
          if (priceRub < 1000 && (rounded - priceRub) > 10.0001) return false;
          if (priceRub >= 1000 && (rounded - priceRub) > 100.0001) return false;
          return true;
        }
      ),
      { numRuns: 100_000 }
    );
    recordTest(suite3, 'applyBeautifulRounding 100k random float asserts', true);
  } catch (err: any) {
    recordTest(suite3, 'applyBeautifulRounding 100k random float asserts', false, err.message);
  }

  // Floating point precision jitter stress test
  const trickyFloats = [
    220.00000000000003,
    199.99999999999997,
    999.9999999999999,
    1000.0000000000001,
    10.000000000000002,
    0.000000000000001,
    0.0,
    -5.0
  ];

  for (const val of trickyFloats) {
    const res = applyBeautifulRounding(val);
    const pass = Number.isInteger(res) && (val <= 0 ? res === 0 : res > 0);
    recordTest(suite3, `Tricky float ${val}`, pass, `Got ${res}`);
  }

  // ===========================================================================
  // TEST SUITE 4: Discount Stacking, Promo Codes & Safety Floor Domination
  // ===========================================================================
  const suite4 = '4. Discount Stacking & Safety Floor Domination';
  console.log(`\n--- Running ${suite4} ---`);

  try {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.001, max: 50.0, noNaN: true }),  // rate ($/1k)
        fc.double({ min: 0.5, max: 20.0, noNaN: true }),    // markup (multiplier)
        fc.integer({ min: 1, max: 100_000 }),                // quantity
        fc.double({ min: 0, max: 100.0, noNaN: true }),      // personalDiscount (%)
        fc.double({ min: 0, max: 100.0, noNaN: true }),      // promoDiscount (%)
        fc.bigInt({ min: BigInt(0), max: BigInt(500_000_00) }), // totalSpent (cents)
        async (rate, markup, quantity, personalDiscount, promoDiscount, totalSpent) => {
          const mockService = {
            id: 'fc_srv',
            rate,
            markup,
            minQty: 1,
            maxQty: 1_000_000,
            providerCurrency: 'USD',
          };
          const mockUser = {
            id: 'fc_user',
            totalSpent,
            personalDiscount,
          };

          const res = await marketingService.calculatePrice(
            'fc_user',
            'fc_srv',
            quantity,
            null,
            { user: mockUser, service: mockService }
          );

          // INVARIANT A: Final totalCents must never be below safetyFloorCents
          if (res.totalCents < res.safetyFloorCents) return false;

          // INVARIANT B: Final totalCents must be >= 1 for positive quantity
          if (quantity > 0 && res.totalCents < 1) return false;

          // INVARIANT C: discountPercent must never exceed MAX_TOTAL_DISCOUNT (30%)
          // unless safety floor is triggered which may adjust discount
          if (res.discountPercent > MAX_TOTAL_DISCOUNT) return false;

          // INVARIANT D: If totalCents equals safetyFloorCents, discountCents is correctly clamped
          if (res.totalCents === res.safetyFloorCents) {
            if (res.discountCents !== Math.max(0, res.originalTotalCents - res.totalCents)) return false;
          } else {
            if (res.totalCents + res.discountCents !== res.originalTotalCents) return false;
          }

          return true;
        }
      ),
      { numRuns: 5000 }
    );
    recordTest(suite4, 'MarketingService calculatePrice 5000 async property runs', true);
  } catch (err: any) {
    recordTest(suite4, 'MarketingService calculatePrice 5000 async property runs', false, err.message);
  }

  // ===========================================================================
  // TEST SUITE 5: API Formatted Services Safety Floor Enforcement
  // ===========================================================================
  const suite5 = '5. API Formatted Services Floor Enforcement';
  console.log(`\n--- Running ${suite5} ---`);

  try {
    const mockUser = { totalSpent: 100_000_00, personalDiscount: 50.0 }; // Extreme discount
    const services = [
      { numericId: 1, name: 'Normal', rate: 1.0, markup: 5.0, minQty: 1, maxQty: 1000, providerCurrency: 'USD', isDripFeedEnabled: false, isRefillEnabled: false, isCancelEnabled: false, category: { name: 'Cat' } },
      { numericId: 2, name: 'LowMarkup', rate: 1.0, markup: 1.2, minQty: 1, maxQty: 1000, providerCurrency: 'USD', isDripFeedEnabled: false, isRefillEnabled: false, isCancelEnabled: false, category: { name: 'Cat' } },
      { numericId: 3, name: 'MicroRate', rate: 0.0001, markup: 3.0, minQty: 1, maxQty: 1000, providerCurrency: 'USD', isDripFeedEnabled: false, isRefillEnabled: false, isCancelEnabled: false, category: { name: 'Cat' } },
    ];

    const apiResult = await marketingService.getAPIFormattedServices(mockUser, services);
    const usdToRub = 100.0; // from settings mock

    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      const res = apiResult[i];
      const rateNum = parseFloat(res.rate);
      const minExpectedFloor = (s.rate * usdToRub * (1 + SAFETY_FLOOR_MARKUP)) / (1 - TOTAL_MANDATORY_DEDUCTIONS);
      
      const passed = rateNum >= parseFloat(minExpectedFloor.toFixed(4)) - 0.0001;
      recordTest(
        suite5,
        `API service ${s.name} (rate: ${res.rate} >= floor: ${minExpectedFloor.toFixed(4)})`,
        passed,
        `Got rate ${res.rate}, expected floor ${minExpectedFloor.toFixed(4)}`
      );
    }
  } catch (err: any) {
    recordTest(suite5, 'API Formatted Services check', false, err.message);
  }

  // ===========================================================================
  // TEST SUITE 6: Quarantine Loss Prevention & Audit Engine
  // ===========================================================================
  const suite6 = '6. Quarantine Loss Prevention & Audit Engine';
  console.log(`\n--- Running ${suite6} ---`);

  // Test isLossBreach under edge cases
  const lossCases = [
    { rate: 1.0, markup: 0.5, ex: 100, shouldBreach: true },
    { rate: 1.0, markup: 2.9, ex: 100, shouldBreach: true },
    { rate: 1.0, markup: 3.0, ex: 100, shouldBreach: false },
    { rate: 1.0, markup: 5.0, ex: 100, shouldBreach: false },
    { rate: 0.0001, markup: 2.0, ex: 100, shouldBreach: true },
    { rate: 0.0001, markup: 3.0, ex: 100, shouldBreach: false },
  ];

  for (const tc of lossCases) {
    const isBreach = QuarantineService.isLossBreach(tc.rate, tc.markup, tc.ex);
    const pass = isBreach === tc.shouldBreach;
    recordTest(
      suite6,
      `Quarantine isLossBreach (rate=${tc.rate}, markup=${tc.markup}, ex=${tc.ex})`,
      pass,
      `Expected ${tc.shouldBreach}, got ${isBreach}`
    );
  }

  // Test ServiceAuditEngine auto-fix logic
  const mockService = {
    id: 'audit_test_srv',
    name: 'Cheap SMM Promo',
    description: 'Buy cheap here',
    markup: 1.5,
    pricePer1000Cents: 15000,
    isQuarantined: false,
    quarantineReason: null,
    quarantinedAt: null,
  };
  const mockExt = { rate: '1.0' };
  const payloads = ServiceAuditEngine.auditAndFixService(mockService as any, mockExt, 100.0);

  const fixPass = mockService.markup === 3.0 && mockService.pricePer1000Cents > 15000 && payloads.length > 0;
  recordTest(suite6, 'ServiceAuditEngine auto-corrects markup < 3.0 to 3.0', fixPass, `markup=${mockService.markup}, price=${mockService.pricePer1000Cents}`);

  // ===========================================================================
  // SUMMARY OF RESULTS
  // ===========================================================================
  console.log('\n================================================================');
  console.log('📊 CHALLENGER STRESS TEST RESULTS SUMMARY');
  console.log('================================================================');
  let totalPassed = 0;
  let totalFailed = 0;

  for (const s of stats) {
    console.log(`\nSuite: ${s.suite}`);
    console.log(`  Passed: ${s.passed} | Failed: ${s.failed}`);
    if (s.failed > 0) {
      for (const d of s.details) {
        console.error(`  - ${d}`);
      }
    }
    totalPassed += s.passed;
    totalFailed += s.failed;
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`TOTAL: ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdversarialPricingSuite().catch((err) => {
  console.error('Fatal error in stress suite:', err);
  process.exit(1);
});
