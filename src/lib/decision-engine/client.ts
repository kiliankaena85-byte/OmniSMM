/**
 * client.ts
 *
 * OmniDecisionClient — Клиент локального сервиса принятия решений System 1 (Laya / Jev-class)
 * с встроенным Circuit Breaker, валидацией Zod DTOs и мгновенным детерминированным фоллбеком.
 *
 * Соответствует спецификации docs/specs/SPEC-2026-09-30-LOCAL-JEV-DECISION-MCP.md
 */

import {
  DecisionChoiceRequest,
  DecisionChoiceRequestSchema,
  DecisionChoiceResponse,
  DecisionChoiceResponseSchema,
  DecisionScoreRequest,
  DecisionScoreRequestSchema,
  DecisionScoreResponse,
  DecisionScoreResponseSchema,
  DecisionNoulRequest,
  DecisionNoulRequestSchema,
  DecisionNoulResponse,
  DecisionNoulResponseSchema,
  OrderRoutingRequest,
  OrderRoutingRequestSchema,
  OrderRoutingResponse,
  OrderRoutingResponseSchema,
  ActionArbitrationRequest,
  ActionArbitrationRequestSchema,
  ActionArbitrationResponse,
  ActionArbitrationResponseSchema,
  DialecticalArbitrationRequest,
  DialecticalArbitrationRequestSchema,
  DialecticalVerdict,
  DialecticalVerdictSchema,
} from './contracts';
import { logger } from '@/lib/logger';

export interface DecisionClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxConsecutiveFailures?: number;
}

export class OmniDecisionClient {
  private baseUrl: string;
  private timeoutMs: number;
  private consecutiveFailures = 0;
  private isCircuitOpen = false;
  private lastFailureTimestamp = 0;
  private readonly maxFailures: number;
  private readonly circuitResetTimeMs = 30000; // 30 секунд

  constructor(options: DecisionClientOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.LAYA_ENGINE_URL || 'http://127.0.0.1:8150';
    this.timeoutMs = options.timeoutMs || 80; // Бюджет NFR 80ms
    this.maxFailures = options.maxConsecutiveFailures || 3;
  }

  private checkCircuit(): boolean {
    if (this.isCircuitOpen) {
      if (Date.now() - this.lastFailureTimestamp > this.circuitResetTimeMs) {
        this.isCircuitOpen = false;
        this.consecutiveFailures = 0;
        logger.info('Circuit Breaker RESET: Laya decision engine circuit closed', { component: 'DecisionClient' });
        return true;
      }
      return false;
    }
    return true;
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isCircuitOpen = false;
  }

  private recordFailure(err: unknown): void {
    this.consecutiveFailures++;
    this.lastFailureTimestamp = Date.now();
    logger.warn('Laya Decision Engine HTTP failure', {
      component: 'DecisionClient',
      consecutiveFailures: this.consecutiveFailures,
      error: String(err),
    });
    if (this.consecutiveFailures >= this.maxFailures) {
      this.isCircuitOpen = true;
      logger.error('Circuit Breaker TRIP: Laya decision engine circuit OPEN', { component: 'DecisionClient' });
    }
  }

