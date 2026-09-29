/**
 * Laya Decision Engine Client & Local Fallback
 * Architecture: System 1 Fast Multi-Task Gating (15-35ms)
 * Standard: Dual Agent Self-Improving Loop (2026)
 */

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

/**
 * Локальное ядро Laya (Fallback при недоступности Docker-контейнера)
 */
export class LocalLayaEngine {
  public static detectSlop(layout: string): { slopDetected: boolean; slopType?: SlopClicheType; penalty: number } {
    const text = layout.toLowerCase();

    // 1. Фиолетовый неон на темном фоне (Purple Neon Cliche)
    const hasPurpleNeon =
      text.includes('#8b5cf6') || text.includes('purple-500') || text.includes('purple-600') ||
      text.includes('violet-500') || text.includes('violet-600') || text.includes('fuchsia-500') ||
      text.includes('#a855f7') || text.includes('shadow-purple') || text.includes('shadow-violet');

    const hasDarkBg =
      text.includes('#000000') || text.includes('bg-black') || text.includes('bg-slate-950') ||
      text.includes('bg-zinc-950') || text.includes('bg-gray-950') || text.includes('bg-gray-900') ||
      text.includes('bg-[#090d16]') || text.includes('neon');

    if (hasPurpleNeon && hasDarkBg) {
      return { slopDetected: true, slopType: 'purple_neon', penalty: 0.85 };
    }

    // 2. Бенто-сетка, перегруженная эмодзи
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const emojiMatches = layout.match(emojiRegex);
    if ((text.includes('bento') && emojiMatches && emojiMatches.length >= 1) || (emojiMatches && emojiMatches.length >= 3)) {
      return { slopDetected: true, slopType: 'bento_emoji_overuse', penalty: 0.75 };
    }

    // 3. Пульсирующие пилюли (кроме лоадеров)
    const isSkeleton = text.includes('skeleton') || (text.includes('bg-muted') && !text.includes('badge'));
    if (!isSkeleton && text.includes('rounded-full') && (text.includes('animate-pulse') || text.includes('h-2 w-2 rounded-full bg-emerald'))) {
      return { slopDetected: true, slopType: 'pill_badge_fatigue', penalty: 0.60 };
    }

    // 4. Размытые градиентные пятна (Blob Mesh)
    if ((text.includes('blur-3xl') || text.includes('blur-2xl')) && (text.includes('bg-gradient-to-tr') || text.includes('absolute -inset-'))) {
      return { slopDetected: true, slopType: 'blob_mesh', penalty: 0.70 };
    }

    // 5. Градиентный текст на ключевых словах
    if (text.includes('bg-clip-text') && text.includes('text-transparent') && text.includes('bg-gradient-to-r')) {
      return { slopDetected: true, slopType: 'gradient_keywords', penalty: 0.65 };
    }

    return { slopDetected: false, penalty: 0.0 };
  }

  public static classifyDna(layout: string): LayaClassificationResult {
    const slopCheck = this.detectSlop(layout);
    if (slopCheck.slopDetected) {
      return { designDna: 'generic_slop', slopDetected: true, slopType: slopCheck.slopType, confidence: 0.95 };
    }

    const text = layout.toLowerCase();
    if (text.includes('tabular-nums') && (text.includes('mono') || text.includes('terminal'))) {
      return { designDna: 'financial_terminal', slopDetected: false, confidence: 0.92 };
    }
    if (text.includes('grid-cols-12') || text.includes('swiss') || (text.includes('border-border') && text.includes('text-xs'))) {
      return { designDna: 'swiss_kinetic', slopDetected: false, confidence: 0.88 };
    }
    if (text.includes('bevel') || text.includes('tactile') || text.includes('aluminum')) {
      return { designDna: 'tactile_hardware', slopDetected: false, confidence: 0.84 };
    }
    if (text.includes('serif') || text.includes('editorial')) {
      return { designDna: 'neo_editorial', slopDetected: false, confidence: 0.82 };
    }
    if (text.includes('obsidian') || text.includes('bg-[#0b0f19]')) {
      return { designDna: 'obsidian_monolith', slopDetected: false, confidence: 0.89 };
    }
    if (text.includes('spring') || text.includes('motion')) {
      return { designDna: 'bio_mechanical', slopDetected: false, confidence: 0.80 };
    }

    return { designDna: 'swiss_kinetic', slopDetected: false, confidence: 0.75 };
  }

