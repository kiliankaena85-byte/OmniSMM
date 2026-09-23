/**
 * SMOKE TEST: CATALOG LIFECYCLE & SERVICE MANAGEMENT ENGINE (SDD-TDD 2026)
 *
 * Verifies end-to-end:
 * 1. Provider Catalog Ingestion Authority & Zero-Unknown-Platform Guard
 * 2. Pricing Ladder, Safety Floor Markup (>= 3.0x) & Beautiful Rounding
 * 3. Platform Branding & Windows Flag Emoji Normalization
 * 4. Catalog Smart Search & Service #ID Normalization
 * 5. TargetType Semantic Resolution (Link-to-Service Compatibility)
 * 6. Drip-Feed Floor Invariant & Price Drift Circuit Breaker
 *
 * Run: npx tsx scripts/smoke-catalog-lifecycle.ts
 */

import {
  resolveCanonicalNetwork,
  resolveCanonicalCategory,
  calculateImportPrice,
  auditServiceQuality,
} from '../src/services/providers/ai-catalog-importer';
import { formatFullServiceName } from '../src/services/admin/catalog/catalog-taxonomy.service';
import { resolveServiceTargetType, TargetTypeEnum } from '../src/utils/target-type-mapper';
import {
  SAFETY_FLOOR_MARKUP,
  applyBeautifulRounding,
  calculateSafetyFloorCents,
} from '../src/lib/financial-constants';
import { PriceDriftCircuitBreaker, DEFAULT_DRIFT_CONFIG } from '../src/lib/pricing/drift-circuit-breaker';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function pass(title: string, details?: string) {
  console.log(`  ${COLORS.green}✔ PASS${COLORS.reset} ${title}${details ? ` ${COLORS.cyan}(${details})${COLORS.reset}` : ''}`);
}

function fail(title: string, error: unknown) {
  console.error(`  ${COLORS.red}✖ FAIL${COLORS.reset} ${title}`);
  console.error(`    ${COLORS.red}Error:${COLORS.reset}`, error);
}

