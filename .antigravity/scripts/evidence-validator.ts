import fs from 'fs';
import path from 'path';

export interface EvidenceControl {
  control_id: string;
  module?: string;
  category: 'security' | 'financial' | 'race' | 'business_logic' | string;
  status: string;
  evidence_level: string;
  required_evidence_level?: string;
  files?: string[];
  code_snippets?: string[] | string;
  positive_tests?: string[];
  negative_tests?: string[];
  concurrency_tests?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sql_checks?: any[];
  reconciliation_output?: string | object;
  logs?: string[];
  monitoring?: string[];
  unknowns?: string[];
  residual_risks?: string[];
  validator_errors?: string[];
}

export interface EvidenceRisk {
  risk_id: string;
  module?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  status: 'OPEN' | 'CLOSED' | 'RISK_ACCEPTED' | 'NEEDS_REMEDIATION' | string;
  title?: string;
  attack_scenario?: string;
  impact?: string;
  evidence?: string;
}

export interface EvidencePack {
  module?: string;
  baseline_commit?: string;
  schema_sha256?: string;
  baseline_clean_tree?: boolean;
  baseline_status?: string;
  closure_status?: 'CLOSED' | 'CONDITIONALLY_CLOSED' | 'NEEDS_REMEDIATION' | 'OPEN' | string;
  controls: EvidenceControl[];
  risks?: EvidenceRisk[];
  unknowns?: string[];
  residual_risks?: string[];
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  rejectedControls: string[];
  rejectedRisks: string[];
  score: number;
}

const PLACEHOLDERS = ['...', 'placeholder', 'todo', 'uncommitted', 'unknown', 'none', 'n/a', '0 rows', '""', 'null', 'undefined'];

const LEVEL_WEIGHTS: Record<string, number> = {
  L0_CLAIMED: 0,
  L1_DESIGN_PRESENT: 1,
  L2_CODE_IMPLEMENTED: 2,
  L3_POSITIVE_TEST_PASSED: 3,
  L4_NEGATIVE_TEST_PASSED: 4,
  L5_RACE_FUZZ_PASSED: 5,
  L6_RECONCILIATION_PASSED: 6,
  L7_MONITORED: 7,
  L8_PRODUCTION_PROVEN: 8
};

