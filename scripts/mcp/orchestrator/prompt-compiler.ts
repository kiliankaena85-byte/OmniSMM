/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Cognitive Prompt Compiler for Google Stitch & OmniSMM Orchestrator.
 * Compiles user intent, anti-slop rules, web benchmarks, and Laya feedback into structured prompts.
 */

export interface PromptCompilerOptions {
  intent: string;
  brand: 'smmplan' | 'smmflux';
  feedbackHistory?: string[];
  viewport?: 'desktop' | 'mobile' | 'tablet';
  targetDna?: string;
  webBenchmarkNotes?: string[];
}

export class PromptCompiler {
  public static compileStitchPrompt(options: PromptCompilerOptions): string {
    const {
      intent,
      brand,
      feedbackHistory = [],
      viewport = 'desktop',
      targetDna,
      webBenchmarkNotes = []
    } = options;

    const isFlux = brand === 'smmflux';
    const isMobile = viewport === 'mobile';

    const brandContext = isFlux
      ? 'Brand: SMMflux. Dark Obsidian theme (#090d16 / #0B0E14), subtle cyan/indigo borders, frosted glass blur (24px).'
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

    const webBenchmarkSection = webBenchmarkNotes.length > 0
      ? `\nLIVE WEB BENCHMARK & IMPROVEMENT TARGETS (Do not clone blindly, elevate past these standards):\n${webBenchmarkNotes.map(n => `• ${n}`).join('\n')}`
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
${webBenchmarkSection}
${layoutArchitecture}
${refinementInstructions}
`.trim();
  }
}
