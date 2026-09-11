import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_KEYS = Array.from(
  new Set(
    [
      process.env.OPENROUTER_API_KEY,
      ...(process.env.OPENROUTER_API_KEYS ? process.env.OPENROUTER_API_KEYS.split(',') : []),
    ]
      .filter((k): k is string => Boolean(k && k.trim().startsWith('sk-or-v1-')))
      .map((k) => k.trim())
  )
);
const OPENROUTER_API_KEY = OPENROUTER_KEYS[0] || '';

const CANDIDATE_MODELS = [
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'nex-agi/nex-n2.5-pro:free',
  'google/gemma-4-31b-it:free'
];

async function main() {
  console.log('🤖 [Maker-Checker] Auditing Headless Storefront Gateway Spec via Free OpenRouter Model...');

  const specPath = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-11-headless-storefront-gateway.md');
  if (!fs.existsSync(specPath)) {
    console.error(`❌ Spec file not found: ${specPath}`);
    process.exit(1);
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');

  const systemPrompt = `You are a strict Principal Security Architect & API Reviewer in the Maker-Checker Protocol for the OmniSMM multi-tenant platform.
Review the newly proposed SDD specification for Headless Storefront Gateway (SPEC-2026-09-11-headless-storefront-gateway.md).

Evaluate against:
1. Multi-Tenant Isolation & BOLA/IDOR Defense (Does it prevent cross-tenant data leaks and vendor leaks?).
2. REST API Quality & DTO Design (Are endpoints idiomatic, secure, and well-specified?).
3. Rate Limiting, Abuse Prevention, RFC 9331.
4. Completeness of Failure Simulation (Pre-Mortem) and Verification Plan.

Your output must conclude with:
- Score: X / 10
- Verdict: APPROVED or REVISE
- Specific observations and recommendations.`;

  let verdict = '';
  for (const model of CANDIDATE_MODELS) {
    console.log(`📡 Querying model: ${model}...`);
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Maker-Checker Audit',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please audit this specification:\n\n${specContent}` },
          ],
          temperature: 0.1,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.warn(`⚠️ Model ${model} returned HTTP ${resp.status}: ${txt.slice(0, 150)}`);
        continue;
      }

      const data = await resp.json();
      verdict = data?.choices?.[0]?.message?.content || '';
      if (verdict) {
        console.log(`✅ Success from model: ${model}`);
        break;
      }
    } catch (e: any) {
      console.warn(`⚠️ Error contacting ${model}:`, e.message);
    }
  }

  if (!verdict) {
    console.error('❌ Failed to get response from free models');
    process.exit(1);
  }

  const reportPath = path.resolve(process.cwd(), '.planning/SPEC_STOREFRONT_AUDIT_REPORT.md');
  fs.writeFileSync(reportPath, verdict, 'utf-8');
  console.log(`📄 Saved audit report to ${reportPath}`);
  console.log('\n--- VERDICT SUMMARY ---');
  console.log(verdict.slice(0, 800));
}

main().catch(console.error);
