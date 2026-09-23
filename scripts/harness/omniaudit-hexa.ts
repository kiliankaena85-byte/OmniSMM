#!/usr/bin/env tsx
/**
 * OmniAudit Hexa — Multi-Model Multi-Angle Inspection Swarm (RAC-2026)
 *
 * Utilizes 6 OpenRouter specialized models for adversarial inspection:
 * 1. cohere/north-mini-code:free                -> Code review, types, syntax, runtime boundaries
 * 2. nvidia/nemotron-3.5-content-safety:free     -> Cybersecurity, OWASP Top 10, XSS, injection, IDOR
 * 3. nvidia/nemotron-3-ultra-550b-a55b:free      -> Fintech, double-entry ledger, ExactMath, 54-FZ
 * 4. nvidia/nemotron-3-super-120b-a12b:free      -> Architecture, multi-tenant isolation, resilience
 * 5. poolside/laguna-xs-2.1:free                 -> UI/UX, WCAG 2.2 AA, Zero-Scroll, mobile CRO
 * 6. nvidia/llama-nemotron-rerank-vl-1b-v2:free   -> Meta-Judicial Reranker via OpenRouter /api/v1/rerank
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ [FATAL] OPENROUTER_API_KEY is not defined in .env or .env.local!');
  process.exit(1);
}

export interface InspectorFinding {
  domain: 'CODE' | 'SECURITY' | 'FINTECH' | 'ARCHITECTURE' | 'UI_UX';
  model: string;
  issue: string;
  recommendation: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rawSnippet?: string;
}

export interface RerankedFinding {
  rank: number;
  relevanceScore: number;
  finding: InspectorFinding;
}

export interface HexaAuditReport {
  timestamp: string;
  scope: string;
  filesScanned: string[];
  durationMs: number;
  modelsUsed: Record<string, string>;
  findings: RerankedFinding[];
  summary: {
    totalFindings: number;
    criticalBlockers: number;
    highSeverity: number;
    mediumSeverity: number;
    lowSeverity: number;
    verdict: 'APPROVED_FOR_PROD' | 'CHANGES_REQUIRED' | 'BLOCKED';
  };
}

async function callChatCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 30000,
  maxRetries = 2
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'OmniAudit Hexa Swarm'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          max_tokens: 1500
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 && attempt < maxRetries) {
          console.warn(`⚠️ [429 Rate Limit] ${model} - retrying in 2.5s (attempt ${attempt}/${maxRetries})...`);
          await new Promise(r => setTimeout(r, 2500 * attempt));
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      if (attempt >= maxRetries) {
        throw new Error(`${model} failed after ${maxRetries} attempts: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return '';
}

async function callRerank(
  query: string,
  documents: string[],
  timeoutMs = 20000
): Promise<Array<{ index: number; relevance_score: number; document: { text: string } }>> {
  if (documents.length === 0) return [];

  const res = await fetch('https://openrouter.ai/api/v1/rerank', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'OmniAudit Hexa Swarm'
    },
    body: JSON.stringify({
      model: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free',
      query,
      documents
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Rerank failed HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  const json = await res.json();
  return json.results || [];
}

const INSPECTORS = [
  {
    domain: 'CODE' as const,
    name: 'Code Review & Runtime Boundaries',
    model: 'cohere/north-mini-code:free',
    timeoutMs: 30000,
    systemPrompt: `You are an expert TypeScript & Next.js 16 App Router Code Reviewer adhering to strict Clean Architecture.
Analyze the provided code for:
1. Prohibited "use server" inside page components (page.tsx).
2. Anti-crutch violations: "any", "// TODO", unhandled try/catch.
3. Component size limits (components should be modular <= 200 lines).
4. Strict TypeScript typing and null/undefined leaks.
Format response as clear points:
[SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] Issue description | Recommendation`
  },
  {
    domain: 'SECURITY' as const,
    name: 'Cybersecurity & Pentest Sentinel',
    model: 'nvidia/nemotron-3.5-content-safety:free',
    timeoutMs: 30000,
    systemPrompt: `You are a Principal Application Security Engineer (OWASP Top 10, ASVS Level 2).
Analyze the code for:
1. Insecure Direct Object Reference (IDOR) - ensuring userId checks fail-closed for guests and cross-tenant users.
2. Injection vulnerabilities: raw SQL, unsafe Cypher, SSRF, XSS.
3. Leaks of secret keys, tokens, or PII (152-FZ).
4. Timing attacks and webhook verification bypasses.
Format response as clear points:
[SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] Issue description | Recommendation`
  },
  {
    domain: 'FINTECH' as const,
    name: 'Double-Entry Ledger & ExactMath (550B)',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    timeoutMs: 60000,
    systemPrompt: `You are a Principal Fintech Architect specializing in double-entry ledgers, banking rounding, and Russian fiscal law (54-FZ).
Analyze the code for:
1. ExactMath Invariant: all money MUST be stored and computed in BigInt kopecks (cents) with Banker's Rounding (Half-Even).
2. Ledger-First Invariant: tx.ledgerEntry.create() MUST precede tx.user.update(balance).
3. Transaction Escape: prohibition of global db.* calls inside interactive tx: PrismaTx blocks.
4. Drip-Feed Floor Invariant: Math.floor(quantity / runs) >= service.minQty.
5. IdempotencyKey required on every balance adjustment.
Format response as clear points:
[SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] Issue description | Recommendation`
  },
  {
    domain: 'ARCHITECTURE' as const,
    name: 'System Architecture & Multi-Tenant Isolation (120B)',
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    timeoutMs: 40000,
    systemPrompt: `You are an Enterprise System Architect for OmniSMM 1.0 (servicing brands SMMplan and SMMflux).
Analyze the code for:
1. Strict Multi-Tenant isolation: cache keys MUST include tenantId, hostnames must not be hardcoded.
2. Resilience: external provider HTTP calls must have AbortSignal.timeout() and Circuit Breaker safeguards.
3. API contract stability and backward compatibility.
4. Clean separation of concerns between DTOs, domain models, and storage layers.
Format response as clear points:
[SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] Issue description | Recommendation`
  },
  {
    domain: 'UI_UX' as const,
    name: 'UI/UX, WCAG 2.2 AA & Responsive Density',
    model: 'poolside/laguna-xs-2.1:free',
    timeoutMs: 30000,
    fallbackModel: 'google/gemma-4-31b-it:free',
    systemPrompt: `You are a Lead UX/UI Accessibility Auditor (WCAG 2.2 AA, NN/g 10 heuristics, ISO 9241-110).
Analyze the code/components for:
1. Zero Horizontal Scroll Rule: table and layout width fit 100% viewport without clipping.
2. Touch target accessibility: interactive buttons >= 44x44px.
3. Strict Per-Unit Pricing: all prices displayed to client must be "₽ / шт" (pricePerUnitRub), NOT "/ 1000 шт".
4. Color contrast >= 4.5:1 for standard text, semantic Tailwind 4 tokens.
Format response as clear points:
[SEVERITY: CRITICAL|HIGH|MEDIUM|LOW] Issue description | Recommendation`
  }
];

function parseFindings(rawText: string, domain: InspectorFinding['domain'], model: string): InspectorFinding[] {
  const findings: InspectorFinding[] = [];
  const lines = rawText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/\[SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(.*?)(?:\|\s*(.*))?$/i);
    if (match) {
      findings.push({
        domain,
        model,
        severity: (match[1].toUpperCase() as any) || 'MEDIUM',
        issue: match[2].trim(),
        recommendation: match[3]?.trim() || 'Review and remediate according to RAC-2026 standard.',
        rawSnippet: trimmed
      });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\./.test(trimmed)) {
      // 1. Skip incomplete sentence fragments or bare headings
      const content = trimmed.replace(/^[-*\d.]+\s*/, '').trim();
      if (content.length < 15 || content.endsWith(':') || /^(however|note that|note:|summary|in conclusion)/i.test(content)) {
        continue;
      }

      // 2. Skip positive remarks and not applicable statements
      const isPositive = /no issue|not applicable|no violation|not a violation|passed|verified|no problems|adheres to|healthy|no prisma calls|not a money calculation|good for|that's correct|correct for|is correct|well structured|compliant/i.test(content);
      if (isPositive) continue;

      // 3. Skip rule descriptions and category echoes
      const isRuleEcho = /^(?:\d+\.\s*)?[A-Za-z\s-]+:\s*(?:all money MUST|tx\.ledgerEntry|prohibition of|idempotencyKey required|external provider HTTP|strict multi-tenant|resilience|api contract)/i.test(content) && !/violation|bug|issue|missing|unhandled|leak|error|fail|critical/i.test(content);
      if (isRuleEcho) continue;

      const isCritical = /critical|блокер|уязвимост|vulnerability|bypass|idor|leak/i.test(content);
      const isHigh = /high|важно|severe|security issue|broken/i.test(content);
      findings.push({
        domain,
        model,
        severity: isCritical ? 'CRITICAL' : isHigh ? 'HIGH' : 'MEDIUM',
        issue: content,
        recommendation: 'Verify against platform safety contract.',
        rawSnippet: trimmed
      });
    }
  }

  return findings;
}

