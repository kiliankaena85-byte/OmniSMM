import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { scanComponentFiles, runLayoutAudit } from '@/../scripts/ui/layout-sentry';

describe('Skill Contract: layout-overflow-sentry', () => {
  const skillDir = path.resolve(process.cwd(), '.agents/skills/layout-overflow-sentry');
  const skillFile = path.join(skillDir, 'SKILL.md');
  const coreFile = path.join(skillDir, 'CORE.md');
  const specFile = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-13-layout-overflow-sentry.md');

  it('1.1 should have valid SKILL.md, CORE.md, and SPEC documents', () => {
    expect(fs.existsSync(skillFile)).toBe(true);
    expect(fs.existsSync(coreFile)).toBe(true);
    expect(fs.existsSync(specFile)).toBe(true);
  });

  it('1.2 should strictly satisfy L1 CORE.md token/line budget (<= 25 lines)', () => {
    const coreContent = fs.readFileSync(coreFile, 'utf8');
    const lines = coreContent.split('\n').filter(l => l.trim().length > 0);
    expect(lines.length).toBeLessThanOrEqual(25);
  });

  it('1.3 should contain core layout invariants in SKILL.md', () => {
    const skillContent = fs.readFileSync(skillFile, 'utf8');
    expect(skillContent).toContain('name: layout-overflow-sentry');
    expect(skillContent).toContain('Zero Horizontal Scroll');
    expect(skillContent).toContain('shrink-0');
    expect(skillContent).toContain('iOS Auto-Zoom');
    expect(skillContent).toContain('dvh');
    expect(skillContent).toContain('Modal & Popover Hoisting');
  });

  it('1.4 should have layout:audit registered in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['layout:audit']).toBe('tsx scripts/ui/layout-sentry.ts');
  });

  it('2.1 should execute scanComponentFiles without runtime errors', () => {
    const findings = scanComponentFiles(['src/components/dashboard']);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('2.2 should execute runLayoutAudit and produce valid audit report structure', () => {
    const report = runLayoutAudit();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('verdict');
    expect(report).toHaveProperty('totalDefects');
    expect(Array.isArray(report.findings)).toBe(true);
  });
});
