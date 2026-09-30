/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Stitch Prompt Enhancer Utility.
 * Transforms raw developer briefs into structured, anti-slop Google Stitch briefs.
 */

export interface PromptEnhancerInput {
  rawPrompt: string;
  brand?: 'smmflux' | 'smmplan';
  designDna?: string;
  viewport?: 'desktop' | 'mobile' | 'tablet';
  densityTier?: 'compact' | 'standard' | 'spacious';
}

export interface EnhancedStitchBrief {
  title: string;
  brand: 'smmflux' | 'smmplan';
  designDna: string;
  viewport: 'desktop' | 'mobile' | 'tablet';
  densityTier: 'compact' | 'standard' | 'spacious';
  systemDirectives: string[];
  layoutBlueprint: string[];
  elementHierarchy: string[];
  bannedPatterns: string[];
  compiledPromptText: string;
}

export function enhanceStitchPrompt(input: PromptEnhancerInput): EnhancedStitchBrief {
  const brand = input.brand || 'smmflux';
  const designDna = input.designDna || 'High-Frequency Financial Terminal';
  const viewport = input.viewport || 'desktop';
  const densityTier = input.densityTier || 'compact';

  const systemDirectives = [
    `Target Viewport: ${viewport} (strict responsive contract).`,
    `Brand Context: ${brand.toUpperCase()} design system tokens.`,
    `Design DNA: ${designDna}.`,
    `Density Tier: ${densityTier} (WCAG 2.2 AA compliant, minimum touch zone >= 44px).`
  ];

  const layoutBlueprint = [
    'Modular container with explicit max-w-7xl and zero horizontal overflow.',
    'Tactile high-contrast card borders (border-slate-200/90 dark:border-zinc-800).',
    'Calibrated surfaces: pure white or obsidian dark with subtle shadow-sm elevation.',
    'Sticky responsive actions header/bar where applicable.'
  ];

  const elementHierarchy = [
    'Primary Focal Anchor: Main conversion element or data visualization.',
    'Supporting Micro-Metrics: High-density monospace tabular counters.',
    'Action Sub-elements: Semantic buttons with active hover and pending feedback.'
  ];

  const bannedPatterns = [
    'NO generic neon purple ambient glow or floating gradient blobs.',
    'NO arbitrary emoji or icon stuffing inside badges.',
    'NO disabled CTA buttons (interactive error feedback on invalid click).',
    'NO white cards washed out into white backgrounds without border boundaries.'
  ];

  const compiledPromptText = [
    `### High-Precision Google Stitch Brief: ${input.rawPrompt}`,
    '',
    '#### 1. System Directives',
    ...systemDirectives.map((d) => `- ${d}`),
    '',
    '#### 2. Layout Blueprint',
    ...layoutBlueprint.map((l) => `- ${l}`),
    '',
    '#### 3. Core Requirements',
    `User Objective: "${input.rawPrompt}"`,
    '',
    '#### 4. Element Hierarchy',
    ...elementHierarchy.map((e) => `- ${e}`),
    '',
    '#### 5. Banned Anti-Slop Constraints',
    ...bannedPatterns.map((b) => `- ${b}`)
  ].join('\n');

  return {
    title: input.rawPrompt.slice(0, 48),
    brand,
    designDna,
    viewport,
    densityTier,
    systemDirectives,
    layoutBlueprint,
    elementHierarchy,
    bannedPatterns,
    compiledPromptText
  };
}

if (process.argv[1]?.endsWith('enhance-prompt.ts')) {
  const raw = process.argv.slice(2).join(' ') || 'High-density affiliate referral card';
  const enhanced = enhanceStitchPrompt({ rawPrompt: raw });
  console.log(enhanced.compiledPromptText);
}
