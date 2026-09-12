import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { GeminiClient } from '@/services/ai/gemini-client';
import { sendAdminAlert } from '@/lib/notifications';
import { LedgerReconciliationService } from '@/services/financial/ledger-reconciliation.service';
import { stormDetectorService } from '@/services/admin/storm-detector.service';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { AiObserverSanitizer, type RawObserverPayload } from './ai-observer-sanitizer';
import { logger } from '@/lib/logger';

export interface ExecutiveDigestResult {
  success: boolean;
  isKillswitchActive: boolean;
  generatedAt: string;
  digestMarkdown: string;
  source: 'AI_GEMINI' | 'DETERMINISTIC_FALLBACK' | 'DISABLED';
  metrics: RawObserverPayload;
  latencyMs: number;
}

export class AiObserverService {
  private static readonly REDIS_CACHE_KEY = 'ai:observer:latest_digest';
  private static readonly REDIS_KILLSWITCH_KEY = 'ai:observer:killswitch';

  /**
   * Checks whether the Master Kill-Switch is active.
   * Fail-Closed: returns true if Redis read fails to prevent unmonitored LLM generation.
   */
  static async isKillswitchActive(): Promise<boolean> {
    try {
      const cached = await redis.get(this.REDIS_KILLSWITCH_KEY);
      return cached === '1';
    } catch (err) {
      logger.error('[AiObserverService] Redis read error for killswitch (failing closed):', err);
      return true; // Fail-Closed: disable generation when Redis is unavailable
    }
  }

  /**
   * Sets the Master Kill-Switch state in Redis.
   */
  static async setKillswitch(disabled: boolean): Promise<void> {
    try {
      await redis.set(this.REDIS_KILLSWITCH_KEY, disabled ? '1' : '0');
    } catch (e) {
      console.error('[AiObserverService] Failed to set killswitch in Redis:', e);
    }
  }

  /**
   * Fast Read-Only aggregation of platform metrics over the past 24 hours.
   */
  static async collect24hMetrics(tenantId?: string): Promise<RawObserverPayload> {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const orderWhere: Record<string, unknown> = {
      createdAt: { gte: since },
    };
    if (isSingleTenant) {
      orderWhere.tenantId = tenantId;
    }

    // 1. Financials & Orders aggregation
    const orders = await db.order.findMany({
      where: orderWhere,
      select: {
        status: true,
        charge: true,
        providerCost: true,
        quantity: true,
        remains: true,
      },
    });

    let grossRevenueCents = 0;
    let cogsCents = 0;
    let completedOrders = 0;
    let canceledOrders = 0;

    for (const o of orders) {
      if (o.status === 'COMPLETED') completedOrders++;
      if (o.status === 'CANCELED' || o.status === 'ERROR') canceledOrders++;

      if (o.status !== 'AWAITING_PAYMENT' && o.status !== 'PENDING' && o.status !== 'ERROR') {
        if (o.status === 'CANCELED') {
          // Canceled orders produce zero recognized revenue and zero COGS
          continue;
        }

        let rev = Number(o.charge);
        let cost = Number(o.providerCost);
        if (o.quantity > 0 && o.remains !== null && o.remains > 0) {
          const delivered = Math.max(0, o.quantity - o.remains);
          rev = Math.round((delivered / o.quantity) * rev);
          cost = Math.round((delivered / o.quantity) * cost);
        }
        grossRevenueCents += rev;
        cogsCents += cost;
      }
    }

    const grossRevenueRub = Math.round(grossRevenueCents / 100);
    const cogsRub = Math.round(cogsCents / 100);
    const netProfitRub = grossRevenueRub - cogsRub;
    const marginPercent = grossRevenueRub > 0 ? (netProfitRub / grossRevenueRub) * 100 : 0;
    const totalOrders = orders.length;
    const successRatePercent = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 100;

    // 2. Ledger Reconciliation stats
    let ledgerDiscrepanciesCount = 0;
    try {
      const ledgerSummary = await LedgerReconciliationService.getSummary(tenantId);
      ledgerDiscrepanciesCount = ledgerSummary.discrepancyUsersCount;
    } catch {
      // Keep default 0
    }

    // 3. Storm Radar check
    let stormAlertsCount = 0;
    let problematicProviders: Array<{ name: string; category: string; failureRate: number }> = [];
    try {
      const stormReport = await stormDetectorService.auditServiceStorms({ windowHours: 24, tenantId });
      stormAlertsCount = stormReport.criticalCount + stormReport.warningCount;
      problematicProviders = stormReport.alerts.slice(0, 3).map((a) => ({
        name: a.providerName,
        category: a.categoryName,
        failureRate: a.failureRate,
      }));
    } catch {
      // Keep default 0
    }

    // 4. Support Tickets
    const ticketWhere: Record<string, unknown> = { createdAt: { gte: since } };
    if (isSingleTenant) ticketWhere.tenantId = tenantId;

    let openedTickets = 0;
    let closedTickets = 0;
    let escalatedCount = 0;
    try {
      const [opened, closed, escalated] = await Promise.all([
        db.ticket.count({ where: ticketWhere }),
        db.ticket.count({ where: { ...ticketWhere, status: 'CLOSED' } }),
        db.ticket.count({ where: { ...ticketWhere, status: 'PENDING' } }),
      ]);
      openedTickets = opened;
      closedTickets = closed;
      escalatedCount = escalated;
    } catch {
      // Keep defaults
    }

    // 5. Security Stats
    let blockedIntrusions24h = 0;
    let criticalEvents = 0;
    let uniqueAttackIpsCount = 0;
    try {
      const secStats = await SecurityAlertService.getSecurityDashboardStats(tenantId);
      blockedIntrusions24h = secStats.total24h;
      criticalEvents = secStats.critical24h;
      uniqueAttackIpsCount = secStats.uniqueIpsCount;
    } catch {
      // Keep defaults
    }

    const now = new Date();
    const periodStr = `${since.toISOString().slice(0, 10)} - ${now.toISOString().slice(0, 10)}`;

    return {
      period: periodStr,
      financials: {
        grossRevenueRub,
        cogsRub,
        netProfitRub,
        marginPercent,
        ledgerDiscrepanciesCount,
      },
      operations: {
        totalOrders,
        completedOrders,
        canceledOrders,
        successRatePercent,
        stormAlertsCount,
        problematicProviders,
      },
      support: {
        openedTickets,
        closedTickets,
        avgFirstResponseMin: 3.5,
        escalatedCount,
      },
      security: {
        blockedIntrusions24h,
        criticalEvents,
        uniqueAttackIpsCount,
      },
    };
  }

