/**
 * scripts/verify-tenant-enforcer-spec.ts
 *
 * Независимая проверка и аудит спецификации Автоматического Prisma Tenant Enforcer
 * с использованием бесплатной модели OpenRouter (cohere/north-mini-code:free и резервного пула).
 * Реализует Maker-Checker Protocol (Вектор: Architecture, Multi-Tenant Isolation & Zero-BOLA).
 */

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
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nex-agi/nex-n2.5-pro:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

async function main() {
  console.log('🤖 [Maker-Checker] Starting Independent Spec Verification via OpenRouter Free Models...');

  const specPath = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-11-automatic-prisma-tenant-enforcer.md');
  const skillPath = path.resolve(process.cwd(), '.agents/skills/multi-tenant-isolation-arch/SKILL.md');

  if (!fs.existsSync(specPath)) {
    console.error(`❌ Spec file not found: ${specPath}`);
    process.exit(1);
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');
  const skillSummary = fs.existsSync(skillPath)
    ? fs.readFileSync(skillPath, 'utf-8').slice(0, 4000)
    : '';

  const systemPrompt = `You are a world-class, rigorous Enterprise Security & Multi-Tenant Database Architect serving as an independent Checker in the Maker-Checker Protocol.
Your mission is to rigorously review the proposed architecture specification: "SPEC-2026-09-11-automatic-prisma-tenant-enforcer.md".

Context:
OmniSMM 1.0 is a high-load platform serving multiple brands (SMMplan, SMMflux) and external investor storefronts.
The proposed specification introduces an Automatic Prisma Client Extension (Enforcer) using Node.js AsyncLocalStorage to eliminate BOLA/IDOR vulnerabilities at the ORM layer.

Evaluate the specification against these 5 pillars:
1. Security & BOLA/IDOR Immunity: Does the automatic injection of tenantId into findMany/findFirst and conversion of findUnique into findFirst({ where: { id, tenantId } }) completely prevent cross-tenant data access?
2. Concurrency & Context Propagation: Does AsyncLocalStorage safely propagate across asynchronous execution, Promise chains, and nested calls without context pollution?
3. Edge Cases & Resilience: Are batch operations (createMany, updateMany), transactions, and unauthenticated/system tasks (workers, migrations) properly addressed with auditable bypass (runWithTenantBypass)?
4. Backward Compatibility: Will this break existing legitimate queries or cause performance degradation in high-throughput routes?
5. Architectural Hygiene: Does it comply with Hexagonal/Clean Architecture and Domain-Driven Design (DDD) invariants?

Return a strict, valid JSON response with this exact structure (no markdown fences, raw JSON only):
{
  "auditorModel": "<your model name>",
  "verdict": "APPROVED" | "REJECTED",
  "score": <integer from 1 to 10>,
  "findingsAssessed": {
    "bolaIdorImmunity": true | false,
    "concurrencySafety": true | false,
    "bypassSafety": true | false,
    "backwardCompatibility": true | false
  },
  "feedback": {
    "strengths": ["<strength 1>", "<strength 2>"],
    "concernsOrEdgeCases": ["<potential edge case or risk 1>"],
    "architecturalRecommendation": "<guidance for production rollout>"
  },
  "officialStatement": "<formal verdict and recommendation for the OmniSMM engineering team>"
}`;

  const userPrompt = `### MULTI-TENANT ISOLATION SKILL CONTEXT:
${skillSummary}

---

### SPECIFICATION TO AUDIT:
${specContent}

Please analyze this specification and output your verdict as raw JSON.`;

  let reviewResult: any = null;
  let usedModel = '';

  for (const model of CANDIDATE_MODELS) {
    console.log(`📡 Querying Reviewer Model: ${model}...`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM-Maker-Checker',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`  ⚠️ Model ${model} returned HTTP ${response.status}: ${errorText.slice(0, 150)}`);
        continue;
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content?.trim();

      if (!rawContent) {
        console.warn(`  ⚠️ Model ${model} returned empty content.`);
        continue;
      }

      // Clean markdown fences if any
      const cleaned = rawContent
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      try {
        reviewResult = JSON.parse(cleaned);
        usedModel = model;
        console.log(`  ✓ Successfully received verdict from ${model}!`);
        break;
      } catch (e) {
        // Attempt to extract JSON via regex
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          reviewResult = JSON.parse(match[0]);
          usedModel = model;
          console.log(`  ✓ Extracted valid JSON from ${model}!`);
          break;
        }
        console.warn(`  ⚠️ Failed to parse JSON from ${model}. Response snippet: ${cleaned.slice(0, 150)}`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️ Error connecting to ${model}: ${err.message}`);
    }
  }

  if (!reviewResult) {
    console.error('❌ All OpenRouter models failed or were unavailable.');
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log(`  INDEPENDENT CHECKER AUDIT REPORT (${usedModel})      `);
  console.log('======================================================');
  console.log(`Verdict: ${reviewResult.verdict} (Score: ${reviewResult.score}/10)`);
  console.log(`Official Statement: ${reviewResult.officialStatement}`);
  console.log('Strengths:');
  reviewResult.feedback?.strengths?.forEach((s: string) => console.log(`  + ${s}`));
  console.log('Concerns & Edge Cases:');
  reviewResult.feedback?.concernsOrEdgeCases?.forEach((c: string) => console.log(`  - ${c}`));

  // Write audit report to .planning
  const reportPath = path.resolve(process.cwd(), '.planning/SPEC_TENANT_ENFORCER_AUDIT_REPORT.md');
  const mdReport = `# INDEPENDENT CHECKER AUDIT REPORT: Automatic Prisma Tenant Enforcer

> **Reviewer Model:** \`${usedModel}\` (OpenRouter Free Tier)  
> **Verdict:** **${reviewResult.verdict}**  
> **Score:** **${reviewResult.score} / 10**  
> **Date:** ${new Date().toISOString()}  
> **Target Specification:** \`docs/specs/SPEC-2026-09-11-automatic-prisma-tenant-enforcer.md\`

---

## 1. Executive Summary & Findings Assessment

| Vector | Status | Assessment |
| :--- | :--- | :--- |
| **BOLA / IDOR Immunity** | ${reviewResult.findingsAssessed?.bolaIdorImmunity ? '✅ PASS' : '❌ FAIL'} | Automated injection of tenantId on queries & findUnique conversion |
| **Concurrency Safety** | ${reviewResult.findingsAssessed?.concurrencySafety ? '✅ PASS' : '❌ FAIL'} | AsyncLocalStorage propagation across async tasks |
| **Bypass & Audit Safety** | ${reviewResult.findingsAssessed?.bypassSafety ? '✅ PASS' : '❌ FAIL'} | Explicit, auditable runWithTenantBypass(reason) |
| **Backward Compatibility** | ${reviewResult.findingsAssessed?.backwardCompatibility ? '✅ PASS' : '❌ FAIL'} | Transparent handling when no tenant context is required |

---

## 2. Reviewer Feedback & Analysis

### Strengths:
${reviewResult.feedback?.strengths?.map((s: string) => `- ${s}`).join('\n') || '- None noted'}

### Concerns & Edge Cases:
${reviewResult.feedback?.concernsOrEdgeCases?.map((c: string) => `- ${c}`).join('\n') || '- None noted'}

### Architectural Recommendation:
> ${reviewResult.feedback?.architecturalRecommendation || 'Proceed with implementation according to the specification.'}

---

## 3. Official Statement of Approval:
> "${reviewResult.officialStatement}"
`;

  fs.writeFileSync(reportPath, mdReport, 'utf-8');
  console.log(`\n✓ Formal report written to ${reportPath}`);
}

main().catch((e) => {
  console.error('Fatal error in spec verification:', e);
  process.exit(1);
});
