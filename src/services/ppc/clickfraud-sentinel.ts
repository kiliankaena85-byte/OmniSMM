/**
 * src/services/ppc/clickfraud-sentinel.ts
 *
 * Сторожевой модуль защиты от скликивания (Click-Fraud Defense) для Autonomous PPC Growth Agent.
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import { ClickFraudAlert, MetrikaPhrasePerformance } from './types';

export interface ClickFraudAnalysisResult {
  totalAnalyzed: number;
  fraudAlerts: ClickFraudAlert[];
  suspiciousPhrases: string[];
  estimatedBudgetSavedRub: number;
}

export class ClickFraudSentinel {
  private readonly bounceThreshold: number;
  private readonly minVisitsThreshold: number;
  private readonly maxDurationSeconds: number;

  constructor(options?: {
    bounceThreshold?: number;
    minVisitsThreshold?: number;
    maxDurationSeconds?: number;
  }) {
    this.bounceThreshold = options?.bounceThreshold ?? 75; // >= 75% bounce
    this.minVisitsThreshold = options?.minVisitsThreshold ?? 3; // at least 3 visits
    this.maxDurationSeconds = options?.maxDurationSeconds ?? 4; // < 4 seconds avg duration
  }

  /**
   * Анализ поисковых фраз на предмет скликивания ботнетами и клик-фермами
   */
  public analyzePhrasePerformance(
    phrases: MetrikaPhrasePerformance[],
    avgCpcRub = 35.0
  ): ClickFraudAnalysisResult {
    const fraudAlerts: ClickFraudAlert[] = [];
    const suspiciousPhrases: string[] = [];
    let estimatedWastedClicks = 0;

    for (const item of phrases) {
      if (item.visits < this.minVisitsThreshold) {
        continue;
      }

      // Паттерн 1: Высокий отказ + мгновенный уход (Ботнет / скликиватель)
      if (item.bounceRate >= this.bounceThreshold && item.avgDurationSeconds <= this.maxDurationSeconds) {
        fraudAlerts.push({
          type: 'BOUNCE_SPIKE',
          severity: item.visits >= 10 ? 'HIGH' : 'MEDIUM',
          phrase: item.phrase,
          bounceRate: item.bounceRate,
          visits: item.visits,
          recommendedAction: `Add "${item.phrase}" to negative keywords or exclude audience segment (-100%)`,
        });
        suspiciousPhrases.push(item.phrase);
        estimatedWastedClicks += item.visits;
        continue;
      }

      // Паттерн 2: 100% отказ независимо от времени при числе визитов >= 5
      if (item.bounceRate === 100 && item.visits >= 5) {
        fraudAlerts.push({
          type: 'BOT_CLUSTER',
          severity: 'HIGH',
          phrase: item.phrase,
          bounceRate: 100,
          visits: item.visits,
          recommendedAction: `Immediate negative keyword injection for "${item.phrase}" (100% bounce cluster)`,
        });
        suspiciousPhrases.push(item.phrase);
        estimatedWastedClicks += item.visits;
      }
    }

    const estimatedBudgetSavedRub = Math.round(estimatedWastedClicks * avgCpcRub);

    return {
      totalAnalyzed: phrases.length,
      fraudAlerts,
      suspiciousPhrases,
      estimatedBudgetSavedRub,
    };
  }
}
