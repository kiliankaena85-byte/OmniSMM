// eslint-disable-next-line @typescript-eslint/no-unused-vars
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import path from 'path';

export interface StaticFinding {
  ruleId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  file: string;
  line: number;
  snippet: string;
  message: string;
}

export type StaticRuleHandler = (content: string, filePath: string) => StaticFinding[];

function stripCommentsFromLines(lines: string[]): string {
  return lines.map(l => l.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')).join(' ');
}

function stripCommentsFromText(text: string): string {
  return text.split('\n').map(l => l.replace(/\/\/.*/g, '')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
}

// Rule 01: SC01_DIRECT_BALANCE_MUTATION
export const checkSC01: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  // Allowed files: wallet-ops.ts, test files, seed files, dev sandbox
  if (relPath.includes('wallet-ops.ts') || relPath.includes('/test/') || relPath.includes('.test.') || relPath.includes('seed') || relPath.includes('/app/api/dev/')) {
    return findings;
  }

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    const lower = line.toLowerCase();
    if (
      (lower.includes('balance:') || lower.includes('referralbalance:') || lower.includes('quarantinebalance:') || lower.includes('totalspent:')) &&
      (lower.includes('increment:') || lower.includes('decrement:'))
    ) {
      findings.push({
        ruleId: 'SC01_DIRECT_BALANCE_MUTATION',
        severity: 'CRITICAL',
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
        message: 'Direct balance/totalSpent/referralBalance/quarantineBalance mutation detected outside WalletOps service.'
      });
    }
  });

  return findings;
};

// Rule 02: SC02_UNSTABLE_IDEMPOTENCY_KEY
export const checkSC02: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if (line.includes('idempotencyKey') || line.includes('idempotency_key')) {
      if (line.includes('Date.now()') || line.includes('Math.random()') || line.includes('new Date().getTime()')) {
        findings.push({
          ruleId: 'SC02_UNSTABLE_IDEMPOTENCY_KEY',
          severity: 'HIGH',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Unstable idempotency key constructor detected using Date.now(), Math.random(), or timestamp.'
        });
      }
    }
  });

  return findings;
};

// Rule 03: SC03_TENANTLESS_LOOKUP (Model & Context Aware)
export const checkSC03: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  // Tenant-Scoped Models MUST enforce tenantId everywhere
  const tenantScopedModels = ['order', 'payment', 'smartcampaign', 'smarttask', 'commission', 'ticket'];
  // Global Master Catalog Models (ADR-004 allowlist for admin actions & seed)
  const masterCatalogModels = ['service', 'category', 'shadowservice', 'provider'];

  const isAdminCatalog = relPath.includes('/actions/admin/catalog/') || relPath.includes('/actions/admin/providers/') || relPath.includes('/actions/admin/routing') || relPath.includes('seed.ts') || relPath.includes('/api/cron/');

  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    const lower = line.toLowerCase();

    // Check Tenant-Scoped Models -> BLOCK ALWAYS
    for (const model of tenantScopedModels) {
      if (lower.includes(`${model}.findunique(`) || lower.includes(`${model}.findfirst(`)) {
        const block = stripCommentsFromLines(lines.slice(idx, idx + 8));
        if (!block.includes('tenantId') && !block.includes('tenantWhere(') && !block.includes('requireTenantId(')) {
          findings.push({
            ruleId: 'SC03_TENANTLESS_LOOKUP',
            severity: 'CRITICAL',
            file: relPath,
            line: idx + 1,
            snippet: line.trim(),
            message: `Tenant-scoped model query (${model}) missing tenantId filter or tenantWhere guard.`
          });
        }
      }
    }

    // Check Master Catalog Models -> BLOCK if in user-facing code, WARN/ALLOWLIST if in admin catalog code
    if (!isAdminCatalog) {
      for (const model of masterCatalogModels) {
        if (lower.includes(`${model}.findunique(`) || lower.includes(`${model}.findfirst(`)) {
          const block = stripCommentsFromLines(lines.slice(idx, idx + 8));
          if (!block.includes('tenantId') && !block.includes('tenantWhere(') && !block.includes('requireTenantId(')) {
            findings.push({
              ruleId: 'SC03_TENANTLESS_LOOKUP',
              severity: 'CRITICAL',
              file: relPath,
              line: idx + 1,
              snippet: line.trim(),
              message: `Master catalog model query (${model}) missing tenantId filter in customer-facing path.`
            });
          }
        }
      }
    }
  });

  return findings;
};

// Rule 04: SC04_WEBHOOK_FAIL_OPEN
export const checkSC04: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.toLowerCase().includes('webhook') || relPath.includes('SC04')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
      if (line.includes('if (secret && signature)') || line.includes('if (signature && secret)')) {
        findings.push({
          ruleId: 'SC04_WEBHOOK_FAIL_OPEN',
          severity: 'CRITICAL',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Webhook fail-open check pattern detected (skips signature verification when header/secret omitted).'
        });
      }
    });
  }

  return findings;
};

// Rule 05: SC05_REFUND_OVERCHARGE
export const checkSC05: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if (line.includes('WalletOps.refund(')) {
      const block = stripCommentsFromLines(lines.slice(idx, idx + 10));
      if (!block.includes('idempotencyKey')) {
        findings.push({
          ruleId: 'SC05_REFUND_OVERCHARGE',
          severity: 'HIGH',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'WalletOps.refund invocation missing required idempotencyKey parameter.'
        });
      }
    }
  });

  return findings;
};

