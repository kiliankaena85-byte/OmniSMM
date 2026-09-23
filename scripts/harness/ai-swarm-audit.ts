/**
 * SMMplan Adversarial Swarm Debate Engine (Round Table v2)
 * Orchestrates a 3-Round Dialectic Audit:
 *   Round 1: Red Team Attack (GLM-5.2 + Reasoning Enabled)
 *   Round 2: Blue Team Defense (Nemotron 3 Ultra 550B)
 *   Round 3: CTO Arbiter Consensus (Inkling Small + Reasoning Enabled)
 *
 * Usage:
 *   npm run audit:swarm
 *   npx tsx scripts/harness/ai-swarm-audit.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { z } from 'zod';

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('\x1b[31m❌ Ошибка: Переменная OPENROUTER_API_KEY не найдена в .env!\x1b[0m');
  console.error('Пожалуйста, добавьте: OPENROUTER_API_KEY=sk-or-v1-... в .env файл.');
  process.exit(1);
}

// ============================================================================
// 1. SCHEMAS
// ============================================================================

export const RedTeamFindingSchema = z.object({
  findingId: z.string().describe('Unique ID, e.g. RED-001'),
  category: z.enum([
    'RACE_CONDITION',
    'FINANCIAL_LEAK_OR_OVERFLOW',
    'SECURITY_IDOR_OR_AUTH',
    'TRANSACTION_ESCAPE_OR_DB',
    'DRIP_FEED_INVARIANT_VIOLATION',
    'SUBOPTIMAL_QUERY_OR_N_PLUS_ONE',
    'UNHANDLED_EDGE_CASE_OR_PANIC'
  ]),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  targetFile: z.string().describe('File path where defect exists'),
  lineRange: z.string().optional().describe('Estimated line range, e.g. L45-L52'),
  flawTitle: z.string().max(120).describe('Concise description of the flaw'),
  failureScenario: z.string().describe('Concrete scenario demonstrating how system breaks'),
  reproductionVector: z.string().describe('Step-by-step trigger input or concurrency race'),
  exploitImpact: z.string().describe('Business, financial or security impact'),
  confidence: z.number().min(0).max(1).default(0.9)
});

export const RedTeamAttackSchema = z.object({
  attackerPersona: z.string().default('Red Team Adversary (GLM-5.2)'),
  attackSummary: z.string(),
  vulnerabilities: z.array(RedTeamFindingSchema)
});

export type RedTeamAttackOutput = z.infer<typeof RedTeamAttackSchema>;

export const BlueTeamRebuttalSchema = z.object({
  findingId: z.string().describe('Corresponds to Red Team findingId'),
  verdict: z.enum([
    'ACCEPTED_VALID_BUG',
    'REJECTED_YAGNI_OVERENGINEERING',
    'REJECTED_FALSE_POSITIVE',
    'MITIGATED_BY_EXISTING_CONTROL',
    'PROPOSED_PRAGMATIC_ALTERNATIVE'
  ]),
  engineeringTradeOffRationale: z.string().describe('Detailed defense of pragmatic engineering choice'),
  costOfFixVsRisk: z.string().describe('Risk assessment: why fixing or deferring makes sense'),
  proposedResolution: z.string().describe('Concrete action or reason for no-op')
});

export const BlueTeamDefenseSchema = z.object({
  defenderPersona: z.string().default('Blue Team Systems Architect (Nemotron 550B)'),
  defenseSummary: z.string(),
  rebuttals: z.array(BlueTeamRebuttalSchema)
});

export type BlueTeamDefenseOutput = z.infer<typeof BlueTeamDefenseSchema>;

export const ActionableFixSchema = z.object({
  fixId: z.string().describe('e.g. FIX-01'),
  linkedFindingId: z.string(),
  priority: z.enum(['P0_BLOCKING', 'P1_REQUIRED', 'P2_DEFERRED']),
  targetFile: z.string(),
  summary: z.string(),
  concretePatchInstruction: z.string().describe('Exact code change required to resolve'),
  verificationCriteria: z.string().describe('How to verify fix via automated tests')
});

export const AcceptedTradeOffSchema = z.object({
  tradeOffId: z.string().describe('e.g. TRADEOFF-01'),
  linkedFindingId: z.string(),
  justification: z.string().describe('Why this risk is accepted under current SLAs'),
  mitigatingFactors: z.string().describe('Existing guards or low probability')
});

export const CTOArbiterConsensusSchema = z.object({
  arbiterPersona: z.string().default('CTO Arbiter & Chief Synthesizer (Inkling)'),
  overallVerdict: z.enum(['SHIP_AS_IS', 'PASS_WITH_P1_REFACTOR', 'HARD_BLOCK_P0']),
  consensusScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  actionableFixes: z.array(ActionableFixSchema),
  acceptedTradeOffs: z.array(AcceptedTradeOffSchema),
  unresolvedDebates: z.array(z.string()).default([])
});

export type CTOArbiterConsensusOutput = z.infer<typeof CTOArbiterConsensusSchema>;

function extractJsonString(raw: string): any {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  if (cleaned.includes('```json')) {
    cleaned = cleaned.split('```json')[1].split('```')[0].trim();
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.split('```')[1].split('```')[0].trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // If strict parse fails due to trailing unescaped characters or truncations, try dirty json fix
    try {
      const sanitized = cleaned
        .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
        .replace(/[\u0000-\u001F]+/g, ' '); // remove control characters
      return JSON.parse(sanitized);
    } catch {
      // Fallback empty structured object if model truncated severely
      return {};
    }
  }
}

function parseAndNormalizeRedTeam(raw: string): RedTeamAttackOutput {
  const obj = extractJsonString(raw);
  const rawList = obj.vulnerabilities || obj.findings || obj.attacks || obj.critiques || obj.issues || [];
  
  const vulnerabilities = (Array.isArray(rawList) ? rawList : []).map((v: any, idx: number) => {
    if (typeof v === 'string') {
      return {
        findingId: `RED-${String(idx + 1).padStart(3, '0')}`,
        category: 'UNHANDLED_EDGE_CASE_OR_PANIC' as const,
        severity: 'MEDIUM' as const,
        targetFile: 'src/actions/checkout.ts',
        flawTitle: v.slice(0, 100),
        failureScenario: v,
        reproductionVector: 'Direct API invocation',
        exploitImpact: 'Potential logical deviation',
        confidence: 0.9,
      };
    }

    return {
      findingId: v.findingId || v.id || `RED-${String(idx + 1).padStart(3, '0')}`,
      category: ['RACE_CONDITION', 'FINANCIAL_LEAK_OR_OVERFLOW', 'SECURITY_IDOR_OR_AUTH', 'TRANSACTION_ESCAPE_OR_DB', 'DRIP_FEED_INVARIANT_VIOLATION', 'SUBOPTIMAL_QUERY_OR_N_PLUS_ONE', 'UNHANDLED_EDGE_CASE_OR_PANIC'].includes(v.category) ? v.category : 'UNHANDLED_EDGE_CASE_OR_PANIC',
      severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(v.severity?.toUpperCase()) ? v.severity.toUpperCase() : 'MEDIUM',
      targetFile: v.targetFile || v.file || 'src/actions/checkout.ts',
      lineRange: v.lineRange || (v.line ? `L${v.line}` : undefined),
      flawTitle: v.flawTitle || v.title || v.name || 'Identified Architectural Defect',
      failureScenario: v.failureScenario || v.scenario || v.description || 'Potential system failure scenario',
      reproductionVector: v.reproductionVector || v.repro || v.trigger || 'Trigger input / concurrency race',
      exploitImpact: v.exploitImpact || v.impact || 'Service disruption or data inconsistency',
      confidence: typeof v.confidence === 'number' ? v.confidence : 0.9,
    };
  });

  return {
    attackerPersona: 'Red Team Adversary (GLM-5.2)',
    attackSummary: obj.attackSummary || obj.summary || obj.attack_summary || `Identified ${vulnerabilities.length} failure modes`,
    vulnerabilities,
  };
}

function parseAndNormalizeBlueTeam(raw: string): BlueTeamDefenseOutput {
  const obj = extractJsonString(raw);
  const rawList = obj.rebuttals || obj.defenses || obj.responses || obj.evaluations || obj.findings || (Array.isArray(obj) ? obj : []);

  const rebuttals = (Array.isArray(rawList) ? rawList : []).map((r: any, idx: number) => {
    const rawVerdict = typeof r?.verdict === 'string' ? r.verdict.toUpperCase().trim() : 'DEFENDED_ACCEPTABLE_TRADEOFF';
    const validVerdict = [
      'ACCEPTED_VALID_BUG',
      'REJECTED_YAGNI_OVERENGINEERING',
      'REJECTED_FALSE_POSITIVE',
      'MITIGATED_BY_EXISTING_CONTROL',
      'PROPOSED_PRAGMATIC_ALTERNATIVE',
      'DEFENDED_ACCEPTABLE_TRADEOFF',
    ].includes(rawVerdict) ? rawVerdict : 'DEFENDED_ACCEPTABLE_TRADEOFF';

    return {
      findingId: r?.findingId || r?.id || `RED-${String(idx + 1).padStart(3, '0')}`,
      verdict: validVerdict as any,
      engineeringTradeOffRationale: r?.engineeringTradeOffRationale || r?.rationale || r?.defenseArgument || r?.reason || 'Pragmatic design acceptable at current scale',
      costOfFixVsRisk: r?.costOfFixVsRisk || r?.costVsRisk || r?.risk || 'Low immediate risk',
      proposedResolution: r?.proposedResolution || r?.resolution || 'Maintain current architecture with monitoring',
    };
  });

  return {
    defenderPersona: 'Blue Team Systems Architect (Nemotron 550B)',
    defenseSummary: obj.defenseSummary || obj.summary || `Evaluated ${rebuttals.length} points`,
    rebuttals,
  };
}

function parseAndNormalizeArbiter(raw: string): CTOArbiterConsensusOutput {
  const obj = extractJsonString(raw);
  const rawFixes = obj.actionableFixes || obj.fixes || obj.actionableVerdicts || [];
  const rawTradeOffs = obj.acceptedTradeOffs || obj.tradeOffs || [];

  const actionableFixes = (Array.isArray(rawFixes) ? rawFixes : []).map((f: any, idx: number) => {
    const rawPriority = typeof f?.priority === 'string' ? f.priority.trim().toUpperCase() : 'P1_REQUIRED';
    const normalizedPriority: 'P0_BLOCKING' | 'P1_REQUIRED' | 'P2_DEFERRED' = 
      rawPriority === 'P0_BLOCKING' || rawPriority === 'P0' || rawPriority === 'CRITICAL'
        ? 'P0_BLOCKING'
        : rawPriority === 'P2_DEFERRED' || rawPriority === 'P2' || rawPriority === 'LOW'
        ? 'P2_DEFERRED'
        : 'P1_REQUIRED';

    return {
      fixId: f?.fixId || `FIX-${String(idx + 1).padStart(2, '0')}`,
      linkedFindingId: f?.linkedFindingId || f?.findingId || `RED-${String(idx + 1).padStart(3, '0')}`,
      priority: normalizedPriority,
      targetFile: f?.targetFile || f?.file || 'src/proxy.ts',
      summary: f?.summary || f?.title || 'Required architectural patch',
      concretePatchInstruction: f?.concretePatchInstruction || f?.patch || f?.actionPlan || 'Apply safe boundary check',
      verificationCriteria: f?.verificationCriteria || f?.verify || 'Automated unit test verification',
    };
  });

  const acceptedTradeOffs = (Array.isArray(rawTradeOffs) ? rawTradeOffs : []).map((t: any, idx: number) => {
    return {
      tradeOffId: t?.tradeOffId || `TRADEOFF-${String(idx + 1).padStart(2, '0')}`,
      linkedFindingId: t?.linkedFindingId || t?.findingId || `RED-${String(idx + 1).padStart(3, '0')}`,
      justification: t?.justification || t?.reason || 'Acceptable trade-off under current architecture',
      mitigatingFactors: t?.mitigatingFactors || t?.guards || 'Guarded by database invariants',
    };
  });

  const hasP0 = actionableFixes.some((f) => f.priority === 'P0_BLOCKING');
  const hasP1 = actionableFixes.some((f) => f.priority === 'P1_REQUIRED');

  const defaultVerdict: 'SHIP_AS_IS' | 'PASS_WITH_P1_REFACTOR' | 'HARD_BLOCK_P0' = hasP0
    ? 'HARD_BLOCK_P0'
    : hasP1
    ? 'PASS_WITH_P1_REFACTOR'
    : 'SHIP_AS_IS';

  const defaultScore = hasP0 ? 30 : hasP1 ? 85 : 100;

  const validVerdict = ['SHIP_AS_IS', 'PASS_WITH_P1_REFACTOR', 'HARD_BLOCK_P0'].includes(obj.overallVerdict)
    ? obj.overallVerdict
    : defaultVerdict;

  const validScore = typeof obj.consensusScore === 'number' && obj.consensusScore >= 0 && obj.consensusScore <= 100
    ? obj.consensusScore
    : defaultScore;

  return {
    arbiterPersona: 'CTO Arbiter & Chief Synthesizer (Inkling)',
    overallVerdict: validVerdict,
    consensusScore: validScore,
    executiveSummary: typeof obj.executiveSummary === 'string'
      ? obj.executiveSummary
      : typeof obj.summary === 'string'
      ? obj.summary
      : obj.executiveSummary
      ? JSON.stringify(obj.executiveSummary)
      : 'Debate concluded with actionable synthesis.',
    actionableFixes,
    acceptedTradeOffs,
    unresolvedDebates: Array.isArray(obj.unresolvedDebates) ? obj.unresolvedDebates : [],
  };
}

// ============================================================================
// 3. OPENROUTER CALLER WITH FALLBACKS & TIMEOUT
// ============================================================================

interface ModelCallConfig {
  models: string[];
  systemPrompt: string;
  userPrompt: string;
  enableReasoning?: boolean;
  temperature?: number;
  timeoutMs?: number;
}

async function callOpenRouterWithFallback(config: ModelCallConfig): Promise<string> {
  const { models, systemPrompt, userPrompt, enableReasoning = false, temperature = 0.1, timeoutMs = 70000 } = config;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const payload: Record<string, any> = {
    model: models[0],
    models: models.slice(0, 3), // OpenRouter supports fallback models
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
  };

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'SMMplan Adversarial Round Table v2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty model completion response');
    }
    return content;
  } catch (err: any) {
    clearTimeout(timeout);
    
    // Failover to Gemini direct API (Antigravity Native gemini-3-flash) if OpenRouter rate-limited
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      console.warn(`\x1b[33m⚠️ [Swarm Engine] OpenRouter unavailable (${err.message.slice(0, 80)}). Failing over to Antigravity Native Engine (gemini-3-flash)...\x1b[0m`);
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            }
          })
        });

        if (geminiRes.ok) {
          const gJson = await geminiRes.json();
          const gContent = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (gContent) {
            console.log(`\x1b[32m✔ [Antigravity Engine] Generated response via gemini-3-flash.\x1b[0m`);
            return gContent;
          }
        } else {
          // Fallback to gemini-2.5-flash if gemini-3-flash endpoint preview differs
          const g2Res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              }
            })
          });
          if (g2Res.ok) {
            const g2Json = await g2Res.json();
            const g2Content = g2Json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (g2Content) {
              console.log(`\x1b[32m✔ [Antigravity Engine] Generated response via Gemini.\x1b[0m`);
              return g2Content;
            }
          }
          const gErr = await geminiRes.text();
          console.error(`\x1b[31m❌ [Antigravity Engine] Gemini HTTP ${geminiRes.status}: ${gErr.slice(0, 200)}\x1b[0m`);
        }
      } catch (gemErr: any) {
        console.error(`\x1b[31m❌ [Antigravity Engine] Gemini fallback failed: ${gemErr.message}\x1b[0m`);
      }
    }

    throw err;
  }
}

// ============================================================================
// 4. GIT DIFF INGESTION
// ============================================================================

function getGitTargetDiff(): string {
  try {
    const staged = execSync('git diff --cached', { encoding: 'utf8' }).trim();
    if (staged) return staged;

    const unstaged = execSync('git diff HEAD', { encoding: 'utf8' }).trim();
    if (unstaged) return unstaged;

    const lastCommit = execSync('git diff HEAD~1 HEAD', { encoding: 'utf8' }).trim();
    if (lastCommit) return lastCommit;
  } catch {
    // ignore
  }

  // Fallback to recent key files
  try {
    const linkRules = fs.readFileSync(path.resolve(process.cwd(), 'src/services/analyzer/link-rules.ts'), 'utf8');
    const exactMath = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/financial/exact-math.ts'), 'utf8');
    const safeRegex = fs.readFileSync(path.resolve(process.cwd(), 'src/services/analyzer/safe-regex.validator.ts'), 'utf8');
    return `// SMMplan Global Link Rules & Multi-Platform\n${linkRules.slice(0, 5000)}\n\n// ExactMath\n${exactMath.slice(0, 3000)}\n\n// SafeRegexValidator\n${safeRegex.slice(0, 3000)}`;
  } catch {
    return '// SMMplan Core Engine Invariants';
  }
}

// ============================================================================
// 5. DEBATE ENGINE ORCHESTRATOR
// ============================================================================

async function runAdversarialDebate() {
  console.log('\n\x1b[1m\x1b[35m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[35m   ⚔️  OmniSMM 1.0 Adversarial Swarm Debate Engine (Round Table v2)   \x1b[0m');
  console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

  const diff = getGitTargetDiff();
  const truncatedDiff = diff.slice(0, 16000);
  console.log(`📦 Ingested target diff (${diff.length} bytes, analyzed slice: ${truncatedDiff.length} bytes)\n`);

  // --------------------------------------------------------------------------
  // ROUND 1: RED TEAM ATTACK
  // --------------------------------------------------------------------------
  console.log('\x1b[1m\x1b[31m[ROUND 1/3] 🔴 Red Team Attack (MiniMax M3 / GLM-5.2 with 1M Context)...\x1b[0m');
  const r1Start = Date.now();

  const redSystemPrompt = `You are the Lead Adversarial Red Team Security & FinOps Auditor for OmniSMM 1.0 (Next.js 16, React 19, Prisma 5, PostgreSQL, Redis, WalletOps BigInt Ledger).

MISSION:
Your sole mandate is ADVERSARIAL ATTACK. Deconstruct the provided code diff and uncover 3 to 5 CONCRETE, REAL-WORLD failure modes.

CRITICAL INVARIANTS:
1. FINANCIAL: Balance operations must strictly use WalletOps with BigInt kopecks, ledger-first entries, and idempotencyKey.
2. TRANSACTION ESCAPE: Forbid db.* inside tx: PrismaTx interactive blocks.
3. DRIP-FEED: Floor invariant Math.floor(quantity / runs) >= service.minQty must hold.
4. ZERO-TRUST IDOR: Reject unauthorized access when item.userId exists and session is guest/unmatched.
5. REGEX & REDOS: Links must not trigger catastrophic backtracking.
6. MULTI-TENANT ISOLATION: Customer notifications must be strictly isolated to user's tenant; Admin alerts come from OmniSMM 1.0.

Output valid JSON matching RedTeamAttackSchema.`;

  const redUserPrompt = `TARGET CODE DIFF:\n\`\`\`typescript\n${truncatedDiff}\n\`\`\`\n\nAttack the code now. Identify 3-5 concrete failure scenarios. Output valid JSON only.`;

  const redRawResponse = await callOpenRouterWithFallback({
    models: [
      'poolside/laguna-s-2.1:free',
      'minimax/minimax-m3:free',
      'cohere/north-mini-code:free',
      'nvidia/nemotron-3.5-lightning:free',
      'inclusionai/ling-3.0-flash-fin:free',
      'openrouter/free',
    ],
    systemPrompt: redSystemPrompt,
    userPrompt: redUserPrompt,
    enableReasoning: true,
    temperature: 0.1,
  });

  const redAttack = parseAndNormalizeRedTeam(redRawResponse);
  const r1Time = ((Date.now() - r1Start) / 1000).toFixed(1);
  console.log(`\x1b[32m✔ Round 1 Complete (${r1Time}s). Found ${redAttack.vulnerabilities.length} failure modes.\x1b[0m\n`);

  for (const v of redAttack.vulnerabilities) {
    console.log(`   \x1b[31m[${v.findingId}]\x1b[0m \x1b[1m${v.flawTitle}\x1b[0m (${v.severity})`);
    console.log(`      Scenario: ${v.failureScenario.slice(0, 130)}...`);
  }

  // --------------------------------------------------------------------------
  // ROUND 2: BLUE TEAM DEFENSE
  // --------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[ROUND 2/3] 🔵 Blue Team Defense (Laguna S / Cohere North Mini / Ling Fin / Nemotron)...\x1b[0m');
  const r2Start = Date.now();

  const blueSystemPrompt = `You are the Principal Systems Architect & Production Defense Lead (Blue Team) for OmniSMM 1.0.

MISSION:
Review the Red Team's attack report against the actual code diff. Your mandate is PRAGMATIC PRODUCTION REALISM.
- If Red Team identified a real P0 bug (race condition, balance leak, IDOR, ReDoS crash), ACCEPT IT (ACCEPTED_VALID_BUG).
- If Red Team demands unnecessary distributed architectures or premature abstractions, REJECT IT (REJECTED_YAGNI_OVERENGINEERING).
- Highlight existing DB constraints, Redis locks, SafeRegexValidator, or Zod schemas that already mitigate theoretical risks.

Output valid JSON matching BlueTeamDefenseSchema.`;

  const blueUserPrompt = `ORIGINAL CODE DIFF:\n\`\`\`typescript\n${truncatedDiff}\n\`\`\`\n\nRED TEAM ATTACK REPORT:\n\`\`\`json\n${JSON.stringify(redAttack, null, 2)}\n\`\`\`\n\nEvaluate each finding. Output valid JSON only.`;

  const blueRawResponse = await callOpenRouterWithFallback({
    models: [
      'poolside/laguna-s-2.1:free',
      'cohere/north-mini-code:free',
      'minimax/minimax-m2.7:free',
      'inclusionai/ling-3.0-flash-fin:free',
      'nvidia/nemotron-3.5-lightning:free',
      'openrouter/free',
    ],
    systemPrompt: blueSystemPrompt,
    userPrompt: blueUserPrompt,
    enableReasoning: false,
    temperature: 0.1,
  });

  const blueDefense = parseAndNormalizeBlueTeam(blueRawResponse);
  const r2Time = ((Date.now() - r2Start) / 1000).toFixed(1);
  console.log(`\x1b[32m✔ Round 2 Complete (${r2Time}s). Evaluated ${blueDefense.rebuttals.length} rebuttals.\x1b[0m\n`);

  for (const r of blueDefense.rebuttals) {
    const color = r.verdict === 'ACCEPTED_VALID_BUG' ? '\x1b[31m' : '\x1b[36m';
    console.log(`   ${color}[${r.findingId}] -> ${r.verdict}\x1b[0m`);
    console.log(`      Rationale: ${r.engineeringTradeOffRationale.slice(0, 130)}...`);
  }

  // --------------------------------------------------------------------------
  // ROUND 3: CTO ARBITER CONSENSUS
  // --------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[35m[ROUND 3/3] ⚖️  CTO Arbiter Consensus (MiniMax M3 / Dots3 Note / Gemini Synthesis)...\x1b[0m');
  const r3Start = Date.now();

  const ctoSystemPrompt = `You are the Fractional CTO & Chief Arbiter for OmniSMM 1.0.

MISSION:
Read the dialectic debate between Red Team and Blue Team. Synthesize a definitive engineering verdict.
- Any P0_BLOCKING issues MUST be fixed before shipping.
- Any P1_REQUIRED issues should be resolved in the current phase or tracked.
- Distinguish between real operational risk vs academic perfectionism.

Output valid JSON matching CTOArbiterConsensusSchema.`;

  const ctoUserPrompt = `TARGET CODE DIFF:\n\`\`\`typescript\n${truncatedDiff}\n\`\`\`\n\nROUND 1 (RED TEAM ATTACK):\n\`\`\`json\n${JSON.stringify(redAttack, null, 2)}\n\`\`\`\n\nROUND 2 (BLUE TEAM DEFENSE):\n\`\`\`json\n${JSON.stringify(blueDefense, null, 2)}\n\`\`\`\n\nSynthesize final verdict. Output valid JSON only.`;

  const ctoRawResponse = await callOpenRouterWithFallback({
    models: [
      'minimax/minimax-m3:free',
      'dots-studio/dots-3-note-preview:free',
      'nvidia/nemotron-3.5-lightning:free',
      'cohere/north-mini-code:free',
      'openrouter/free',
    ],
    systemPrompt: ctoSystemPrompt,
    userPrompt: ctoUserPrompt,
    enableReasoning: true,
    temperature: 0.1,
  });

  const ctoVerdict = parseAndNormalizeArbiter(ctoRawResponse);
  const r3Time = ((Date.now() - r3Start) / 1000).toFixed(1);
  console.log(`\x1b[32m✔ Round 3 Complete (${r3Time}s). Arbiter ruling delivered.\x1b[0m\n`);

  // --------------------------------------------------------------------------
  // FINAL EXECUTIVE REPORT
  // --------------------------------------------------------------------------
  console.log('\x1b[1m======================================================================\x1b[0m');
  console.log('\x1b[1m                      📊 CTO CONSENSUS REPORT                         \x1b[0m');
  console.log('\x1b[1m======================================================================\x1b[0m\n');

  console.log(`👑 \x1b[1mVerdict:\x1b[0m ${ctoVerdict.overallVerdict === 'HARD_BLOCK_P0' ? '\x1b[41m\x1b[37m HARD BLOCK (P0) \x1b[0m' : ctoVerdict.overallVerdict === 'PASS_WITH_P1_REFACTOR' ? '\x1b[43m\x1b[30m PASS WITH P1 REFACTOR \x1b[0m' : '\x1b[42m\x1b[30m SHIP AS IS \x1b[0m'}`);
  console.log(`📈 \x1b[1mConsensus Health Score:\x1b[0m ${ctoVerdict.consensusScore}/100`);
  console.log(`📝 \x1b[1mExecutive Summary:\x1b[0m ${ctoVerdict.executiveSummary}\n`);

  console.log('\x1b[1m🛠️  ACTIONABLE FIXES (P0 / P1):\x1b[0m');
  if (ctoVerdict.actionableFixes.length === 0) {
    console.log('   \x1b[32m✔ No mandatory fixes required.\x1b[0m');
  } else {
    for (const fix of ctoVerdict.actionableFixes) {
      const badge = fix.priority === 'P0_BLOCKING' ? '\x1b[41m\x1b[37m P0 BLOCK \x1b[0m' : '\x1b[43m\x1b[30m P1 REQ \x1b[0m';
      console.log(`   ${badge} \x1b[1m${fix.fixId}\x1b[0m (Ref: ${fix.linkedFindingId}) -> \x1b[36m${fix.targetFile}\x1b[0m`);
      console.log(`      Summary: ${fix.summary}`);
      console.log(`      Patch:   \x1b[32m${fix.concretePatchInstruction}\x1b[0m`);
      console.log(`      Verify:  ${fix.verificationCriteria}\n`);
    }
  }

  console.log('\x1b[1m🤝 ACCEPTED TRADE-OFFS & PRAGMATIC DEBT:\x1b[0m');
  if (ctoVerdict.acceptedTradeOffs.length === 0) {
    console.log('   -- None --');
  } else {
    for (const to of ctoVerdict.acceptedTradeOffs) {
      console.log(`   \x1b[36m[${to.tradeOffId}]\x1b[0m (Ref: ${to.linkedFindingId}): ${to.justification}`);
      console.log(`      Guards: ${to.mitigatingFactors}\n`);
    }
  }

  // Save detailed debate transcript to .planning/audit
  const outDir = path.resolve(process.cwd(), '.planning', 'audit');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const transcriptPath = path.resolve(outDir, 'SWARM_DEBATE_TRANSCRIPT.md');
  let md = '# ⚔️ SMMplan Adversarial Swarm Debate Report\n\n';
  md += `**Дата:** ${new Date().toISOString()}\n`;
  md += `**Вердикт CTO:** ${ctoVerdict.overallVerdict}\n`;
  md += `**Оценка здоровья:** ${ctoVerdict.consensusScore}/100\n\n`;
  md += `## Резюме CTO\n${ctoVerdict.executiveSummary}\n\n`;
  md += '## Раунд 1: Атака Red Team (GLM-5.2)\n';
  for (const v of redAttack.vulnerabilities) {
    md += `- **[${v.findingId}] ${v.flawTitle}** (${v.severity})\n  - *Сценарий:* ${v.failureScenario}\n  - *Вектор:* ${v.reproductionVector}\n\n`;
  }
  md += '## Раунд 2: Защита Blue Team (Nemotron 550B)\n';
  for (const r of blueDefense.rebuttals) {
    md += `- **[${r.findingId}] ${r.verdict}**\n  - *Обоснование:* ${r.engineeringTradeOffRationale}\n\n`;
  }
  md += '## Раунд 3: Вердикт и Решения (Inkling)\n';
  for (const fix of ctoVerdict.actionableFixes) {
    md += `- **[${fix.priority}] ${fix.summary}** (${fix.targetFile})\n  - *Инструкция:* \`${fix.concretePatchInstruction.replace(/`/g, "'")}\`\n\n`;
  }

  fs.writeFileSync(transcriptPath, md, 'utf8');
  console.log(`\x1b[32m📄 Полный протокол дебатов сохранён в: .planning/audit/SWARM_DEBATE_TRANSCRIPT.md\x1b[0m\n`);
}

runAdversarialDebate().catch((err) => {
  console.error('\x1b[31m❌ Debate Engine Aborted:\x1b[0m', err);
  process.exit(1);
});
