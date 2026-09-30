/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Unit Tests: Gemini-Stitch-Laya Tri-Partite UI Orchestration (RAC-2026 / SDD-TDD 2026).
 *
 * Validates:
 * 1. Laya Decision Engine (System 1) fast decision gating, Zero-Slop detection, and calibrated scoring.
 * 2. Google Stitch Generative UI MCP server and inner-loop Laya consultation.
 * 3. Gemini Orchestrator closed-loop convergence and React 19 component synthesis.
 * 4. MCP Manifest registry and health probes.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  LayaDecisionEngine,
  handleLayaMcpRequest,
  LAYA_MCP_TOOLS,
  LayaDecisionPayload
} from '@/../scripts/mcp/laya-mcp-server';
import {
  StitchGenerativeEngine,
  handleStitchMcpRequest,
  STITCH_MCP_TOOLS,
  StitchLayoutSpecification
} from '@/../scripts/mcp/stitch-mcp-server';
import {
  GeminiStitchLayaOrchestrator,
  OrchestrationGoal,
  OrchestrationResult
} from '@/../scripts/mcp/gemini-stitch-laya-orchestrator';
import {
  loadMcpConfig,
  probeServerHealth
} from '@/../scripts/mcp/mcp-pipeline-orchestrator';

describe('Gemini-Stitch-Laya Tri-Partite UI Orchestration (RAC-2026)', () => {
  // =========================================================================
  // 1. Laya MCP Server & System 1 Decision Engine
  // =========================================================================
  describe('1. Laya Decision Engine (System 1 Non-Autoregressive)', () => {
    it('1.1 should register all required Laya MCP tools', () => {
      const toolNames = LAYA_MCP_TOOLS.map(t => t.name);
      expect(toolNames).toContain('laya_decide');
      expect(toolNames).toContain('laya_classify');
      expect(toolNames).toContain('laya_score');
      expect(toolNames).toContain('laya_check');
    });

    it('1.2 should respond to MCP ping and initialize protocols', async () => {
      const ping = await handleLayaMcpRequest({ id: 1, method: 'ping' });
      expect((ping.result as { status: string }).status).toBe('pong');

      const init = await handleLayaMcpRequest({ id: 2, method: 'initialize' });
      expect((init.result as { serverInfo: { name: string } }).serverInfo.name).toBe('laya-decisions');
    });

    it('1.3 should execute laya_decide in under 40ms and approve clean high-density layout', async () => {
      const cleanLayout = `
        <div class="bg-background text-foreground p-4">
          <table class="w-full tabular-nums text-xs">
            <thead><tr><th>Услуга</th><th>Цена</th></tr></thead>
            <tbody><tr><td>Подписчики</td><td>0.18 ₽ / шт</td></tr></tbody>
          </table>
          <button class="w-full min-h-[44px] bg-primary text-primary-foreground text-xs">Заказать</button>
        </div>
      `;

      const start = Date.now();
      const res = await handleLayaMcpRequest({
        id: 3,
        method: 'tools/call',
        params: {
          name: 'laya_decide',
          arguments: { candidateLayout: cleanLayout, context: 'admin_density_dashboard' }
        }
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
      const data = (res.result as { data: LayaDecisionPayload }).data;
      expect(data.decision).toBe('APPROVED');
      expect(data.gates.zeroSlopPass).toBe(true);
      expect(data.gates.readyForSynthesis).toBe(true);
      expect(data.scores.informationDensity).toBeGreaterThanOrEqual(0.65);
    });

    it('1.4 should detect AI-Slop cliches and reject purple neon and emoji bento', () => {
      // Cliche 1: Purple neon on black
      const purpleSlop = '<div class="bg-black text-purple-500 shadow-[0_0_20px_#8b5cf6]">Neon Glow</div>';
      const slopCheck1 = LayaDecisionEngine.detectSlop(purpleSlop);
      expect(slopCheck1.slopDetected).toBe(true);
      expect(slopCheck1.slopType).toBe('purple_neon');

      const decision1 = LayaDecisionEngine.decide(purpleSlop);
      expect(decision1.decision).toBe('REJECTED');
      expect(decision1.gates.zeroSlopPass).toBe(false);
      expect(decision1.gates.readyForSynthesis).toBe(false);

      // Cliche 2: Bento grid with emojis
      const bentoSlop = '<div class="grid bento-grid"><div>🚀 Fast ⚡ Instant 🔥 Hot</div></div>';
      const slopCheck2 = LayaDecisionEngine.detectSlop(bentoSlop);
      expect(slopCheck2.slopDetected).toBe(true);
      expect(slopCheck2.slopType).toBe('bento_emoji_overuse');

      // Cliche 3: Pulsing pill badge fatigue
      const pillSlop = '<div class="rounded-full animate-pulse h-2 w-2 bg-emerald">Status</div>';
      const slopCheck3 = LayaDecisionEngine.detectSlop(pillSlop);
      expect(slopCheck3.slopDetected).toBe(true);
      expect(slopCheck3.slopType).toBe('pill_badge_fatigue');
    });

    it('1.5 should accurately classify design DNA', () => {
      const financialLayout = '<div class="tabular-nums font-mono ticker">Rate: 0.18 RUB</div>';
      const resFin = LayaDecisionEngine.classifyDna(financialLayout);
      expect(resFin.designDna).toBe('financial_terminal');

      const obsidianLayout = '<div class="bg-[#0b0f19] border-[#1f2937]">Obsidian</div>';
      const resObs = LayaDecisionEngine.classifyDna(obsidianLayout);
      expect(resObs.designDna).toBe('obsidian_monolith');
    });

    it('1.6 should enforce laya_check ternary gating', async () => {
      const safeLayout = '<div class="min-h-[44px] w-full text-foreground bg-background">Safe</div>';
      const res = await handleLayaMcpRequest({
        id: 4,
        method: 'tools/call',
        params: {
          name: 'laya_check',
          arguments: { candidateLayout: safeLayout, gateName: 'mobile_safe' }
        }
      });
      const data = (res.result as { data: { status: string; passed: boolean } }).data;
      expect(data.status).toBe('YES');
      expect(data.passed).toBe(true);
    });

    it('1.7 should preserve low-contrast violation and not override with text-foreground', () => {
      // Contains low-contrast violation AND text-foreground in another section
      const mixedContrastLayout = `
        <div class="bg-background text-foreground">
          <header class="text-foreground">Title</header>
          <div class="bg-white text-gray-400">Unreadable grey text</div>
        </div>
      `;
      const scores = LayaDecisionEngine.scoreMetrics(mixedContrastLayout);
      expect(scores.wcagContrastScore).toBeLessThan(0.70);
      expect(scores.wcagContrastScore).toBe(0.40);

      const decision = LayaDecisionEngine.decide(mixedContrastLayout);
      expect(decision.gates.wcagAaPass).toBe(false);
      expect(decision.refinements.some(r => r.includes('WCAG AA Violation'))).toBe(true);
    });

    it('1.8 should detect violet-500 on dark background and emoji clutter without bento keyword', () => {
      const violetSlop = '<div class="bg-zinc-950 text-violet-500">Dark violet glow</div>';
      const check1 = LayaDecisionEngine.detectSlop(violetSlop);
      expect(check1.slopDetected).toBe(true);
      expect(check1.slopType).toBe('purple_neon');

      const emojiCluster = '<div><span>🚀 Fast</span><span>⚡ Instant</span><span>🔥 Hot</span></div>';
      const check2 = LayaDecisionEngine.detectSlop(emojiCluster);
      expect(check2.slopDetected).toBe(true);
      expect(check2.slopType).toBe('bento_emoji_overuse');
    });

    it('1.9 should penalize undersized touch controls (h-5, h-8) for mobile touch safety', () => {
      const smallBtn = '<div class="p-4"><button class="h-5 bg-primary text-white">Tiny</button></div>';
      const scores = LayaDecisionEngine.scoreMetrics(smallBtn);
      expect(scores.mobileTouchSafety).toBeLessThan(0.65);

      const decision = LayaDecisionEngine.decide(smallBtn);
      expect(decision.gates.mobileSafePass).toBe(false);
      expect(decision.refinements.some(r => r.includes('Mobile Ergonomics'))).toBe(true);

      const safeBtn = '<div class="p-4"><button class="min-h-[44px] bg-primary text-white">Full</button></div>';
      const safeScores = LayaDecisionEngine.scoreMetrics(safeBtn);
      expect(safeScores.mobileTouchSafety).toBeGreaterThanOrEqual(0.80);
    });

    it('1.10 should not penalize skeleton loaders as pill badge slop', () => {
      const skeletonLayout = '<div class="p-4"><div class="w-12 h-12 rounded-full animate-pulse bg-muted skeleton"></div></div>';
      const slopCheck = LayaDecisionEngine.detectSlop(skeletonLayout);
      expect(slopCheck.slopDetected).toBe(false);
    });

    it('1.11 should detect purple/fuchsia neon on extended dark backgrounds (bg-gray-950, bg-[#090d16])', () => {
      const fuchsiaDark = '<div class="bg-gray-950 text-fuchsia-500">Fuchsia Glow</div>';
      const check1 = LayaDecisionEngine.detectSlop(fuchsiaDark);
      expect(check1.slopDetected).toBe(true);
      expect(check1.slopType).toBe('purple_neon');

      const obsidianPurple = '<div class="bg-[#090d16] text-[#8b5cf6]">Obsidian Purple</div>';
      const check2 = LayaDecisionEngine.detectSlop(obsidianPurple);
      expect(check2.slopDetected).toBe(true);
      expect(check2.slopType).toBe('purple_neon');
    });

    it('1.12 should pass context to laya_check and enforce context-sensitive density threshold', async () => {
      // Moderate density (~0.50): passes general/mobile threshold (0.45), but fails admin threshold (0.65)
      const moderateLayout = '<div class="bg-background text-foreground p-4"><span>Order</span></div>';

      const resAdmin = await handleLayaMcpRequest({
        id: 112,
        method: 'tools/call',
        params: {
          name: 'laya_check',
          arguments: { candidateLayout: moderateLayout, gateName: 'ready_for_synthesis', context: 'admin_density_dashboard' }
        }
      });
      const dataAdmin = (resAdmin.result as { data: { passed: boolean } }).data;
      expect(dataAdmin.passed).toBe(false);

      const resMobile = await handleLayaMcpRequest({
        id: 113,
        method: 'tools/call',
        params: {
          name: 'laya_check',
          arguments: { candidateLayout: moderateLayout, gateName: 'ready_for_synthesis', context: 'mobile_catalog' }
        }
      });
      const dataMobile = (resMobile.result as { data: { passed: boolean } }).data;
      expect(dataMobile.passed).toBe(true);
    });
  });

  // =========================================================================
  // 2. Google Stitch MCP Server & Inner-Loop Delegation
  // =========================================================================
  describe('2. Google Stitch MCP Server (Generative UI)', () => {
    it('2.1 should register all required Stitch MCP tools', () => {
      const toolNames = STITCH_MCP_TOOLS.map(t => t.name);
      expect(toolNames).toContain('stitch_generate_screen');
      expect(toolNames).toContain('stitch_create_variant');
      expect(toolNames).toContain('stitch_consult_laya');
      expect(toolNames).toContain('stitch_synthesize_react');
    });

    it('2.2 should generate layout screen and delegate candidate evaluation to Laya', async () => {
      const spec = await StitchGenerativeEngine.generateScreen(
        'SMM Console',
        'Order placement wizard with table',
        'smmplan',
        true
      );

      expect(spec.screenTitle).toBe('SMM Console');
      expect(spec.targetBrand).toBe('smmplan');
      expect(spec.elements.length).toBeGreaterThanOrEqual(3);
      expect(spec.consultedCandidatesCount).toBeGreaterThanOrEqual(3);
      expect(spec.layaInnerAudit).toBeDefined();
      expect(spec.layaInnerAudit?.decision).toBe('APPROVED');
    });

    it('2.3 should create responsive mobile variant with safe area insets and 44px touch targets', () => {
      const mobileSpec = StitchGenerativeEngine.createVariant('SMM Checkout', 'mobile', 'smmplan');
      expect(mobileSpec.viewport).toBe('mobile');
      expect(mobileSpec.rawMarkupPreview).toContain('min-h-[44px]');
      expect(mobileSpec.elements[0].title).toContain('Mobile Header');
    });

    it('2.4 should allow Stitch to directly consult Laya via stitch_consult_laya tool', async () => {
      const snippet = '<div class="tabular-nums p-2 text-xs">Financial Grid</div>';
      const res = await handleStitchMcpRequest({
        id: 5,
        method: 'tools/call',
        params: {
          name: 'stitch_consult_laya',
          arguments: { candidateSnippet: snippet, context: 'grid_test' }
        }
      });

      const data = (res.result as { data: LayaDecisionPayload }).data;
      expect(data.decision).toBe('APPROVED');
      expect(data.scores.informationDensity).toBeGreaterThanOrEqual(0.60);
    });

    it('2.5 should synthesize typed React 19 component with Server Actions compliance', () => {
      const code = StitchGenerativeEngine.synthesizeReactComponent('SmmOrderWizard', 'smmplan');
      expect(code).toContain("'use client';");
      expect(code).toContain('export function SmmOrderWizard');
      expect(code).toContain('initialBalanceKopecks?: bigint;');
      expect(code).toContain('min-h-[44px]');
    });

    it('2.6 should safely transliterate Cyrillic and numeric titles to valid React component identifiers', () => {
      expect(StitchGenerativeEngine.toValidComponentName('Быстрый заказ')).toBe('BystryyZakaz');
      expect(StitchGenerativeEngine.toValidComponentName('2026 SMM Dashboard')).toBe('Smm2026SmmDashboard');
      expect(StitchGenerativeEngine.toValidComponentName('###')).toBe('SmmGeneratedScreen');
      expect(StitchGenerativeEngine.toValidComponentName('')).toBe('SmmGeneratedScreen');

      const russianComponentCode = StitchGenerativeEngine.synthesizeReactComponent('Быстрый заказ', 'smmplan');
      expect(russianComponentCode).toContain('export function BystryyZakaz(');
      expect(russianComponentCode).not.toContain('export function (');

      const numericComponentCode = StitchGenerativeEngine.synthesizeReactComponent('2026 SMM Dashboard', 'smmflux');
      expect(numericComponentCode).toContain('export function Smm2026SmmDashboard(');
    });

    it('2.7 should prune inferior candidates and return multi-candidate evaluation scorecard', async () => {
      const spec = await StitchGenerativeEngine.generateScreen('Catalog Screen', 'Standard order form', 'smmplan', true);
      expect(spec.candidateEvaluations).toBeDefined();
      expect(spec.candidateEvaluations!.length).toBeGreaterThanOrEqual(4);

      const selected = spec.candidateEvaluations!.filter(c => c.selected);
      expect(selected.length).toBe(1);

      const pruned = spec.candidateEvaluations!.filter(c => !c.selected);
      expect(pruned.length).toBeGreaterThanOrEqual(3);
      expect(pruned.every(p => p.rejectionReason && p.rejectionReason.length > 0)).toBe(true);
    });

    it('2.8 should transliterate Ukrainian characters and preserve clean PascalCase', () => {
      expect(StitchGenerativeEngine.toValidComponentName('Вхід у кабінет')).toBe('VkhidUKabinet');
      expect(StitchGenerativeEngine.toValidComponentName('Швидке замовлення')).toBe('ShvidkeZamovlennya');
    });

    it('2.9 should actively reject candidate-ai-slop in candidate pool and select approved candidate', async () => {
      const spec = await StitchGenerativeEngine.generateScreen('SMM Store', 'High speed orders', 'smmplan', true);
      const slopCandidate = spec.candidateEvaluations?.find(c => c.candidateId === 'candidate-ai-slop');

      expect(slopCandidate).toBeDefined();
      expect(slopCandidate?.decision).toBe('REJECTED');
      expect(slopCandidate?.selected).toBe(false);
      expect(slopCandidate?.rejectionReason).toContain('AI-Slop Detected');
    });

    it('2.10 should favor and select Financial Terminal candidate when targetDna is financial_terminal', async () => {
      const spec = await StitchGenerativeEngine.generateScreen(
        'Trading Screen',
        'Financial rates ticker',
        'smmflux',
        true,
        'desktop',
        'financial_terminal'
      );

      expect(spec.designDna).toBe('financial_terminal');
      const selected = spec.candidateEvaluations?.find(c => c.selected);
      expect(selected?.candidateId).toBe('candidate-financial-terminal');
    });

    it('2.11 should synthesize dedicated mobile component with Safe Area header and BigInt ExactMath kopecks pricing', () => {
      const mobileCode = StitchGenerativeEngine.synthesizeReactComponent('MobileOrder', 'smmplan', 'mobile');
      expect(mobileCode).toContain('Viewport: MOBILE');
      expect(mobileCode).toContain('pt-[env(safe-area-inset-top)]');
      expect(mobileCode).toContain('pb-[env(safe-area-inset-bottom)]');
      expect(mobileCode).toContain('unitRateKopecks = 18n;');
      expect(mobileCode).toContain('BigInt(quantity) * unitRateKopecks');
      expect(mobileCode).toContain('Drip-Feed Floor');
    });

    it('2.12 should synthesize dedicated Financial Terminal component when designDna is financial_terminal', () => {
      const termCode = StitchGenerativeEngine.synthesizeReactComponent('RateTerminal', 'smmflux', 'desktop', 'financial_terminal');
      expect(termCode).toContain('DNA: FINANCIAL_TERMINAL');
      expect(termCode).toContain('TERMINAL::SMMFLUX');
      expect(termCode).toContain('font-mono');
      expect(termCode).toContain('EXECUTION CONSOLE [BIGINT EXACTMATH]');
    });
  });

  // =========================================================================
  // 3. Gemini Orchestrator (Tri-Partite System 1 + System 2 Loop)
  // =========================================================================
  describe('3. Gemini Orchestrator (Closed-Loop Convergence)', () => {
    it('3.1 should compile strict Zero-Slop prompt with brand tokens', () => {
      const prompt = GeminiStitchLayaOrchestrator.compileStitchPrompt(
        'Design high-density admin panel',
        'smmplan',
        ['Low Information Density detected previously']
      );

      expect(prompt).toContain('Brand: SMMplan');
      expect(prompt).toContain('CRITICAL ZERO-SLOP CONSTRAINTS:');
      expect(prompt).toContain('NO purple neon');
      expect(prompt).toContain('PREVIOUS ITERATION DEFECTS TO HEAL:');
    });

    it('3.2 should execute full orchestration loop with telemetry and token savings', async () => {
      const goal: OrchestrationGoal = {
        userIntent: 'SMM High-Density Dashboard and Checkout Console',
        targetBrand: 'smmplan',
        maxIterations: 3
      };

      const result: OrchestrationResult = await GeminiStitchLayaOrchestrator.execute(goal);

      expect(result.success).toBe(true);
      expect(result.totalIterations).toBeGreaterThanOrEqual(1);
      expect(result.totalIterations).toBeLessThanOrEqual(3);
      expect(result.totalLayaLatencyMs).toBeGreaterThan(0);
      expect(result.estimatedTokensSaved).toBeGreaterThanOrEqual(650);
      expect(result.finalScores.density).toBeGreaterThanOrEqual(0.65);
      expect(result.finalScores.wcag).toBeGreaterThanOrEqual(0.70);
      expect(result.synthesizedReactCode).toContain("'use client';");
      expect(result.synthesizedReactCode).toContain('export function');
    });

    it('3.3 should handle smmflux brand styling and obsidian tokens', async () => {
      const goal: OrchestrationGoal = {
        userIntent: 'SMMflux Radiant Aurora Checkout',
        targetBrand: 'smmflux',
        maxIterations: 2
      };

      const result = await GeminiStitchLayaOrchestrator.execute(goal);
      expect(result.success).toBe(true);
      expect(result.targetBrand).toBe('smmflux');
      expect(result.synthesizedReactCode).toContain('bg-[#090d16]');
    });

    it('3.4 should support mobile viewport and return candidate scorecards', async () => {
      const goal: OrchestrationGoal = {
        userIntent: 'Mobile Express Order',
        targetBrand: 'smmplan',
        viewport: 'mobile',
        maxIterations: 2
      };

      const result = await GeminiStitchLayaOrchestrator.execute(goal);
      expect(result.success).toBe(true);
      expect(result.viewport).toBe('mobile');
      expect(result.candidateScorecards.length).toBeGreaterThanOrEqual(1);
      expect(result.synthesizedReactCode).toContain('min-h-[44px]');
      expect(result.synthesizedReactCode).toContain('Viewport: MOBILE');
    });

    it('3.5 should steer design with targetDna financial_terminal and compile specific prompt guidelines', async () => {
      const prompt = GeminiStitchLayaOrchestrator.compileStitchPrompt(
        'Crypto & SMM Exchange Rates',
        'smmflux',
        [],
        'desktop',
        'financial_terminal'
      );
      expect(prompt).toContain('Target Design DNA: FINANCIAL_TERMINAL');

      const goal: OrchestrationGoal = {
        userIntent: 'Live Rates Stream',
        targetBrand: 'smmflux',
        targetDna: 'financial_terminal',
        maxIterations: 2
      };

      const result = await GeminiStitchLayaOrchestrator.execute(goal);
      expect(result.success).toBe(true);
      expect(result.finalDna).toBe('financial_terminal');
      expect(result.synthesizedReactCode).toContain('DNA: FINANCIAL_TERMINAL');
      expect(result.synthesizedReactCode).toContain('TERMINAL::SMMFLUX');
    });
  });

  // =========================================================================
  // 4. MCP Manifest & Pipeline Governance (RAC-2026)
  // =========================================================================
  describe('4. MCP Manifest & Pipeline Governance', () => {
    const configPath = path.resolve(process.cwd(), '.mcp/mcp-servers.json');
    const specPath = path.resolve(process.cwd(), 'docs/specs/SPEC-2026-09-29-GEMINI-STITCH-LAYA-ORCHESTRATION.md');
    const skillPath = path.resolve(process.cwd(), '.agents/skills/design-boost/SKILL.md');
    const indexSkillsPath = path.resolve(process.cwd(), '.agents/skills/INDEX.md');

    it('4.1 should have architectural spec file present', () => {
      expect(fs.existsSync(specPath)).toBe(true);
      const specContent = fs.readFileSync(specPath, 'utf8');
      expect(specContent).toContain('SPEC-2026-09-29: Gemini-Stitch-Laya Tri-Partite UI Orchestration Pipeline');
      expect(specContent).toContain('laya_decide');
      expect(specContent).toContain('stitch_generate_screen');
    });

    it('4.2 should register laya-decisions and stitch-designer in .mcp/mcp-servers.json', () => {
      const config = loadMcpConfig();
      expect(config.servers).toHaveProperty('laya-decisions');
      expect(config.servers).toHaveProperty('stitch-designer');

      const layaConf = config.servers['laya-decisions'];
      expect(layaConf.tier).toBe('LEVEL_1_TYPES');
      expect(layaConf.enabled).toBe(true);

      const stitchConf = config.servers['stitch-designer'];
      expect(stitchConf.tier).toBe('LEVEL_2_VISUAL');
      expect(stitchConf.enabled).toBe(true);
    });

    it('4.3 should successfully probe in-house health of laya-decisions and stitch-designer', async () => {
      const config = loadMcpConfig();

      const layaHealth = await probeServerHealth('laya-decisions', config.servers['laya-decisions']);
      expect(layaHealth.status).toBe('HEALTHY');
      expect(layaHealth.toolsCount).toBe(4);

      const stitchHealth = await probeServerHealth('stitch-designer', config.servers['stitch-designer']);
      expect(stitchHealth.status).toBe('HEALTHY');
      expect(stitchHealth.toolsCount).toBe(4);
    });

    it('4.4 should have design:boost script registered in package.json', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
      expect(pkg.scripts['design:boost']).toBe('tsx scripts/mcp/run-design-boost.ts');
    });

    it('4.5 should have design-boost Antigravity skill registered in INDEX.md', () => {
      expect(fs.existsSync(skillPath)).toBe(true);
      const skillContent = fs.readFileSync(skillPath, 'utf8');
      expect(skillContent).toContain('name: design-boost');
      expect(skillContent).toContain('/boost');

      const indexContent = fs.readFileSync(indexSkillsPath, 'utf8');
      expect(indexContent).toContain('design-boost');
      expect(indexContent).toContain('/boost');
    });
  });
});
