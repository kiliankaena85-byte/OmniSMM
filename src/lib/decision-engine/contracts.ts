/**
 * contracts.ts
 * Единый источник правды (Single Source of Truth) для Zod DTOs и TypeScript контрактов
 * локального сервиса принятия решений System 1 (Jev/Laya Decision Engine & MCP Gateway).
 * 
 * Соответствует спецификации SPEC-2026-09-30-LOCAL-JEV-DECISION-MCP.md
 */

import { z } from 'zod';

// ==========================================
// 1. ПРИМИТИВ: CHOICE (Выбор из N вариантов)
// ==========================================
export const ChoiceOptionSchema = z.object({
  id: z.string().min(1, 'ID опции не может быть пустым'),
  label: z.string().min(1, 'Метка опции обязательна'),
  metadata: z.record(z.unknown()).optional(),
});
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

export const DecisionChoiceRequestSchema = z.object({
  context: z.string().min(1, 'Контекст обязателен для принятия решения'),
  instruction: z.string().min(1, 'Инструкция обязательна'),
  options: z.array(ChoiceOptionSchema).min(2, 'Необходимо как минимум 2 варианта выбора').max(32, 'Максимум 32 варианта'),
  temperature: z.number().min(0.0).max(1.0).default(0.0),
});
export type DecisionChoiceRequest = z.input<typeof DecisionChoiceRequestSchema>;

export const DecisionChoiceResponseSchema = z.object({
  selectedId: z.string(),
  confidence: z.number().min(0.0).max(1.0),
  distribution: z.record(z.number()),
  entropy: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  engineVersion: z.string(),
});
export type DecisionChoiceResponse = z.infer<typeof DecisionChoiceResponseSchema>;

// ==========================================
// 2. ПРИМИТИВ: SCORE (Непрерывный скоринг)
// ==========================================
export const DecisionMetricNameSchema = z.enum([
  'FRAUD_RISK',
  'LINK_SAFETY',
  'TICKET_URGENCY',
  'CODE_SLOP_RISK',
  'PROVIDER_RELIABILITY'
]);
export type DecisionMetricName = z.infer<typeof DecisionMetricNameSchema>;

export const DecisionScoreRequestSchema = z.object({
  context: z.string().min(1, 'Контекст обязателен'),
  metricName: DecisionMetricNameSchema,
  evidence: z.array(z.string()).optional(),
});
export type DecisionScoreRequest = z.infer<typeof DecisionScoreRequestSchema>;

export const DecisionScoreResponseSchema = z.object({
  metricName: DecisionMetricNameSchema,
  score: z.number().min(0.0).max(1.0),
  isCriticalThresholdExceeded: z.boolean(),
  latencyMs: z.number().nonnegative(),
});
export type DecisionScoreResponse = z.infer<typeof DecisionScoreResponseSchema>;

// ==========================================
// 3. ПРИМИТИВ: NOUL (Бинарный Да/Нет шлюз)
// ==========================================
export const DecisionNoulRequestSchema = z.object({
  proposition: z.string().min(1, 'Утверждение обязательно'),
  context: z.string().min(1, 'Контекст обязателен'),
  riskWeight: z.number().min(0.1).max(2.0).default(1.0),
});
export type DecisionNoulRequest = z.input<typeof DecisionNoulRequestSchema>;

export const DecisionNoulResponseSchema = z.object({
  verdict: z.boolean(),
  probabilityYes: z.number().min(0.0).max(1.0),
  riskAdjustedThreshold: z.number().min(0.0).max(1.0),
  isUncertain: z.boolean(),
  latencyMs: z.number().nonnegative(),
});
export type DecisionNoulResponse = z.infer<typeof DecisionNoulResponseSchema>;

