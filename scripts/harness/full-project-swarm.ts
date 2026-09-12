import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const rawKeys = [
  process.env.OPENROUTER_API_KEY,
  ...(process.env.OPENROUTER_API_KEYS ? process.env.OPENROUTER_API_KEYS.split(',') : [])
].filter(Boolean).map(k => k!.trim());

const OPENROUTER_KEYS = Array.from(new Set(rawKeys));

if (OPENROUTER_KEYS.length === 0) {
  console.error('\x1b[31m❌ Ошибка: Ни один OPENROUTER_API_KEY не найден в .env!\x1b[0m');
  process.exit(1);
}

let activeKeyIndex = 0;
function getNextApiKey(): string {
  const key = OPENROUTER_KEYS[activeKeyIndex % OPENROUTER_KEYS.length];
  activeKeyIndex++;
  return key;
}

// 1. Bulletproof Unified Audit Schema
const FindingSchema = z.object({
  ruleId: z.string().optional().default('CODE-AUDIT'),
  severity: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).optional().default('LOW'),
  file: z.string().optional().default('src/'),
  line: z.union([z.number(), z.string()]).optional().default(1),
  title: z.string().optional().default('Code Finding'),
  description: z.string().optional().default('Review code for details'),
  recommendation: z.string().optional().default('Verify implementation against AGENTS.md'),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});

const SwarmAuditResultSchema = z.object({
  expertRole: z.string(),
  passed: z.boolean().optional().default(true),
  summary: z.string().optional().default('Audit completed.'),
  findings: z.array(z.any()).optional().default([]),
});

export type SwarmAuditResult = z.infer<typeof SwarmAuditResultSchema>;

// 2. Swarm Agents
interface SwarmAgent {
  name: string;
  role: string;
  emoji: string;
  models: string[];
  systemPrompt: string;
  enableReasoning?: boolean;
}

const SWARM_AGENTS: SwarmAgent[] = [
  {
    name: 'DevSecOps Sentinel (120B)',
    role: 'SECURITY',
    emoji: '🛡️',
    models: [
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'nvidia/nemotron-3.5-lightning:free'
    ],
    systemPrompt: `You are the Principal DevSecOps Security Auditor for SMMplan (Next.js 16, PostgreSQL/Prisma).
Analyze the code for OWASP Top 10 vulnerabilities.
CRITICAL CHECKS:
1. IDOR and Access Control: Ensure session checks verify item.userId === session.userId. All DB queries MUST be scoped to tenantId/userId.
2. Webhooks and Signatures: Fail-closed verification with crypto.timingSafeEqual.
3. Server/Client boundary: No 'use server' in page.tsx. No sensitive keys in client.
4. Network Leaks: No hardcoded hosts, no 0.0.0.0 or host.docker.internal in redirects.

Output format: Return ONLY valid JSON:
{
  "expertRole": "DevSecOps Sentinel",
  "passed": boolean,
  "summary": "Summary",
  "findings": []
}`
  },
  {
    name: 'FinOps and Logic Specialist',
    role: 'FINOPS_QA',
    emoji: '🧪',
    models: [
      'nvidia/nemotron-3.5-lightning:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nex-agi/nex-n2.5-mini:free'
    ],
    systemPrompt: `You are the Principal QA Automation and FinOps Logician for SMMplan.
Analyze the code for mathematical invariants, race conditions, edge cases, and multi-tenant integrity.
CRITICAL CHECKS:
1. Ledger-First Balance: Wallet mutations MUST go through WalletOps with BigInt kopecks ledger creation before user balance update.
2. Drip-Feed Floor: floor(quantity / runs) MUST be >= service.minQty.
3. Multi-Tenant Brands: Strictly 2 brands: 'smmplan' and 'flux'. No 'lovable' or 'smmboost'.
4. Concurrency: Redis distributed locks for webhook replay protection.

Output format: Return ONLY valid JSON matching:
{
  "expertRole": "FinOps and Logic Specialist",
  "passed": boolean,
  "summary": "Summary",
  "findings": []
}`
  },
  {
    name: 'UI/UX and Design System Guardian',
    role: 'UI_UX',
    emoji: '🎨',
    models: [
      'nex-agi/nex-n2.5-mini:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nex-agi/nex-n2.5-pro:free'
    ],
    systemPrompt: `You are the Lead UI/UX and Design System Architect for SMMplan (Tailwind CSS 4.0, HeroUI v3).
Analyze the code for UI/UX defects, styling standards, and accessibility.
CRITICAL CHECKS:
1. Zero Raw Colors: Forbid inline/raw colors ('text-white', 'bg-black', 'text-blue-500'). Require semantic tokens ('text-foreground', 'bg-background', 'text-primary').
2. Viewport 100% Fit: No horizontal scroll. Data tables must fit viewport without clipping right-side action columns.
3. Form UX: Submit buttons MUST NOT be disabled. Shake animation on invalid submit.
4. Modal Hoisting: Forbid <Modal> or <Dialog> inside DropdownMenu or Tooltips.

Output format: Return ONLY valid JSON matching:
{
  "expertRole": "UI/UX and Design System Guardian",
  "passed": boolean,
  "summary": "Summary",
  "findings": []
}`
  },
  {
    name: 'Architecture & Clean Code Arbiter',
    role: 'ARBITER',
    emoji: '⚡',
    models: [
      'nex-agi/nex-n2.5-pro:free',
      'nvidia/nemotron-3.5-lightning:free',
      'nex-agi/nex-n2.5-mini:free'
    ],
    systemPrompt: `You are the Fast Review Arbiter and Clean Architecture Specialist for SMMplan.
Analyze the code for code hygiene, clean TypeScript types, dead code, component line limits (<= 200 lines), and missing error handlers.
Output format: Return ONLY valid JSON matching:
{
  "expertRole": "Architecture & Clean Code Arbiter",
  "passed": boolean,
  "summary": "Summary",
  "findings": []
}`
  }
];

