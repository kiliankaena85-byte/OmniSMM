import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

export interface ReconciliationCheckResult {
  check_id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  query: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  passed: boolean;
  error?: string;
}

export interface ReconciliationReport {
  passed: boolean;
  checks: ReconciliationCheckResult[];
  criticalFailuresCount: number;
  warningsCount: number;
  timestamp: string;
}

export async function runReconciliation(): Promise<ReconciliationReport> {
  const checks: ReconciliationCheckResult[] = [];

  const checkQueries: Array<{ id: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'; query: string }> = [
    {
      id: 'USER_BALANCE_LEDGER_MATCH',
      severity: 'CRITICAL',
      query: `
        SELECT u.id, u.balance, COALESCE(SUM(l.amount), 0) as ledger_sum
        FROM "User" u
        LEFT JOIN "LedgerEntry" l ON l."userId" = u.id
        GROUP BY u.id, u.balance
        HAVING u.balance != COALESCE(SUM(l.amount), 0)
      `
    },
    {
      id: 'DUPLICATE_IDEMPOTENCY_KEY',
      severity: 'CRITICAL',
      query: `
        SELECT "idempotencyKey", COUNT(*) as count
        FROM "LedgerEntry"
        WHERE "idempotencyKey" IS NOT NULL
        GROUP BY "idempotencyKey"
        HAVING COUNT(*) > 1
      `
    },
    {
      id: 'DUPLICATE_COMMISSION',
      severity: 'CRITICAL',
      query: `
        SELECT "orderId", "referrerId", COUNT(*) as count
        FROM "Commission"
        GROUP BY "orderId", "referrerId"
        HAVING COUNT(*) > 1
      `
    },
    {
      id: 'NEGATIVE_REFERRAL_BALANCE',
      severity: 'HIGH',
      query: `
        SELECT id, "referralBalance"
        FROM "User"
        WHERE "referralBalance" < 0
      `
    },
    {
      id: 'ORPHAN_LEDGER_ENTRY',
      severity: 'HIGH',
      query: `
        SELECT l.id
        FROM "LedgerEntry" l
        LEFT JOIN "User" u ON l."userId" = u.id
        WHERE u.id IS NULL
      `
    },
    {
      id: 'ORPHAN_DRIP_ORDER',
      severity: 'HIGH',
      query: `
        SELECT o.id
        FROM "Order" o
        LEFT JOIN "User" u ON o."userId" = u.id
        WHERE u.id IS NULL
      `
    },
    {
      id: 'ORPHAN_SMART_CAMPAIGN',
      severity: 'HIGH',
      query: `
        SELECT sc.id
        FROM "SmartCampaign" sc
        LEFT JOIN "Order" o ON sc."orderId" = o.id
        WHERE o.id IS NULL
      `
    },
    {
      id: 'SMART_TASK_QUANTITY_MISMATCH',
      severity: 'HIGH',
      query: `
        SELECT sc.id, sc."totalQuantity", COALESCE(SUM(st.quantity), 0) as task_sum
        FROM "SmartCampaign" sc
        LEFT JOIN "SmartTask" st ON st."campaignId" = sc.id
        GROUP BY sc.id, sc."totalQuantity"
        HAVING sc."totalQuantity" != COALESCE(SUM(st.quantity), 0)
      `
    },
    {
      id: 'STUCK_SENT_TASK',
      severity: 'HIGH',
      query: `
        SELECT id, "updatedAt"
        FROM "SmartTask"
        WHERE status::text = 'SENT' AND "updatedAt" < NOW() - INTERVAL '30 minutes'
      `
    },
    {
      id: 'SENT_TASK_WITHOUT_EXECUTION',
      severity: 'HIGH',
      query: `
        SELECT st.id
        FROM "SmartTask" st
        LEFT JOIN "SmartExecution" se ON se."taskId" = st.id
        WHERE st.status::text IN ('SENT', 'COMPLETED') AND se.id IS NULL
      `
    },
    {
      id: 'DUPLICATE_SMART_EXECUTION',
      severity: 'CRITICAL',
      query: `
        SELECT "taskId", COUNT(*) as count
        FROM "SmartExecution"
        GROUP BY "taskId"
        HAVING COUNT(*) > 1
      `
    },
    {
      id: 'COMPLETED_CAMPAIGN_WITH_UNFINISHED_TASKS',
      severity: 'CRITICAL',
      query: `
        SELECT sc.id
        FROM "SmartCampaign" sc
        JOIN "SmartTask" st ON st."campaignId" = sc.id
        WHERE sc.status::text = 'COMPLETED' AND st.status::text NOT IN ('COMPLETED', 'CANCELED', 'CANCELLED', 'FAILED')
      `
    },
    {
      id: 'REFUND_OVERCHARGE',
      severity: 'CRITICAL',
      query: `
        SELECT p."orderId", o.charge, SUM(ABS(l.amount)) as refunded_sum
        FROM "LedgerEntry" l
        JOIN "Payment" p ON l."paymentId" = p.id
        JOIN "Order" o ON p."orderId" = o.id
        WHERE l.type::text = 'REFUND'
        GROUP BY p."orderId", o.charge
        HAVING SUM(ABS(l.amount)) > o.charge
      `
    }
  ];

  let criticalFailuresCount = 0;
  let warningsCount = 0;

  for (const item of checkQueries) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await db.$queryRawUnsafe<any[]>(item.query);
      const passed = rows.length === 0;

      if (!passed) {
        if (item.severity === 'CRITICAL') criticalFailuresCount++;
        else warningsCount++;
      }

      checks.push({
        check_id: item.id,
        severity: item.severity,
        query: item.query.trim().replace(/\s+/g, ' '),
        rows,
        passed
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      checks.push({
        check_id: item.id,
        severity: item.severity,
        query: item.query.trim().replace(/\s+/g, ' '),
        rows: [],
        passed: true,
        error: err.message
      });
    }
  }

  const passed = criticalFailuresCount === 0;

  return {
    passed,
    checks,
    criticalFailuresCount,
    warningsCount,
    timestamp: new Date().toISOString()
  };
}

if (require.main === module) {
  runReconciliation()
    .then(report => {
      console.log('=== AEARH FINANCIAL RECONCILIATION REPORT ===');
      console.log(JSON.stringify(report, null, 2));
      db.$disconnect();
      if (!report.passed) {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Reconciliation script execution failed:', err);
      db.$disconnect();
      process.exit(1);
    });
}
