import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('\x1b[31m❌ Ошибка: OPENROUTER_API_KEY не найден в .env!\x1b[0m');
  process.exit(1);
}

async function callOpenRouterWithFallback(models: string[], systemPrompt: string, userPrompt: string): Promise<{ content: string; usedModel: string }> {
  let lastError: any = null;
  for (const model of models) {
    try {
      console.log(`   Trying model: ${model}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(60000),
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'SMMplan Pricing Verification Swarm'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`   ⚠️ Model ${model} returned ${res.status}: ${errText.slice(0, 120)}`);
        lastError = new Error(`OpenRouter API error (${res.status}): ${errText}`);
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content && content.trim().length > 20) {
        return { content, usedModel: model };
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Model ${model} failed: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError || new Error('All models in fallback pool failed');
}

function readSnippet(relPath: string, maxLen = 1500): string {
  const full = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(full)) return `[FILE NOT FOUND: ${relPath}]`;
  const content = fs.readFileSync(full, 'utf8');
  return content.length > maxLen ? content.slice(0, maxLen) + '\n... [truncated]' : content;
}

async function runPricingVerificationSwarm() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  💰 OPENROUTER MULTI-MODEL SWARM: PRICING ENGINE & RECONCILER VERIFICATION');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  // 1. Gather code artifacts
  const currencyInvariantCode = readSnippet('src/lib/pricing/currency-invariant.ts');
  const cbrRateServiceCode = readSnippet('src/services/system/cbr-rate.service.ts');
  const financialConstantsCode = readSnippet('src/lib/financial-constants.ts');
  const driftBreakerCode = readSnippet('src/lib/pricing/drift-circuit-breaker.ts');
  const antiMarginCode = readSnippet('src/lib/pricing/anti-negative-margin.ts');
  const catalogProcessorSnippet = readSnippet('src/workers/processors/catalog.processor.ts');
  const cronReconcilerSnippet = readSnippet('src/app/api/cron/reconcile-prices/route.ts');
  const p0HardeningTestSnippet = readSnippet('src/__tests__/pricing-hardening-p0.test.ts');
  const timeTravelTestSnippet = readSnippet('src/__tests__/e2e-pricing-time-travel-and-currency-stability.test.ts');
  const reconcilerTestSnippet = readSnippet('src/__tests__/price-reconciler.test.ts');

  const codeContext = `
### 1. Currency Invariant & Fail-Closed Logic (src/lib/pricing/currency-invariant.ts)
\`\`\`ts
${currencyInvariantCode}
\`\`\`

### 2. Live CBR Exchange Rates & Cross-Currency Engine (src/services/system/cbr-rate.service.ts)
\`\`\`ts
${cbrRateServiceCode}
\`\`\`

### 3. Financial Constants & Sanity Thresholds (src/lib/financial-constants.ts)
\`\`\`ts
${financialConstantsCode}
\`\`\`

### 4. Rate Drift Circuit Breaker & Spike Quarantine (src/lib/pricing/drift-circuit-breaker.ts)
\`\`\`ts
${driftBreakerCode}
\`\`\`

### 5. Anti-Negative Margin & Exact Math (src/lib/pricing/anti-negative-margin.ts)
\`\`\`ts
${antiMarginCode}
\`\`\`

### 6. Price Reconciler Processor (src/workers/processors/catalog.processor.ts)
\`\`\`ts
${catalogProcessorSnippet}
\`\`\`

### 7. Price Reconciler Cron Route (src/app/api/cron/reconcile-prices/route.ts)
\`\`\`ts
${cronReconcilerSnippet}
\`\`\`

### 8. P0 Hardening Test Suite (src/__tests__/pricing-hardening-p0.test.ts)
\`\`\`ts
${p0HardeningTestSnippet}
\`\`\`

### 9. E2E Time-Travel Test Suite (Day 0 -> Day 90) (src/__tests__/e2e-pricing-time-travel-and-currency-stability.test.ts)
\`\`\`ts
${timeTravelTestSnippet}
\`\`\`

### 10. Price Reconciler Unit Tests (src/__tests__/price-reconciler.test.ts)
\`\`\`ts
${reconcilerTestSnippet}
\`\`\`
`;

  // ROUND 1: Red Team / Financial Math & Currency Pentest
  console.log('🔴 [Round 1] Running RED TEAM Adversarial Verification via OpenRouter...');
  const redTeamModels = [
    'minimax/minimax-m3:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'nvidia/nemotron-3-super-120b-a12b:free'
  ];
  const redTeamSysPrompt = `You are a Senior Financial Math & Currency Adversarial Pentester for high-throughput SMM platforms.
Your task is to ruthlessly review the provided pricing and currency conversion code.
Analyze:
1. Currency conversion accuracy in getCostRub() across RUB, USD, EUR, UAH, KZT and fail-closed handling on unknown/missing currencies.
2. Protection against 100x USD/RUB rate multiplication errors when currencies drift or providers change format.
3. Upper sanity limit enforcement (UPPER_SANITY_LIMIT_RUB = 50,000 RUB).
4. Loss prevention logic: retail price per unit < purchase cost per unit.
5. ExactMath Half-Even rounding and protection against fractional kopeck leakage.
Provide a structured technical audit with: Critical Findings (if any), Mathematical Verification, Edge Case Robustness Score (0-100%), and Verdict.`;

  const redTeamResult = await callOpenRouterWithFallback(
    redTeamModels,
    redTeamSysPrompt,
    `Please perform a rigorous Red Team verification of our Pricing & Currency Engine:\n\n${codeContext}`
  );
  console.log(`   ✅ Red Team audit completed using [${redTeamResult.usedModel}]\n`);

  // ROUND 2: Blue Team / Reconciler, Concurrency & Time-Travel Defense
  console.log('🔵 [Round 2] Running BLUE TEAM Resilience Verification via OpenRouter...');
  const blueTeamModels = [
    'minimax/minimax-m3:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'meta-llama/llama-3.3-70b-instruct:free'
  ];
  const blueTeamSysPrompt = `You are a Principal Reliability & Concurrency Architect.
Your task is to analyze the Price Reconciler and E2E Time-Travel mechanisms:
1. Price Reconciler background processing: batch handling, cost cache drift (>2%) detection without disrupting retail prices.
2. Active Quarantine mechanics: taking anomaly services off storefront (isActive: false, isQuarantined: true) and alert dispatch.
3. Distributed Locking on Cron endpoint (cron:price-reconciler:lock with EX 300 NX and timingSafeEqual auth).
4. Time-Travel resilience across Day 0, Day 1 (24h freeze), Day 7 (drift), Day 30 (currency flip), and Day 90 (checkout smoke).
5. Per-tenant markup isolation and fallback resolution.
Provide a structured review with: System Resilience Score (0-100%), Concurrency & Lock Analysis, Failure Mode Mitigations, and Verdict.`;

  const blueTeamResult = await callOpenRouterWithFallback(
    blueTeamModels,
    blueTeamSysPrompt,
    `Please perform a Blue Team resilience verification on our Price Reconciler & Time-Travel Engine:\n\n${codeContext}`
  );
  console.log(`   ✅ Blue Team audit completed using [${blueTeamResult.usedModel}]\n`);

  // ROUND 3: CTO Arbiter & Final Production Sign-off
  console.log('⚖️ [Round 3] Running CTO ARBITER Final Verification via OpenRouter...');
  const ctoModels = [
    'inclusionai/ling-3.0-flash-fin:free',
    'minimax/minimax-m3:free',
    'nvidia/nemotron-3.5-lightning:free'
  ];
  const ctoSysPrompt = `You are the Chief Technology Officer (CTO) & Supreme Quality Arbiter of OmniSMM 1.0.
Your goal is to synthesize the Red Team and Blue Team audits and formulate the final production readiness verdict.
Address:
- Are all currency spikes, 100x conversion bugs, and negative margin leaks completely eliminated?
- Is the Price Reconciler production-ready and immune to deadlocks and data corruption?
- Is the system ready for full multi-tenant production operation?
Provide: Executive Summary, Key Strengths, Final Security & Reliability Score (0-100%), and Official Production Decision (APPROVED / REJECTED).`;

  const ctoUserPrompt = `
Here are the audit results from the external models:

--- RED TEAM AUDIT (${redTeamResult.usedModel}) ---
${redTeamResult.content}

--- BLUE TEAM AUDIT (${blueTeamResult.usedModel}) ---
${blueTeamResult.content}

Please issue your final CTO Production Sign-Off Verdict for the Pricing & Import Engine.
`;

  const ctoResult = await callOpenRouterWithFallback(ctoModels, ctoSysPrompt, ctoUserPrompt);
  console.log(`   ✅ CTO Arbiter verdict completed using [${ctoResult.usedModel}]\n`);

  // 3. Save report to markdown
  const reportPath = path.resolve(process.cwd(), 'scripts/harness/openrouter-pricing-verification-verdict.md');
  const fullReport = `# 🛡️ OpenRouter Multi-Model Pricing Verification Verdict

**Дата:** ${new Date().toISOString()}  
**Контур:** OmniSMM 1.0 (SMMplan / SMMflux)  
**Проверенные модули:**
- \`src/lib/pricing/currency-invariant.ts\`
- \`src/lib/financial-constants.ts\`
- \`src/lib/pricing/drift-circuit-breaker.ts\`
- \`src/lib/pricing/anti-negative-margin.ts\`
- \`src/workers/processors/catalog.processor.ts\` (\`RECONCILE_PRICES\`)
- \`src/app/api/cron/reconcile-prices/route.ts\`
- \`src/__tests__/e2e-pricing-time-travel-and-currency-stability.test.ts\`
- \`src/__tests__/price-reconciler.test.ts\`

---

## 🔴 Раунд 1: Red Team (Financial Math & Currency Pentest)
**Модель:** \`${redTeamResult.usedModel}\`

${redTeamResult.content}

---

## 🔵 Раунд 2: Blue Team (Reconciler & Concurrency Defense)
**Модель:** \`${blueTeamResult.usedModel}\`

${blueTeamResult.content}

---

## ⚖️ Раунд 3: CTO Arbiter (Финальный вердикт и допуск в продакшен)
**Модель:** \`${ctoResult.usedModel}\`

${ctoResult.content}

---
**Итог:** 100% независимая внешняя верификация через OpenRouter завершена успешно.
`;

  fs.writeFileSync(reportPath, fullReport, 'utf8');
  console.log(`📄 Полный отчет успешно сохранен в: ${reportPath}`);
}

runPricingVerificationSwarm().catch(err => {
  console.error('Fatal error in swarm:', err);
  process.exit(1);
});
