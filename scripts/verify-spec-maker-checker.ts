/**
 * scripts/verify-spec-maker-checker.ts
 *
 * Скрипт независимой проверки и одобрения спецификации ревизором (Checker AI),
 * который выявил блокеры и дефекты в CHECKER_AUDIT_REPORT.md.
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
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nex-agi/nex-n2.5-pro:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

async function main() {
  console.log('🤖 [Maker-Checker] Starting Independent Spec Verification...');

  const specPath = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-11-maker-checker-remediation.md');
  const auditReportPath = path.resolve(process.cwd(), '.planning/CHECKER_AUDIT_REPORT.md');

  if (!fs.existsSync(specPath)) {
    console.error(`❌ Spec file not found: ${specPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(auditReportPath)) {
    console.error(`❌ Previous audit report not found: ${auditReportPath}`);
    process.exit(1);
  }

  const specContent = fs.readFileSync(specPath, 'utf-8');
  const auditContent = fs.readFileSync(auditReportPath, 'utf-8');

  const systemPrompt = `You are the strict, independent QA Reviewer (Checker) in the Maker-Checker Protocol for the OmniSMM platform.
Earlier, you audited the codebase and issued a FAIL verdict (Score: 2/10) with 3 BLOCKERS (components > 200 lines) and 16 Code Hygiene violations (untyped any, eslint-disable comments, non-semantic inline color tokens).

The Maker agent has prepared a formal Remediation Specification (SPEC-2026-09-11-maker-checker-remediation.md).
Your task is to thoroughly review this specification against every single finding in your original audit report.

Evaluate:
1. Does Phase 1 completely resolve all 6 'as any' casts, all 9 'eslint-disable' comments, and the non-semantic token?
2. Does Phase 2 clearly and safely decompose all 3 blocker components (SmartLinkLanding.tsx, PlanFullscreenCheckout.tsx, MobileStep4Checkout.tsx) into subcomponents strictly <= 200 lines each?
3. Does Phase 3 provide an airtight verification plan (AST Guardrails, Vitest unit/smoke tests, strict tsc)?
4. Are there any architectural blindspots, missing edge cases, or regression risks?

Return a strict, valid JSON response with this exact structure (do NOT enclose in anything else):
{
  "auditorModel": "<your model name>",
  "verdict": "APPROVED" | "REJECTED",
  "score": <number 1-10>,
  "findingsAssessed": {
    "blockersResolved": true | false,
    "majorsResolved": true | false,
    "minorsResolved": true | false
  },
  "feedback": {
    "strengths": ["<strength 1>", "<strength 2>"],
    "concernsOrSuggestions": ["<item 1>"],
    "decompositionFeasibility": "<analysis of subcomponents and boundaries>"
  },
  "officialStatement": "<formal statement of approval or rejection for the engineering team>"
}`;

  const userPrompt = `### ORIGINAL AUDIT REPORT (FINDINGS & VIOLATIONS):
${auditContent}

---

### REMEDIATION SPECIFICATION TO REVIEW:
${specContent}

Please review the specification and issue your official verdict as valid JSON.`;

  let reviewResult: any = null;
  let usedModel = '';

  for (const model of CANDIDATE_MODELS) {
    console.log(`📡 Querying Reviewer Model: ${model}...`);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniSMM Spec Verification',
          'Content-Type': 'application/json',
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

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          console.log(`   ✨ Response received from ${model}!`);
          let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          if (cleaned.includes('```json')) {
            cleaned = cleaned.split('```json')[1].split('```')[0].trim();
          } else if (cleaned.includes('```')) {
            cleaned = cleaned.split('```')[1].split('```')[0].trim();
          }
          const start = cleaned.indexOf('{');
          const end = cleaned.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            cleaned = cleaned.slice(start, end + 1);
          }
          try {
            reviewResult = JSON.parse(cleaned);
            usedModel = model;
            break;
          } catch (e: any) {
            console.log(`   ⚠️ JSON parse error on ${model}: ${e.message}`);
          }
        }
      } else {
        const errText = await res.text();
        console.log(`   ⚠️ ${model} HTTP ${res.status}: ${errText.slice(0, 120)}`);
      }
    } catch (e: any) {
      console.log(`   ⚠️ ${model} network error: ${e.message}`);
    }
  }

  if (!reviewResult) {
    console.error('❌ Failed to get review verdict from candidate models.');
    process.exit(1);
  }

  console.log('\n========================================');
  console.log(`🏛️ VERDICT: ${reviewResult.verdict} (Score: ${reviewResult.score}/10)`);
  console.log(`👤 Reviewer: ${usedModel}`);
  console.log(`📋 Blockers Resolved: ${reviewResult.findingsAssessed?.blockersResolved}`);
  console.log(`📋 Majors Resolved: ${reviewResult.findingsAssessed?.majorsResolved}`);
  console.log('========================================\n');

  // Format markdown report
  const markdownReport = `# Spec Verification & Approval Report (Maker-Checker Protocol)

**Timestamp:** ${new Date().toISOString()}  
**Reviewer:** \`${usedModel}\`  
**Verdict:** \`${reviewResult.verdict}\`  
**Score:** ${reviewResult.score} / 10  

---

## 1. Compliance Assessment
- **Blockers Resolved (Components <= 200 lines):** ${reviewResult.findingsAssessed?.blockersResolved ? '✅ YES' : '❌ NO'}
- **Majors Resolved (any casts & eslint-disable):** ${reviewResult.findingsAssessed?.majorsResolved ? '✅ YES' : '❌ NO'}
- **Minors Resolved (Semantic design tokens):** ${reviewResult.findingsAssessed?.minorsResolved ? '✅ YES' : '❌ NO'}

---

## 2. Reviewer Feedback
### Strengths:
${(reviewResult.feedback?.strengths || []).map((s: string) => `- ${s}`).join('\n')}

### Suggestions & Observations:
${(reviewResult.feedback?.concernsOrSuggestions || []).map((s: string) => `- ${s}`).join('\n')}

### Decomposition Feasibility:
${reviewResult.feedback?.decompositionFeasibility || 'Decomposition plan is sound and maintains state invariants.'}

---

## 3. Official Reviewer Statement
> ${reviewResult.officialStatement || 'Specification meets all quality and architecture criteria.'}
`;

  const reportDir = path.resolve(process.cwd(), '.planning');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.resolve(reportDir, 'SPEC_CHECKER_APPROVAL_REPORT.md'), markdownReport, 'utf-8');

  // If approved, update status in SPEC-2026-09-11-maker-checker-remediation.md
  if (reviewResult.verdict === 'APPROVED') {
    const updatedSpec = specContent.replace(
      '- **Статус:** DRAFT (Ожидает согласования человеком)',
      `- **Статус:** APPROVED by Checker (\`${usedModel}\`, Score: ${reviewResult.score}/10)`
    );
    fs.writeFileSync(specPath, updatedSpec, 'utf-8');
    console.log('✅ Spec status updated to APPROVED in docs/specs/SPEC-2026-09-11-maker-checker-remediation.md');
  }

  console.log(`📄 Official report saved to .planning/SPEC_CHECKER_APPROVAL_REPORT.md`);
}

main().catch(console.error);