function isPlaceholderText(text: string | undefined | null): boolean {
  if (!text) return true;
  const trimmed = text.trim().toLowerCase();
  return trimmed === '' || PLACEHOLDERS.includes(trimmed);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateJsonSchema(pack: any): string[] {
  const schemaErrors: string[] = [];
  if (!pack || typeof pack !== 'object') {
    schemaErrors.push('E014_SCHEMA_VIOLATION: Root evidence pack must be a valid JSON object.');
    return schemaErrors;
  }

  if (typeof pack.module !== 'string' || isPlaceholderText(pack.module)) {
    schemaErrors.push('E014_SCHEMA_VIOLATION: Property "module" is required and must be a non-empty string.');
  }

  if (typeof pack.baseline_commit !== 'string') {
    schemaErrors.push('E014_SCHEMA_VIOLATION: Property "baseline_commit" is required and must be a string.');
  }

  if (typeof pack.schema_sha256 !== 'string') {
    schemaErrors.push('E014_SCHEMA_VIOLATION: Property "schema_sha256" is required and must be a string.');
  }

  if (typeof pack.closure_status !== 'string') {
    schemaErrors.push('E014_SCHEMA_VIOLATION: Property "closure_status" is required and must be a string.');
  }

  if (!Array.isArray(pack.controls)) {
    schemaErrors.push('E014_SCHEMA_VIOLATION: Property "controls" must be an array.');
  }

  return schemaErrors;
}

export function validateEvidencePack(pack: EvidencePack): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rejectedControls: string[] = [];
  const rejectedRisks: string[] = [];

  // 0. SCHEMA VALIDATION (E014)
  const schemaViolations = validateJsonSchema(pack);
  if (schemaViolations.length > 0) {
    errors.push(...schemaViolations);
  }

  // 1. BASELINE CHECKS
  if (!pack.baseline_commit || pack.baseline_commit === 'UNCOMMITTED' || isPlaceholderText(pack.baseline_commit)) {
    errors.push('E009_DIRTY_BASELINE: Missing or uncommitted baseline commit hash.');
  }

  if (!pack.schema_sha256 || isPlaceholderText(pack.schema_sha256)) {
    errors.push('E006_PLACEHOLDER_EVIDENCE: Invalid or placeholder schema_sha256 hash.');
  }

  if (pack.baseline_clean_tree === false && pack.baseline_status !== 'DIRTY_TREE_ALLOWED_WITH_WARNING') {
    errors.push('E009_DIRTY_BASELINE: Working tree is dirty without explicit DIRTY_TREE_ALLOWED_WITH_WARNING acceptance.');
  }

  // 2. CONTROL CHECKS
  if (!pack.controls || !Array.isArray(pack.controls) || pack.controls.length === 0) {
    warnings.push('W003_NO_CONTROLS: Evidence pack contains no control definitions.');
  } else {
    for (const ctrl of pack.controls) {
      let ctrlRejected = false;

      if (!ctrl.control_id) {
        errors.push('E006_PLACEHOLDER_EVIDENCE: Control entry missing control_id.');
        continue;
      }

      const currentLevelWeight = LEVEL_WEIGHTS[ctrl.evidence_level] ?? -1;
      const requiredLevelWeight = ctrl.required_evidence_level ? (LEVEL_WEIGHTS[ctrl.required_evidence_level] ?? 0) : 0;

      // Overclaim check
      if (ctrl.status === 'VERIFIED_PASS' && currentLevelWeight < requiredLevelWeight) {
        errors.push(`E006_PLACEHOLDER_EVIDENCE: Control ${ctrl.control_id} marked VERIFIED_PASS but evidence level ${ctrl.evidence_level} is below required level ${ctrl.required_evidence_level}.`);
        ctrlRejected = true;
      }

      // E001: Missing file
      const files = ctrl.files || [];
      if (ctrl.status === 'VERIFIED_PASS' && files.length === 0) {
        errors.push(`E001_VERIFIED_WITHOUT_FILE: Control ${ctrl.control_id} marked VERIFIED_PASS without file references.`);
        ctrlRejected = true;
      }

      // E002: Missing code snippet
      const snippets = Array.isArray(ctrl.code_snippets) ? ctrl.code_snippets : (ctrl.code_snippets ? [ctrl.code_snippets] : []);
      if (ctrl.status === 'VERIFIED_PASS' && (snippets.length === 0 || snippets.some(s => isPlaceholderText(s)))) {
        errors.push(`E002_VERIFIED_WITHOUT_CODE: Control ${ctrl.control_id} marked VERIFIED_PASS without valid code snippet proof.`);
        ctrlRejected = true;
      }

      // E007: Model existence as proof
      if (ctrl.status === 'VERIFIED_PASS' && snippets.some(s => s.toLowerCase().includes('model exists') || s.toLowerCase().includes('schema definition only'))) {
        errors.push(`E007_MODEL_EXISTENCE_AS_PROOF: Control ${ctrl.control_id} attempts to use model existence as proof of active control enforcement.`);
        ctrlRejected = true;
      }

      // E011, E012, E013: Unstable / Random Idempotency Keys in code snippets
      for (const snippet of snippets) {
        if (snippet.includes('idempotency') || snippet.includes('idempotencyKey') || snippet.includes('key')) {
          if (snippet.includes('Date.now()')) {
            errors.push(`E011_UNSTABLE_IDEMPOTENCY_KEY: Control ${ctrl.control_id} uses unstable Date.now() timestamp in idempotency key constructor.`);
            ctrlRejected = true;
          }
          if (snippet.includes('Math.random()')) {
            errors.push(`E012_RANDOM_IDEMPOTENCY_KEY: Control ${ctrl.control_id} uses random Math.random() in idempotency key constructor.`);
            ctrlRejected = true;
          }
          if (snippet.includes('randomUUID()') && !snippet.includes('.id')) {
            errors.push(`E013_NON_PERSISTED_RANDOM_KEY: Control ${ctrl.control_id} uses unpersisted randomUUID() in idempotency key constructor.`);
            ctrlRejected = true;
          }
        }
      }

      // L3 Positive Tests
      if (currentLevelWeight >= 3 && (!ctrl.positive_tests || ctrl.positive_tests.length === 0)) {
        errors.push(`E006_PLACEHOLDER_EVIDENCE: Control ${ctrl.control_id} at level ${ctrl.evidence_level} lacks positive test evidence.`);
        ctrlRejected = true;
      }

      // E003: Security without negative test
      if (ctrl.category === 'security' && (ctrl.status === 'VERIFIED_PASS' || currentLevelWeight >= 4)) {
        if (!ctrl.negative_tests || ctrl.negative_tests.length === 0 || ctrl.negative_tests.some(t => isPlaceholderText(t))) {
          errors.push(`E003_SECURITY_WITHOUT_NEGATIVE_TEST: Security control ${ctrl.control_id} marked VERIFIED_PASS / L4 without verified negative test execution.`);
          ctrlRejected = true;
        }
      }

      // E005: Race without concurrency test
      if (ctrl.category === 'race' && (ctrl.status === 'VERIFIED_PASS' || currentLevelWeight >= 5)) {
        if (!ctrl.concurrency_tests || ctrl.concurrency_tests.length === 0 || ctrl.concurrency_tests.some(t => isPlaceholderText(t))) {
          errors.push(`E005_RACE_WITHOUT_CONCURRENCY_TEST: Race condition control ${ctrl.control_id} marked VERIFIED_PASS / L5 without multi-threaded concurrency fuzz test.`);
          ctrlRejected = true;
        }
      }

      // E004 & E008: Financial without reconciliation
      if (ctrl.category === 'financial' && (ctrl.status === 'VERIFIED_PASS' || currentLevelWeight >= 6)) {
        const recon = typeof ctrl.reconciliation_output === 'string'
          ? ctrl.reconciliation_output
          : (ctrl.reconciliation_output ? JSON.stringify(ctrl.reconciliation_output) : '');

        if (!recon || isPlaceholderText(recon)) {
          errors.push(`E004_FINANCIAL_WITHOUT_RECONCILIATION: Financial control ${ctrl.control_id} marked VERIFIED_PASS / L6 without reconciliation output.`);
          ctrlRejected = true;
        } else if (recon.toLowerCase().includes('0 records') || recon.toLowerCase().includes('empty db') || recon.toLowerCase().includes('0 rows')) {
          errors.push(`E008_EMPTY_DB_RECONCILIATION: Financial control ${ctrl.control_id} uses empty database state as reconciliation proof.`);
          ctrlRejected = true;
        }

        if (!ctrl.sql_checks || ctrl.sql_checks.length === 0) {
          errors.push(`E004_FINANCIAL_WITHOUT_RECONCILIATION: Financial control ${ctrl.control_id} lacks SQL invariant checks.`);
          ctrlRejected = true;
        }
      }

      // Monitoring check for L7
      if (currentLevelWeight >= 7 && (!ctrl.monitoring || ctrl.monitoring.length === 0)) {
        errors.push(`E006_PLACEHOLDER_EVIDENCE: Control ${ctrl.control_id} claims L7_MONITORED without production alert configuration.`);
        ctrlRejected = true;
      }

      if (ctrlRejected) {
        rejectedControls.push(ctrl.control_id);
      }
    }
  }

  // 3. RISK & CLOSURE CHECKS
  const risks = pack.risks || [];
  if (risks.length === 0) {
    warnings.push('W002_EMPTY_RISKS: Risk register is empty.');
  }

  const unknowns = pack.unknowns || [];
  if (unknowns.length === 0) {
    warnings.push('W001_EMPTY_UNKNOWNS: Unknowns register is empty.');
  }

  const openCritical = risks.filter(r => r.severity === 'CRITICAL' && r.status !== 'CLOSED' && r.status !== 'RISK_ACCEPTED');
  const openHigh = risks.filter(r => r.severity === 'HIGH' && r.status !== 'CLOSED' && r.status !== 'RISK_ACCEPTED');

  if (openCritical.length > 0) {
    openCritical.forEach(r => rejectedRisks.push(r.risk_id));
    if (pack.closure_status === 'CLOSED') {
      errors.push(`E010_CRITICAL_RISK_OPEN_BUT_CLOSED: Module closure set to CLOSED despite ${openCritical.length} open CRITICAL risk(s) (${openCritical.map(r => r.risk_id).join(', ')}).`);
    }
  }

  if (openHigh.length > 0 && pack.closure_status === 'CLOSED') {
    errors.push(`E010_CRITICAL_RISK_OPEN_BUT_CLOSED: Module closure set to CLOSED despite ${openHigh.length} open HIGH risk(s). Closure must be CONDITIONALLY_CLOSED or NEEDS_REMEDIATION.`);
  }

  const score = Math.max(0, Math.min(100, 100 - (errors.length * 15) - (warnings.length * 5)));
  const valid = errors.length === 0;

  return {
    valid,
    errors,
    warnings,
    rejectedControls,
    rejectedRisks,
    score
  };
}

if (require.main === module) {
  const targetFile = process.argv[2] || path.resolve(process.cwd(), '.antigravity/reports/sample.json');
  
  if (!fs.existsSync(targetFile)) {
    console.error(`Error: Target evidence pack JSON file not found: ${targetFile}`);
    process.exit(1);
  }

  try {
    const rawData = fs.readFileSync(targetFile, 'utf8');
    const pack: EvidencePack = JSON.parse(rawData);
    const report = validateEvidencePack(pack);

    console.log('=== AEARH EVIDENCE VALIDATION REPORT ===');
    console.log(JSON.stringify(report, null, 2));

    if (!report.valid) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to parse or validate evidence pack:', err);
    process.exit(1);
  }
}
