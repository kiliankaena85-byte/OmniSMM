/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Gemini-Stitch-Laya Tri-Partite Orchestrator Engine.
 *
 * Architecture:
 * - Gemini (System 2 Orchestrator): High-level cognitive reasoning, planning, prompt synthesis, closed-loop convergence.
 * - Google Stitch (Generative UI Renderer): Layout generation, component DOM trees, visual wireframes, responsive variants.
 * - Laya (System 1 Decision Engine): Non-autoregressive fast evaluator (~15-30ms), Zero-Slop gating, density & WCAG scoring.
 *
 * Special Feature:
 * - Stitch delegates inner-loop candidate pruning directly to Laya MCP via JSON-RPC.
 * - Gemini steers the outer loop and synthesizes production React 19 / Tailwind 4 code upon Laya greenlight.
 */

import { handleStitchMcpRequest, StitchLayoutSpecification } from './stitch-mcp-server';
import { handleLayaMcpRequest, LayaDecisionPayload } from './laya-mcp-server';

export interface OrchestrationGoal {
  userIntent: string;
  targetBrand?: 'smmplan' | 'smmflux';
  targetDna?: 'swiss_kinetic' | 'financial_terminal' | 'tactile_hardware' | 'neo_editorial' | 'obsidian_monolith' | 'bio_mechanical';
  maxIterations?: number;
  viewport?: 'desktop' | 'mobile' | 'tablet';
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
  finalScores: {
    density: number;
    hierarchy: number;
    wcag: number;
    mobileSafety: number;
  };
  iterationHistory: IterationAuditStep[];
  candidateScorecards: CandidateSummary[];
  synthesizedReactCode?: string;
  errorMessage?: string;
}

export class GeminiStitchLayaOrchestrator {
  /**
   * System 2: Gemini Cognitive Prompt Compiler.
   * Compiles user intent and Laya's feedback into a surgical Stitch prompt.
   */
  public static compileStitchPrompt(
    intent: string,
    brand: 'smmplan' | 'smmflux',
    feedbackHistory: string[] = [],
    viewport: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    targetDna?: string
  ): string {
    const isFlux = brand === 'smmflux';
    const isMobile = viewport === 'mobile';
    const brandContext = isFlux
      ? 'Brand: SMMflux. Dark Obsidian theme (#090d16), frosted glass blur (24px), subtle cyan/indigo borders.'
      : 'Brand: SMMplan. Enterprise Clean SaaS (Linear/Vercel aesthetic), high information density, neutral slate borders.';

    const antiSlopRules = `
CRITICAL ZERO-SLOP CONSTRAINTS:
1. NO purple neon (#8b5cf6 / purple-500) on black backgrounds.
2. NO bento grids stuffed with random emojis.
3. NO pulsing pill badges above section headers.
4. NO blur-3xl gradient blob meshes.
5. NO gradient text across plain keywords.
`.trim();

    const refinementInstructions = feedbackHistory.length > 0
      ? `\nPREVIOUS ITERATION DEFECTS TO HEAL:\n${feedbackHistory.map(f => `- ${f}`).join('\n')}`
      : '';

    const dnaGuidance = targetDna
      ? `\nTarget Design DNA: ${targetDna.toUpperCase()} (Align typography and layout structure with this aesthetic).`
      : '';

    const layoutArchitecture = isMobile
      ? `Layout Architecture (Mobile 375px+ Viewport):
- Single-column touch-first stepper / wizard with progressive disclosure.
- 56px Safe Area top header with quick balance and tenant logo.
- Sticky or thumb-accessible bottom action button (min-h-[48px]).
- Minimum 44px touch targets on all interactive controls.
- Safe Area Insets compliant, min-w-0 flexbox children, zero horizontal overflow.`
      : `Layout Architecture (Desktop High-Density):
- High-density data grid (target density >= 0.75).
- Tabular numeric rates (tabular-nums font-mono) with price per unit (₽ / unit).
- Minimum 44px touch targets on all interactive controls.
- Safe Area Insets compliant, min-w-0 flexbox children, zero horizontal overflow.`;

    return `
Goal: ${intent}
${brandContext}
${antiSlopRules}
${dnaGuidance}
${layoutArchitecture}
${refinementInstructions}
`.trim();
  }

