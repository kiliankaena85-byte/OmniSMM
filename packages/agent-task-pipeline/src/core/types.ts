import { z } from 'zod';

export type ActionCategory = 
  | 'REFACTOR'
  | 'BUGFIX'
  | 'OPTIMIZATION'
  | 'SCHEMA_MIGRATION'
  | 'DEPENDENCY'
  | 'DEPLOY'
  | 'INFRASTRUCTURE';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionOption {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  isDestructive: boolean;
  hasRollbackPlan: boolean;
  estimatedImpactFiles: number;
  touchesFinancialLedger?: boolean;
  touchesAuthOrSecrets?: boolean;
  paradigm?: 'CONSERVATIVE' | 'RADICAL_CLEAN' | 'INVERSION_TRIZ' | 'UNKNOWN';
  qualityScore?: number; // 0-100
}

export interface ActionProposalContext {
  targetEnvironment: 'LOCAL' | 'STAGE' | 'PRODUCTION';
  userIntentExplicit?: boolean;
  hasBackup?: boolean;
  activeGitDiffLines?: number;
}

export interface ActionIntentProposal {
  actionId: string;
  intent: string;
  category: ActionCategory;
  options: ActionOption[];
  context: ActionProposalContext;
}

export type DecisionVerdict = 'PROCEED' | 'REDIRECT_SAFE' | 'ESCALATE_TO_HUMAN' | 'REJECT' | 'CHALLENGE_CREATIVITY';

export interface ActionDecisionResult {
  decisionId: string;
  timestamp: string;
  verdict: DecisionVerdict;
  selectedOptionId: string | null;
  selectedOptionTitle: string | null;
  confidenceScore: number;
  tokenCost: 0;
  rationale: string;
  riskAssessment: {
    financialRisk: 'NONE' | 'LOW' | 'HIGH';
    securityRisk: 'NONE' | 'LOW' | 'HIGH';
    dataIntegrityRisk: 'NONE' | 'LOW' | 'HIGH';
    overallRiskScore: number;
  };
  remediationAdvice: string[];
  creativeVectors?: string[];
}

export interface BusinessRequest {
  id: string;
  title: string;
  description: string;
  businessGoals: string[];
  nonGoals?: string[];
  targetAudience?: string;
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AtomicTask {
  id: string;
  title: string;
  description: string;
  targetFiles: string[]; // Strict WBS rule: <= 2 files
  riskLevel: RiskLevel;
  testCriteria: string[];
  dependencies: string[];
  estimatedMinutes?: number;
}

export interface DecompositionResult {
  requestId: string;
  specSummary: string;
  totalTasks: number;
  atomicTasks: AtomicTask[];
  criticalPath: string[];
  isWbsCompliant: boolean; // Each task <= 2 files
}

export type ThreatCategory = 
  | 'IDOR_ACCESS_CONTROL'
  | 'CONCURRENCY_TOCTOU'
  | 'TIMING_ATTACK_CRYPTO'
  | 'SSRF_INJECTION'
  | 'RATE_LIMIT_DOS'
  | 'FINANCIAL_EXACT_MATH';

export interface SecurityThreatVector {
  id: string;
  category: ThreatCategory;
  owaspReference: string; // e.g. "A01:2025"
  file?: string;
  line?: number;
  attackScenario: string;
  mitigationRequirement: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface SecurityAuditReport {
  timestamp: string;
  threatsIdentified: SecurityThreatVector[];
  isImmune: boolean;
  requiredGuards: string[];
  pentestTestCases: string[];
}
