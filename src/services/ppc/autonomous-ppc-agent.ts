/**
 * src/services/ppc/autonomous-ppc-agent.ts
 *
 * Главный оркестратор OODA-цикла (Observe -> Orient -> Decide -> Act) для Autonomous PPC Growth Agent.
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  ClickFraudAlert,
  DirectCampaign,
  MetrikaPhrasePerformance,
  PpcOodaCycleResult,
  validateBudgetCeiling,
  validatePolicy15Compliant,
} from './types';
import { YandexDirectClient } from './yandex-direct-client';
import { YandexMetrikaClient } from './yandex-metrika-client';
import { classifySearchIntents } from './intent-classifier';
import { ClickFraudSentinel } from './clickfraud-sentinel';
import { CroRetentionWebhook } from './cro-retention-webhook';

export interface AutonomousAgentConfig {
  directClient?: YandexDirectClient;
  metrikaClient?: YandexMetrikaClient;
  clickFraudSentinel?: ClickFraudSentinel;
  croWebhook?: CroRetentionWebhook;
  maxDailyBudgetRub?: number;
  logFilePath?: string;
}

export class AutonomousPpcAgent {
  private readonly directClient: YandexDirectClient;
  private readonly metrikaClient: YandexMetrikaClient;
  private readonly clickFraudSentinel: ClickFraudSentinel;
  private readonly croWebhook: CroRetentionWebhook;
  private readonly maxDailyBudgetRub: number;
  private readonly logFilePath: string;

  constructor(config?: AutonomousAgentConfig) {
    this.directClient = config?.directClient || new YandexDirectClient();
    this.metrikaClient = config?.metrikaClient || new YandexMetrikaClient();
    this.clickFraudSentinel = config?.clickFraudSentinel || new ClickFraudSentinel();
    this.croWebhook = config?.croWebhook || new CroRetentionWebhook();
    this.maxDailyBudgetRub = config?.maxDailyBudgetRub || 4000;
    this.logFilePath =
      config?.logFilePath || path.resolve(process.cwd(), '.planning', 'ACTION_DECISIONS_LOG.md');
  }

  /**
   * Запуск полного суточного цикла OODA
   */
  public async runOodaCycle(options?: { dryRun?: boolean }): Promise<PpcOodaCycleResult> {
    const isDryRun = options?.dryRun ?? false;
    const timestamp = new Date().toISOString();

    // INVARIANT-PPC-1: Проверка потолка бюджета
    validateBudgetCeiling(this.maxDailyBudgetRub, 4000);

    // ==========================================
    // 1. OBSERVE (Наблюдение и сбор телеметрии)
    // ==========================================
    let campaigns: DirectCampaign[] = [];
    let metrikaPhrases: MetrikaPhrasePerformance[] = [];

    try {
      if (this.directClient.isAuthorized()) {
        campaigns = await this.directClient.getCampaigns();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[AutonomousPpcAgent] Direct API observe failed: ${msg}`);
    }

    try {
      if (this.metrikaClient.isAuthorized()) {
        metrikaPhrases = await this.metrikaClient.getSearchPhrasesWithBounceRate(1);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[AutonomousPpcAgent] Metrika API observe failed: ${msg}`);
    }

    // ==========================================
    // 2. ORIENT (Анализ интентов и детекция фрода)
    // ==========================================
    const rawSearchQueries = metrikaPhrases.map((p) => p.phrase).filter(Boolean);
    const intentResult = await classifySearchIntents(rawSearchQueries);
    const fraudResult = this.clickFraudSentinel.analyzePhrasePerformance(metrikaPhrases);

    // ==========================================
    // 3. DECIDE (Принятие решений по оптимизации)
    // ==========================================
    const newMinusWordsSet = new Set<string>();

    // Добавляем минус-слова из семантического классификатора
    for (const word of intentResult.negativeKeywordsToAdd) {
      // INVARIANT-PPC-6: Проверка на соблюдение Policy 15
      try {
        validatePolicy15Compliant(word);
        newMinusWordsSet.add(word);
      } catch {
        // Если слово само является черным термином, безопасно экранируем его в минус-слова
        newMinusWordsSet.add(word);
      }
    }

    // Добавляем поисковые фразы с 100% отказом из ClickFraudSentinel
    for (const suspicious of fraudResult.suspiciousPhrases) {
      newMinusWordsSet.add(suspicious);
    }

    const finalMinusWords = Array.from(newMinusWordsSet);

    // ==========================================
    // 4. ACT (Исполнение решений и протоколирование)
    // ==========================================
    let bidsAdjustedCount = 0;

    if (!isDryRun) {
      // Применяем минус-слова к активным кампаниям
      for (const campaign of campaigns) {
        if (finalMinusWords.length > 0) {
          try {
            await this.directClient.appendMinusKeywords(campaign.Id, finalMinusWords);
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[AutonomousPpcAgent] Failed to append minus keywords to campaign ${campaign.Id}: ${msg}`);
          }
        }
      }
    }

    // Проверяем лиды с нулевым балансом для CRO дожима
    try {
      const zeroBalanceLeads = await this.croWebhook.findZeroBalanceRegistrations(20, 1440);
      for (const lead of zeroBalanceLeads) {
        await this.croWebhook.triggerRetentionPush(lead);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[AutonomousPpcAgent] CRO push step skipped: ${msg}`);
    }

    // Формируем сводный результат
    const result: PpcOodaCycleResult = {
      timestamp,
      dryRun: isDryRun,
      campaignsAnalyzed: campaigns.length,
      phrasesAnalyzed: metrikaPhrases.length,
      commercialPhrasesCount: intentResult.commercialKeywords.length,
      newMinusWordsIdentified: finalMinusWords,
      clickFraudAlerts: fraudResult.fraudAlerts,
      bidsAdjustedCount,
      summary: `OODA Cycle Completed. Analyzed ${campaigns.length} campaigns and ${metrikaPhrases.length} phrases. Detected ${fraudResult.fraudAlerts.length} fraud alerts. Generated ${finalMinusWords.length} negative keywords. Estimated budget saved: ~${fraudResult.estimatedBudgetSavedRub} ₽.`,
    };

    // Запись в аудит-лог
    this.recordAuditLog(result);

    return result;
  }

  /**
   * Запись в аудит-лог решений (INVARIANT-PPC-5)
   */
  private recordAuditLog(cycle: PpcOodaCycleResult): void {
    try {
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const logEntry = `\n### [${cycle.timestamp}] Autonomous PPC Cycle (DryRun: ${cycle.dryRun})
- **Summary**: ${cycle.summary}
- **Commercial Phrases**: ${cycle.commercialPhrasesCount}
- **Negative Keywords Added (${cycle.newMinusWordsIdentified.length})**: ${cycle.newMinusWordsIdentified.slice(0, 10).join(', ')}${cycle.newMinusWordsIdentified.length > 10 ? '...' : ''}
- **Fraud Alerts (${cycle.clickFraudAlerts.length})**: ${cycle.clickFraudAlerts.map((a) => `${a.type} (${a.phrase}): ${a.recommendedAction}`).join('; ') || 'None'}
- **Hash**: \`${crypto.createHash('sha256').update(JSON.stringify(cycle)).digest('hex').slice(0, 16)}\`
---
`;

      fs.appendFileSync(this.logFilePath, logEntry, 'utf8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[AutonomousPpcAgent] Failed to write audit log: ${msg}`);
    }
  }
}