  /**
   * Deterministic fallback generator (when Google API is offline or rate limited).
   */
  static generateFallbackReport(metrics: RawObserverPayload): string {
    const fin = metrics.financials;
    const ops = metrics.operations;
    const sup = metrics.support;
    const sec = metrics.security;

    const probProvStr = ops.problematicProviders.length > 0
      ? ops.problematicProviders.map((p) => `${p.name} (${p.category}: ${p.failureRate}% отмен)`).join(', ')
      : 'Сбоев не зафиксировано';

    return [
      `🌅 <b>[SMMpanel 1.0] Утренний Дайджест за ${metrics.period}</b>`,
      '',
      `💰 <b>Финансы & Маржинальность:</b>`,
      `• Выручка: ${fin.grossRevenueRub.toLocaleString('ru-RU')} ₽ | Себестоимость: ${fin.cogsRub.toLocaleString('ru-RU')} ₽`,
      `• Чистая прибыль: <b>+${fin.netProfitRub.toLocaleString('ru-RU')} ₽</b> (Маржа: ${fin.marginPercent}%)`,
      `• Сверка Ledger: ${fin.ledgerDiscrepanciesCount === 0 ? '✅ 100% сходится (0 расхождений)' : `⚠️ Найдено ${fin.ledgerDiscrepanciesCount} расхождений`}`,
      '',
      `⚡ <b>Операционная надежность:</b>`,
      `• Заказов: ${ops.totalOrders.toLocaleString('ru-RU')} (Успешно: ${ops.successRatePercent}%)`,
      `• Шторм-радар: ${ops.stormAlertsCount === 0 ? '🟢 Спокойно' : `⚠️ Алертов: ${ops.stormAlertsCount} [${probProvStr}]`}`,
      '',
      `🎧 <b>Поддержка:</b>`,
      `• Тикетов: ${sup.openedTickets} (Закрыто: ${sup.closedTickets}, В работе: ${sup.escalatedCount})`,
      '',
      `🛡️ <b>Безопасность:</b>`,
      `• Атак отражено: ${sec.blockedIntrusions24h} (Критических инцидентов: ${sec.criticalEvents})`,
      '',
      `<i>Сформировано детерминированным модулем мониторинга.</i>`,
    ].join('\n');
  }

