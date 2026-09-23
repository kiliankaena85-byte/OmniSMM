import { describe, it, expect } from 'vitest';
import { validateEvidencePack, EvidencePack } from '../scripts/evidence-validator';
import { scanRoutes } from '../scripts/scanners/route-scanner';
import { scanSchema } from '../scripts/scanners/schema-scanner';
import { scanBalanceMutations } from '../scripts/scanners/balance-mutations';
import { scanIdempotencyKeys } from '../scripts/scanners/idempotency-keys';
import { scanDevRoutes } from '../scripts/scanners/dev-routes';

describe('AEARH Harness Self-Test Suite (v1.1)', () => {
  describe('1. Evidence Validator Rules', () => {
    const validBaseline: Partial<EvidencePack> = {
      module: 'test_module',
      baseline_commit: '14fa34dc503f9f4a9b607fd8da7624efb96785a9',
      schema_sha256: 'f5805511531cccb9cfc5f2768ebd059c14a19de875fc83bd24f6aa11827374e9',
      baseline_clean_tree: true,
      closure_status: 'CLOSED'
    };

    it('rejects verified control without file reference (E001)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'CTRL-01',
            category: 'business_logic',
            status: 'VERIFIED_PASS',
            evidence_level: 'L2_CODE_IMPLEMENTED',
            files: [],
            code_snippets: ['const x = 1;']
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E001_VERIFIED_WITHOUT_FILE'))).toBe(true);
    });

    it('rejects verified control without code snippet (E002)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'CTRL-02',
            category: 'business_logic',
            status: 'VERIFIED_PASS',
            evidence_level: 'L2_CODE_IMPLEMENTED',
            files: ['src/app/page.tsx'],
            code_snippets: []
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E002_VERIFIED_WITHOUT_CODE'))).toBe(true);
    });

    it('rejects security control at L4 without negative test (E003)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'SEC-01',
            category: 'security',
            status: 'VERIFIED_PASS',
            evidence_level: 'L4_NEGATIVE_TEST_PASSED',
            files: ['src/actions/auth.ts'],
            code_snippets: ['function verify() {}'],
            negative_tests: [] // Missing negative test
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E003_SECURITY_WITHOUT_NEGATIVE_TEST'))).toBe(true);
    });

    it('rejects financial control at L6 without reconciliation output (E004)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'FIN-01',
            category: 'financial',
            status: 'VERIFIED_PASS',
            evidence_level: 'L6_RECONCILIATION_PASSED',
            files: ['src/services/wallet.ts'],
            code_snippets: ['function debit() {}'],
            sql_checks: [{ query: 'SELECT 1' }]
            // Missing reconciliation_output
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E004_FINANCIAL_WITHOUT_RECONCILIATION'))).toBe(true);
    });

    it('rejects race control at L5 without concurrency test (E005)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'RACE-01',
            category: 'race',
            status: 'VERIFIED_PASS',
            evidence_level: 'L5_RACE_FUZZ_PASSED',
            files: ['src/workers/dripfeed.ts'],
            code_snippets: ['await updateMany()'],
            concurrency_tests: [] // Missing concurrency test
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E005_RACE_WITHOUT_CONCURRENCY_TEST'))).toBe(true);
    });

    it('rejects placeholder evidence (E006)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        schema_sha256: 'placeholder',
        controls: []
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E006_PLACEHOLDER_EVIDENCE'))).toBe(true);
    });

    it('rejects model existence as proof of control (E007)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'CTRL-07',
            category: 'business_logic',
            status: 'VERIFIED_PASS',
            evidence_level: 'L2_CODE_IMPLEMENTED',
            files: ['prisma/schema.prisma'],
            code_snippets: ['Model exists in schema definition']
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E007_MODEL_EXISTENCE_AS_PROOF'))).toBe(true);
    });

    it('rejects empty DB reconciliation as proof (E008)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        controls: [
          {
            control_id: 'FIN-08',
            category: 'financial',
            status: 'VERIFIED_PASS',
            evidence_level: 'L6_RECONCILIATION_PASSED',
            files: ['src/services/wallet.ts'],
            code_snippets: ['function credit() {}'],
            sql_checks: [{ query: 'SELECT 1' }],
            reconciliation_output: '0 rows returned (empty db)'
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E008_EMPTY_DB_RECONCILIATION'))).toBe(true);
    });

    it('rejects module closure when CRITICAL risk is open (E010)', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        closure_status: 'CLOSED',
        controls: [],
        risks: [
          {
            risk_id: 'CRIT-01',
            severity: 'CRITICAL',
            status: 'OPEN'
          }
        ]
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('E010_CRITICAL_RISK_OPEN_BUT_CLOSED'))).toBe(true);
    });

    it('accepts fully evidenced control pack', () => {
      const pack: EvidencePack = {
        ...validBaseline as EvidencePack,
        closure_status: 'CLOSED',
        controls: [
          {
            control_id: 'SEC-100',
            category: 'security',
            status: 'VERIFIED_PASS',
            evidence_level: 'L4_NEGATIVE_TEST_PASSED',
            files: ['src/actions/auth.ts'],
            code_snippets: ['if (!signature) throw new Error()'],
            positive_tests: ['auth.test.ts > authenticates user'],
            negative_tests: ['auth.test.ts > rejects missing signature']
          }
        ],
        risks: [
          {
            risk_id: 'SEC-RISK-01',
            severity: 'HIGH',
            status: 'CLOSED'
          }
        ],
        unknowns: ['None'],
        residual_risks: ['None']
      };
      const res = validateEvidencePack(pack);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
    });
  });

  describe('2. Scanners Integration Tests', () => {
    it('route scanner finds existing application routes', () => {
      const res = scanRoutes();
      expect(res.pages.length).toBeGreaterThan(0);
      expect(res.routes.length).toBeGreaterThan(0);
    });

    it('schema scanner parses prisma schema models', () => {
      const res = scanSchema();
      expect(res.models.length).toBeGreaterThan(0);
      expect(res.models.some(m => m.name === 'User')).toBe(true);
    });

    it('balance mutations scanner runs without error', () => {
      const res = scanBalanceMutations();
      expect(res.matches).toBeDefined();
    });

    it('idempotency scanner runs without error', () => {
      const res = scanIdempotencyKeys();
      expect(res.matches).toBeDefined();
    });

    it('dev routes scanner scans dev endpoints', () => {
      const res = scanDevRoutes();
      expect(res.routes).toBeDefined();
    });
  });
});
