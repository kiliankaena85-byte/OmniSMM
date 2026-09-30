/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Gemini-Stitch-Laya Tri-Partite Orchestrator Engine.
 * Coordinates System 2 cognitive planning, Stitch generative UI, Laya System 1 fast pruning,
 * OmniDesign AST token audit, and competitive benchmarking.
 */

import { handleStitchMcpRequest, StitchLayoutSpecification } from './stitch-mcp-server';
import { handleLayaMcpRequest, LayaDecisionPayload } from './laya-mcp-server';
import { handleOmniDesignMcpRequest } from './omnidesign-mcp-server';
import { PromptCompiler } from './orchestrator/prompt-compiler';
import { DesignBenchmarkingEngine } from './orchestrator/design-benchmarking';
import {
  OrchestrationGoal,
  IterationAuditStep,
  CandidateSummary,
  OrchestrationResult
} from './orchestrator/types';

export type {
  OrchestrationGoal,
  IterationAuditStep,
  CandidateSummary,
  OrchestrationResult
};

export class GeminiStitchLayaOrchestrator {
  public static compileStitchPrompt(
    intent: string,
    brand: 'smmplan' | 'smmflux',
    feedbackHistory: string[] = [],
    viewport: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    targetDna?: string,
    webBenchmarkNotes?: string[]
  ): string {
    return PromptCompiler.compileStitchPrompt({
      intent, brand, feedbackHistory, viewport, targetDna, webBenchmarkNotes
    });
  }

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
      const prompt = this.compileStitchPrompt(
        goal.userIntent, brand, feedbackList, viewport, goal.targetDna, goal.webBenchmarkNotes
      );

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

      const layaContext = viewport === 'mobile' ? 'mobile_catalog' : 'admin_density_dashboard';
      const layaResponse = await handleLayaMcpRequest({
        jsonrpc: '2.0',
        id: iteration,
        method: 'tools/call',
        params: {
          name: 'laya_decide',
          arguments: { candidateLayout: spec.rawMarkupPreview, context: layaContext }
        }
      });

      const layaPayload = (layaResponse.result as Record<string, unknown>).data as LayaDecisionPayload;
      finalPayload = layaPayload;
      totalLayaLatency += layaPayload.latencyMs;

      if (layaPayload.decision === 'APPROVED' && layaPayload.gates.readyForSynthesis) {
        history.push({
          iteration, promptSent: prompt,
          stitchCandidatesEvaluated: spec.consultedCandidatesCount || 1,
          layaDecision: layaPayload, geminiAction: 'APPROVED_PROCEED_TO_SYNTHESIS'
        });
        break;
      }

      feedbackList.push(...layaPayload.refinements);
      history.push({
        iteration, promptSent: prompt,
        stitchCandidatesEvaluated: spec.consultedCandidatesCount || 1,
        layaDecision: layaPayload,
        geminiAction: iteration < maxIterations ? 'REFINED_PROMPT' : 'ABORTED_MAX_ITERATIONS'
      });
    }

    if (!finalPayload || !successfulSpec) {
      return {
        success: false, screenTitle: 'Error', targetBrand: brand, viewport,
        totalIterations: maxIterations, totalLayaLatencyMs: totalLayaLatency, estimatedTokensSaved: 0,
        finalDna: 'unknown', finalScores: { density: 0, hierarchy: 0, wcag: 0, mobileSafety: 0 },
        iterationHistory: history, candidateScorecards: [],
        errorMessage: 'Orchestration failed to produce candidates.'
      };
    }

    let synthesizedCode = '';
    if (finalPayload.gates.readyForSynthesis) {
      const synthRes = await handleStitchMcpRequest({
        jsonrpc: '2.0', id: 999, method: 'tools/call',
        params: {
          name: 'stitch_synthesize_react',
          arguments: {
            screenTitle: successfulSpec.screenTitle, targetBrand: brand, viewport,
            designDna: finalPayload.classification.designDna
          }
        }
      });
      synthesizedCode = (synthRes.result as Record<string, unknown>).code as string;
    }

    const benchmarkResult = DesignBenchmarkingEngine.compare(
      finalPayload, goal.referenceMarkup, viewport === 'mobile' ? 'mobile_catalog' : 'admin_density_dashboard'
    );

    let tokenValidationResult: { valid: boolean; violationsCount: number } | undefined;
    if (synthesizedCode) {
      const tokenAuditRes = await handleOmniDesignMcpRequest({
        jsonrpc: '2.0', id: 1000, method: 'tools/call',
        params: {
          name: 'validate_design_tokens',
          arguments: { code: synthesizedCode, brand }
        }
      });
      const data = (tokenAuditRes.result as Record<string, unknown>)?.data as { valid?: boolean; violations?: unknown[] };
      if (data) {
        tokenValidationResult = { valid: Boolean(data.valid), violationsCount: data.violations?.length ?? 0 };
      }
    }

    const totalDecisionsCount = history.reduce((sum, h) => sum + h.stitchCandidatesEvaluated, 0);

    return {
      success: finalPayload.gates.readyForSynthesis,
      screenTitle: successfulSpec.screenTitle,
      targetBrand: brand,
      viewport,
      totalIterations: history.length,
      totalLayaLatencyMs: totalLayaLatency,
      estimatedTokensSaved: totalDecisionsCount * 650,
      finalDna: finalPayload.classification.designDna,
      finalScores: {
        density: finalPayload.scores.informationDensity,
        hierarchy: finalPayload.scores.visualHierarchy,
        wcag: finalPayload.scores.wcagContrastScore,
        mobileSafety: finalPayload.scores.mobileTouchSafety
      },
      iterationHistory: history,
      candidateScorecards: (successfulSpec.candidateEvaluations || []).map(c => ({
        candidateId: c.candidateId, name: c.name, designDna: c.designDna,
        score: c.score, decision: c.decision, selected: c.selected, rejectionReason: c.rejectionReason
      })),
      synthesizedReactCode: synthesizedCode,
      benchmarkResult,
      tokenValidationResult
    };
  }
}
