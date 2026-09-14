/**
 * scripts/self-improving-orchestrator.ts
 *
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Unified Self-Improving Loop Orchestrator (SIL-2026 Protocol).
 *
 * Coordinates the 5-phase self-improving feedback loop:
 * Phase 1: Static Quality & Security Hygiene Gate (tsc, bundle secrets, API domains)
 * Phase 2: Layout & Mobile Density Sentry (Layout Healer auto-codemods)
 * Phase 3: Adversarial TDD & Critical Regression Gate
 * Phase 4: Ephemeral Sandbox & Visual Verification (Optional / Stage port 3005)
 * Phase 5: Knowledge & Skill Evolution (SKILL.md updates & GraphRAG sync)
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { healLayoutFiles, HealResult } from './ui/layout-healer';
import { evolveSkillWithLesson } from './skill-evolve';

export interface LoopPhaseResult {
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

export interface SelfImprovingLoopScorecard {
  timestamp: string;
  overallStatus: 'PASS' | 'FAIL' | 'NEEDS_APPROVAL';
  autoHealed: boolean;
  phases: LoopPhaseResult[];
  appliedFixesCount: number;
  learnedLessonsCount: number;
}

export class SelfImprovingOrchestrator {
  private projectRoot: string;
  private scorecardPath: string;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.scorecardPath = path.resolve(this.projectRoot, '.planning', 'SELF_IMPROVING_LOOP_SCORECARD.md');
  }

  public async run(options: { autoHeal?: boolean; full?: boolean; quick?: boolean } = {}): Promise<SelfImprovingLoopScorecard> {
    console.log('======================================================================');
    console.log('🔄 STARTING SELF-IMPROVING LOOP ORCHESTRATOR (SIL-2026)');
    console.log(`   Mode: ${options.full ? 'FULL (inc. Stage/Visual)' : options.quick ? 'QUICK' : 'STANDARD'}`);
    console.log(`   Auto-Heal: ${options.autoHeal ? '🟢 ENABLED' : '⚪ DRY-RUN'}`);
    console.log('======================================================================\n');

    const phases: LoopPhaseResult[] = [];
    let appliedFixesCount = 0;
    let learnedLessonsCount = 0;

    // --- Phase 1: Static Hygiene & Secret Gate ---
    const phase1Start = Date.now();
    console.log('▶ [PHASE 1] Static Quality & Secret Leak Gate...');
    const tscRes = this.runCommand('npx', ['tsc', '--noEmit'], 60000);
    const secretRes = this.runCommand('node', ['scripts/check-bundle-secrets.mjs'], 15000);
    const domainRes = this.runCommand('npx', ['tsx', 'scripts/ci/check-api-docs-domains.ts'], 15000);

    const phase1Passed = tscRes.status === 0 && secretRes.status === 0 && domainRes.status === 0;
    phases.push({
      name: 'Phase 1: Static Quality & Secrets',
      passed: phase1Passed,
      durationMs: Date.now() - phase1Start,
      details: phase1Passed
        ? 'TypeScript strict (0 errors), bundle secrets clean, API domains compliant.'
        : `Failures: tsc (${tscRes.status === 0 ? 'OK' : 'FAIL'}), secrets (${secretRes.status === 0 ? 'OK' : 'FAIL'}), domains (${domainRes.status === 0 ? 'OK' : 'FAIL'})`
    });
    console.log(`   └─ Phase 1 Status: ${phase1Passed ? '🟢 PASS' : '🔴 FAIL'}\n`);

    // --- Phase 2: Layout & Mobile Density Sentry ---
    const phase2Start = Date.now();
    console.log('▶ [PHASE 2] Layout & Mobile Density Sentry (Layout Healer)...');
    let healResult: HealResult;
    try {
      healResult = healLayoutFiles({ dryRun: !options.autoHeal });
      appliedFixesCount = healResult.fixesApplied;
      console.log(`   Scanned: ${healResult.filesScanned} files | Issues found: ${healResult.fixes.length} | Applied: ${healResult.fixesApplied}`);
      
      phases.push({
        name: 'Phase 2: Layout Auto-Heal',
        passed: true,
        durationMs: Date.now() - phase2Start,
        details: `${healResult.fixesApplied} fixes applied (${healResult.fixes.length} detected across ${healResult.filesScanned} files).`
      });
      console.log(`   └─ Phase 2 Status: 🟢 PASS\n`);
    } catch (err: any) {
      phases.push({
        name: 'Phase 2: Layout Auto-Heal',
        passed: false,
        durationMs: Date.now() - phase2Start,
        details: `Layout healer error: ${err.message}`
      });
      console.log(`   └─ Phase 2 Status: 🔴 FAIL\n`);
    }

    // --- Phase 3: Adversarial TDD & Critical Regression Gate ---
    const phase3Start = Date.now();
    console.log('▶ [PHASE 3] Adversarial TDD & Critical Regression Gate...');
    const criticalTests = options.quick
      ? ['src/__tests__/security/vulnerability-vectors-remediation.test.ts']
      : [
          'src/__tests__/security/vulnerability-vectors-remediation.test.ts',
          'src/services/analyzer/__tests__/strict-domain-validator.test.ts',
          'src/services/analyzer/__tests__/target-type-compatibility.test.ts'
        ];
    const testTimeout = options.quick ? 45000 : 240000;
    const vitestRes = this.runCommand('npx', ['dotenv', '-e', '.env.test', '--', 'vitest', 'run', ...criticalTests], testTimeout);
    const phase3Passed = vitestRes.status === 0;
    phases.push({
      name: 'Phase 3: Critical TDD Regressions',
      passed: phase3Passed,
      durationMs: Date.now() - phase3Start,
      details: phase3Passed 
        ? `Passed ${criticalTests.length} test suites cleanly.` 
        : `Vitest encountered failing regression tests: ${vitestRes.stderr || vitestRes.stdout || 'exit code ' + vitestRes.status}`
    });
    console.log(`   └─ Phase 3 Status: ${phase3Passed ? '🟢 PASS' : '🔴 FAIL'}\n`);

    // --- Phase 4: Ephemeral Stage & Visual Loop (Optional / Full) ---
    if (options.full) {
      const phase4Start = Date.now();
      console.log('▶ [PHASE 4] Ephemeral Stage & Visual Loop (:3005)...');
      const stageRes = this.runCommand('npx', ['tsx', 'scripts/ephemeral-sandbox-visual-loop.ts'], 120000);
      const phase4Passed = stageRes.status === 0;
      phases.push({
        name: 'Phase 4: Ephemeral Stage Visual Loop',
        passed: phase4Passed,
        durationMs: Date.now() - phase4Start,
        details: phase4Passed ? 'Multi-role headless visual audit passed.' : 'Visual audit failed or found horizontal scroll.'
      });
      console.log(`   └─ Phase 4 Status: ${phase4Passed ? '🟢 PASS' : '🔴 FAIL'}\n`);
    }

    // --- Phase 5: Knowledge & Skill Evolution ---
    const phase5Start = Date.now();
    console.log('▶ [PHASE 5] Knowledge & Skill Evolution...');
    if (appliedFixesCount > 0) {
      try {
        const evoRes = evolveSkillWithLesson({
          skillName: 'layout-overflow-sentry',
          incidentSlug: 'layout-auto-heal-codemod-verified',
          triggerCondition: 'Автоматическое обнаружение антипаттернов верстки (сжатие SVG, отсутствие min-w-0)',
          solutionPattern: 'Автоисправление через healLayoutFiles() с добавлением семантических Tailwind-классов',
          verifiedDate: new Date().toISOString().split('T')[0]
        });
        if (evoRes.success) learnedLessonsCount++;
      } catch {
        // non-blocking
      }
    }

    phases.push({
      name: 'Phase 5: Skill Evolution',
      passed: true,
      durationMs: Date.now() - phase5Start,
      details: `${learnedLessonsCount} new lessons recorded into .agents/skills/ repository.`
    });
    console.log(`   └─ Phase 5 Status: 🟢 PASS\n`);

    // --- Summary & Scorecard ---
    const allPassed = phases.every(p => p.passed);
    const overallStatus = allPassed ? 'PASS' : 'FAIL';

    const scorecard: SelfImprovingLoopScorecard = {
      timestamp: new Date().toISOString(),
      overallStatus,
      autoHealed: options.autoHeal ?? false,
      phases,
      appliedFixesCount,
      learnedLessonsCount
    };

    this.saveScorecard(scorecard);

    console.log('======================================================================');
    console.log(`🏁 SELF-IMPROVING LOOP FINISHED: ${allPassed ? '🟢 ALL PASS' : '🔴 FAILED'}`);
    console.log(`   Report: ${this.scorecardPath}`);
    console.log('======================================================================\n');

    return scorecard;
  }

  private runCommand(cmd: string, args: string[], timeout: number) {
    const resolvedCmd = process.platform === 'win32' && (cmd === 'npx' || cmd === 'npm') ? `${cmd}.cmd` : cmd;
    return spawnSync(resolvedCmd, args, {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      shell: process.platform === 'win32',
      timeout,
      env: {
        ...process.env,
        PATH: `C:\\Program Files\\nodejs;${process.env.PATH}`
      }
    });
  }

  private saveScorecard(scorecard: SelfImprovingLoopScorecard): void {
    const planningDir = path.dirname(this.scorecardPath);
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }

    const rows = scorecard.phases.map(p => 
      `| **${p.name}** | ${p.passed ? '🟢 PASS' : '🔴 FAIL'} | ${p.durationMs}ms | ${p.details} |`
    ).join('\n');

    const markdown = `# Self-Improving Loop Scorecard (SIL-2026)

**Run Timestamp:** \`${scorecard.timestamp}\`  
**Overall Status:** \`${scorecard.overallStatus}\`  
**Auto-Heal Active:** \`${scorecard.autoHealed ? 'YES' : 'NO'}\`  
**Fixes Applied:** \`${scorecard.appliedFixesCount}\`  
**Skill Lessons Recorded:** \`${scorecard.learnedLessonsCount}\`  

---

## Phases Execution Summary

| Фаза контура | Статус | Время | Детали выполнения |
| :--- | :--- | :--- | :--- |
${rows}

---

## Human Approval Gate
${scorecard.overallStatus === 'PASS' 
  ? '> 🟢 **Все барьеры надежности успешно пройдены.** Кодовая база готова к выкатке на Stage / Prod.' 
  : '> 🔴 **Обнаружены критические ошибки.** Выкатка заблокирована до устранения несоответствий.'}
`;

    fs.writeFileSync(this.scorecardPath, markdown, 'utf-8');
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const autoHeal = args.includes('--fix') || args.includes('--auto-heal');
  const full = args.includes('--full');
  const quick = args.includes('--quick');

  const orchestrator = new SelfImprovingOrchestrator();
  orchestrator.run({ autoHeal, full, quick }).then(res => {
    process.exit(res.overallStatus === 'PASS' ? 0 : 1);
  }).catch(err => {
    console.error('Fatal orchestrator failure:', err);
    process.exit(1);
  });
}
