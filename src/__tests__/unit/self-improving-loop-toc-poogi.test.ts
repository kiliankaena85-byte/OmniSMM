import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SelfImprovingOrchestrator } from '@/../scripts/self-improving-orchestrator';
import { healLayoutFiles } from '@/../scripts/ui/layout-healer';

describe('Self-Improving Loop TOC POOGI Architecture (Eli Goldratt Model)', () => {
  it('1. should initialize SelfImprovingOrchestrator and resolve base security suites', () => {
    const orchestrator = new SelfImprovingOrchestrator();
    const resolvedQuick = orchestrator.resolveImpactedTests({ quick: true });

    expect(resolvedQuick.suites).toContain('src/__tests__/security/vulnerability-vectors-remediation.test.ts');
    expect(resolvedQuick.suites).toContain('src/__tests__/security/sensitive-data-filter.test.ts');
    expect(resolvedQuick.suites.length).toBeLessThanOrEqual(4);
  });

  it('2. should dynamically map domain files to impacted test suites', () => {
    const orchestrator = new SelfImprovingOrchestrator();
    const resolvedFull = orchestrator.resolveImpactedTests({ quick: false });

    // Base suites present
    expect(resolvedFull.suites).toContain('src/__tests__/security/vulnerability-vectors-remediation.test.ts');
    expect(resolvedFull.suites).toContain('src/__tests__/security/sensitive-data-filter.test.ts');
    expect(resolvedFull.suites).toContain('src/__tests__/security/p0-threat-matrix.test.ts');

    // All returned test suites must physically exist on disk
    for (const suite of resolvedFull.suites) {
      expect(fs.existsSync(path.resolve(process.cwd(), suite)), `Suite ${suite} must exist`).toBe(true);
    }
  });

  it('3. should detect and apply INJECT_NUMERIC_INPUT_MODE in layout-healer dry-run', () => {
    const testSnippet = `
      export function NumericInputTest() {
        return (
          <div>
            <input type="number" className="w-full text-base" placeholder="Amount" />
          </div>
        );
      }
    `;

    const tmpDir = path.resolve(process.cwd(), '.temp', 'healer-test');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const tmpFile = path.join(tmpDir, 'test-component.tsx');
    fs.writeFileSync(tmpFile, testSnippet, 'utf-8');

    try {
      const result = healLayoutFiles({ scope: '.temp/healer-test', dryRun: true });
      const numericFixes = result.fixes.filter(f => f.type === 'INJECT_NUMERIC_INPUT_MODE');

      expect(numericFixes.length).toBeGreaterThan(0);
      expect(numericFixes[0].after).toContain('inputMode="numeric"');
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    }
  });

  it('4. should verify TOC POOGI Flow & System Constraint Metrics structure', async () => {
    const orchestrator = new SelfImprovingOrchestrator();
    
    // Spying runCommand to verify scorecard creation without executing heavy subcommands
    vi.spyOn(orchestrator as unknown as { runCommand: () => { status: number; stdout: string; stderr: string } }, 'runCommand').mockReturnValue({
      status: 0,
      stdout: 'All green',
      stderr: ''
    });

    const scorecard = await orchestrator.run({ quick: true });

    expect(scorecard.overallStatus).toBe('PASS');
    expect(scorecard.tocMetrics).toBeDefined();
    expect(scorecard.tocMetrics?.throughputSuitesCount).toBeGreaterThan(0);
    expect(scorecard.tocMetrics?.activeConstraint).toBeDefined();
    expect(scorecard.tocMetrics?.totalDurationMs).toBeGreaterThanOrEqual(0);

    const scorecardContent = fs.readFileSync(path.resolve(process.cwd(), '.planning', 'SELF_IMPROVING_LOOP_SCORECARD.md'), 'utf-8');
    expect(scorecardContent).toContain('TOC POOGI Flow & Constraint Metrics (Eli Goldratt Model)');
    expect(scorecardContent).toContain('Throughput (T):');
    expect(scorecardContent).toContain('Active System Constraint (Bottleneck):');
  });
});
