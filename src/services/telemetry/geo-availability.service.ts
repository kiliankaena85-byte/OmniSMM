/**
 * GeoAvailabilityService — Multi-Region & Russia Availability Telemetry Engine
 * Part of OmniSMM 1.0 Infrastructure & Security Suite.
 */

export interface GeoNodeResult {
  nodeId: string;
  countryCode: string;
  countryName: string;
  city: string;
  isRussia: boolean;
  status: 'OK' | 'FAIL' | 'PENDING';
  httpCode?: number;
  responseTimeMs?: number;
  errorMessage?: string;
}

export interface GeoAvailabilityReport {
  targetUrl: string;
  timestamp: string;
  ruRate: number; // 0.0 to 1.0 (e.g. 1.0 = 100%)
  ruTotal: number;
  ruPassed: number;
  globalRate: number;
  globalTotal: number;
  globalPassed: number;
  avgResponseTimeMs: number;
  verdict: 'ALL_GREEN' | 'RU_BLOCKED' | 'PARTIAL_OUTAGE' | 'GLOBAL_OUTAGE';
  verdictText: string;
  permanentLink: string;
  nodes: GeoNodeResult[];
}

export class GeoAvailabilityService {
  private static DEFAULT_TARGET = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://test.smmplan.pro';

  /**
   * Performs an asynchronous geo-distributed HTTP probe across Russian and international probe nodes.
   */
  public static async checkAvailability(
    targetUrl: string = GeoAvailabilityService.DEFAULT_TARGET,
    maxNodes: number = 15,
    waitMs: number = 6000
  ): Promise<GeoAvailabilityReport> {
    const initUrl = `https://check-host.net/check-http?host=${encodeURIComponent(targetUrl)}&max_nodes=${maxNodes}`;

    try {
      const initRes = await fetch(initUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (!initRes.ok) {
        throw new Error(`Check-Host API returned HTTP ${initRes.status}: ${initRes.statusText}`);
      }

      const initData = await initRes.json();
      const requestId = initData.request_id;
      const rawNodes: Record<string, [string, string, string, string]> = initData.nodes || {};
      const permanentLink = initData.permanent_link || `https://check-host.net/check-report/${requestId}`;

      // Wait for distributed probes to complete
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const resultUrl = `https://check-host.net/check-result/${requestId}`;
      const resultRes = await fetch(resultUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      const rawResults: Record<string, any> = resultRes.ok ? await resultRes.json() : {};

      return this.parseResults(targetUrl, rawNodes, rawResults, permanentLink);
    } catch (err: any) {
      // Graceful fallback on network/timeout error
      return this.buildFallbackReport(targetUrl, err.message);
    }
  }

  /**
   * Pure parser function to transform raw API responses into typed domain model
   */
  public static parseResults(
    targetUrl: string,
    rawNodes: Record<string, [string, string, string, string]>,
    rawResults: Record<string, any>,
    permanentLink: string
  ): GeoAvailabilityReport {
    const nodeResults: GeoNodeResult[] = [];
    let ruPassed = 0;
    let ruTotal = 0;
    let globalPassed = 0;
    let globalTotal = 0;
    let totalResponseTimeMs = 0;
    let responseTimeCount = 0;

    for (const [nodeId, nodeInfo] of Object.entries(rawNodes)) {
      const countryCode = (nodeInfo[0] || '').toUpperCase();
      const countryName = nodeInfo[1] || 'Unknown';
      const city = nodeInfo[2] || 'Unknown';
      const isRussia = countryCode === 'RU';

      const probeOutput = rawResults[nodeId];

      if (!probeOutput || !Array.isArray(probeOutput) || probeOutput.length === 0 || !probeOutput[0]) {
        nodeResults.push({
          nodeId,
          countryCode,
          countryName,
          city,
          isRussia,
          status: 'PENDING',
        });
        continue;
      }

      const item = probeOutput[0];
      // Format: [is_ok (1/0), time_seconds, message, http_code, ip]
      const isOk = item[0] === 1;
      const responseTimeMs = typeof item[1] === 'number' ? Math.round(item[1] * 1000) : 0;
      const errorMessage = item[2] || '';
      const httpCode = typeof item[3] === 'number' ? item[3] : parseInt(String(item[3]), 10) || undefined;

      if (isRussia) ruTotal++;
      else globalTotal++;

      if (isOk) {
        if (isRussia) ruPassed++;
        else globalPassed++;

        if (responseTimeMs > 0) {
          totalResponseTimeMs += responseTimeMs;
          responseTimeCount++;
        }

        nodeResults.push({
          nodeId,
          countryCode,
          countryName,
          city,
          isRussia,
          status: 'OK',
          httpCode: httpCode || 200,
          responseTimeMs,
        });
      } else {
        nodeResults.push({
          nodeId,
          countryCode,
          countryName,
          city,
          isRussia,
          status: 'FAIL',
          httpCode,
          responseTimeMs,
          errorMessage,
        });
      }
    }

    const ruRate = ruTotal > 0 ? ruPassed / ruTotal : 1.0;
    const globalRate = globalTotal > 0 ? globalPassed / globalTotal : 1.0;
    const avgResponseTimeMs = responseTimeCount > 0 ? Math.round(totalResponseTimeMs / responseTimeCount) : 0;

    let verdict: GeoAvailabilityReport['verdict'] = 'ALL_GREEN';
    let verdictText = '🟢 Полная доступность в РФ и мире (100% Green)';

    if (ruTotal > 0 && ruPassed === 0) {
      verdict = 'RU_BLOCKED';
      verdictText = '🔴 Блокировка в РФ (Сайт недоступен у российских операторов)';
    } else if (ruTotal > 0 && ruRate < 0.7) {
      verdict = 'PARTIAL_OUTAGE';
      verdictText = '⚠️ Частичная недоступность в РФ (Проблемы у некоторых провайдеров)';
    } else if (globalRate < 0.5) {
      verdict = 'GLOBAL_OUTAGE';
      verdictText = '🔴 Глобальный сбой инфраструктуры';
    }

    return {
      targetUrl,
      timestamp: new Date().toISOString(),
      ruRate,
      ruTotal,
      ruPassed,
      globalRate,
      globalTotal,
      globalPassed,
      avgResponseTimeMs,
      verdict,
      verdictText,
      permanentLink,
      nodes: nodeResults,
    };
  }

  /**
   * Fallback report when external probe API is completely unreachable
   */
  private static buildFallbackReport(targetUrl: string, errorReason: string): GeoAvailabilityReport {
    return {
      targetUrl,
      timestamp: new Date().toISOString(),
      ruRate: 1.0,
      ruTotal: 0,
      ruPassed: 0,
      globalRate: 1.0,
      globalTotal: 0,
      globalPassed: 0,
      avgResponseTimeMs: 0,
      verdict: 'ALL_GREEN',
      verdictText: `⚠️ Внешний зонд недоступен (${errorReason}). Локальный статус: Active.`,
      permanentLink: '',
      nodes: [],
    };
  }
}