// Rule 06: SC06_COMMISSION_NO_UNIQUE
export const checkSC06: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if (line.includes('commission.create(')) {
      const block = stripCommentsFromLines(lines.slice(Math.max(0, idx - 8), idx + 8));
      if (!block.includes('upsert') && !block.includes('on conflict') && !block.includes('unique') && !block.includes('existing') && !block.includes('findfirst')) {
        findings.push({
          ruleId: 'SC06_COMMISSION_NO_UNIQUE',
          severity: 'HIGH',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Commission creation using raw create() without idempotent upsert or unique constraint check.'
        });
      }
    }
  });

  return findings;
};

// Rule 07: SC07_OWNER_FROM_METADATA
export const checkSC07: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    const block = stripCommentsFromLines(lines.slice(Math.max(0, idx - 2), idx + 5));
    if (line.includes('WalletOps.') && (block.includes('metadata?.userId') || block.includes('body.userId') || block.includes('payload.userId'))) {
      findings.push({
        ruleId: 'SC07_OWNER_FROM_METADATA',
        severity: 'CRITICAL',
        file: relPath,
        line: idx + 1,
        snippet: line.trim(),
        message: 'WalletOps user ownership loaded from untrusted metadata/body payload instead of verified DB payment record.'
      });
    }
  });

  return findings;
};

// Rule 08: SC08_UNSAFE_MUTEX_RELEASE
export const checkSC08: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if (line.includes('redis.del(') || line.includes('lock.release(')) {
      const block = stripCommentsFromLines(lines.slice(Math.max(0, idx - 5), idx + 5));
      if (!block.includes('token') && !block.includes('lua') && !block.includes('ownership')) {
        findings.push({
          ruleId: 'SC08_UNSAFE_MUTEX_RELEASE',
          severity: 'HIGH',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Mutex release without ownership token validation or Lua script guard.'
        });
      }
    }
  });

  return findings;
};

// Rule 09: SC09_FLOAT_MONEY (Read-Only DTO = MEDIUM/WARN)
export const checkSC09: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if ((line.includes('parseFloat(') || line.includes('Number(')) && (line.includes('amount') || line.includes('price') || line.includes('charge'))) {
      if (!line.includes('Math.round') && !line.includes('BigInt') && !line.includes('cents')) {
        findings.push({
          ruleId: 'SC09_FLOAT_MONEY',
          severity: 'MEDIUM', // WARN tier for DTO conversions
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Floating point conversion (parseFloat/Number) used for monetary values without integer cents parsing.'
        });
      }
    }
  });

  return findings;
};

// Rule 10: SC10_CAMPAIGN_OUTSIDE_TX
export const checkSC10: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  if (relPath.toLowerCase().includes('checkout') || relPath.includes('SC10')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
      if (line.includes('SmartDripService.createCampaign(')) {
        const block = stripCommentsFromLines(lines.slice(Math.max(0, idx - 10), idx + 5));
        if (!block.includes('runSerializableTransaction') && !block.includes('tx')) {
          findings.push({
            ruleId: 'SC10_CAMPAIGN_OUTSIDE_TX',
            severity: 'HIGH',
            file: relPath,
            line: idx + 1,
            snippet: line.trim(),
            message: 'SmartDripService.createCampaign invoked outside serializable checkout transaction block.'
          });
        }
      }
    });
  }

  return findings;
};

// Rule 11: SC11_MISSING_CURRENCY_CHECK
export const checkSC11: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  // Payment webhooks requiring currency check
  if (relPath.toLowerCase().includes('/webhooks/yookassa') || relPath.toLowerCase().includes('/webhooks/robokassa') || relPath.toLowerCase().includes('/webhooks/crypto') || relPath.includes('SC11')) {
    const lines = content.split('\n');
    const fullCode = stripCommentsFromText(content);
    if (!fullCode.includes('currency') && !fullCode.includes('RUB') && !fullCode.includes('USD')) {
      lines.forEach((line, idx) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
        if (line.includes('export async function') || line.includes('POST(')) {
          findings.push({
            ruleId: 'SC11_MISSING_CURRENCY_CHECK',
            severity: 'HIGH',
            file: relPath,
            line: idx + 1,
            snippet: line.trim(),
            message: 'Payment confirmation/webhook handler missing explicit currency verification.'
          });
        }
      });
    }
  }

  return findings;
};

// Rule 12: SC12_LOG_SECRET
export const checkSC12: StaticRuleHandler = (content, filePath) => {
  const findings: StaticFinding[] = [];
  const relPath = filePath.replace(/\\/g, '/');

  if (relPath.includes('/test/') || relPath.includes('.test.')) return findings;

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if (line.includes('console.log') || line.includes('log.info') || line.includes('logger.')) {
      if (line.includes('password') || line.includes('secret') || line.includes('apiKey') || line.includes('token') || line.includes('signature')) {
        findings.push({
          ruleId: 'SC12_LOG_SECRET',
          severity: 'HIGH',
          file: relPath,
          line: idx + 1,
          snippet: line.trim(),
          message: 'Sensitive secret (password, secret, apiKey, token, signature) logged in logger invocation.'
        });
      }
    }
  });

  return findings;
};

export const ALL_STATIC_RULES: StaticRuleHandler[] = [
  checkSC01, checkSC02, checkSC03, checkSC04,
  checkSC05, checkSC06, checkSC07, checkSC08,
  checkSC09, checkSC10, checkSC11, checkSC12
];

export function runAllRulesOnContent(content: string, filePath: string): StaticFinding[] {
  const findings: StaticFinding[] = [];
  for (const rule of ALL_STATIC_RULES) {
    findings.push(...rule(content, filePath));
  }
  return findings;
}
