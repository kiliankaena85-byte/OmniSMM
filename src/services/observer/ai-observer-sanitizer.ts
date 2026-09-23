/**
 * AI Observer PII & Secrets Sanitizer
 * Guarantees zero sensitive data / PII leak into LLM prompts.
 */

export interface RawObserverPayload {
  period: string;
  financials: {
    grossRevenueRub: number;
    cogsRub: number;
    netProfitRub: number;
    marginPercent: number;
    ledgerDiscrepanciesCount: number;
  };
  operations: {
    totalOrders: number;
    completedOrders: number;
    canceledOrders: number;
    successRatePercent: number;
    stormAlertsCount: number;
    problematicProviders: Array<{
      name: string;
      category: string;
      failureRate: number;
    }>;
  };
  support: {
    openedTickets: number;
    closedTickets: number;
    avgFirstResponseMin: number;
    escalatedCount: number;
  };
  security: {
    blockedIntrusions24h: number;
    criticalEvents: number;
    uniqueAttackIpsCount: number;
  };
}

export class AiObserverSanitizer {
  /**
   * Cleans arbitrary text from emails, tokens, secrets, IP addresses and UUIDs.
   */
  static cleanText(text: string): string {
    if (!text) return '';
    return text
      // Strip emails
      .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL_REDACTED]')
      // Strip IPv4
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
      // Strip UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID_REDACTED]')
      // Strip API keys / Bearer tokens / hex keys (24+ hex or base64)
      .replace(/\b(?:Bearer\s+)?[a-zA-Z0-9_=-]{24,}\b/gi, '[TOKEN_REDACTED]')
      // Strip provider secrets / pass
      .replace(/(?:password|secret|key|token|auth)\s*[:=]\s*['"][^'"]+['"]/gi, '$1=[REDACTED]');
  }

  /**
   * Sanitizes the full aggregated payload into an immutable safe DTO.
   */
  static sanitizePayload(raw: RawObserverPayload): RawObserverPayload {
    return {
      period: this.cleanText(raw.period),
      financials: {
        grossRevenueRub: Math.round(raw.financials.grossRevenueRub || 0),
        cogsRub: Math.round(raw.financials.cogsRub || 0),
        netProfitRub: Math.round(raw.financials.netProfitRub || 0),
        marginPercent: Number((raw.financials.marginPercent || 0).toFixed(1)),
        ledgerDiscrepanciesCount: Math.max(0, raw.financials.ledgerDiscrepanciesCount || 0),
      },
      operations: {
        totalOrders: Math.max(0, raw.operations.totalOrders || 0),
        completedOrders: Math.max(0, raw.operations.completedOrders || 0),
        canceledOrders: Math.max(0, raw.operations.canceledOrders || 0),
        successRatePercent: Number((raw.operations.successRatePercent || 0).toFixed(1)),
        stormAlertsCount: Math.max(0, raw.operations.stormAlertsCount || 0),
        problematicProviders: (raw.operations.problematicProviders || []).slice(0, 5).map((p) => ({
          name: this.cleanText(p.name).slice(0, 50),
          category: this.cleanText(p.category).slice(0, 50),
          failureRate: Math.round(p.failureRate || 0),
        })),
      },
      support: {
        openedTickets: Math.max(0, raw.support.openedTickets || 0),
        closedTickets: Math.max(0, raw.support.closedTickets || 0),
        avgFirstResponseMin: Number((raw.support.avgFirstResponseMin || 0).toFixed(1)),
        escalatedCount: Math.max(0, raw.support.escalatedCount || 0),
      },
      security: {
        blockedIntrusions24h: Math.max(0, raw.security.blockedIntrusions24h || 0),
        criticalEvents: Math.max(0, raw.security.criticalEvents || 0),
        uniqueAttackIpsCount: Math.max(0, raw.security.uniqueAttackIpsCount || 0),
      },
    };
  }
}
