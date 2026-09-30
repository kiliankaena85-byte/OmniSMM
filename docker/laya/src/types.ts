// docker/laya/src/types.ts
// Single Source of Truth for Laya System 1 Decision Engine Types (RAC-2026)

export type DesignDnaType =
  | 'swiss_kinetic'
  | 'financial_terminal'
  | 'tactile_hardware'
  | 'neo_editorial'
  | 'obsidian_monolith'
  | 'bio_mechanical'
  | 'generic_slop';

export type SlopClicheType =
  | 'purple_neon'
  | 'bento_emoji_overuse'
  | 'pill_badge_fatigue'
  | 'blob_mesh'
  | 'gradient_keywords';

export interface LayaDecisionScores {
  informationDensity: number;
  visualHierarchy: number;
  wcagContrastScore: number;
  mobileTouchSafety: number;
  slopPenalty: number;
}

export interface LayaClassificationResult {
  designDna: DesignDnaType;
  slopDetected: boolean;
  slopType?: SlopClicheType;
  confidence: number;
}

export interface LayaGates {
  zeroSlopPass: boolean;
  wcagAaPass: boolean;
  mobileSafePass: boolean;
  readyForSynthesis: boolean;
}

export interface LayaDecisionPayload {
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT';
  confidence: number;
  latencyMs: number;
  scores: LayaDecisionScores;
  classification: LayaClassificationResult;
  gates: LayaGates;
  refinements: string[];
}

// ============================================================================
// SYSTEM 1 TYPED DECISION PRIMITIVES (Jev / Laya 2026 Standard)
// ============================================================================

export interface ChoiceOption {
  id: string;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionChoiceRequest {
  context: string;
  instruction: string;
  options: ChoiceOption[];
  temperature?: number;
}

export interface DecisionChoiceResponse {
  selectedId: string;
  confidence: number;
  distribution: Record<string, number>;
  entropy: number;
  latencyMs: number;
  engineVersion: string;
}

export type DecisionMetricName =
  | 'FRAUD_RISK'
  | 'LINK_SAFETY'
  | 'TICKET_URGENCY'
  | 'CODE_SLOP_RISK'
  | 'PROVIDER_RELIABILITY';

export interface DecisionScoreRequest {
  context: string;
  metricName: DecisionMetricName;
  evidence?: string[];
}

export interface DecisionScoreResponse {
  metricName: DecisionMetricName;
  score: number;
  isCriticalThresholdExceeded: boolean;
  latencyMs: number;
}

export interface DecisionNoulRequest {
  proposition: string;
  context: string;
  riskWeight?: number;
}

export interface DecisionNoulResponse {
  verdict: boolean;
  probabilityYes: number;
  riskAdjustedThreshold: number;
  isUncertain: boolean;
  latencyMs: number;
}

export interface ProviderCandidate {
  providerId: string;
  costRub?: number;
  historicalSuccessRate?: number;
  avgFulfillmentSpeedMinutes?: number;
  activeErrorsLastHour?: number;
  // Новые поля формата MCP-кандидатов (BUG-003 FIX)
  providerName?: string;
  unitCostRub?: number;
  reliabilityScore?: number;
  estimatedDeliveryHours?: number;
  isSovereign?: boolean;
}

export interface OrderRoutingRequest {
  orderId: string;
  serviceCategory: string;
  targetUrl: string;
  quantity: number;
  inHouseAvailable: boolean;
  inHouseUnitCostRub: number;
  candidates: ProviderCandidate[];
}

export interface OrderRoutingResponse {
  orderId: string;
  destinationType: 'IN_HOUSE_PRODUCTION' | 'IN_HOUSE_MTPROTO' | 'EXTERNAL_WHOLESALE' | 'MANUAL_REVIEW';
  selectedTargetId: string;
  confidence: number;
  estimatedMarginPercent: number;
  routingReason: string;
  latencyMs: number;
}

export interface ActionArbitrationRequest {
  actionId: string;
  intent: string;
  category: 'REFACTOR' | 'BUGFIX' | 'OPTIMIZATION' | 'SCHEMA_MIGRATION' | 'DEPENDENCY' | 'DEPLOY' | 'INFRASTRUCTURE';
  isDestructive: boolean;
  hasRollbackPlan: boolean;
  estimatedImpactFiles: number;
  touchesFinancialLedger?: boolean;
  touchesAuthOrSecrets?: boolean;
  environment?: 'LOCAL' | 'STAGE' | 'PRODUCTION';
}

export interface ActionArbitrationResponse {
  actionId: string;
  verdict: 'PROCEED' | 'REDIRECT_SAFE' | 'ESCALATE_TO_HUMAN' | 'REJECT';
  confidenceScore: number;
  rationale: string;
  latencyMs: number;
  tokenCost: 0;
}

// ============================================================================
// DIALECTICAL SELF-LOOP IMPROVING SCHEMAS
// ============================================================================

export type DialecticalCandidateRole = 'ALPHA_RADICAL' | 'BETA_CONSERVATIVE' | 'GAMMA_SYNTHESIS';

export interface DialecticalCandidate {
  role: DialecticalCandidateRole;
  title: string;
  philosophy: string;
  implementationSummary: string;
  pros: string[];
  cons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedBlastRadius: number;
}

export interface DialecticalArbitrationRequest {
  taskId: string;
  taskContext: string;
  businessObjective: string;
  hardInvariants: string[];
  candidates: DialecticalCandidate[];
}

export interface DialecticalVerdict {
  taskId: string;
  winningRole: DialecticalCandidateRole;
  confidenceScore: number;
  invariantViolations: Record<string, string[]>;
  riskAssessment: {
    alphaRiskScore: number;
    betaRiskScore: number;
    gammaRiskScore?: number;
  };
  rationale: string;
  recommendedAction: 'EXECUTE_IMMEDIATELY' | 'REFINE_LOOP' | 'ESCALATE_TO_HUMAN';
  latencyMs: number;
}
