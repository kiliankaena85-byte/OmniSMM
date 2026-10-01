/**
 * src/services/ppc/yandex-direct-client.ts
 *
 * Строго типизированный клиент API Яндекс.Директ v5 с Circuit Breaker и Rate Limiting.
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import {
  CircuitBreaker,
  DirectCampaign,
  YandexDirectBidsPayloadSchema,
  YandexDirectBidUpdate,
} from './types';

export interface DirectClientConfig {
  token?: string;
  isSandbox?: boolean;
}

export class YandexDirectClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(config?: DirectClientConfig) {
    let resolvedToken = config?.token || process.env.YANDEX_DIRECT_TOKEN;
    if (!resolvedToken) {
      const tokenPath = path.resolve(process.cwd(), '.yandex-oauth-token');
      if (fs.existsSync(tokenPath)) {
        resolvedToken = fs.readFileSync(tokenPath, 'utf8').trim();
      }
    }

    this.token = resolvedToken || '';
    this.baseUrl = config?.isSandbox
      ? 'https://api-sandbox.direct.yandex.com/json/v5/'
      : 'https://api.direct.yandex.com/json/v5/';
    this.circuitBreaker = new CircuitBreaker({ failureThreshold: 3, recoveryTimeoutMs: 30000 });
  }

  public isAuthorized(): boolean {
    return Boolean(this.token && this.token.length > 10);
  }

  private async requestApi<T>(service: string, body: unknown): Promise<T> {
    if (!this.isAuthorized()) {
      throw new Error('[YandexDirectClient] Unauthorized: No OAuth token configured in .yandex-oauth-token');
    }

    return this.circuitBreaker.execute(async () => {
      const url = `${this.baseUrl}${service}`;
      const payloadStr = JSON.stringify(body);

      return new Promise<T>((resolve, reject) => {
        const parsed = new URL(url);
        const req = https.request(
          {
            hostname: parsed.hostname,
            path: parsed.pathname,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.token}`,
              'Accept-Language': 'ru',
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': String(Buffer.byteLength(payloadStr)),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              try {
                const parsedData = JSON.parse(data) as {
                  error?: { error_code: number; error_detail: string; error_string: string };
                  result?: unknown;
                };
                if (parsedData.error) {
                  reject(
                    new Error(
                      `Yandex Direct API Error [${parsedData.error.error_code}]: ${parsedData.error.error_detail || parsedData.error.error_string}`
                    )
                  );
                } else {
                  resolve(parsedData as T);
                }
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : String(e);
                reject(new Error(`Failed to parse Yandex Direct response: ${message}`));
              }
            });
          }
        );

        req.on('error', reject);
        req.write(payloadStr);
        req.end();
      });
    });
  }

  /**
   * Обновление ставок по списку ключевых слов
   */
  public async updateKeywordBids(bids: Array<{ keywordId: number; bidRub: number }>): Promise<boolean> {
    const formattedBids: YandexDirectBidUpdate[] = bids.map((b) => ({
      KeywordId: b.keywordId,
      Bid: Math.round(b.bidRub * 1000000), // перевод в микро-рубли
    }));

    const payload = YandexDirectBidsPayloadSchema.parse({
      method: 'set',
      params: {
        Bids: formattedBids,
      },
    });

    await this.requestApi('bids', payload);
    return true;
  }

  /**
   * Добавление минус-слов к кампании
   */
  public async appendMinusKeywords(campaignId: number, minusWords: string[]): Promise<boolean> {
    if (!minusWords.length) return true;

    const payload = {
      method: 'update',
      params: {
        Campaigns: [
          {
            Id: campaignId,
            NegativeKeywords: {
              Items: minusWords,
            },
          },
        ],
      },
    };

    await this.requestApi<{ result?: { UpdateResults?: Array<{ Id: number }> } }>('campaigns', payload);
    return true;
  }

  /**
   * Получение списка кампаний
   */
  public async getCampaigns(ids?: number[]): Promise<DirectCampaign[]> {
    const selectionCriteria: Record<string, unknown> = {};
    if (ids && ids.length > 0) {
      selectionCriteria.Ids = ids;
    }

    const response = await this.requestApi<{
      result?: {
        Campaigns?: DirectCampaign[];
      };
    }>('campaigns', {
      method: 'get',
      params: {
        SelectionCriteria: selectionCriteria,
        FieldNames: ['Id', 'Name', 'State', 'Status', 'DailyBudget'],
      },
    });

    return response.result?.Campaigns ?? [];
  }
}
