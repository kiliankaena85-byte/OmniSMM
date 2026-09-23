import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Auto-Flush Plan Review',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2500
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 150)}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function runSwarmPlanAudit() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🛡️  OPENROUTER ADVERSARIAL SWARM: AUTO-FLUSH ARCHITECTURE & PRE-MORTEM');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const planPath = 'C:/Users/Артём/.gemini/antigravity/brain/2016db99-759c-42ac-b603-0ce3374d29e3/implementation_plan.md';
  const planText = fs.existsSync(planPath) 
    ? fs.readFileSync(planPath, 'utf8')
    : 'Architecture Plan: Auto-Flush and Provider Balance Recovery Engine';

  const systemPrompt = `You are a Principal Security & Fintech Distributed Systems Architect (Adversarial Auditor).
Your task is to perform an uncompromising PRE-MORTEM and Security Review on an architectural proposal for an automated SMM order provider auto-flush system (handling balance recovery, BullMQ queues, provider API rate limits, double-charge guards, and state transitions).

Evaluate strictly against:
1. Double-Charge & Ledger Invariants: Are there any edge cases where a customer is charged twice or funds are drained unsafely?
2. Thundering Herd & API Rate Limits (429): Will rapid balance polling or mass order dispatch get our server IP banned by upstream providers?
3. Race Conditions: What if the operator clicks 'Retry' simultaneously while the background cron sweeps?
4. False-Positive Auto-Dispatch: Could an order with an invalid link / private profile get stuck in an endless retry storm?
5. Fail-Safe / Breaker Policy: Is the pre-mortem comprehensive, and what specific safeguards must be added to code?

Output format:
- Overall Verdict: [APPROVED WITH ENHANCEMENTS / REJECTED]
- Critical Vulnerability & Edge Case Audit (Points 1-5)
- Mandatory Architectural Guards (Concrete constraints for implementation)
- Summary score: 0-100`;

  const userPrompt = `Here is our proposed implementation plan and pre-mortem analysis:

${planText}

Please perform an adversarial review and pre-mortem failure simulation.`;

  const models = [
    'z-ai/glm-5.2:free',
    'minimax/minimax-m3:free',
    'minimax/minimax-m2.7:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openrouter/free'
  ];

  let successCount = 0;

  for (const model of models) {
    console.log(`📡 Querying Auditor Model: [${model}]...`);
    try {
      const response = await queryOpenRouter(model, systemPrompt, userPrompt);
      console.log(`\n────────────────────────────────────────────────────────────────────────`);
      console.log(`📝 VERDICT FROM [${model}]:`);
      console.log(`────────────────────────────────────────────────────────────────────────`);
      console.log(response);
      console.log(`────────────────────────────────────────────────────────────────────────\n`);
      successCount++;
      break;
    } catch (err) {
      console.warn(`⚠️ Model ${model} failed (${err instanceof Error ? err.message : String(err)}), trying fallback...`);
    }
  }

  if (successCount === 0) {
    console.log('Falling back to direct audit...');
  }
}

runSwarmPlanAudit().catch(console.error);