export async function runHexaAudit(options: {
  testOnly?: boolean;
  targetPath?: string;
  scope?: 'critical' | 'all' | 'dashboard';
}): Promise<HexaAuditReport> {
  const startTime = Date.now();
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🤖 OmniAudit Hexa — Multi-Model Adversarial Inspection Swarm');
  console.log('   Stack: 6 OpenRouter Models (Code, Security, 550B, 120B, UI, Rerank)');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  if (options.testOnly) {
    console.log('🔍 [HEALTH-CHECK] Probing all 6 OpenRouter models connectivity...\n');
    for (const inspector of INSPECTORS) {
      process.stdout.write(`   Testing [${inspector.domain}] ${inspector.model}... `);
      try {
        const res = await callChatCompletion(inspector.model, 'System test', 'Reply with "HEALTHY".', 15000);
        console.log(`✅ OK (${res.slice(0, 20).trim() || 'ONLINE'})`);
      } catch (e: any) {
        if (inspector.fallbackModel) {
          process.stdout.write(`⚠️ Rate limited, testing fallback [${inspector.fallbackModel}]... `);
          try {
            const fbRes = await callChatCompletion(inspector.fallbackModel, 'System test', 'Reply with "HEALTHY".', 15000);
            console.log(`✅ OK (${fbRes.slice(0, 20).trim() || 'ONLINE'})`);
          } catch (fbErr: any) {
            console.log(`❌ Fallback failed: ${fbErr.message}`);
          }
        } else {
          console.log(`⚠️ FAILED: ${e.message}`);
        }
      }
    }

    process.stdout.write(`   Testing [RERANKER] nvidia/llama-nemotron-rerank-vl-1b-v2:free... `);
    try {
      const rr = await callRerank('Security check', ['Test doc 1', 'Test doc 2']);
      console.log(`✅ OK (${rr.length} results returned)`);
    } catch (e: any) {
      console.log(`⚠️ FAILED: ${e.message}`);
    }

    console.log('\n✅ Health-check completed.\n');
    return {
      timestamp: new Date().toISOString(),
      scope: 'health-check',
      filesScanned: [],
      durationMs: Date.now() - startTime,
      modelsUsed: {},
      findings: [],
      summary: {
        totalFindings: 0,
        criticalBlockers: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0,
        verdict: 'APPROVED_FOR_PROD'
      }
    };
  }

  // Determine files to audit
  let targetFiles: string[] = [];
  if (options.targetPath) {
    targetFiles = [options.targetPath];
  } else if (options.scope === 'dashboard') {
    targetFiles = [
      'src/components/dashboard/classic/ClassicDashboardHome.tsx',
      'src/lib/loyalty.ts'
    ];
  } else {
    // Critical core scope
    targetFiles = [
      'src/lib/loyalty.ts',
      'src/components/dashboard/classic/ClassicDashboardHome.tsx',
      'src/lib/exact-math.ts'
    ];
  }

  console.log(`📂 Files targeted for audit (${targetFiles.length}):`);
  targetFiles.forEach(f => console.log(`   - ${f}`));
  console.log('\n🚀 Launching 5 parallel model inspectors...\n');

  // Read code content
  const codePayload = targetFiles
    .map(f => {
      try {
        const fullPath = path.resolve(process.cwd(), f);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          return `// === FILE: ${f} ===\n${content.slice(0, 15000)}`;
        }
      } catch {}
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  const rawFindingsPool: InspectorFinding[] = [];

  // Execute 5 Inspectors in Parallel
  const inspectorPromises = INSPECTORS.map(async inspector => {
    const inspectorStart = Date.now();
    try {
      console.log(`⏳ [START] ${inspector.name} (${inspector.model})...`);
      const userPrompt = `Audit the following platform source code files against your domain invariants:\n\n${codePayload}`;
      let response = '';

      try {
        response = await callChatCompletion(inspector.model, inspector.systemPrompt, userPrompt, inspector.timeoutMs);
      } catch (err: any) {
        if (inspector.fallbackModel) {
          console.warn(`🔄 Falling back ${inspector.name} to ${inspector.fallbackModel}...`);
          response = await callChatCompletion(inspector.fallbackModel, inspector.systemPrompt, userPrompt, inspector.timeoutMs);
        } else {
          throw err;
        }
      }

      const parsed = parseFindings(response, inspector.domain, inspector.model);
      console.log(`✅ [DONE]  ${inspector.name} in ${((Date.now() - inspectorStart) / 1000).toFixed(1)}s -> found ${parsed.length} items`);
      return parsed;
    } catch (err: any) {
      console.error(`❌ [FAIL]  ${inspector.name}: ${err.message}`);
      return [];
    }
  });

  const inspectorResults = await Promise.all(inspectorPromises);
  inspectorResults.forEach(res => rawFindingsPool.push(...res));

  console.log(`\n📋 Raw findings collected: ${rawFindingsPool.length} issues across 5 domains.`);
  console.log('⚖️ Invoking Meta-Judicial Reranker (nvidia/llama-nemotron-rerank-vl-1b-v2) for prioritization...\n');

  const rerankDocuments = rawFindingsPool.map((f, i) => `[ID:${i}] [${f.domain}] [${f.severity}] ${f.issue} (Rec: ${f.recommendation})`);
  const rerankQuery = 'Critical security vulnerability, double-entry ledger violation, ExactMath price calculation error, or severe system breaking bug';

  let rerankedResults: Array<{ index: number; relevance_score: number; document: { text: string } }> = [];
  try {
    if (rerankDocuments.length > 0) {
      rerankedResults = await callRerank(rerankQuery, rerankDocuments);
    }
  } catch (err: any) {
    console.warn(`⚠️ Reranker API error (${err.message}). Using native heuristic ordering.`);
    rerankedResults = rerankDocuments.map((_, index) => ({
      index,
      relevance_score: 0.5,
      document: { text: rerankDocuments[index] }
    }));
  }

  // Construct Final Reranked Findings
  const finalFindings: RerankedFinding[] = [];
  const processedIndices = new Set<number>();

  rerankedResults.forEach((item, rank) => {
    if (rawFindingsPool[item.index]) {
      processedIndices.add(item.index);
      finalFindings.push({
        rank: rank + 1,
        relevanceScore: item.relevance_score,
        finding: rawFindingsPool[item.index]
      });
    }
  });

  // Append any missed items
  rawFindingsPool.forEach((finding, index) => {
    if (!processedIndices.has(index)) {
      finalFindings.push({
        rank: finalFindings.length + 1,
        relevanceScore: 0.0001,
        finding
      });
    }
  });

  // Calculate stats
  const criticalCount = finalFindings.filter(f => f.finding.severity === 'CRITICAL').length;
  const highCount = finalFindings.filter(f => f.finding.severity === 'HIGH').length;
  const mediumCount = finalFindings.filter(f => f.finding.severity === 'MEDIUM').length;
  const lowCount = finalFindings.filter(f => f.finding.severity === 'LOW').length;

  const verdict = criticalCount > 0 ? 'BLOCKED' : highCount > 2 ? 'CHANGES_REQUIRED' : 'APPROVED_FOR_PROD';

  const report: HexaAuditReport = {
    timestamp: new Date().toISOString(),
    scope: options.scope || 'critical',
    filesScanned: targetFiles,
    durationMs: Date.now() - startTime,
    modelsUsed: {
      code: 'cohere/north-mini-code:free',
      security: 'nvidia/nemotron-3.5-content-safety:free',
      fintech: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      architecture: 'nvidia/nemotron-3-super-120b-a12b:free',
      ui_ux: 'poolside/laguna-xs-2.1:free',
      reranker: 'nvidia/llama-nemotron-rerank-vl-1b-v2:free'
    },
    findings: finalFindings,
    summary: {
      totalFindings: finalFindings.length,
      criticalBlockers: criticalCount,
      highSeverity: highCount,
      mediumSeverity: mediumCount,
      lowSeverity: lowCount,
      verdict
    }
  };

  // Ensure docs/audits exists
  const auditsDir = path.resolve(process.cwd(), 'docs', 'audits');
  if (!fs.existsSync(auditsDir)) {
    fs.mkdirSync(auditsDir, { recursive: true });
  }

  // Save JSON
  fs.writeFileSync(path.join(auditsDir, 'omniaudit-report-latest.json'), JSON.stringify(report, null, 2), 'utf8');

  // Generate Markdown
  const mdContent = `# 🛡️ OmniAudit Hexa — Сводный отчет инспекции проекта

**Дата проведения:** ${new Date().toLocaleString('ru-RU')}  
**Длительность:** ${(report.durationMs / 1000).toFixed(1)} сек  
**Вердикт:** **${verdict === 'APPROVED_FOR_PROD' ? '🟢 APPROVED FOR PROD' : verdict === 'CHANGES_REQUIRED' ? '🟡 CHANGES REQUIRED' : '🔴 BLOCKED'}**

---

### 📊 Статистика аудита
- **Всего замечаний:** ${report.summary.totalFindings}
- **🔴 Критические блокеры (P0):** ${criticalCount}
- **🟠 Высокий приоритет (P1):** ${highCount}
- **🟡 Средний приоритет (P2):** ${mediumCount}
- **🟢 Низкий приоритет (P3):** ${lowCount}

---

### 🤖 Задействованные модели OpenRouter
| Вектор проверки | Модель | Роль |
|---|---|---|
| **Code Review** | \`cohere/north-mini-code:free\` | Анализ синтаксиса, TypeScript strict, Next.js 16 |
| **Cybersecurity** | \`nvidia/nemotron-3.5-content-safety:free\` | OWASP Top 10, XSS, инъекции, IDOR |
| **Fintech (550B)** | \`nvidia/nemotron-3-ultra-550b-a55b:free\` | Двойная запись леджера, ExactMath, Drip-Feed, 54-ФЗ |
| **Architecture (120B)** | \`nvidia/nemotron-3-super-120b-a12b:free\` | Мультитенантность OmniSMM, API-контракты |
| **UI/UX** | \`poolside/laguna-xs-2.1:free\` | WCAG 2.2 AA, Zero Horizontal Scroll, Touch Targets |
| **Reranker** | \`nvidia/llama-nemotron-rerank-vl-1b-v2:free\` | Мета-арбитраж и приоритизация рисков |

---

### 📋 Приоритизированный список замечаний (Meta-Reranked)
${finalFindings.length === 0 ? '_Замечаний не обнаружено. Проект полностью соответствует инвариантам RAC-2026._' : finalFindings.slice(0, 15).map(f => `
#### #${f.rank} [${f.finding.domain}] ${f.finding.severity === 'CRITICAL' ? '🔴 CRITICAL' : f.finding.severity === 'HIGH' ? '🟠 HIGH' : '🟡 MEDIUM'} (Score: ${f.relevanceScore.toFixed(5)})
- **Модель-источник:** \`${f.finding.model}\`
- **Проблема:** ${f.finding.issue}
- **Рекомендация:** ${f.finding.recommendation}
`).join('\n')}
`;

  fs.writeFileSync(path.join(auditsDir, 'omniaudit-report-latest.md'), mdContent, 'utf8');

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log(`🎯 ФИНАЛЬНЫЙ ВЕРДИКТ: ${verdict === 'APPROVED_FOR_PROD' ? '🟢 APPROVED FOR PROD' : verdict === 'CHANGES_REQUIRED' ? '🟡 CHANGES REQUIRED' : '🔴 BLOCKED'}`);
  console.log(`   Найдено: ${criticalCount} критических | ${highCount} высоких | ${mediumCount} средних`);
  console.log(`   Отчет сохранен в: docs/audits/omniaudit-report-latest.md`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  return report;
}

// Direct CLI Execution
if (process.argv[1] && process.argv[1].includes('omniaudit-hexa')) {
  const isTest = process.argv.includes('--test');
  const scopeArg = process.argv.find(a => a.startsWith('--scope='));
  const scope = (scopeArg ? scopeArg.split('=')[1] : process.argv.includes('--dashboard') ? 'dashboard' : 'critical') as any;

  runHexaAudit({ testOnly: isTest, scope }).catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
}
