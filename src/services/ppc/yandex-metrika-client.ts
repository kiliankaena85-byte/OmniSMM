/**
 * src/services/ppc/yandex-metrika-client.ts
 *
 * Строго типизированный клиент API Яндекс.Метрики (Stat v1 Data).
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import {
  CircuitBreaker,
  MetrikaPhrasePerformance,
  YandexMetrikaResponseSchema,
} from './types';

export interface MetrikaClientConfig {
  token?: string;
  counterId?: string;
}

export class YandexMetrikaClient {
  private readonly token: string;
  private readonly counterId: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(config?: MetrikaClientConfig) {
    let resolvedToken = config?.token || process.env.YANDEX_METRIKA_TOKEN || process.env.YANDEX_DIRECT_TOKEN;
    if (!resolvedToken) {
      const tokenPath = path.resolve(process.cwd(), '.yandex-oauth-token');
      if (fs.existsSync(tokenPath)) {
        resolvedToken = fs.readFileSync(tokenPath, 'utf8').trim();
      }
    }

    this.token = resolvedToken || '';
    this.counterId =
      config?.counterId ||
      process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ||
      process.env.YANDEX_METRIKA_ID ||
      '113263331';
    this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 30000 });
  }

  public isAuthorized(): boolean {
    return Boolean(this.token && this.token.length > 10);
  }

  public getCounterId(): string {
    return this.counterId;
  }

  private async requestMetrikaApi<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    if (!this.isAuthorized()) {
      throw new Error('[YandexMetrikaClient] Unauthorized: No OAuth token configured in .yandex-oauth-token');
    }

    return this.circuitBreaker.execute(async () => {
      const queryParams = new URLSearchParams({
        ids: this.counterId,
        ...params,
      });

      const url = `https://api-metrika.yandex.net/stat/v1/data?${queryParams.toString()}`;

      return new Promise<T>((resolve, reject) => {
        const parsed = new URL(url);
        const req = https.request(
          {
            hostname: parsed.hostname,
            path: `${parsed.pathname}?${parsed.searchParams.toString()}`,
            method: 'GET',
            headers: {
              'Authorization': `OAuth ${this.token}`,
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(15000),
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              try {
                const parsedData = JSON.parse(data) as {
                  errors?: Array<{ error_type: string; message: string }>;
                  message?: string;
                } & T;

                if (parsedData.errors && parsedData.errors.length > 0) {
                  reject(
                    new Error(
                      `Yandex Metrika API Error: ${parsedData.errors.map((e) => e.message).join('; ')}`
                    )
                  );
                } else if (res.statusCode && res.statusCode >= 400) {
                  reject(
                    new Error(
                      `Yandex Metrika API HTTP ${res.statusCode}: ${parsedData.message || data}`
                    )
                  );
                } else {
                  resolve(parsedData as T);
                }
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                reject(new Error(`Failed to parse Yandex Metrika response: ${message}`));
              }
            });
          }
        );

        req.on('error', reject);
        req.end();
      });
    });
  }

  /**
   * Выгрузка поисковых фраз с показателями отказов и длительности визита
   */
  public async getSearchPhrasesWithBounceRate(days = 1): Promise<MetrikaPhrasePerformance[]> {
    const rawResponse = await this.requestMetrikaApi<unknown>('stat/v1/data', {
      metrics: 'ym:s:visits,ym:s:bounceRate,ym:s:pageviews,ym:s:avgVisitDurationSeconds',
      dimensions: 'ym:s:searchPhrase',
      date1: `${days}daysAgo`,
      date2: 'today',
      limit: '100',
      sort: '-ym:s:visits',
    });

    const parsed = YandexMetrikaResponseSchema.parse(rawResponse);

    return parsed.data.map((item) => {
      const phrase = item.dimensions[0]?.name ?? '';
      const visits = item.metrics[0] ?? 0;
      const bounceRate = item.metrics[1] ?? 0;
      const pageviews = item.metrics[2] ?? 0;
      const avgDurationSeconds = item.metrics[3] ?? 0;

      return {
        phrase,
        visits,
        bounceRate,
        pageviews,
        avgDurationSeconds,
        isHighBounce: bounceRate >= 70 && visits >= 3,
      };
    });
  }

  /**
   * Определение роботов с высокой вероятностью скликивания
   */
  public async getHighProbabilityRobots(days = 1): Promise<string[]> {
    const rawResponse = await this.requestMetrikaApi<unknown>('stat/v1/data', {
      metrics: 'ym:s:visits,ym:s:bounceRate,ym:s:avgVisitDurationSeconds',
      dimensions: 'ym:s:robotCode,ym:s:searchPhrase',
      date1: `${days}daysAgo`,
      date2: 'today',
      limit: '50',
    });

    const parsed = YandexMetrikaResponseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      return [];
    }

    const botPhrases: string[] = [];
    for (const item of parsed.data.data) {
      const phrase = item.dimensions[1]?.name || item.dimensions[0]?.name;
      const bounceRate = item.metrics[1] ?? 0;
      const duration = item.metrics[2] ?? 0;

      // Если 100% отказов и менее 2 секунд нахождения
      if (bounceRate >= 95 && duration < 2 && phrase) {
        botPhrases.push(phrase);
      }
    }

    return botPhrases;
  }
}
