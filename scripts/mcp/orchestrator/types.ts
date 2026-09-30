/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Orchestration Types for Gemini-Stitch-Laya-OmniDesign Triad.
 */

import { LayaDecisionPayload } from '../laya-mcp-server';
import { BenchmarkComparisonResult } from './design-benchmarking';

export interface OrchestrationGoal {
  userIntent: string;
  targetBrand?: 'smmplan' | 'smmflux';
  targetDna?: 'swiss_kinetic' | 'financial_terminal' | 'tactile_hardware' | 'neo_editorial' | 'obsidian_monolith' | 'bio_mechanical';
  maxIterations?: number;
  viewport?: 'desktop' | 'mobile' | 'tablet';
  referenceMarkup?: string;
  webBenchmarkNotes?: string[];
}

export interface IterationAuditStep {
  iteration: number;
  promptSent: string;
  stitchCandidatesEvaluated: number;
  layaDecision: LayaDecisionPayload;
  geminiAction: 'REFINED_PROMPT' | 'APPROVED_PROCEED_TO_SYNTHESIS' | 'ABORTED_MAX_ITERATIONS';
}

export interface CandidateSummary {
  candidateId: string;
  name: string;
  designDna: string;
  score: number;
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT';
  selected: boolean;
  rejectionReason?: string;
}

export interface OrchestrationResult {
  success: boolean;
  screenTitle: string;
  targetBrand: 'smmplan' | 'smmflux';
  viewport: 'desktop' | 'mobile' | 'tablet';
  totalIterations: number;
  totalLayaLatencyMs: number;
  estimatedTokensSaved: number;
  finalDna: string;
  finalScores: { density: number; hierarchy: number; wcag: number; mobileSafety: number };
  iterationHistory: IterationAuditStep[];
  candidateScorecards: CandidateSummary[];
  synthesizedReactCode?: string;
  benchmarkResult?: BenchmarkComparisonResult;
  tokenValidationResult?: { valid: boolean; violationsCount: number };
  errorMessage?: string;
}