  public static score(layout: string): LayaDecisionScores {
    const text = layout.toLowerCase();
    const slop = this.detectSlop(layout);

    // Плотность информации (Information Density)
    let density = 0.50;
    if (text.includes('text-xs') || text.includes('text-sm')) density += 0.20;
    if (text.includes('tabular-nums')) density += 0.15;
    if (text.includes('px-2 py-1') || text.includes('p-2') || text.includes('gap-2')) density += 0.10;
    if (text.includes('h-screen') || text.includes('py-24') || text.includes('py-32')) density -= 0.30;
    density = Math.min(1.0, Math.max(0.0, density - slop.penalty * 0.3));

    // Визуальная иерархия
    let hierarchy = 0.60;
    if (text.includes('font-semibold') || text.includes('font-medium')) hierarchy += 0.15;
    if (text.includes('text-muted-foreground') || text.includes('text-secondary')) hierarchy += 0.15;
    hierarchy = Math.min(1.0, Math.max(0.0, hierarchy - slop.penalty * 0.2));

    // WCAG контрастность
    let wcag = 0.85;
    if (text.includes('text-gray-400') && (text.includes('bg-white') || text.includes('bg-gray-100'))) wcag -= 0.40;
    if (text.includes('text-zinc-600') && text.includes('bg-zinc-900')) wcag -= 0.35;
    if (text.includes('border-border') || text.includes('text-foreground')) wcag += 0.10;
    wcag = Math.min(1.0, Math.max(0.0, wcag));

    // Мобильная безопасность (Touch Target >= 44px)
    let mobileTouch = 0.80;
    const hasSmallClickable =
      (text.includes('h-6 w-6') || text.includes('h-7 w-7') || text.includes('h-8 w-8') || text.includes('p-1')) &&
      (text.includes('<button') || text.includes('cursor-pointer') || text.includes('onclick'));
    if (hasSmallClickable && !text.includes('min-h-[44px]') && !text.includes('min-w-[44px]')) {
      mobileTouch = 0.35;
    }
    if (text.includes('min-h-[44px]') || text.includes('h-11') || text.includes('h-12')) {
      mobileTouch = 0.95;
    }

    return {
      informationDensity: Number(density.toFixed(2)),
      visualHierarchy: Number(hierarchy.toFixed(2)),
      wcagContrastScore: Number(wcag.toFixed(2)),
      mobileTouchSafety: Number(mobileTouch.toFixed(2)),
      slopPenalty: Number(slop.penalty.toFixed(2))
    };
  }

  public static decide(layout: string, context?: string): LayaDecisionPayload {
    const startTime = Date.now();
    const scores = this.score(layout);
    const classification = this.classifyDna(layout);
    const refinements: string[] = [];

    const zeroSlopPass = !classification.slopDetected && scores.slopPenalty < 0.40;
    if (!zeroSlopPass) {
      refinements.push(`[ZERO_SLOP_VIOLATION] Обнаружено ИИ-клише: ${classification.slopType}. Замените на чистый High-Density интерфейс.`);
    }

    const wcagAaPass = scores.wcagContrastScore >= 0.70;
    if (!wcagAaPass) {
      refinements.push(`[WCAG_AA_VIOLATION] Недостаточный контраст текста/фона (${scores.wcagContrastScore} < 0.70).`);
    }

    const isMobileContext = context?.includes('mobile') || layout.includes('viewport: mobile');
    const mobileSafePass = isMobileContext ? scores.mobileTouchSafety >= 0.75 : scores.mobileTouchSafety >= 0.50;
    if (!mobileSafePass) {
      refinements.push(`[TOUCH_TARGET_VIOLATION] Интерактивные элементы меньше 44x44px. Добавьте min-h-[44px] min-w-[44px].`);
    }

    const readyForSynthesis = zeroSlopPass && wcagAaPass && mobileSafePass && scores.informationDensity >= 0.45;

    let decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT' = 'APPROVED';
    if (!zeroSlopPass || scores.informationDensity < 0.30) {
      decision = 'REJECTED';
    } else if (!readyForSynthesis) {
      decision = 'NEEDS_REFINEMENT';
    }

    const latencyMs = Math.max(1, Date.now() - startTime);

    return {
      decision,
      confidence: Number((0.85 + (readyForSynthesis ? 0.10 : -0.15)).toFixed(2)),
      latencyMs,
      scores,
      classification,
      gates: {
        zeroSlopPass,
        wcagAaPass,
        mobileSafePass,
        readyForSynthesis
      },
      refinements
    };
  }
}

export class LayaClient {
  private readonly baseUrl: string;

  constructor(baseUrl = process.env.LAYA_URL || 'http://127.0.0.1:8150') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  public async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(1500)
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { status?: string };
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }

  public async decide(candidateLayout: string, context?: string): Promise<LayaDecisionPayload> {
    try {
      const res = await fetch(`${this.baseUrl}/api/laya/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateLayout, context }),
        signal: AbortSignal.timeout(2000)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return (await res.json()) as LayaDecisionPayload;
    } catch {
      // Автоматический неблокирующий fallback на локальный движок
      return LocalLayaEngine.decide(candidateLayout, context);
    }
  }

  public async classify(candidateLayout: string): Promise<LayaClassificationResult> {
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'laya_classify',
            arguments: { candidateLayout }
          }
        }),
        signal: AbortSignal.timeout(2000)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { result?: { content?: Array<{ text?: string }> } };
      const rawText = data.result?.content?.[0]?.text;
      if (rawText) {
        return JSON.parse(rawText) as LayaClassificationResult;
      }
      return LocalLayaEngine.classifyDna(candidateLayout);
    } catch {
      return LocalLayaEngine.classifyDna(candidateLayout);
    }
  }

  public async score(candidateLayout: string): Promise<LayaDecisionScores> {
    try {
      const res = await fetch(`${this.baseUrl}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'laya_score',
            arguments: { candidateLayout }
          }
        }),
        signal: AbortSignal.timeout(2000)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { result?: { content?: Array<{ text?: string }> } };
      const rawText = data.result?.content?.[0]?.text;
      if (rawText) {
        return JSON.parse(rawText) as LayaDecisionScores;
      }
      return LocalLayaEngine.score(candidateLayout);
    } catch {
      return LocalLayaEngine.score(candidateLayout);
    }
  }

  public async check(
    candidateLayout: string,
    gateName: keyof LayaGates,
    context?: string
  ): Promise<{ gate: string; pass: boolean }> {
    const decision = await this.decide(candidateLayout, context);
    return {
      gate: gateName,
      pass: decision.gates[gateName] ?? false
    };
  }
}

export const laya = new LayaClient();
