import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DeterministicArbiter } from '@/../scripts/decision-engine/deterministic-arbiter';

describe('Deterministic Decision Engine (DDE-2026 / TOC POOGI Arbiter)', () => {
  const tmpDir = path.resolve(process.cwd(), '.temp', 'dde-test');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('1. AST Sensor should detect "use server" inside page.tsx as BLOCKER', () => {
    const pageFile = path.join(tmpDir, 'page.tsx');
    fs.writeFileSync(pageFile, `
      "use server";
      export default function Page() {
        return <div>Hello</div>;
      }
    `, 'utf-8');

    const arbiter = new DeterministicArbiter({ projectRoot: process.cwd() });
    const relPath = path.relative(process.cwd(), pageFile).replace(/\\/g, '/');
    const result = arbiter.runAstSensor([relPath]);

    expect(result.passed).toBe(false);
    const blocker = result.findings.find(f => f.severity === 'BLOCKER');
    expect(blocker).toBeDefined();
    expect(blocker?.message).toContain('use server');
  });

  it('2. AST Sensor should detect components exceeding 200 lines as MAJOR', () => {
    const bigComponent = path.join(tmpDir, 'BigComponent.tsx');
    const lines = Array.from({ length: 210 }, (_, i) => `// Line ${i + 1}`).join('\n');
    fs.writeFileSync(bigComponent, lines, 'utf-8');

    const arbiter = new DeterministicArbiter({ projectRoot: process.cwd() });
    const relPath = path.relative(process.cwd(), bigComponent).replace(/\\/g, '/');
    const result = arbiter.runAstSensor([relPath]);

    expect(result.passed).toBe(false);
    const major = result.findings.find(f => f.severity === 'MAJOR');
    expect(major).toBeDefined();
    expect(major?.message).toContain('превышает лимит в 200 строк');
  });

  it('3. Hygiene Sensor should detect any, @ts-ignore, and TODO as MAJOR violations', () => {
    const dirtyFile = path.join(tmpDir, 'dirty-module.ts');
    fs.writeFileSync(dirtyFile, `
      // TODO: implement later
      // @ts-ignore
      export const badVar: any = 123;
    `, 'utf-8');

    const arbiter = new DeterministicArbiter({ projectRoot: process.cwd() });
    const relPath = path.relative(process.cwd(), dirtyFile).replace(/\\/g, '/');
    const result = arbiter.runHygieneSensor([relPath]);

    expect(result.passed).toBe(false);
    const anyFinding = result.findings.find(f => f.message.includes('any'));
    const todoFinding = result.findings.find(f => f.message.includes('TODO'));
    const tsIgnoreFinding = result.findings.find(f => f.message.includes('@ts-ignore'));

    expect(anyFinding).toBeDefined();
    expect(todoFinding).toBeDefined();
    expect(tsIgnoreFinding).toBeDefined();
  });

  it('4. DOM Sensor should catch input[type="number"] lacking inputMode="numeric"', () => {
    const inputComponent = path.join(tmpDir, 'InputComponent.tsx');
    fs.writeFileSync(inputComponent, `
      export function InputView() {
        return <input type="number" className="p-2" />;
      }
    `, 'utf-8');

    const arbiter = new DeterministicArbiter({ projectRoot: process.cwd() });
    const relPath = path.relative(process.cwd(), inputComponent).replace(/\\/g, '/');
    const result = arbiter.runDomSensor([relPath]);

    expect(result.passed).toBe(false);
    const numInputFinding = result.findings.find(f => f.message.includes('inputMode="numeric"'));
    expect(numInputFinding).toBeDefined();
    expect(numInputFinding?.severity).toBe('MAJOR');
  });

  it('5. Full Arbiter evaluation should yield exactly 0 tokens and generate decision report', async () => {
    const cleanFile = path.join(tmpDir, 'CleanView.tsx');
    fs.writeFileSync(cleanFile, `
      export function CleanView() {
        return (
          <div className="w-full max-w-full">
            <input type="number" inputMode="numeric" className="w-full" />
          </div>
        );
      }
    `, 'utf-8');

    const testReportPath = path.join(tmpDir, 'TEST_DECISION_REPORT.md');
    const arbiter = new DeterministicArbiter({
      projectRoot: process.cwd(),
      reportPath: testReportPath
    });

    const relPath = path.relative(process.cwd(), cleanFile).replace(/\\/g, '/');
    const result = await arbiter.evaluate({
      targetFiles: [relPath],
      skipTdd: true // Mocking TDD in unit test to focus on DDE engine logic
    });

    expect(result.tokenCost).toBe(0);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.sensors.astSensor.passed).toBe(true);
    expect(result.sensors.domSensor.passed).toBe(true);
    expect(result.sensors.hygieneSensor.passed).toBe(true);
    expect(result.verdict).toBe('PASS');

    expect(fs.existsSync(testReportPath)).toBe(true);
    const content = fs.readFileSync(testReportPath, 'utf-8');
    expect(content).toContain('Deterministic Decision Engine Report');
    expect(content).toContain('0 Tokens (Zero-Token Verification)');
    expect(content).toContain('**Final Verdict:** `PASS`');
  });
});
