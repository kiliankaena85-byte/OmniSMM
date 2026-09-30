/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * OmniDesign MCP Hub — Design Candidate Generator.
 */

import { GenerateDesignCandidateParams, GenerateDesignCandidateResult } from './types';
import { validateCode } from './token-validator';
import { buildFluxCard, buildPlanCard, buildFluxTable, buildWizard, buildHud } from './templates';

export function generateCandidate(params: GenerateDesignCandidateParams): GenerateDesignCandidateResult {
  const brand = params.brand ?? 'smmflux';
  const category = params.category ?? 'card';
  const name = params.componentName || 'GeneratedWidget';
  const title = params.title || (brand === 'smmflux' ? 'Cobalt Matrix Module' : 'API Terminal Service');
  const desc = params.description || (brand === 'smmflux'
    ? 'Высокоскоростное управление сервисами продвижения с моментальным откликом.'
    : 'Корпоративная интеграция с биллингом и выделенным SLA.');

  let code = '';
  switch (category) {
    case 'table':
      code = buildFluxTable(name, title);
      break;
    case 'wizard':
      code = buildWizard(name, title, brand);
      break;
    case 'hud':
      code = buildHud(name, title, brand);
      break;
    case 'card':
    default:
      code = brand === 'smmplan' ? buildPlanCard(name, title, desc) : buildFluxCard(name, title, desc);
      break;
  }

  const lines = code.trim().split('\n');
  const lineCount = lines.length;
  const violations = validateCode(code, `${name}.tsx`, brand);

  return {
    componentName: name,
    brand,
    category,
    candidateCode: code,
    lineCount,
    adheresToMaxLines: lineCount <= 200,
    tokenValidation: {
      valid: violations.length === 0,
      violationsCount: violations.length,
    },
  };
}