  /**
   * Runs the full Tri-Partite Orchestration Loop.
   */
  public static async execute(goal: OrchestrationGoal): Promise<OrchestrationResult> {
    const brand = goal.targetBrand || 'smmplan';
    const viewport = goal.viewport || 'desktop';
    const maxIterations = goal.maxIterations || 3;
    const history: IterationAuditStep[] = [];
    const feedbackList: string[] = [];

    let totalLayaLatency = 0;
    let successfulSpec: StitchLayoutSpecification | null = null;
    let finalPayload: LayaDecisionPayload | null = null;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      // 1. Gemini plans and crafts the prompt
      const prompt = this.compileStitchPrompt(goal.userIntent, brand, feedbackList, viewport, goal.targetDna);

      // 2. Gemini instructs Stitch to generate layout (with inner-loop Laya consultation enabled)
      const stitchResponse = await handleStitchMcpRequest({
        jsonrpc: '2.0',
        id: iteration,
        method: 'tools/call',
        params: {
          name: 'stitch_generate_screen',
          arguments: {
            screenTitle: `SMM Console [${goal.userIntent.slice(0, 24)}]`,
            prompt,
            targetBrand: brand,
            viewport,
            targetDna: goal.targetDna,
            consultLayaDirectly: 'true'
          }
        }
      });

      const spec = (stitchResponse.result as Record<string, unknown>).data as StitchLayoutSpecification;
      successfulSpec = spec;

      // 3. Laya System 1 Fast Decision Gate
      const layaContext = viewport === 'mobile' ? 'mobile_catalog' : 'admin_density_dashboard';
      const layaResponse = await handleLayaMcpRequest({
        jsonrpc: '2.0',
        id: iteration,
        method: 'tools/call',
        params: {
          name: 'laya_decide',
          arguments: {
            candidateLayout: spec.rawMarkupPreview,
            context: layaContext
          }
        }
      });

      const layaPayload = (layaResponse.result as Record<string, unknown>).data as LayaDecisionPayload;
      finalPayload = layaPayload;
      totalLayaLatency += layaPayload.latencyMs;

      // Check if Laya approved the design
      if (layaPayload.decision === 'APPROVED' && layaPayload.gates.readyForSynthesis) {
        history.push({
          iteration,
          promptSent: prompt,
          stitchCandidatesEvaluated: spec.consultedCandidatesCount || 1,
          layaDecision: layaPayload,
          geminiAction: 'APPROVED_PROCEED_TO_SYNTHESIS'
        });
        break;
      }

      // If rejected or needs refinement, record feedback for next iteration
      feedbackList.push(...layaPayload.refinements);
      history.push({
        iteration,
        promptSent: prompt,
        stitchCandidatesEvaluated: spec.consultedCandidatesCount || 1,
        layaDecision: layaPayload,
        geminiAction: iteration < maxIterations ? 'REFINED_PROMPT' : 'ABORTED_MAX_ITERATIONS'
      });
    }

    if (!finalPayload || !successfulSpec) {
      return {
        success: false,
        screenTitle: 'Error',
        targetBrand: brand,
        viewport,
        totalIterations: maxIterations,
        totalLayaLatencyMs: totalLayaLatency,
        estimatedTokensSaved: 0,
        finalDna: 'unknown',
        finalScores: { density: 0, hierarchy: 0, wcag: 0, mobileSafety: 0 },
        iterationHistory: history,
        candidateScorecards: [],
        errorMessage: 'Orchestration failed to produce candidates.'
      };
    }

    // 4. Final React 19 Code Synthesis
    let synthesizedCode = '';
    if (finalPayload.gates.readyForSynthesis) {
      const synthRes = await handleStitchMcpRequest({
        jsonrpc: '2.0',
        id: 999,
        method: 'tools/call',
        params: {
          name: 'stitch_synthesize_react',
          arguments: {
            screenTitle: successfulSpec.screenTitle,
            targetBrand: brand,
            viewport,
            designDna: finalPayload.classification.designDna
          }
        }
      });
      synthesizedCode = (synthRes.result as Record<string, unknown>).code as string;
    }

    // Estimated tokens saved: Each Laya System 1 decision (~15-30ms) replaces ~600 tokens of LLM critique
    const totalDecisionsCount = history.reduce((sum, h) => sum + h.stitchCandidatesEvaluated, 0);
    const estimatedTokensSaved = totalDecisionsCount * 650;

    return {
      success: finalPayload.gates.readyForSynthesis,
      screenTitle: successfulSpec.screenTitle,
      targetBrand: brand,
      viewport,
      totalIterations: history.length,
      totalLayaLatencyMs: totalLayaLatency,
      estimatedTokensSaved,
      finalDna: finalPayload.classification.designDna,
      finalScores: {
        density: finalPayload.scores.informationDensity,
        hierarchy: finalPayload.scores.visualHierarchy,
        wcag: finalPayload.scores.wcagContrastScore,
        mobileSafety: finalPayload.scores.mobileTouchSafety
      },
      iterationHistory: history,
      candidateScorecards: (successfulSpec.candidateEvaluations || []).map(c => ({
        candidateId: c.candidateId,
        name: c.name,
        designDna: c.designDna,
        score: c.score,
        decision: c.decision,
        selected: c.selected,
        rejectionReason: c.rejectionReason
      })),
      synthesizedReactCode: synthesizedCode
    };
  }
}
