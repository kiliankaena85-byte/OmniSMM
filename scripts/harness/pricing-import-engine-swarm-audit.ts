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

async function callOpenRouterWithFallback(models: string[], systemPrompt: string, userPrompt: string): Promise<string> {
  let lastError: any = null;
  for (const model of models) {
    try {
      console.log(`   Trying model: ${model}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'SMMplan Pricing & Import Engine Swarm Auditor'
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
        return content;
      }
    } catch (e: any) {
      console.warn(`   ⚠️ Model ${model} failed: ${e.message}`);
      lastError = e;
    }
  }
  throw lastError || new Error('All models in fallback pool failed');
}

async function runPricingImportSwarmAudit() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  💰 OPENROUTER ADVERSARIAL SWARM: PRICING & IMPORT ENGINE DEEP AUDIT');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const catalogServiceContent = fs.readFileSync('src/services/admin/catalog.service.ts', 'utf-8');
  const importCherryPickContent = fs.readFileSync('src/actions/admin/providers/import-cherry-pick.ts', 'utf-8');
  const providerBalanceContent = fs.readFileSync('src/services/admin/provider-balance.service.ts', 'utf-8');
  const catalogOrderActionContent = fs.readFileSync('src/actions/order/catalog.ts', 'utf-8');

  const codebaseSlice = `
### 1. Catalog Order Action (Retail Price Calculation):
\`\`\`typescript
${catalogOrderActionContent.slice(10000, 14000)}
\`\`\`

### 2. Catalog Service (Shadow Catalog Refresh & Currency Normalization):
\`\`\`typescript
${catalogServiceContent.slice(19000, 24500)}
\`\`\`

### 3. Import Services & Provider Currency Resolution:
\`\`\`typescript
${catalogServiceContent.slice(45000, 52000)}
\`\`\`

### 4. Provider Balance Service (Currency Detection & Balances):
\`\`\`typescript
${providerBalanceContent.slice(2500, 6500)}
\`\`\`
`;

  // Round 1: Red Team Adversarial Attack (GLM 5.2 / MiniMax M3)
  console.log('🔥 [ROUND 1] Red Team Adversarial Attack (GLM 5.2 / MiniMax M3)...');
  const redTeamSystem = `Ты — Principal Financial Systems & SMM Engine Red Team Auditor. Твоя задача — жестко атаковать движок импорта услуг, автоопределения валют, синхронизации цен и расчета наценок платформы OmniSMM:
1. Найди ВСЕ уязвимые места и сценарии сбоя ценообразования:
   - Автоопределение валюты: что будет, если провайдер отдает баланс в USD, а цены в RUB (или баланс в RUB, а цены в USD, или если панель использует неявную валюту без поля currency)?
   - Как провайдерские цены из теневого каталога (ShadowService) переносятся в боевой каталог (Service)? Может ли валюта провайдера перезаписать валюту услуги или наоборот?
   - Ошибки конвертации: где может произойти двойное умножение на курс доллара (x95) или двойное деление?
   - Дрейф цен и синхронизация: что произойдет, если провайдер внезапно поднимет цену в 10 раз или изменит валюту с USD на RUB во время ночного cron-обновления?
   - Наценки и маржинальность: нет ли случаев продажи в минус (Negative Margin) при низких minQty, микро-ценах (<0.01 руб) или Drip-Feed?
   - Multi-Tenant: корректно ли рассчитываются цены для SMMplan vs SMMflux?
2. Составь список из 5-7 конкретных сценариев отказа (Failure Scenarios) и багов с кодом.`;

  const redTeamAttack = await callOpenRouterWithFallback(
    [
      'z-ai/glm-5.2:free',
      'minimax/minimax-m3:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free'
    ],
    redTeamSystem,
    `Проанализируй кодовую базу движка импорта и ценообразования:\n\n${codebaseSlice}`
  );

  console.log('\n--- RED TEAM AUDIT REPORT ---');
  console.log(redTeamAttack + '\n');

  // Round 2: Blue Team Defense & Architectural Hardening (MiniMax M3 / Nemotron 3 Ultra)
  console.log('🛡️ [ROUND 2] Blue Team Verification & Hardening (MiniMax M3 / Nemotron 3 Ultra)...');
  const blueTeamSystem = `Ты — Blue Team Principal Financial & Distributed Systems Architect. Твоя задача:
1. Проанализировать каждую уязвимость и сценарий отказа от Red Team: отделить реальные системные риски от теоретических.
2. Спроектировать конкретные защитные инварианты (Guardrails) в кодовой базе:
   - Инвариант автодетекции валюты услуги (Service Currency Invariant).
   - Защита от дрейфа цен (Price Drift Threshold Circuit Breaker).
   - Защита от продажи в минус и валидация наценок.
   - Корректная синхронизация валюты провайдера и услуги.
3. Предложить точные фрагменты кода для исправления.`;

  const blueTeamDefense = await callOpenRouterWithFallback(
    [
      'minimax/minimax-m3:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'z-ai/glm-5.2:free'
    ],
    blueTeamSystem,
    `Архитектура:\n${codebaseSlice}\n\nКритика Red Team:\n${redTeamAttack}`
  );

  console.log('\n--- BLUE TEAM AUDIT REPORT ---');
  console.log(blueTeamDefense + '\n');

  // Round 3: CTO Arbiter Synthesis & Action Plan (Nemotron 3 Ultra 550B / Inkling)
  console.log('⚖️ [ROUND 3] CTO Arbiter Final Verdict & Action Directives (Nemotron 3 Ultra 550B)...');
  const ctoSystem = `Ты — CTO Arbiter платформы OmniSMM 1.0. 
1. Оцени надежность движка импорта и ценообразования от 0 до 100%.
2. Сформулируй вердикт: PASS, PASS_WITH_HARDENING, или BLOCK.
3. Сформируй список конкретных P0/P1 патчей для кодовой базы, чтобы навсегда исключить ошибки валют, искажение цен и финансовые потери.`;

  const ctoVerdict = await callOpenRouterWithFallback(
    [
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'thinkingmachines/inkling:free',
      'minimax/minimax-m3:free',
      'z-ai/glm-5.2:free'
    ],
    ctoSystem,
    `Архитектура:\n${codebaseSlice}\n\nRed Team Attack:\n${redTeamAttack}\n\nBlue Team Defense:\n${blueTeamDefense}`
  );

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log('  👑 CTO ARBITER FINAL VERDICT ON PRICING & IMPORT ENGINE');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
  console.log(ctoVerdict);

  fs.writeFileSync(
    'scripts/harness/pricing-import-engine-verdict.md',
    `# PRICING & IMPORT ENGINE SWARM AUDIT REPORT\n\n## Red Team Attack\n${redTeamAttack}\n\n## Blue Team Defense\n${blueTeamDefense}\n\n## CTO Verdict\n${ctoVerdict}`
  );
}

runPricingImportSwarmAudit().catch(console.error);