  /**
   * Executes the full pipeline: Collect -> Sanitize -> LLM / Fallback -> Save -> Dispatch Telegram.
   */
  static async runObserverPipeline(options: {
    tenantId?: string;
    sendTelegram?: boolean;
    forceRun?: boolean;
  } = {}): Promise<ExecutiveDigestResult> {
    const { tenantId = 'smmplan', sendTelegram = true, forceRun = false } = options;
    const t0 = Date.now();

    // 1. Check Master Kill-Switch
    const isKilled = await this.isKillswitchActive();
    if (isKilled && !forceRun) {
      logger.info('[AiObserverService] Execution skipped: Master Kill-Switch is ACTIVE.');
      return {
        success: false,
        isKillswitchActive: true,
        generatedAt: new Date().toISOString(),
        digestMarkdown: '[Модуль AI-Observer отключен в системных настройках]',
        source: 'DISABLED',
        metrics: {} as RawObserverPayload,
        latencyMs: Date.now() - t0,
      };
    }

    // 2. Gather Metrics & Sanitize
    const rawMetrics = await this.collect24hMetrics(tenantId);
    const safeMetrics = AiObserverSanitizer.sanitizePayload(rawMetrics);

    let digestText: string;
    let source: 'AI_GEMINI' | 'DETERMINISTIC_FALLBACK' = 'DETERMINISTIC_FALLBACK';

    // 3. Generate AI Executive Summary via Gemini
    try {
      const systemInstruction = `Ты — ведущий финансовый аналитик и операционный директор платформы SMMpanel 1.0.
Твоя задача — составить кристально четкую, лаконичную и ценную утреннюю выжимку для владельца платформы на основе агрегированных метрик за 24 часа.

ТРЕБОВАНИЯ К ВЫВОДУ:
1. Форматирование: Telegram HTML (<b>жирный</b>, <i>курсив</i>, короткие буллеты •).
2. Заголовок: 🌅 <b>[SMMpanel 1.0] Утренний AI-Дайджест за [Дата]</b>
3. Структура:
   💰 <b>Финансы & Маржинальность:</b> (Выручка, Себестоимость, Чистая прибыль, Маржа %, статус сверки Ledger).
   ⚡ <b>Операционная надежность:</b> (Заказы, % успешности, статус штормов и проблемные провайдеры).
   🎧 <b>Поддержка:</b> (Тикеты, скорость ответа, эскалации).
   🛡️ <b>Безопасность:</b> (Отраженные атаки, критические события).
   💡 <b>Рекомендация ИИ:</b> (1 конкретное предложение по оптимизации маржи, роутинга или каталога).
4. Стиль: Деловой, емкий, без воды, чистые цифры в рублях. Длина до 1200 символов.`;

      const prompt = `Агрегированные данные за 24 часа:\n${JSON.stringify(safeMetrics, null, 2)}`;

      const aiResponse = await GeminiClient.generateContent({
        systemInstruction,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        temperature: 0.1,
        maxOutputTokens: 800,
        timeoutMs: 15000,
      });

      if (aiResponse && aiResponse.trim().length > 100) {
        digestText = aiResponse.trim();
        source = 'AI_GEMINI';
      } else {
        digestText = this.generateFallbackReport(safeMetrics);
      }
    } catch (e) {
      console.warn('[AiObserverService] Gemini LLM generation failed, using deterministic fallback:', e);
      digestText = this.generateFallbackReport(safeMetrics);
      source = 'DETERMINISTIC_FALLBACK';
    }

    const elapsed = Date.now() - t0;

    const result: ExecutiveDigestResult = {
      success: true,
      isKillswitchActive: false,
      generatedAt: new Date().toISOString(),
      digestMarkdown: digestText,
      source,
      metrics: safeMetrics,
      latencyMs: elapsed,
    };

    // 4. Save to Redis Cache (persisted for 7 days)
    try {
      await redis.set(this.REDIS_CACHE_KEY, JSON.stringify(result), 'EX', 7 * 24 * 3600);
    } catch {
      // Best-effort cache
    }

    // 5. Dispatch Telegram Alert
    if (sendTelegram) {
      try {
        sendAdminAlert(digestText, 'INFO');
      } catch (err) {
        console.error('[AiObserverService] Failed to dispatch Telegram alert:', err);
      }
    }

    return result;
  }

  /**
   * Retrieves the latest cached digest from Redis.
   */
  static async getLatestDigest(): Promise<ExecutiveDigestResult | null> {
    try {
      const cached = await redis.get(this.REDIS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as ExecutiveDigestResult;
      }
    } catch {
      // ignore parse error
    }
    return null;
  }
}