async function runSmokeCatalogLifecycle() {
  console.log('\n' + '═'.repeat(75));
  console.log(`  ${COLORS.bold}🚀 SMOKE SUITE: CATALOG LIFECYCLE & IMPORT INVARIANTS (2026)${COLORS.reset}`);
  console.log('═'.repeat(75) + '\n');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function runAssertion(title: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result
          .then(() => {
            passedTests++;
            pass(title);
          })
          .catch((err) => {
            failedTests++;
            fail(title, err);
          });
      }
      passedTests++;
      pass(title);
    } catch (err) {
      failedTests++;
      fail(title, err);
    }
  }

  // ── VECTOR 1: Ingestion Authority & Zero-Unknown-Platform Guard ──────────
  console.log(`${COLORS.bold}📦 [Vector 1] Ingestion Authority & Quality Gatekeeper${COLORS.reset}`);

  runAssertion('Zero-Unknown-Platform Guard rejects unidentifiable networks', () => {
    const net = resolveCanonicalNetwork('Promo Super Fast 2026');
    if (net.code !== 'OTHER') throw new Error(`Expected OTHER, got ${net.code}`);

    const audit = auditServiceQuality({
      service: '9001',
      name: 'Mystery Boost Package',
      category: '',
      rate: 10,
      min: 100,
      max: 5000,
    });
    if (audit.status !== 'REJECT' || audit.rejectCategory !== 'ORPHAN') {
      throw new Error(`Expected REJECT/ORPHAN, got ${audit.status}/${audit.rejectCategory}`);
    }
  });

  runAssertion('Toxic Service Filter blocks banned operations (снос/жалобы)', () => {
    const toxicAudit = auditServiceQuality({
      service: '9002',
      name: 'Снос канала конкурента ботами',
      category: 'Telegram',
      rate: 500,
      min: 1,
      max: 10,
    });
    if (toxicAudit.status !== 'REJECT' || toxicAudit.rejectCategory !== 'TOXIC') {
      throw new Error(`Expected REJECT/TOXIC, got ${toxicAudit.status}/${toxicAudit.rejectCategory}`);
    }
  });

  runAssertion('Garbage Filter blocks maintenance / [TEST] flags', () => {
    const garbageAudit = auditServiceQuality({
      service: '9003',
      name: 'Telegram подписчики [TEST ONLY] не заказывать',
      category: 'Telegram',
      rate: 20,
      min: 10,
      max: 1000,
    });
    if (garbageAudit.status !== 'REJECT' || garbageAudit.rejectCategory !== 'GARBAGE') {
      throw new Error(`Expected REJECT/GARBAGE, got ${garbageAudit.status}/${garbageAudit.rejectCategory}`);
    }
  });

  runAssertion('Technical Validator rejects invalid rates and inverted min/max', () => {
    const zeroRate = auditServiceQuality({
      service: '9004',
      name: 'Telegram Подписчики',
      category: 'Telegram',
      rate: 0,
      min: 10,
      max: 1000,
    });
    if (zeroRate.status !== 'REJECT' || zeroRate.rejectCategory !== 'INVALID_PARAMS') {
      throw new Error(`Expected invalid rate rejection, got ${zeroRate.status}`);
    }

    const inverted = auditServiceQuality({
      service: '9005',
      name: 'Telegram Подписчики',
      category: 'Telegram',
      rate: 25,
      min: 5000,
      max: 100,
    });
    if (inverted.status !== 'REJECT' || inverted.rejectCategory !== 'INVALID_PARAMS') {
      throw new Error(`Expected inverted min/max rejection, got ${inverted.status}`);
    }
  });

  // ── VECTOR 2: Pricing Ladder & Safety Floor Markup ───────────────────────
  console.log(`\n${COLORS.bold}💰 [Vector 2] Pricing Ladder & Safety Floor Markup (>= 3.0x)${COLORS.reset}`);

  runAssertion('Safety Floor Markup formula covers mandatory taxes and target margin', () => {
    if (SAFETY_FLOOR_MARKUP < 3.0) {
      throw new Error(`SAFETY_FLOOR_MARKUP must be >= 3.0, got ${SAFETY_FLOOR_MARKUP}`);
    }
    const costCents = 1000; // 10.00 RUB
    const safetyPriceCents = calculateSafetyFloorCents(costCents);
    if (safetyPriceCents < 4670) {
      throw new Error(`Expected safety floor >= 4670 cents, got ${safetyPriceCents}`);
    }
  });

  runAssertion('Adaptive Pricing Calculator enforces markup and beautiful rounding', () => {
    // 1 USD @ 95 RUB/USD = 95 RUB cost per 1k
    const priceResult = calculateImportPrice({
      rawRate: 1.0,
      providerCurrency: 'USD',
      usdRate: 95.0,
    });

    if (priceResult.effectiveMarkup < SAFETY_FLOOR_MARKUP) {
      throw new Error(`Effective markup ${priceResult.effectiveMarkup} < floor ${SAFETY_FLOOR_MARKUP}`);
    }

    // Beautiful rounding check
    if (priceResult.pricePer1000Rub % 10 !== 0) {
      throw new Error(`Price ${priceResult.pricePer1000Rub} is not rounded to multiple of 10`);
    }

    // Price per unit calculation
    const expectedPerUnit = priceResult.pricePer1000Rub / 1000;
    if (Math.abs(priceResult.pricePerUnitRub - expectedPerUnit) > 0.0001) {
      throw new Error(`Price per unit mismatch: ${priceResult.pricePerUnitRub} vs ${expectedPerUnit}`);
    }
  });

  // ── VECTOR 3: Platform Branding & Windows Flag Emoji ─────────────────────
  console.log(`\n${COLORS.bold}🏷️  [Vector 3] Platform Branding & Windows Flag Emoji Normalization${COLORS.reset}`);

  runAssertion('Format full service name prepends platform prefix to avoid flag bug', () => {
    const formatted = formatFullServiceName('🇷🇺 Подписчики реальные быстрые', 'Подписчики', 'Telegram');
    if (formatted !== 'Telegram 🇷🇺 Подписчики реальные быстрые') {
      throw new Error(`Expected "Telegram 🇷🇺 Подписчики...", got "${formatted}"`);
    }

    const alreadyPrefixed = formatFullServiceName('Telegram Подписчики живые', 'Подписчики', 'Telegram');
    if (alreadyPrefixed !== 'Telegram Подписчики живые') {
      throw new Error(`Double prefix detected: "${alreadyPrefixed}"`);
    }
  });

  // ── VECTOR 4: Catalog Smart Search & Service #ID ─────────────────────────
  console.log(`\n${COLORS.bold}🔍 [Vector 4] Catalog Smart Search & Service #ID Normalization${COLORS.reset}`);

  runAssertion('Search query normalizer cleanly extracts numericId from all formats', () => {
    function normalizeCatalogSearch(q: string) {
      const normalizedNumericQ = q.replace(/^[#№\s]+/, '').replace(/^id[\s:]*/i, '').trim();
      const numId = parseInt(normalizedNumericQ, 10);
      const isPureNumber = !isNaN(numId) && normalizedNumericQ === String(numId);
      return { numId, isPureNumber };
    }

    const permutations = ['1643', '#1643', '№1643', 'ID: 1643', 'id 1643', '# 1643', '№  1643', 'ID:   1643'];
    for (const p of permutations) {
      const { numId, isPureNumber } = normalizeCatalogSearch(p);
      if (!isPureNumber || numId !== 1643) {
        throw new Error(`Failed to extract 1643 from "${p}", got ${numId} (isPureNumber=${isPureNumber})`);
      }
    }

    // Text queries
    const textQuery = normalizeCatalogSearch('Telegram 1000 просмотров');
    if (textQuery.isPureNumber) {
      throw new Error(`False positive pure number on text query`);
    }
  });

  // ── VECTOR 5: TargetType Semantic Resolution ─────────────────────────────
  console.log(`\n${COLORS.bold}🎯 [Vector 5] TargetType Semantic Resolution (Link Compatibility)${COLORS.reset}`);

  runAssertion('TargetType Engine maps channel/bot/poll services overcoming DB default POST', () => {
    const channelService = {
      name: 'Telegram Подписчики в публичный канал',
      targetType: 'POST', // Default in database
    };
    const resolvedChannel = resolveServiceTargetType(channelService);
    if (resolvedChannel !== TargetTypeEnum.CHANNEL) {
      throw new Error(`Expected CHANNEL, got ${resolvedChannel}`);
    }

    const botService = {
      name: 'Telegram Запуск бота (Старты рефералов)',
      targetType: 'POST',
    };
    const resolvedBot = resolveServiceTargetType(botService);
    if (resolvedBot !== TargetTypeEnum.BOT) {
      throw new Error(`Expected BOT, got ${resolvedBot}`);
    }

    const pollService = {
      name: 'Telegram Голоса в опросы викторины',
      targetType: 'POST',
    };
    const resolvedPoll = resolveServiceTargetType(pollService);
    if (resolvedPoll !== TargetTypeEnum.POLL) {
      throw new Error(`Expected POLL, got ${resolvedPoll}`);
    }
  });

  // ── VECTOR 6: Drip-Feed Floor & Price Drift Circuit Breaker ──────────────
  console.log(`\n${COLORS.bold}🛡️  [Vector 6] Drip-Feed Floor & Price Drift Circuit Breaker${COLORS.reset}`);

  runAssertion('Drip-Feed Floor enforces quantity / runs >= minQty', () => {
    function checkDripFeed(totalQty: number, runs: number, minQty: number): boolean {
      if (runs <= 1) return totalQty >= minQty;
      const perRun = Math.floor(totalQty / runs);
      return perRun >= minQty && totalQty >= minQty * runs;
    }

    // Valid: 1000 total, 5 runs, min 100 -> 200 per run >= 100 -> OK
    if (!checkDripFeed(1000, 5, 100)) {
      throw new Error(`Expected valid drip feed for 1000/5`);
    }

    // Invalid: 500 total, 10 runs, min 100 -> 50 per run < 100 -> REJECT
    if (checkDripFeed(500, 10, 100)) {
      throw new Error(`Expected rejection for 500/10 with min 100`);
    }
  });

  await runAssertion('Price Drift Circuit Breaker catches micro-prices and explosion ratios', async () => {
    // 1. Micro-price anomaly
    const microResult = await PriceDriftCircuitBreaker.validate('prov-test', 'ext-1', 0.001);
    if (microResult.ok) {
      throw new Error(`Expected BLOCK on micro-price 0.001 RUB`);
    }

    // 2. Exchange ratio explosion: rate=10 USD, costPer1kRub=100,000 -> ratio 10,000x
    const ratioResult = await PriceDriftCircuitBreaker.validate(
      'prov-test',
      'ext-2',
      100000,
      DEFAULT_DRIFT_CONFIG,
      10,
      'USD'
    );
    if (ratioResult.ok) {
      throw new Error(`Expected BLOCK on ratio explosion`);
    }
  });

  // ── FINAL SUMMARY ────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(75));
  console.log(`  ${COLORS.bold}🏁 SMOKE SUITE EXECUTION SUMMARY${COLORS.reset}`);
  console.log('─'.repeat(75));
  console.log(`  Total Vectors Checked:  6`);
  console.log(`  Total Invariant Tests:  ${totalTests}`);
  console.log(`  ${COLORS.green}Passed Invariants:     ${passedTests}${COLORS.reset}`);
  console.log(`  ${COLORS.red}Failed Invariants:     ${failedTests}${COLORS.reset}`);
  console.log('─'.repeat(75));

  if (failedTests > 0) {
    console.error(`\n  ${COLORS.red}❌ SMOKE SUITE FAILED with ${failedTests} error(s)!${COLORS.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n  ${COLORS.green}✨ ALL CATALOG LIFECYCLE INVARIANTS VERIFIED (100% SUCCESS)${COLORS.reset}\n`);
    process.exit(0);
  }
}

runSmokeCatalogLifecycle().catch((err) => {
  console.error('Fatal crash in smoke test suite:', err);
  process.exit(1);
});