// ==========================================
// 4. ДОМЕННЫЙ РОУТЕР ЗАКАЗОВ (Order Routing)
// ==========================================
export const ProviderCandidateSchema = z.object({
  providerId: z.string().min(1),
  costRub: z.number().nonnegative().optional(),
  historicalSuccessRate: z.number().min(0).max(100).optional(),
  avgFulfillmentSpeedMinutes: z.number().nonnegative().optional(),
  activeErrorsLastHour: z.number().int().nonnegative().optional(),
  providerName: z.string().optional(),
  unitCostRub: z.number().nonnegative().optional(),
  reliabilityScore: z.number().min(0).max(1).optional(),
  estimatedDeliveryHours: z.number().nonnegative().optional(),
  isSovereign: z.boolean().optional(),
});
export type ProviderCandidate = z.infer<typeof ProviderCandidateSchema>;

export const OrderRoutingRequestSchema = z.object({
  orderId: z.string().min(1),
  serviceCategory: z.string().min(1),
  targetUrl: z.string().url('Ссылка должна быть валидным URL'),
  quantity: z.number().int().positive('Количество должно быть положительным целым числом'),
  inHouseAvailable: z.boolean(),
  inHouseUnitCostRub: z.number().nonnegative(),
  candidates: z.array(ProviderCandidateSchema),
});
export type OrderRoutingRequest = z.infer<typeof OrderRoutingRequestSchema>;

export const OrderRoutingResponseSchema = z.object({
  orderId: z.string(),
  destinationType: z.enum(['IN_HOUSE_PRODUCTION', 'IN_HOUSE_MTPROTO', 'EXTERNAL_WHOLESALE', 'MANUAL_REVIEW']),
  selectedTargetId: z.string(),
  confidence: z.number().min(0.0).max(1.0),
  estimatedMarginPercent: z.number(),
  routingReason: z.string(),
  latencyMs: z.number().nonnegative(),
});
export type OrderRoutingResponse = z.infer<typeof OrderRoutingResponseSchema>;

// ==========================================
// 5. АВТОНОМНЫЙ АРБИТРАЖ ДЕЙСТВИЙ (AAA-2026)
// ==========================================
export const ActionArbitrationRequestSchema = z.object({
  actionId: z.string().min(1),
  intent: z.string().min(1),
  category: z.enum([
    'REFACTOR',
    'BUGFIX',
    'OPTIMIZATION',
    'SCHEMA_MIGRATION',
    'DEPENDENCY',
    'DEPLOY',
    'INFRASTRUCTURE'
  ]),
  isDestructive: z.boolean(),
  hasRollbackPlan: z.boolean(),
  estimatedImpactFiles: z.number().int().nonnegative(),
  touchesFinancialLedger: z.boolean().default(false),
  touchesAuthOrSecrets: z.boolean().default(false),
  environment: z.enum(['LOCAL', 'STAGE', 'PRODUCTION']).default('LOCAL'),
});
export type ActionArbitrationRequest = z.input<typeof ActionArbitrationRequestSchema>;

export const ActionArbitrationResponseSchema = z.object({
  actionId: z.string(),
  verdict: z.enum(['PROCEED', 'REDIRECT_SAFE', 'ESCALATE_TO_HUMAN', 'REJECT']),
  confidenceScore: z.number().min(0.0).max(1.0),
  rationale: z.string(),
  latencyMs: z.number().nonnegative(),
  tokenCost: z.literal(0),
});
export type ActionArbitrationResponse = z.infer<typeof ActionArbitrationResponseSchema>;

// ============================================================================
// 6. ДИАЛЕКТИЧЕСКИЙ SELF-LOOP IMPROVING КОНВЕЙЕР (Anti-Mediocrity Arbiter)
// ============================================================================
export const DialecticalCandidateRoleSchema = z.enum([
  'ALPHA_RADICAL',     // Тезис: смелое инновационное решение, ориентированное на скорость и максимум возможностей
  'BETA_CONSERVATIVE', // Антитезис: строго противоположная полярность, zero-overhead, fail-closed, минимизация рисков
  'GAMMA_SYNTHESIS'    // Синтез: латеральное ТРИЗ/TOC решение, снимающее противоречие без компромисса надежности
]);
export type DialecticalCandidateRole = z.infer<typeof DialecticalCandidateRoleSchema>;

