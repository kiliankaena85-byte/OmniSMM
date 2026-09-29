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
