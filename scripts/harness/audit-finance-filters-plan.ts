import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment (.env or .env.local)');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Financial Ledger & Transaction Filters Audit',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || '';
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function runFinancePlanAudit() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('🛡️  OPENROUTER ADVERSARIAL SWARM: FINANCIAL TRANSACTION FILTERS AUDIT');
  console.log('════════════════════════════════════════════════════════════════════════\n');

  const systemPrompt = `You are a Chief Financial Technology (Fintech) Auditor and Security Architect specializing in double-entry ledgers, PCI DSS, 54-FZ compliance, and high-load transactional database performance.

Audit the architecture and implementation plan for the OmniSMM Financial Ledger and Transaction Filtering Engine (Admin & Operator panels).

Evaluate strictly against 5 core risk vectors:
1. Directional Classification & Financial Invariants: Does the partitioning between TOPUP (credits), DEBIT (debits), REFUND, COMPENSATION, and ADMIN_ADJUSTMENT correctly reflect double-entry ledger truth without ambiguous overlaps?
2. Multi-Tenant Isolation & RBAC Trust Boundary: Can an operator/admin leak financial records across tenants (smmplan vs flux) or access unauthorized ledger segments?
3. High-Load Query Performance & Index Scans: Does the query structure (composite AND clauses, cursor pagination, aggregates) prevent full table scans and database locks on large LedgerEntry tables?
4. Immutable Ledger Defense: Is the ledger guaranteed to be strictly append-only (no destructive delete/update operations)?
5. Aggregation Accuracy & Rounding (BigInt kopecks): Do the summary totals (approved, quarantine, refunds) stay mathematically exact without floating-point drift?

Output format:
- Overall Verdict: [APPROVED / APPROVED WITH GUARDS / REJECTED]
- Risk Analysis for Points 1-5
- Concrete Recommendations & Guardrails
- Final Score: (0-100)`;

  const userPrompt = `PROPOSED FINANCIAL TRANSACTION FILTERING ARCHITECTURE:

### 1. Classification & Query Layer (Server Action getLedgerAction & getTransactionsListAction):
- Filter Parameters:
  - type: 'ALL' | 'TOPUP' | 'DEBIT' | 'REFUND' | 'COMPENSATION' | 'ADJUSTMENT'
  - status: 'ALL' | 'APPROVED' | 'QUARANTINE' | 'REJECTED'
  - period: 'today' | 'week' | 'month' | 'all'
  - tenantId: 'smmplan' | 'flux' | 'all' (scoped by RBAC resolveAdminTenantContext)
  - search: email / transaction ID / idempotencyKey

- Query Composition:
  Uses an atomic andConditions[] array in Prisma to eliminate OR-clause collisions:
  - TOPUP: amount > 0 AND transactionType != 'REFUND'
  - DEBIT: amount < 0
  - REFUND: transactionType == 'REFUND' OR reason ILIKE '%возврат%' OR reason ILIKE '%refund%'
  - COMPENSATION: transactionType == 'COMPENSATION' OR reason ILIKE '%компенсац%' OR reason ILIKE '%бонус%'
  - ADJUSTMENT: adminId IS NOT NULL

- Aggregation:
  Atomic Promise.all query calculating exact _sum on filtered subsets in BigInt cents/kopecks for gross topups, quarantine escrow, and refunds.

- UI Layer:
  - 1-Click Quick Presets (💳 Пополнения баланса, 🔻 Списания, ↩️ Возвраты, ⏳ Карантин, 📋 Все транзакции).
  - Explicit Russian badges with distinctive color coding and icons.
  - Safe cursor-based pagination.

Please perform an adversarial review on this financial filter architecture.`;

  const models = [
    'minimax/minimax-m3:free',
    'z-ai/glm-5.2:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openrouter/free'
  ];

  for (const model of models) {
    console.log(`📡 Querying Auditor Model: [${model}]...`);
    try {
      const response = await queryOpenRouter(model, systemPrompt, userPrompt);
      console.log(`\n────────────────────────────────────────────────────────────────────────`);
      console.log(`📝 AUDIT REPORT FROM: [${model}]`);
      console.log(`────────────────────────────────────────────────────────────────────────\n`);
      console.log(response);
      console.log(`\n════════════════════════════════════════════════════════════════════════\n`);
      break; // Successfully got auditor report
    } catch (err: any) {
      console.error(`❌ Model [${model}] error:`, err.message);
    }
  }
}

runFinancePlanAudit().catch(console.error);