export const DialecticalCandidateSchema = z.object({
  role: DialecticalCandidateRoleSchema,
  title: z.string().min(3, 'Название варианта обязательно'),
  philosophy: z.string().min(5, 'Философия/полярность решения обязательна'),
  implementationSummary: z.string().min(10, 'Описание реализации обязательно'),
  pros: z.array(z.string()).min(1, 'Необходимо указать хотя бы один плюс'),
  cons: z.array(z.string()).min(1, 'Необходимо указать критику и уязвимости'),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  estimatedBlastRadius: z.number().int().min(1).max(10),
});
export type DialecticalCandidate = z.infer<typeof DialecticalCandidateSchema>;

export const DialecticalArbitrationRequestSchema = z.object({
  taskId: z.string().min(1),
  taskContext: z.string().min(10, 'Контекст задачи обязателен'),
  businessObjective: z.string().min(5, 'Бизнес-цель обязательна'),
  hardInvariants: z.array(z.string()).min(1, 'Инварианты обязательны для арбитража'),
  candidates: z.array(DialecticalCandidateSchema).min(2, 'Требуется минимум 2 полярных варианта').max(4),
});
export type DialecticalArbitrationRequest = z.infer<typeof DialecticalArbitrationRequestSchema>;

export const DialecticalVerdictSchema = z.object({
  taskId: z.string(),
  winningRole: DialecticalCandidateRoleSchema,
  confidenceScore: z.number().min(0.0).max(1.0),
  invariantViolations: z.record(z.string(), z.array(z.string())),
  riskAssessment: z.object({
    alphaRiskScore: z.number().min(0).max(1),
    betaRiskScore: z.number().min(0).max(1),
    gammaRiskScore: z.number().min(0).max(1).optional(),
  }),
  rationale: z.string().min(10),
  recommendedAction: z.enum(['EXECUTE_IMMEDIATELY', 'REFINE_LOOP', 'ESCALATE_TO_HUMAN']),
  latencyMs: z.number().nonnegative(),
});
export type DialecticalVerdict = z.infer<typeof DialecticalVerdictSchema>;

// ============================================================================
// 7. MCP DIALECTICAL SYNTHESIS ТРИАДА (Thesis Alpha, Antithesis Beta, Synthesis Gamma)
// ============================================================================
export const DialecticalRoleSchema = z.enum(['THESIS_ALPHA', 'ANTITHESIS_BETA', 'SYNTHESIS_GAMMA']);
export type DialecticalRole = z.infer<typeof DialecticalRoleSchema>;

export const DialecticalSynthesisCandidateSchema = z.object({
  id: z.string().min(1),
  role: DialecticalRoleSchema,
  title: z.string().min(1),
  philosophy: z.string().min(1),
  solutionProposal: z.string().min(1),
  identifiedRisks: z.array(z.string()),
  estimatedOverheadScore: z.number().min(0.0).max(1.0),
  contradictionResolution: z.string().optional(),
});
export type DialecticalSynthesisCandidate = z.infer<typeof DialecticalSynthesisCandidateSchema>;

export const DialecticalSynthesisRequestSchema = z.object({
  problemStatement: z.string().min(1),
  context: z.string().min(1),
  candidates: z.array(DialecticalSynthesisCandidateSchema).length(3, 'Триада обязана содержать ровно 3 варианта: Alpha, Beta, Gamma'),
  hardInvariants: z.array(z.string()).min(1),
});
export type DialecticalSynthesisRequest = z.infer<typeof DialecticalSynthesisRequestSchema>;

export const DialecticalSynthesisResponseSchema = z.object({
  selectedCandidateId: z.string(),
  selectedRole: DialecticalRoleSchema,
  successProbability: z.number().min(0.0).max(1.0),
  synergyScore: z.number().min(0.0).max(1.0),
  vetoOverridden: z.boolean(),
  arbitrationRationale: z.string(),
  vectorScores: z.object({
    safety: z.number().min(0).max(1),
    latency: z.number().min(0).max(1),
    impact: z.number().min(0).max(1),
    resolution: z.number().min(0).max(1),
  }),
  latencyMs: z.number().nonnegative(),
});
export type DialecticalSynthesisResponse = z.infer<typeof DialecticalSynthesisResponseSchema>;