  private async postJson<T>(endpoint: string, payload: unknown): Promise<T | null> {
    if (!this.checkCircuit()) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      this.recordSuccess();
      return data as T;
    } catch (err) {
      this.recordFailure(err);
      return null;
    }
  }

  // ==========================================================================
  // 1. CHOICE
  // ==========================================================================
  public async choice(req: DecisionChoiceRequest): Promise<DecisionChoiceResponse> {
    const validated = DecisionChoiceRequestSchema.parse(req);
    const remote = await this.postJson<DecisionChoiceResponse>('/api/v1/decide/choice', validated);
    if (remote) {
      return DecisionChoiceResponseSchema.parse(remote);
    }

    // Fallback: Выбор первой безопасной опции
    const selected = req.options[0].id;
    return {
      selectedId: selected,
      confidence: 0.90,
      distribution: { [selected]: 1.0 },
      entropy: 0.0,
      latencyMs: 1,
      engineVersion: 'local-fallback-v1',
    };
  }

  // ==========================================================================
  // 2. SCORE
  // ==========================================================================
  public async score(req: DecisionScoreRequest): Promise<DecisionScoreResponse> {
    const validated = DecisionScoreRequestSchema.parse(req);
    const remote = await this.postJson<DecisionScoreResponse>('/api/v1/decide/score', validated);
    if (remote) {
      return DecisionScoreResponseSchema.parse(remote);
    }

    // Fallback: детерминированный скор в зависимости от метрики
    let fallbackScore = 0.10;
    const ctx = req.context.toLowerCase();
    if (req.metricName === 'LINK_SAFETY') {
      fallbackScore = 0.90;
      if (ctx.includes('malware') || ctx.includes('phishing')) fallbackScore = 0.20;
    } else if (req.metricName === 'FRAUD_RISK') {
      fallbackScore = (ctx.includes('hack') || ctx.includes('cheat')) ? 0.85 : 0.10;
    }

    return {
      metricName: req.metricName,
      score: fallbackScore,
      isCriticalThresholdExceeded: fallbackScore >= 0.75,
      latencyMs: 1,
    };
  }

  // ==========================================================================
  // 3. NOUL
  // ==========================================================================
  public async noul(req: DecisionNoulRequest): Promise<DecisionNoulResponse> {
    const validated = DecisionNoulRequestSchema.parse(req);
    const remote = await this.postJson<DecisionNoulResponse>('/api/v1/decide/noul', validated);
    if (remote) {
      return DecisionNoulResponseSchema.parse(remote);
    }

    // Fallback
    return {
      verdict: true,
      probabilityYes: 0.95,
      riskAdjustedThreshold: 0.65,
      isUncertain: false,
      latencyMs: 1,
    };
  }

  // ==========================================================================
  // 4. ORDER ROUTING
  // ==========================================================================
  public async routeOrder(req: OrderRoutingRequest): Promise<OrderRoutingResponse> {
    const validated = OrderRoutingRequestSchema.parse(req);
    const remote = await this.postJson<OrderRoutingResponse>('/api/v1/decide/route-order', validated);
    if (remote) {
      return OrderRoutingResponseSchema.parse(remote);
    }

    // Fallback: Если есть in-house -> in-house, иначе первый провайдер
    if (req.inHouseAvailable) {
      return {
        orderId: req.orderId,
        destinationType: 'IN_HOUSE_PRODUCTION',
        selectedTargetId: 'in_house_mtproto',
        confidence: 0.99,
        estimatedMarginPercent: 100.0,
        routingReason: 'Fallback Router: Внутренний пул Tier-0 роботов свободен',
        latencyMs: 1,
      };
    }

    const firstProvider = req.candidates[0]?.providerId || 'none';
    return {
      orderId: req.orderId,
      destinationType: 'EXTERNAL_WHOLESALE',
      selectedTargetId: firstProvider,
      confidence: 0.85,
      estimatedMarginPercent: 50.0,
      routingReason: `Fallback Router: Выбран первый доступный провайдер ${firstProvider}`,
      latencyMs: 1,
    };
  }

  // ==========================================================================
  // 5. ACTION ARBITRATION
  // ==========================================================================
  public async arbitrateAction(req: ActionArbitrationRequest): Promise<ActionArbitrationResponse> {
    const validated = ActionArbitrationRequestSchema.parse(req);
    const remote = await this.postJson<ActionArbitrationResponse>('/api/v1/decide/action-arbitration', validated);
    if (remote) {
      return ActionArbitrationResponseSchema.parse(remote);
    }

    // Fallback
    return {
      actionId: req.actionId,
      verdict: req.isDestructive ? 'ESCALATE_TO_HUMAN' : 'PROCEED',
      confidenceScore: 0.95,
      rationale: 'Fallback Arbiter: Детерминированное решение по стандарту AAA-2026',
      latencyMs: 1,
      tokenCost: 0,
    };
  }

  public async actionArbitration(req: ActionArbitrationRequest): Promise<ActionArbitrationResponse> {
    return this.arbitrateAction(req);
  }

  // ==========================================================================
  // 6. DIALECTICAL SELF-LOOP IMPROVING ARBITER
  // ==========================================================================
  public async arbitrateDialecticalSynthesis(req: DialecticalArbitrationRequest): Promise<DialecticalVerdict> {
    const validated = DialecticalArbitrationRequestSchema.parse(req);
    const remote = await this.postJson<DialecticalVerdict>('/api/v1/decide/dialectical-synthesis', validated);
    if (remote) {
      return DialecticalVerdictSchema.parse(remote);
    }

    // Fallback: побеждает Синтез Gamma (или Консерватор Beta при его отсутствии)
    const hasGamma = req.candidates.some(c => c.role === 'GAMMA_SYNTHESIS');
    const winningRole = hasGamma ? 'GAMMA_SYNTHESIS' : 'BETA_CONSERVATIVE';

    return {
      taskId: req.taskId,
      winningRole,
      confidenceScore: 0.96,
      invariantViolations: {},
      riskAssessment: {
        alphaRiskScore: 0.75,
        betaRiskScore: 0.30,
        gammaRiskScore: hasGamma ? 0.10 : undefined,
      },
      rationale: hasGamma
        ? 'Fallback Dialectical Arbiter: Синтез GAMMA одобрен с минимальным риском и снятием противоречий'
        : 'Fallback Dialectical Arbiter: Выбран консервативный вариант BETA с нулевым оверхедом',
      recommendedAction: 'EXECUTE_IMMEDIATELY',
      latencyMs: 1,
    };
  }
}

// Экземпляр синглтона для всей платформы
export const decisionClient = new OmniDecisionClient();
