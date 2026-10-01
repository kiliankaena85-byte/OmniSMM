/**
 * src/services/ppc/types.ts
 *
 * Типы, Zod-схемы и архитектурные инварианты для Autonomous PPC Growth Agent.
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import { z } from 'zod';

// ==========================================
// 1. Zod Contract Schemas
// ==========================================

export const YandexDirectBidUpdateSchema = z.object({
  KeywordId: z.number().int().positive(),
  Bid: z.number().int().positive().max(100000000), // Микро-рубли (1 ₽ = 1 000 000)
});

export const YandexDirectBidsPayloadSchema = z.object({
  method: z.literal('set'),
  params: z.object({
    Bids: z.array(YandexDirectBidUpdateSchema).min(1).max(10000),
  }),
});

export const YandexMetrikaSearchQueryItemSchema = z.object({
  dimensions: z.array(z.object({ name: z.string() })),
  metrics: z.array(z.number()),
});

export const YandexMetrikaResponseSchema = z.object({
  data: z.array(YandexMetrikaSearchQueryItemSchema),
  total_rows: z.number().optional(),
});

export const IntentClassifierResultSchema = z.object({
  commercialKeywords: z.array(z.string()),
  negativeKeywordsToAdd: z.array(z.string()),
  botRiskKeywords: z.array(z.string()),
  reasoning: z.string(),
});

export type YandexDirectBidUpdate = z.infer<typeof YandexDirectBidUpdateSchema>;
export type YandexDirectBidsPayload = z.infer<typeof YandexDirectBidsPayloadSchema>;
export type YandexMetrikaResponse = z.infer<typeof YandexMetrikaResponseSchema>;
export type IntentClassifierResult = z.infer<typeof IntentClassifierResultSchema>;

export interface MetrikaPhrasePerformance {
  phrase: string;
  visits: number;
  bounceRate: number; // 0 to 100%
  pageviews: number;
  avgDurationSeconds: number;
  isHighBounce: boolean;
}

export interface DirectCampaign {
  Id: number;
  Name: string;
  State: string;
  Status: string;
  DailyBudget?: {
    Amount: number; // in micros
    Mode: string;
  };
}

export interface ClickFraudAlert {
  type: 'BOUNCE_SPIKE' | 'BOT_CLUSTER' | 'RAPID_CLICKS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  phrase?: string;
  bounceRate: number;
  visits: number;
  recommendedAction: string;
}

export interface PpcActionLogEntry {
  id: string;
  tenantId: string;
  actionType: 'MINUS_WORDS_ADDED' | 'BID_ADJUSTED' | 'BOT_BLOCKED' | 'RETENTION_PUSH';
  campaignId?: number;
  details: Record<string, unknown>;
  impactEstimate?: string;
  createdAt: string;
}

export interface PpcOodaCycleResult {
  timestamp: string;
  dryRun: boolean;
  campaignsAnalyzed: number;
  phrasesAnalyzed: number;
  commercialPhrasesCount: number;
  newMinusWordsIdentified: string[];
  clickFraudAlerts: ClickFraudAlert[];
  bidsAdjustedCount: number;
  actionLogId?: string;
  summary: string;
}

// ==========================================
// 2. Custom Domain Errors
// ==========================================

export class BudgetLimitExceededError extends Error {
  constructor(requestedRub: number, ceilingRub: number) {
    super(`Daily budget of ${requestedRub} RUB exceeds authorized ceiling of ${ceilingRub} RUB`);
    this.name = 'BudgetLimitExceededError';
  }
}

export class Policy15ViolationError extends Error {
  constructor(keyword: string, matchedTerm: string) {
    super(`Keyword "${keyword}" violates Yandex Direct Policy 15 due to blackhat term: "${matchedTerm}"`);
    this.name = 'Policy15ViolationError';
  }
}

// ==========================================
// 3. Invariant Guards
// ==========================================

/**
 * INVARIANT-PPC-1: Budget Ceiling Guard
 */
export function validateBudgetCeiling(dailyBudgetRub: number, maxCeilingRub = 4000): void {
  if (dailyBudgetRub > maxCeilingRub) {
    throw new BudgetLimitExceededError(dailyBudgetRub, maxCeilingRub);
  }
}

const POLICY_15_PROHIBITED_TERMS = [
  'накрутка',
  'накрутить',
  'боты',
  'ботнет',
  'инвайтинг',
  'спам',
  'рассылка спама',
  'взлом',
  'взломать',
  'купить ботов',
];

/**
 * INVARIANT-PPC-6: Policy 15 Immunity Guard
 */
export function validatePolicy15Compliant(phrase: string): void {
  const normalized = phrase.toLowerCase().trim();
  for (const term of POLICY_15_PROHIBITED_TERMS) {
    if (normalized.includes(term)) {
      throw new Policy15ViolationError(phrase, term);
    }
  }
}

// ==========================================
// 4. Gateway Resilience: Circuit Breaker
// ==========================================

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;

  constructor(options?: CircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.recoveryTimeoutMs = options?.recoveryTimeoutMs ?? 30000;
  }

  public getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      throw new Error(`Circuit breaker is OPEN. Fast-failing to protect Yandex API.`);
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
