import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { scanComponentFiles, runLayoutAudit } from '@/../scripts/ui/layout-sentry';
import { healLayoutFiles } from '@/../scripts/ui/layout-healer';
import { handleMcpRequest, LAYOUT_MCP_TOOLS } from '@/../scripts/ui/layout-mcp-server';

describe('Skill Contract: layout-overflow-sentry', () => {
  const skillDir = path.resolve(process.cwd(), '.agents/skills/layout-overflow-sentry');
  const skillFile = path.join(skillDir, 'SKILL.md');
  const coreFile = path.join(skillDir, 'CORE.md');
  const specFile = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-13-layout-overflow-sentry.md');
  const standardFile = path.resolve(process.cwd(), 'docs/standards/RESPONSIVE_LAYOUT_STANDARD_2026.md');

  it('1.1 should have valid SKILL.md, CORE.md, SPEC and STANDARD documents', () => {
    expect(fs.existsSync(skillFile)).toBe(true);
    expect(fs.existsSync(coreFile)).toBe(true);
    expect(fs.existsSync(specFile)).toBe(true);
    expect(fs.existsSync(standardFile)).toBe(true);
  });

  it('1.2 should strictly satisfy L1 CORE.md token/line budget (<= 25 lines) across all UI skills', () => {
    const uiSkills = [
      'layout-overflow-sentry',
      'mobile-first-responsive-architect',
      'viewport-responsive-density',
      'client-hydration-perf-guard',
      'react-19-next-16-ui-engine'
    ];

    for (const skillName of uiSkills) {
      const corePath = path.resolve(process.cwd(), '.agents/skills', skillName, 'CORE.md');
      expect(fs.existsSync(corePath), `CORE.md must exist for ${skillName}`).toBe(true);
      const coreContent = fs.readFileSync(corePath, 'utf8');
      const lines = coreContent.split('\n').filter(l => l.trim().length > 0);
      expect(lines.length, `Line budget for ${skillName} must be <= 25`).toBeLessThanOrEqual(25);
    }
  });

  it('1.3 should contain core layout invariants in SKILL.md', () => {
    const skillContent = fs.readFileSync(skillFile, 'utf8');
    expect(skillContent).toContain('name: layout-overflow-sentry');
    expect(skillContent).toContain('Zero Horizontal Scroll');
    expect(skillContent).toContain('shrink-0');
    expect(skillContent).toContain('iOS Auto-Zoom');
    expect(skillContent).toContain('dvh');
    expect(skillContent).toContain('Modal & Popover Hoisting');
    expect(skillContent).toContain('DOM Nesting Invariants');
  });

  it('1.4 should have layout scripts registered in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.scripts['layout:audit']).toBe('tsx scripts/ui/layout-sentry.ts');
    expect(pkg.scripts['layout:heal']).toBe('tsx scripts/ui/layout-healer.ts');
    expect(pkg.scripts['layout:fix']).toBe('tsx scripts/ui/layout-healer.ts --fix');
    expect(pkg.scripts['layout:mcp']).toBe('tsx scripts/ui/layout-mcp-server.ts');
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

  it('2.3 should execute healLayoutFiles in dry-run mode without modifying files', () => {
    const result = healLayoutFiles({ dryRun: true, scope: 'src/components/dashboard' });
    expect(result.dryRun).toBe(true);
    expect(typeof result.filesScanned).toBe('number');
    expect(typeof result.fixesApplied).toBe('number');
    expect(Array.isArray(result.fixes)).toBe(true);
  });

  it('2.4 should correctly detect and heal synthetic layout anti-patterns', () => {
    const tmpDir = path.resolve(process.cwd(), '.planning', 'test_tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    const testFile = path.join(tmpDir, 'SyntheticLayoutTest.tsx');

    const rawCode = `
import React from 'react';
import { Zap } from 'lucide-react';

export function SyntheticLayoutTest() {
  return (
    <div className="flex w-screen items-center">
      <Zap className="w-5 h-5 text-primary" />
      <span className="truncate">Title</span>
      <input type="text" className="text-xs px-2" />
      <button className="p-1 rounded-lg">Mini</button>
      <div className="fixed inset-x-0 bottom-0 bg-background border-t">
        <button onClick={() => console.log('click')}>Action</button>
      </div>
    </div>
  );
}
`;
    fs.writeFileSync(testFile, rawCode, 'utf8');

    // Run heal on synthetic file
    const healResult = healLayoutFiles({ dryRun: false, scope: testFile });
    expect(healResult.fixesApplied).toBeGreaterThanOrEqual(6);

    const healedContent = fs.readFileSync(testFile, 'utf8');
    expect(healedContent).toContain('shrink-0');
    expect(healedContent).toContain('w-full max-w-full');
    expect(healedContent).toContain('min-w-0');
    expect(healedContent).toContain('text-base sm:text-xs');
    expect(healedContent).toContain('min-w-[44px]');
    expect(healedContent).toContain('safe-area-inset-bottom');
    expect(healedContent).toContain('type="button"');

    // Clean up
    fs.unlinkSync(testFile);
  });

  it('3.1 should handle MCP initialize and tools/list requests', async () => {
    expect(LAYOUT_MCP_TOOLS.length).toBe(3);

    const initRes = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    expect(initRes.result.serverInfo.name).toBe('layout-overflow-sentry');

    const toolsRes = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    expect(toolsRes.result.tools.map((t: any) => t.name)).toContain('layout_audit');
    expect(toolsRes.result.tools.map((t: any) => t.name)).toContain('layout_autofix');
    expect(toolsRes.result.tools.map((t: any) => t.name)).toContain('layout_dom_probe');
  });

  it('3.2 should handle MCP tools/call for layout_audit, layout_autofix, and layout_dom_probe', async () => {
    const callAudit = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'layout_audit',
        arguments: { scope: 'src/components/dashboard' }
      }
    });
    expect(callAudit.result.content[0].type).toBe('text');
    const parsedAudit = JSON.parse(callAudit.result.content[0].text);
    expect(parsedAudit.status).toBe('success');

    const callHeal = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'layout_autofix',
        arguments: { scope: 'src/components/dashboard', dryRun: true }
      }
    });
    expect(callHeal.result.content[0].type).toBe('text');
    const parsedHeal = JSON.parse(callHeal.result.content[0].text);
    expect(parsedHeal.status).toBe('success');
    expect(parsedHeal.dryRun).toBe(true);

    const callProbe = await handleMcpRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'layout_dom_probe',
        arguments: { width: 390, height: 844 }
      }
    });
    expect(callProbe.result.content[0].type).toBe('text');
    const parsedProbe = JSON.parse(callProbe.result.content[0].text);
    expect(parsedProbe.status).toBe('success');
    expect(parsedProbe.viewport.width).toBe(390);
    expect(parsedProbe).toHaveProperty('overflowDeltaPx');
    expect(parsedProbe).toHaveProperty('smallTouchTargetsCount');
    expect(parsedProbe).toHaveProperty('iosZoomSafe');
  });
});
