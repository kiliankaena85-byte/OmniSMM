/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Design Benchmarking & Improvement Engine.
 *
 * Compares candidate UI against web references and legacy designs,
 * calculating the "Improvement Delta" (density, WCAG, touch targets, anti-slop)
 * to ensure that generated interfaces are genuine enhancements rather than blind copies.
 */

import { LayaDecisionEngine, LayaDecisionPayload } from '../laya-mcp-server';

export interface BenchmarkMetrics {
  informationDensity: number;
  wcagContrastScore: number;
  mobileTouchSafety: number;
  visualHierarchy: number;
  zeroSlopPass: boolean;
}

export interface ImprovementDelta {
  densityDelta: number;
  wcagDelta: number;
  touchSafetyDelta: number;
  hierarchyDelta: number;
  compositeImprovementPercent: number;
  slopEliminated: boolean;
}

export interface BenchmarkComparisonResult {
  candidateMetrics: BenchmarkMetrics;
  referenceMetrics: BenchmarkMetrics;
  delta: ImprovementDelta;
  isGenuineImprovement: boolean;
  verdict: 'SUPERIOR_IMPROVEMENT' | 'INCREMENTAL_UPGRADE' | 'REGRESSION_DETECTED';
  keyAdvantages: string[];
}

export class DesignBenchmarkingEngine {
  public static assessMetrics(markupOrDec: string | LayaDecisionPayload, context = 'admin_density_dashboard'): BenchmarkMetrics {
    const dec = typeof markupOrDec === 'string'
      ? LayaDecisionEngine.decide(markupOrDec, context)
      : markupOrDec;

    return {
      informationDensity: dec.scores.informationDensity,
      wcagContrastScore: dec.scores.wcagContrastScore,
      mobileTouchSafety: dec.scores.mobileTouchSafety,
      visualHierarchy: dec.scores.visualHierarchy,
      zeroSlopPass: dec.gates.zeroSlopPass
    };
  }

  public static compare(
    candidate: string | LayaDecisionPayload,
    reference?: string | Partial<BenchmarkMetrics>,
    context = 'admin_density_dashboard'
  ): BenchmarkComparisonResult {
    const candMetrics = this.assessMetrics(candidate, context);

    let refMetrics: BenchmarkMetrics;
    if (typeof reference === 'string') {
      refMetrics = this.assessMetrics(reference, context);
    } else {
      refMetrics = {
        informationDensity: reference?.informationDensity ?? 0.50,
        wcagContrastScore: reference?.wcagContrastScore ?? 0.60,
        mobileTouchSafety: reference?.mobileTouchSafety ?? 0.60,
        visualHierarchy: reference?.visualHierarchy ?? 0.55,
        zeroSlopPass: reference?.zeroSlopPass ?? false
      };
    }

    const densityDelta = candMetrics.informationDensity - refMetrics.informationDensity;
    const wcagDelta = candMetrics.wcagContrastScore - refMetrics.wcagContrastScore;
    const touchSafetyDelta = candMetrics.mobileTouchSafety - refMetrics.mobileTouchSafety;
    const hierarchyDelta = candMetrics.visualHierarchy - refMetrics.visualHierarchy;
    const slopEliminated = !refMetrics.zeroSlopPass && candMetrics.zeroSlopPass;

    const compositeScore = (
      (densityDelta * 0.3) +
      (wcagDelta * 0.3) +
      (touchSafetyDelta * 0.2) +
      (hierarchyDelta * 0.2)
    ) * 100;

    const isGenuineImprovement = candMetrics.zeroSlopPass &&
      candMetrics.wcagContrastScore >= 0.70 &&
      compositeScore >= 0;

    const verdict: BenchmarkComparisonResult['verdict'] = compositeScore >= 15
      ? 'SUPERIOR_IMPROVEMENT'
      : isGenuineImprovement
        ? 'INCREMENTAL_UPGRADE'
        : 'REGRESSION_DETECTED';

    const keyAdvantages: string[] = [];
    if (densityDelta > 0.05) keyAdvantages.push(`Повышена информационная плотность (+${(densityDelta * 100).toFixed(0)}%)`);
    if (wcagDelta > 0.05) keyAdvantages.push(`Улучшен контраст по WCAG 2.2 (+${(wcagDelta * 100).toFixed(0)}%)`);
    if (touchSafetyDelta > 0.05) keyAdvantages.push(`Оптимизирована эргономика мобильных нажатий min 44px (+${(touchSafetyDelta * 100).toFixed(0)}%)`);
    if (candMetrics.zeroSlopPass) keyAdvantages.push('Полная очистка от кислотно-неоновых клише (Zero-Slop Pass)');

    return {
      candidateMetrics: candMetrics,
      referenceMetrics: refMetrics,
      delta: {
        densityDelta,
        wcagDelta,
        touchSafetyDelta,
        hierarchyDelta,
        compositeImprovementPercent: Math.round(compositeScore),
        slopEliminated
      },
      isGenuineImprovement,
      verdict,
      keyAdvantages
    };
  }

  public static getDomainBenchmarks(domain: string): string[] {
    const benchmarks: Record<string, string[]> = {
      checkout: [
        'Stripe 2-column split with instant payment method pills',
        'Direct 54-FZ tax receipt preview with auto-calculated total',
        'Live discount badge with strike-through base rate'
      ],
      catalog: [
        'Linear-style compact key-value matrix with tabular-nums',
        'Zero-scroll Quick Access Tier 1 for top-6 platforms',
        'WCAG 2.2 contrast badge around third-party brand logos'
      ],
      hud: [
        'High-density KPI cards with micro-trend sparklines',
        'Obsidian slate background (#0B0E14) with subtle cobalt borders',
        'Live pulse indicator showing network latency and throughput'
      ]
    };
    return benchmarks[domain] || benchmarks.catalog;
  }
}
