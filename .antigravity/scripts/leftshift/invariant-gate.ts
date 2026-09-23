import fs from 'fs';
import path from 'path';
import { runReconciliation, ReconciliationReport } from '../reconciliation';

export interface InvariantGateResult {
  passed: boolean;
  criticalFailuresCount: number;
  warningsCount: number;
  report: ReconciliationReport;
  evidenceFile: string;
  timestamp: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeJsonStringify = (obj: any) =>
  JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value), 2);

export async function runInvariantGate(): Promise<InvariantGateResult> {
  const report = await runReconciliation();
  const passed = report.passed;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), '.antigravity/evidence/leftshift');
  fs.mkdirSync(outDir, { recursive: true });

  const evidenceFile = path.join(outDir, `invariant-gate-${timestamp}.json`);

  const result: InvariantGateResult = {
    passed,
    criticalFailuresCount: report.criticalFailuresCount,
    warningsCount: report.warningsCount,
    report,
    evidenceFile,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(evidenceFile, safeJsonStringify(result));

  return result;
}

if (require.main === module) {
  console.log('=== ALSH INVARIANT GATE ===');
  runInvariantGate()
    .then(res => {
      console.log(safeJsonStringify({ passed: res.passed, criticalFailuresCount: res.criticalFailuresCount, evidenceFile: res.evidenceFile }));
      if (!res.passed) {
        console.error('\nBLOCKED: Invariant gate failed! Critical database invariants violated.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Invariant gate error:', err);
      process.exit(1);
    });
}
