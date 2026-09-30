/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Unit Tests: Modular Design Pipeline (Stitch + Laya + OmniDesign + Benchmarking).
 * Validates RAC-2026 / SDD-TDD 2026 invariants for multi-tool modular architecture.
 */

import { describe, it, expect } from 'vitest';
import { PromptCompiler } from '@/../scripts/mcp/orchestrator/prompt-compiler';
import { DesignBenchmarkingEngine } from '@/../scripts/mcp/orchestrator/design-benchmarking';
import { probeServerHealth } from '@/../scripts/mcp/orchestrator/server-probes';
import { runMcpPipelineHealthCheck } from '@/../scripts/mcp/mcp-pipeline-orchestrator';
import { GeminiStitchLayaOrchestrator } from '@/../scripts/mcp/gemini-stitch-laya-orchestrator';

describe('Modular Design Pipeline — Multi-Tool Orchestrator (RAC-2026)', () => {
  // =========================================================================
  // 1. Cognitive Prompt Compiler with Web Benchmarks & Anti-Slop
  // =========================================================================
  describe('1. Cognitive Prompt Compiler', () => {
    it('1.1 should compile strict anti-slop rules and brand styling for SMMflux', () => {
      const prompt = PromptCompiler.compileStitchPrompt({
        intent: 'Live Telemetry Dashboard',
        brand: 'smmflux',
        viewport: 'desktop',
        targetDna: 'obsidian_monolith'
      });

      expect(prompt).toContain('Brand: SMMflux');
      expect(prompt).toContain('Dark Obsidian theme');
      expect(prompt).toContain('CRITICAL ZERO-SLOP CONSTRAINTS:');
      expect(prompt).toContain('NO purple neon');
      expect(prompt).toContain('Target Design DNA: OBSIDIAN_MONOLITH');
    });

    it('1.2 should inject web benchmark notes when provided to elevate standards', () => {
      const prompt = PromptCompiler.compileStitchPrompt({
        intent: 'Mobile Order Wizard',
        brand: 'smmplan',
        viewport: 'mobile',
        webBenchmarkNotes: ['Stripe 2-column split with instant payment pills', 'Linear key-value dense summary']
      });

      expect(prompt).toContain('LIVE WEB BENCHMARK & IMPROVEMENT TARGETS');
      expect(prompt).toContain('Stripe 2-column split');
      expect(prompt).toContain('Single-column touch-first stepper');
      expect(prompt).toContain('Minimum 44px touch targets');
    });
  });

  // =========================================================================
  // 2. Design Benchmarking Engine (Genuine Improvement Verification)
  // =========================================================================
  describe('2. Design Benchmarking Engine', () => {
    it('2.1 should confirm SUPERIOR_IMPROVEMENT when candidate outperforms legacy reference', () => {
      const superiorLayout = `
        <div class="bg-background text-foreground p-4">
          <table class="w-full tabular-nums text-xs">
            <thead><tr><th>Услуга</th><th>Цена</th></tr></thead>
            <tbody><tr><td>Подписчики</td><td>0.18 ₽ / шт</td></tr></tbody>
          </table>
          <button class="w-full min-h-[44px] bg-primary text-primary-foreground text-xs">Заказать</button>
        </div>
      `;

      const legacySlopReference = `
        <div class="bg-black text-purple-500 shadow-[0_0_20px_#8b5cf6]">
          <h1>✨ Awesome Bento ✨</h1>
          <button class="h-6">Click</button>
        </div>
      `;

      const comp = DesignBenchmarkingEngine.compare(superiorLayout, legacySlopReference);
      expect(comp.isGenuineImprovement).toBe(true);
      expect(comp.verdict).toBe('SUPERIOR_IMPROVEMENT');
      expect(comp.delta.compositeImprovementPercent).toBeGreaterThanOrEqual(15);
      expect(comp.keyAdvantages.length).toBeGreaterThanOrEqual(2);
    });

    it('2.2 should flag REGRESSION_DETECTED if candidate contains slop or degrades contrast', () => {
      const slopCandidate = '<div class="bg-black text-purple-500">Slop</div>';
      const cleanReference = {
        informationDensity: 0.85,
        wcagContrastScore: 0.90,
        mobileTouchSafety: 0.90,
        visualHierarchy: 0.85,
        zeroSlopPass: true
      };

      const comp = DesignBenchmarkingEngine.compare(slopCandidate, cleanReference);
      expect(comp.isGenuineImprovement).toBe(false);
      expect(comp.verdict).toBe('REGRESSION_DETECTED');
    });

    it('2.3 should return domain-specific benchmarks for checkout, catalog, and hud', () => {
      const checkoutNotes = DesignBenchmarkingEngine.getDomainBenchmarks('checkout');
      expect(checkoutNotes.some(n => n.includes('Stripe'))).toBe(true);

      const catalogNotes = DesignBenchmarkingEngine.getDomainBenchmarks('catalog');
      expect(catalogNotes.some(n => n.includes('Linear-style'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. Multi-Server MCP Probes & Pipeline Orchestration
  // =========================================================================
  describe('3. MCP Pipeline Health & Server Probes', () => {
    it('3.1 should probe omnidesign-hub and report 5 tools with healthy status', async () => {
      const result = await probeServerHealth('omnidesign-hub', {
        type: 'stdio',
        enabled: true,
        tier: 'LEVEL_2_VISUAL',
        description: 'OmniDesign Hub'
      });

      expect(result.status).toBe('HEALTHY');
      expect(result.toolsCount).toBe(5);
      expect(result.tier).toBe('LEVEL_2_VISUAL');
    });

    it('3.2 should probe all in-house servers (stitch, laya, omnidesign, layout-sentry)', async () => {
      const summary = await runMcpPipelineHealthCheck();
      const healthyServerNames = summary.results.filter(r => r.status === 'HEALTHY').map(r => r.name);

      expect(healthyServerNames).toContain('omnidesign-hub');
      expect(healthyServerNames).toContain('stitch-designer');
      expect(healthyServerNames).toContain('laya-decisions');
      expect(healthyServerNames).toContain('layout-sentry');
    });
  });

  // =========================================================================
  // 4. Closed-Loop Triad Execution with Benchmarking & OmniDesign
  // =========================================================================
  describe('4. Triad Execution with Benchmarking & OmniDesign', () => {
    it('4.1 should run full orchestration loop and return benchmark delta and token audit', async () => {
      const result = await GeminiStitchLayaOrchestrator.execute({
        userIntent: 'Mobile Quick Checkout',
        targetBrand: 'smmflux',
        viewport: 'mobile',
        webBenchmarkNotes: ['Stripe 1-click pill', '54-FZ tax breakdown']
      });

      expect(result.success).toBe(true);
      expect(result.synthesizedReactCode).toBeDefined();
      expect(result.benchmarkResult).toBeDefined();
      expect(result.benchmarkResult?.isGenuineImprovement).toBe(true);
      expect(result.tokenValidationResult).toBeDefined();
      expect(result.tokenValidationResult?.valid).toBe(true);
    });
  });
});