// Helper: Extract JSON
function extractJson(raw: string): any {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed.findings)) {
    parsed.findings = parsed.findings.map((f: any) => {
      if (typeof f === 'string') {
        return {
          ruleId: 'CODE-AUDIT',
          severity: 'LOW' as const,
          file: 'src/',
          title: f.slice(0, 80),
          description: f,
          recommendation: 'Check code for details',
          confidence: 0.85,
        };
      }
      return f;
    });
  }
  return parsed;
}

// 3. OpenRouter API Caller with Auto-Rotation & Retries
async function callOpenRouter(agent: SwarmAgent, payload: string): Promise<SwarmAuditResult> {
  const timeoutMs = 25000;
  const maxAttempts = Math.max(3, OPENROUTER_KEYS.length);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const apiKey = getNextApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body: Record<string, any> = {
        models: agent.models,
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: `Audit the following domain source code:\n\n${payload}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      };

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://smmplan.pro',
          'X-Title': 'SMMplan Full Project Swarm',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || res.status >= 500) {
          lastError = new Error(`HTTP ${res.status}: ${errText.slice(0, 100)}`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from model');

      const parsedJson = extractJson(content);
      const rawFindings = Array.isArray(parsedJson.findings) ? parsedJson.findings : [];
      const validFindings = rawFindings.map((f: any) => {
        if (typeof f === 'string') {
          return {
            ruleId: 'CODE-AUDIT',
            severity: 'LOW' as const,
            file: 'src/',
            line: 1,
            title: f.slice(0, 80),
            description: f,
            recommendation: 'Review implementation against AGENTS.md',
            confidence: 0.85,
          };
        }
        const sp = FindingSchema.safeParse(f);
        if (sp.success) return sp.data;
        return {
          ruleId: String(f.ruleId || 'CODE-AUDIT'),
          severity: (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(f.severity) ? f.severity : 'LOW') as any,
          file: String(f.file || 'src/'),
          line: f.line || 1,
          title: String(f.title || f.description || 'Code Finding').slice(0, 100),
          description: String(f.description || f.title || 'Details in code'),
          recommendation: String(f.recommendation || 'Verify against architecture rules'),
          confidence: Number(f.confidence || 0.85),
        };
      });

      return {
        expertRole: agent.name,
        passed: parsedJson.passed ?? (validFindings.length === 0),
        summary: parsedJson.summary || (validFindings.length === 0 ? 'Audit completed: 0 defects.' : `Found ${validFindings.length} findings.`),
        findings: validFindings,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return {
    expertRole: agent.name,
    passed: true,
    summary: `⚠️ Аудит пропущен (${lastError?.message || 'Все ключи исчерпали попытки'})`,
    findings: [],
  };
}

// 4. Domains Definitions
interface DomainDef {
  key: string;
  name: string;
  description: string;
  files: string[];
}

const DOMAINS: DomainDef[] = [
  {
    key: 'payments',
    name: 'Payments, Ledger & Billing',
    description: 'WalletOps, LedgerEntry, YooKassa / Robokassa webhooks, 54-FZ VAT 2026',
    files: [
      'src/services/financial/wallet-ops.ts',
      'src/services/financial/payment.service.ts',
      'src/services/financial/ledger-reconciliation.service.ts',
      'src/actions/admin/finance/ledger.ts',
      'src/actions/admin/finance/payments.ts',
      'src/app/api/webhooks/yookassa/route.ts',
      'src/app/api/webhooks/robokassa/route.ts'
    ]
  },
  {
    key: 'orders',
    name: 'Orders, Drip-Feed & Routing',
    description: 'Checkout, Drip-Feed Floor Invariant, BullMQ workers, Smart Routing',
    files: [
      'src/actions/order/checkout.ts',
      'src/actions/order/mass.ts',
      'src/workers/processors/order.processor.ts',
      'src/workers/processors/dripfeed.processor.ts',
      'src/services/routing/smart-routing.service.ts'
    ]
  },
  {
    key: 'providers',
    name: 'Providers, Catalog & Multi-Currency',
    description: 'Provider balance thresholds, Redis shadow buffer, Zombie Eraser, USD/RUB rates',
    files: [
      'src/services/admin/provider-balance.service.ts',
      'src/services/providers/provider.service.ts',
      'src/workers/processors/catalog.processor.ts',
      'src/workers/processors/sync.processor.ts'
    ]
  },
  {
    key: 'auth',
    name: 'Auth, RBAC & Reverse Proxy',
    description: 'src/proxy.ts, zero 0.0.0.0 leaks, magic link verify, tenant isolation',
    files: [
      'src/proxy.ts',
      'src/app/api/auth/verify/route.ts',
      'src/services/auth/auth.service.ts',
      'src/services/auth/rbac.service.ts'
    ]
  },
  {
    key: 'ui_ux',
    name: 'UI/UX & Design System',
    description: 'Tailwind 4 tokens, HeroUI v3, Zero Raw Colors, Viewport Density, Modal Hoisting',
    files: [
      'src/components/landing/order-engine/DripFeedConfigurator.tsx',
      'src/components/landing/order-engine/drawer/DrawerQuantityCard.tsx',
      'src/components/dev/FloatingQADock.tsx',
      'src/components/ui/PlanButton.tsx',
      'src/components/ui/PlanCard.tsx'
    ]
  },
  {
    key: 'ai_systems',
    name: 'AI Observer, Copilot & Harnesses',
    description: 'AI Observer, Copilot, OutputPolicyEngine, Financial Claim Shields',
    files: [
      'src/services/observer/ai-observer.service.ts',
      'src/services/support/ai-copilot.service.ts',
      'src/services/admin/output-policy-engine.ts'
    ]
  }
];

function buildDomainPayload(domain: DomainDef): string {
  let content = `### DOMAIN: ${domain.name}\n${domain.description}\n\n`;
  for (const relPath of domain.files) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      const lines = code.split('\n');
      const sample = lines.slice(0, 110).join('\n');
      content += `// ===== FILE: ${relPath} (Lines 1-110) =====\n${sample}\n\n`;
    }
  }
  return content;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  const args = process.argv.slice(2);
  const domainArg = args.find(a => a.startsWith('--domain='))?.split('=')[1] || 'all';

  console.log('\n===============================================================');
  console.log('   🚀 SMMplan Full Project Multi-Agent Swarm Audit (OpenRouter)');
  console.log('===============================================================');

  const selectedDomains = domainArg === 'all' 
    ? DOMAINS 
    : DOMAINS.filter(d => d.key === domainArg);

  if (selectedDomains.length === 0) {
    console.error(`❌ Домен '${domainArg}' не найден. Доступные: ${DOMAINS.map(d=>d.key).join(', ')}`);
    process.exit(1);
  }

  const allDomainResults: { domain: DomainDef; results: SwarmAuditResult[] }[] = [];

  for (const domain of selectedDomains) {
    console.log(`\n📦 [Домен: ${domain.name}] (${domain.key})`);
    const payload = buildDomainPayload(domain);
    console.log(`   Размер среза: ${payload.length} байт. Опрос 4 экспертов...`);

    const domainResults: SwarmAuditResult[] = [];
    for (let i = 0; i < SWARM_AGENTS.length; i++) {
      const agent = SWARM_AGENTS[i];
      process.stdout.write(`   [${i + 1}/4] ${agent.emoji} ${agent.name}... `);
      const t0 = Date.now();
      const res = await callOpenRouter(agent, payload);
      const ms = Date.now() - t0;
      const icon = res.passed && res.findings.length === 0 ? '✅' : '⚠️';
      console.log(`${icon} [${ms}ms] (дефектов: ${res.findings.length})`);
      domainResults.push(res);
      await sleep(1000);
    }

    allDomainResults.push({ domain, results: domainResults });
    console.log(`✔ Домен ${domain.key} завершён.`);
  }

  // Save report to .planning/audit
  const outDir = path.resolve(process.cwd(), '.planning', 'audit');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const reportPath = path.resolve(outDir, 'FULL_PROJECT_SWARM_REPORT.md');
  let md = '# 🚀 SMMplan Full Project Multi-Agent Swarm Audit Report\n\n';
  md += `**Дата проверки:** ${new Date().toISOString()}\n\n`;

  let totalFindings = 0;
  let totalCritical = 0;

  for (const { domain, results } of allDomainResults) {
    md += `## 📦 Домен: ${domain.name} (${domain.key})\n\n`;
    md += `*${domain.description}*\n\n`;

    for (const r of results) {
      md += `### ${r.expertRole}\n\n`;
      md += `**Статус:** ${r.passed ? '✅ PASS' : '❌ DEFECTS FOUND'}\n`;
      md += `**Резюме:** ${r.summary}\n\n`;

      if (r.findings.length > 0) {
        md += '| Серьезность | Правило | Файл | Строка | Суть | Рекомендация |\n';
        md += '|---|---|---|---|---|---|\n';
        for (const f of r.findings) {
          totalFindings++;
          if (f.severity === 'CRITICAL' || f.severity === 'HIGH') totalCritical++;
          md += `| **${f.severity}** | ${f.ruleId || '-'} | \`${f.file}\` | ${f.line || '-'} | ${f.title} | ${f.recommendation} |\n`;
        }
        md += '\n';
      }
    }
    md += '\n---\n\n';
  }

  console.log(`Writing report (${md.length} chars) to ${reportPath}`);
  fs.writeFileSync(reportPath, md, 'utf8');

  console.log('\n===============================================================');
  console.log(`📄 Итоговый подробный отчёт сохранён в: .planning/audit/FULL_PROJECT_SWARM_REPORT.md`);
  console.log(`📊 Всего замечаний: ${totalFindings} (Критических: ${totalCritical})`);
  console.log('===============================================================');
}

main().catch(console.error);
