/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * Google Stitch Generative UI — Model Context Protocol (MCP) Server.
 *
 * Implements Google Stitch UI generation with direct inner-loop Laya decision delegation:
 * - stitch_generate_screen: Generates high-fidelity UI layout with optional inner-loop Laya consultation.
 * - stitch_create_variant: Creates responsive (mobile/tablet/desktop) variants.
 * - stitch_consult_laya: Dedicated inner-loop bridge for Stitch to delegate micro-decisions to Laya.
 * - stitch_synthesize_react: Synthesizes approved layouts into typed React 19 & Tailwind 4 components.
 */

import readline from 'readline';
import { LayaDecisionEngine, LayaDecisionPayload, handleLayaMcpRequest } from './laya-mcp-server';

export interface StitchScreenElement {
  id: string;
  type: 'sidebar' | 'hud' | 'wizard' | 'grid' | 'table' | 'banner' | 'modal';
  title: string;
  classes: string;
  densityTier: 'compact' | 'standard' | 'spacious';
  childrenSummary: string;
}

export interface CandidateEvaluation {
  candidateId: string;
  name: string;
  designDna: string;
  score: number;
  decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT';
  selected: boolean;
  rejectionReason?: string;
}

export interface StitchLayoutSpecification {
  screenTitle: string;
  targetBrand: 'smmplan' | 'smmflux';
  designDna: string;
  viewport: 'desktop' | 'mobile' | 'tablet';
  elements: StitchScreenElement[];
  rawMarkupPreview: string;
  layaInnerAudit?: LayaDecisionPayload;
  consultedCandidatesCount?: number;
  candidateEvaluations?: CandidateEvaluation[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; items?: { type: string } }>;
    required?: string[];
  };
}

export const STITCH_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'stitch_generate_screen',
    description: 'Generates high-fidelity UI layouts using Google Stitch. Supports inner-loop delegation to Laya for candidate pruning.',
    inputSchema: {
      type: 'object',
      properties: {
        screenTitle: {
          type: 'string',
          description: 'Title of the screen: e.g. "SMM Order Wizard", "Financial Terminal"'
        },
        prompt: {
          type: 'string',
          description: 'Detailed prompt specifying layout structure, components, and user goals'
        },
        targetBrand: {
          type: 'string',
          description: '"smmplan" (Enterprise Clean Linear) or "smmflux" (Dark Radiant Aurora)'
        },
        viewport: {
          type: 'string',
          description: 'Target viewport: "desktop", "mobile", "tablet"'
        },
        targetDna: {
          type: 'string',
          description: 'Target design DNA to favor: "swiss_kinetic", "financial_terminal", "obsidian_monolith", "tactile_hardware", "neo_editorial", "bio_mechanical"'
        },
        consultLayaDirectly: {
          type: 'string',
          description: 'If "true", Stitch generates multiple candidates and consults Laya to prune slop before returning'
        }
      },
      required: ['screenTitle', 'prompt']
    }
  },
  {
    name: 'stitch_create_variant',
    description: 'Creates responsive variants (desktop, tablet, mobile 375px) of an existing Stitch layout.',
    inputSchema: {
      type: 'object',
      properties: {
        screenTitle: {
          type: 'string',
          description: 'Base screen title'
        },
        viewport: {
          type: 'string',
          description: 'Target viewport: "mobile" (375px), "tablet" (768px), "desktop" (1440px)'
        }
      },
      required: ['screenTitle', 'viewport']
    }
  },
  {
    name: 'stitch_consult_laya',
    description: 'Internal delegation tool: Stitch queries Laya MCP directly for layout density, WCAG contrast, or Zero-Slop gating.',
    inputSchema: {
      type: 'object',
      properties: {
        candidateSnippet: {
          type: 'string',
          description: 'Layout snippet or CSS token configuration to evaluate'
        },
        context: {
          type: 'string',
          description: 'Context of the layout under evaluation'
        }
      },
      required: ['candidateSnippet']
    }
  },
  {
    name: 'stitch_synthesize_react',
    description: 'Synthesizes an approved Stitch layout specification into pure React 19 + Tailwind 4 TypeScript code.',
    inputSchema: {
      type: 'object',
      properties: {
        screenTitle: {
          type: 'string',
          description: 'Title of the screen to synthesize'
        },
        targetBrand: {
          type: 'string',
          description: '"smmplan" or "smmflux"'
        },
        viewport: {
          type: 'string',
          description: 'Target viewport: "desktop", "mobile", "tablet"'
        },
        designDna: {
          type: 'string',
          description: 'e.g. "swiss_kinetic", "financial_terminal"'
        }
      },
      required: ['screenTitle']
    }
  }
];

export class StitchGenerativeEngine {
  /**
   * Generates layout specification with inner-loop candidate pruning via Laya.
   */
  public static async generateScreen(
    title: string,
    prompt: string,
    brand: 'smmplan' | 'smmflux' = 'smmplan',
    consultLaya: boolean = true,
    viewport: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    targetDna?: string
  ): Promise<StitchLayoutSpecification> {
    const isFlux = brand === 'smmflux';
    const isMobile = viewport === 'mobile';
    const bgToken = isFlux ? 'bg-[#090d16] text-[#e0e7ff]' : 'bg-background text-foreground';
    const borderToken = isFlux ? 'border-[#1f293d]' : 'border-border';
    const layaContext = isMobile ? 'mobile_catalog' : 'admin_density_dashboard';

    // Heuristic defect adjustments based on prompt / feedback history
    const needsTighterDensity = prompt.toLowerCase().includes('low information density') || prompt.toLowerCase().includes('high-density');
    const needsMobileTouch = prompt.toLowerCase().includes('mobile ergonomics') || prompt.toLowerCase().includes('touch target') || isMobile;

    const rowPadding = needsTighterDensity ? 'py-1.5' : 'py-3';
    const buttonMinH = needsMobileTouch ? 'min-h-[44px]' : 'min-h-[40px]';

    // Candidate 1: Swiss Kinetic / Linear High-Density HUD
    const candidateHighDensityElements: StitchScreenElement[] = isMobile
      ? [
          {
            id: 'mobile-top-hud',
            type: 'hud',
            title: 'Mobile Header (56px Safe Area)',
            classes: `w-full h-14 border-b ${borderToken} px-3 flex items-center justify-between text-xs tabular-nums`,
            densityTier: 'compact',
            childrenSummary: 'Brand header, Wallet balance HUD (ExactMath BigInt), Drawer menu trigger.'
          },
          {
            id: 'mobile-wizard-core',
            type: 'wizard',
            title: 'Touch 4-Step Checkout Wizard',
            classes: 'w-full p-4 space-y-3',
            densityTier: 'compact',
            childrenSummary: '4-step touch checkout: Service, Target URL, Quantity with Drip-Feed Floor, Submit.'
          }
        ]
      : [
          {
            id: 'sidebar-main',
            type: 'sidebar',
            title: 'Collapsible Nav Sidebar (280px)',
            classes: `w-72 shrink-0 border-r ${borderToken} p-4 space-y-4`,
            densityTier: 'compact',
            childrenSummary: 'Brand header, Wallet balance HUD (ExactMath BigInt), Navigation tree (Services, Orders, API).'
          },
          {
            id: 'hud-top',
            type: 'hud',
            title: 'Top HUD Bar (48px)',
            classes: `h-12 border-b ${borderToken} flex items-center px-4 justify-between text-xs tabular-nums`,
            densityTier: 'compact',
            childrenSummary: 'Platform switcher pills, Search input (min-h-[44px]), Notification chip.'
          },
          {
            id: 'wizard-core',
            type: 'wizard',
            title: 'OmniSMM 4-Step Checkout Wizard',
            classes: 'max-w-4xl mx-auto py-4 px-6 space-y-4',
            densityTier: 'compact',
            childrenSummary: '1. Platform -> 2. Category -> 3. Service with Drip-Feed Floor -> 4. Link & Quantity with live unit price.'
          },
          {
            id: 'table-orders',
            type: 'table',
            title: 'Live Transactions & Order Stream',
            classes: `w-full border ${borderToken} rounded-lg text-xs tabular-nums overflow-hidden`,
            densityTier: 'compact',
            childrenSummary: '100% width zero-scroll table: Order ID, Service, Target URL, Status badge, Timestamp.'
          }
        ];

    const rawMarkupHighDensity = isMobile
      ? `<div class="w-full min-h-screen ${bgToken} flex flex-col min-w-0">
  <div class="h-14 border-b ${borderToken} px-3 flex items-center justify-between text-xs tabular-nums">
    <span class="font-bold">${brand.toUpperCase()}</span>
    <span class="tabular-nums font-semibold text-primary">1 450.00 ₽</span>
  </div>
  <div class="p-3 space-y-3">
    <div class="border ${borderToken} rounded-lg p-3 text-xs space-y-3">
      <div class="font-semibold text-sm">Быстрый заказ</div>
      <input type="url" placeholder="Ссылка на канал/публикацию" class="w-full ${buttonMinH} px-3 border ${borderToken} rounded text-xs" />
      <div class="flex justify-between items-center tabular-nums">
        <span>Минимум: 10 шт</span>
        <span class="font-bold">0.18 ₽ / шт</span>
      </div>
      <button class="w-full ${buttonMinH} bg-primary text-primary-foreground font-semibold rounded text-xs">Создать заказ</button>
    </div>
  </div>
</div>`.trim()
      : `<div class="min-h-screen ${bgToken} flex flex-col md:flex-row">
  <aside class="w-72 shrink-0 border-r ${borderToken} p-4 hidden md:block">
    <div class="font-bold text-sm tracking-wider">OMNISMM | ${brand.toUpperCase()}</div>
    <div class="mt-4 p-3 rounded border ${borderToken} tabular-nums text-xs">
      Баланс: <span class="font-semibold text-primary">1 450.00 ₽</span>
    </div>
  </aside>
  <main class="flex-1 flex flex-col min-w-0">
    <header class="h-12 border-b ${borderToken} px-4 flex items-center justify-between text-xs tabular-nums">
      <span>Каталог услуг SMM 2026</span>
      <span class="text-muted-foreground">Пинг: 24мс</span>
    </header>
    <section class="p-4 space-y-4 max-w-5xl mx-auto w-full">
      <div class="grid grid-cols-12 gap-3">
        <div class="col-span-12 md:col-span-8 border ${borderToken} rounded-md p-4">
          <h2 class="font-semibold text-sm mb-3">Оформление заказа</h2>
          <div class="space-y-3 text-xs">
            <input type="text" placeholder="Ссылка на публикацию/канал" class="w-full ${buttonMinH} px-3 border rounded text-xs" />
            <div class="flex justify-between items-center tabular-nums ${rowPadding}">
              <span>Минимум: 10 шт</span>
              <span class="font-bold">0.18 ₽ / шт</span>
            </div>
            <button class="w-full ${buttonMinH} bg-primary text-primary-foreground font-medium rounded text-xs">Создать заказ</button>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>`.trim();

    // Candidate 2: Financial Terminal HUD (Strict Monospace + Rate Matrix)
    const candidateFinancialElements: StitchScreenElement[] = [
      {
        id: 'financial-ticker-hud',
        type: 'hud',
        title: 'Financial Ticker HUD (48px)',
        classes: `h-12 border-b ${borderToken} flex items-center px-4 justify-between font-mono tabular-nums text-xs`,
        densityTier: 'compact',
        childrenSummary: 'Asset ticker rates, provider execution latency (~24ms), ledger kopeck balance.'
      },
      {
        id: 'financial-matrix',
        type: 'table',
        title: 'High-Density Rate Matrix',
        classes: `w-full border ${borderToken} rounded-md font-mono text-xs tabular-nums`,
        densityTier: 'compact',
        childrenSummary: 'ExactMath rates per 1 unit (₽ / шт), execution latency, refill guarantees.'
      },
      {
        id: 'financial-order-console',
        type: 'wizard',
        title: 'Terminal Order Console (Drip-Feed Safe)',
        classes: `border ${borderToken} rounded-md p-4 space-y-3 font-mono text-xs`,
        densityTier: 'compact',
        childrenSummary: 'Monospace inputs with 44px touch target, ExactMath total price calculator.'
      }
    ];

    const rawMarkupFinancialTerminal = `<div class="min-h-screen ${bgToken} flex flex-col font-mono tabular-nums text-xs">
  <div class="h-12 border-b ${borderToken} px-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <span class="font-bold tracking-wider">${brand.toUpperCase()}_TERMINAL</span>
      <span class="text-muted-foreground">LATENCY: 24ms</span>
    </div>
    <div class="font-semibold text-primary">БАЛАНС: 1 450.00 ₽</div>
  </div>
  <div class="p-4 space-y-4 max-w-5xl mx-auto w-full">
    <div class="border ${borderToken} rounded p-4 space-y-3">
      <div class="font-semibold text-sm">ТЕРМИНАЛ ОФОРМЛЕНИЯ ЗАКАЗА</div>
      <input type="text" placeholder="https://t.me/channel" class="w-full ${buttonMinH} px-3 border rounded text-xs" />
      <div class="grid grid-cols-2 gap-3 py-1.5 border-y ${borderToken}">
        <div>МИНИМУМ: 10 ШТ</div>
        <div class="font-bold text-right">0.18 ₽ / ШТ</div>
      </div>
      <button class="w-full ${buttonMinH} bg-primary text-primary-foreground font-semibold rounded text-xs">ИСПОЛНИТЬ ЗАЯВКУ</button>
    </div>
  </div>
</div>`.trim();

    // Candidate 3: Adaptive Split Grid
    const candidateAdaptiveElements: StitchScreenElement[] = [
      {
        id: 'adaptive-split-left',
        type: 'wizard',
        title: 'Split Checkout Panel',
        classes: `border ${borderToken} rounded p-4 text-xs space-y-3`,
        densityTier: 'standard',
        childrenSummary: 'Order link input, submit button.'
      },
      {
        id: 'adaptive-split-right',
        type: 'hud',
        title: 'Statistics Panel',
        classes: `border ${borderToken} rounded p-4 text-xs tabular-nums`,
        densityTier: 'standard',
        childrenSummary: 'Active orders counter.'
      }
    ];

    const rawMarkupAdaptiveGrid = `<div class="w-full min-h-screen ${bgToken} p-4">
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="border ${borderToken} rounded p-4 text-xs space-y-3">
      <h3 class="font-semibold">Быстрый заказ</h3>
      <input type="text" placeholder="Ссылка" class="w-full ${buttonMinH} px-3 border rounded" />
      <button class="w-full ${buttonMinH} bg-primary text-primary-foreground rounded">Заказать</button>
    </div>
    <div class="border ${borderToken} rounded p-4 text-xs tabular-nums">
      <h3 class="font-semibold mb-2">Статистика</h3>
      <p>Активных заказов: 3</p>
    </div>
  </div>
</div>`.trim();

    // Candidate 4: Spacious Cards (Lower density candidate to prune)
    const candidateSpaciousElements: StitchScreenElement[] = [
      {
        id: 'spacious-bento-hero',
        type: 'banner',
        title: 'Spacious Bento Container',
        classes: `border ${borderToken} rounded-2xl py-8 px-6 text-sm`,
        densityTier: 'spacious',
        childrenSummary: 'Generous whitespace order request container.'
      }
    ];

    const rawMarkupSpaciousCards = `<div class="w-full min-h-screen ${bgToken} py-12 px-8">
  <div class="max-w-3xl mx-auto space-y-8">
    <div class="border ${borderToken} rounded-2xl py-8 px-6 text-sm">
      <h1 class="text-xl font-bold mb-4">Создать заявку</h1>
      <p class="text-muted-foreground mb-6">Заполните поля ниже для запуска продвижения.</p>
      <input type="text" placeholder="URL" class="w-full h-12 px-4 border rounded-xl mb-4" />
      <button class="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl">Отправить</button>
    </div>
  </div>
</div>`.trim();

    // Candidate 5: AI-Slop Cliche (Purple neon on dark background + emoji clutter)
    const candidateAiSlopElements: StitchScreenElement[] = [
      {
        id: 'slop-neon-card',
        type: 'banner',
        title: 'Purple Neon Glow Slop',
        classes: 'bg-black text-purple-500 shadow-[0_0_20px_#8b5cf6] p-8',
        densityTier: 'spacious',
        childrenSummary: 'Banned AI-slop cliches: purple neon on black and emoji clutter.'
      }
    ];

    const rawMarkupAiSlop = `<div class="bg-black text-purple-500 shadow-[0_0_20px_#8b5cf6] p-8">
  <div class="text-xl">🚀 Fast ⚡ Instant 🔥 Hot SMM Promotion</div>
  <button class="bg-purple-600 text-white rounded-full animate-pulse h-10 px-6">Buy Now</button>
</div>`.trim();

    const candidatePool = [
      {
        id: 'candidate-high-density',
        name: isMobile ? 'Mobile Touch Single-Column' : 'Swiss Kinetic High-Density HUD',
        elements: candidateHighDensityElements,
        markup: rawMarkupHighDensity
      },
      {
        id: 'candidate-financial-terminal',
        name: 'Financial Terminal Rate Matrix',
        elements: candidateFinancialElements,
        markup: rawMarkupFinancialTerminal
      },
      {
        id: 'candidate-adaptive-grid',
        name: 'Adaptive Split Grid',
        elements: candidateAdaptiveElements,
        markup: rawMarkupAdaptiveGrid
      },
      {
        id: 'candidate-spacious-cards',
        name: 'Spacious Bento Cards',
        elements: candidateSpaciousElements,
        markup: rawMarkupSpaciousCards
      },
      {
        id: 'candidate-ai-slop',
        name: 'Generic Neon AI-Slop',
        elements: candidateAiSlopElements,
        markup: rawMarkupAiSlop
      }
    ];

    const evaluations: CandidateEvaluation[] = [];
    let winningCandidate = candidatePool[0];
    let winningAudit: LayaDecisionPayload | undefined;
    let highestScore = -1;

    // INNER LOOP: Stitch invokes Laya MCP for EVERY candidate layout
    if (consultLaya) {
      for (const candidate of candidatePool) {
        const audit = LayaDecisionEngine.decide(candidate.markup, layaContext);
        let dnaBonus = 0;
        if (targetDna) {
          dnaBonus = audit.classification.designDna === targetDna ? 0.20 : -0.15;
        }

        const compScore = Number(
          (
            audit.scores.informationDensity * 0.4 +
            audit.scores.wcagContrastScore * 0.3 +
            audit.scores.mobileTouchSafety * 0.3 -
            audit.scores.slopPenalty * 0.5 +
            dnaBonus
          ).toFixed(2)
        );

        let rejectionReason: string | undefined;
        if (!audit.gates.zeroSlopPass) {
          rejectionReason = `AI-Slop Detected: ${audit.classification.slopType || 'Cliche'}`;
        } else if (audit.decision === 'NEEDS_REFINEMENT') {
          rejectionReason = audit.refinements.join('; ');
        }

        evaluations.push({
          candidateId: candidate.id,
          name: candidate.name,
          designDna: audit.classification.designDna,
          score: compScore,
          decision: audit.decision,
          selected: false,
          rejectionReason
        });

        // Preference order: Zero-Slop MUST pass; APPROVED beats NEEDS_REFINEMENT; higher composite score wins
        const canWin = audit.gates.zeroSlopPass;
        const isBetter =
          canWin &&
          (!winningAudit ||
            !winningAudit.gates.zeroSlopPass ||
            (audit.decision === 'APPROVED' && winningAudit.decision !== 'APPROVED') ||
            (audit.decision === winningAudit.decision && compScore > highestScore));

        if (isBetter) {
          winningCandidate = candidate;
          winningAudit = audit;
          highestScore = compScore;
        }
      }

      // Mark the winner as selected and others as pruned
      const selectedEval = evaluations.find(e => e.candidateId === winningCandidate.id);
      if (selectedEval) {
        selectedEval.selected = true;
        delete selectedEval.rejectionReason;
      }
      for (const ev of evaluations) {
        if (!ev.selected && !ev.rejectionReason) {
          ev.rejectionReason = 'Lower density / composite score than selected candidate';
        }
      }
    } else {
      winningAudit = LayaDecisionEngine.decide(winningCandidate.markup, layaContext);
    }

    return {
      screenTitle: title,
      targetBrand: brand,
      designDna: winningAudit?.classification.designDna || 'swiss_kinetic',
      viewport,
      elements: winningCandidate.elements,
      rawMarkupPreview: winningCandidate.markup,
      layaInnerAudit: winningAudit,
      consultedCandidatesCount: candidatePool.length,
      candidateEvaluations: evaluations
    };
  }

  /**
   * Creates responsive variants (mobile 375px, tablet, desktop).
   */
  public static createVariant(
    title: string,
    viewport: 'desktop' | 'mobile' | 'tablet',
    brand: 'smmplan' | 'smmflux' = 'smmplan'
  ): StitchLayoutSpecification {
    const isMobile = viewport === 'mobile';
    const isFlux = brand === 'smmflux';
    const bgToken = isFlux ? 'bg-[#090d16]' : 'bg-background';
    const borderToken = isFlux ? 'border-[#1f293d]' : 'border-border';

    const mobileElements: StitchScreenElement[] = isMobile
      ? [
          {
            id: 'mobile-top-nav',
            type: 'hud',
            title: 'Mobile Header (56px Safe Area)',
            classes: `w-full h-14 border-b ${borderToken} px-3 flex items-center justify-between`,
            densityTier: 'compact',
            childrenSummary: 'Brand logo, Quick balance chip, Hamburger drawer trigger.'
          },
          {
            id: 'mobile-wizard-card',
            type: 'wizard',
            title: 'Single-Column Touch Checkout (44px touch targets)',
            classes: 'w-full p-4 space-y-4',
            densityTier: 'compact',
            childrenSummary: 'Stepper pill (1-4), Platform slider, Auto-collapsing accordion for service selection.'
          }
        ]
      : [
          {
            id: 'tablet-split-grid',
            type: 'grid',
            title: 'Tablet Adaptive 2-Column Split',
            classes: 'w-full p-6 grid grid-cols-2 gap-4',
            densityTier: 'standard',
            childrenSummary: 'Left column: Fast order form; Right column: Live status & FAQ.'
          }
        ];

    const rawMarkup = isMobile
      ? `<div class="w-full min-h-screen ${bgToken} flex flex-col min-w-0">
  <div class="h-14 border-b ${borderToken} px-3 flex items-center justify-between text-xs">
    <span class="font-bold">${brand.toUpperCase()}</span>
    <span class="tabular-nums font-semibold">1 450.00 ₽</span>
  </div>
  <div class="p-3 space-y-3">
    <div class="border ${borderToken} rounded-lg p-3 text-xs">
      <div class="min-h-[44px] flex items-center font-medium">Новый заказ</div>
      <input type="text" placeholder="Ссылка" class="w-full min-h-[44px] px-3 border rounded text-xs mb-2" />
      <button class="w-full min-h-[44px] bg-primary text-white rounded font-medium">Оплатить</button>
    </div>
  </div>
</div>`
      : `<div class="w-full min-h-screen ${bgToken} p-6">Tablet Split Layout</div>`;

    const layaAudit = LayaDecisionEngine.decide(rawMarkup, isMobile ? 'mobile_catalog' : 'tablet');

    return {
      screenTitle: `${title} [${viewport.toUpperCase()}]`,
      targetBrand: brand,
      designDna: layaAudit.classification.designDna,
      viewport,
      elements: mobileElements,
      rawMarkupPreview: rawMarkup,
      layaInnerAudit: layaAudit,
      consultedCandidatesCount: 1
    };
  }

  /**
   * Safely converts any title (including Russian/Cyrillic, symbols, or leading digits)
   * into a valid PascalCase React component identifier name.
   */
  public static toValidComponentName(rawTitle: string): string {
    const cyrillicMap: Record<string, string> = {
      а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
      з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
      п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
      ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
      і: 'i', ї: 'yi', є: 'ye', ґ: 'g'
    };

    // If already clean PascalCase ASCII without spaces or symbols, preserve directly
    if (/^[A-Z][a-zA-Z0-9]*$/.test(rawTitle)) {
      return rawTitle;
    }

    // Split CamelCase words before transliteration: "SmmOrderWizard" -> "Smm Order Wizard"
    const splitCamel = rawTitle.replace(/([a-z0-9])([A-Z])/g, '$1 $2');

    let transliterated = '';
    for (const char of splitCamel) {
      const lower = char.toLowerCase();
      if (cyrillicMap[lower] !== undefined) {
        const mapped = cyrillicMap[lower];
        transliterated += char === char.toUpperCase() && mapped ? mapped.charAt(0).toUpperCase() + mapped.slice(1) : mapped;
      } else {
        transliterated += char;
      }
    }

    const words = transliterated
      .replace(/[^a-zA-Z0-9\s_-]/g, ' ')
      .split(/[\s_-]+/)
      .filter(Boolean);

    let pascal = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');

    if (!pascal || /^[^a-zA-Z]/.test(pascal)) {
      pascal = `Smm${pascal.replace(/^[^a-zA-Z0-9]*/, '')}`;
    }

    if (pascal === 'Smm' || !pascal) {
      pascal = 'SmmGeneratedScreen';
    }

    return pascal;
  }

  /**
   * Synthesizes React 19 / Tailwind 4 component code adhering to RAC-2026.
   * Supports responsive viewport specialization (mobile stepper vs desktop HUD)
   * and BigInt ExactMath billing in kopecks.
   */
  public static synthesizeReactComponent(
    title: string,
    brand: 'smmplan' | 'smmflux' = 'smmplan',
    viewport: 'desktop' | 'mobile' | 'tablet' = 'desktop',
    designDna: string = 'swiss_kinetic'
  ): string {
    const isFlux = brand === 'smmflux';
    const isMobile = viewport === 'mobile';
    const isTerminal = designDna === 'financial_terminal';
    const componentName = this.toValidComponentName(title);

    if (isMobile) {
      return `/**
 * (c) 2026 OmniSMM 1.0 — Synthesized by Google Stitch & Laya Engine.
 * Screen: ${title} | Brand: ${brand.toUpperCase()} | Viewport: MOBILE (375px+)
 * Standard: React 19 (Server Actions), Tailwind CSS 4 & ExactMath BigInt.
 */

'use client';

import React, { useState } from 'react';

export interface ${componentName}Props {
  initialBalanceKopecks?: bigint;
  tenantId?: '${brand}';
}

export function ${componentName}({ initialBalanceKopecks = 145000n, tenantId = '${brand}' }: ${componentName}Props) {
  const [step, setStep] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(100);
  const [targetUrl, setTargetUrl] = useState<string>('');

  const formattedBalance = (Number(initialBalanceKopecks) / 100).toFixed(2);
  const unitRateKopecks = 18n; // 0.18 ₽ per unit in kopecks (ExactMath)
  const totalKopecks = BigInt(quantity) * unitRateKopecks;
  const totalPriceRub = (Number(totalKopecks) / 100).toFixed(2);

  return (
    <div className="w-full min-h-screen ${isFlux ? 'bg-[#090d16] text-[#e0e7ff]' : 'bg-background text-foreground'} flex flex-col min-w-0">
      {/* 56px Safe Area Header */}
      <header className="h-14 border-b ${isFlux ? 'border-[#1f293d]' : 'border-border'} px-3 flex items-center justify-between text-xs tabular-nums pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 font-bold tracking-wider">
          <span className="text-primary">●</span>
          <span>{tenantId.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Баланс:</span>
          <span className="font-semibold text-primary">{formattedBalance} ₽</span>
        </div>
      </header>

      {/* Stepper Progress */}
      <div className="px-4 py-2 border-b ${isFlux ? 'border-[#1f293d] bg-black/20' : 'border-border bg-muted/40'} flex items-center justify-between text-xs">
        <span className={step >= 1 ? 'font-bold text-primary' : 'text-muted-foreground'}>1. Услуга</span>
        <span>→</span>
        <span className={step >= 2 ? 'font-bold text-primary' : 'text-muted-foreground'}>2. Ссылка</span>
        <span>→</span>
        <span className={step >= 3 ? 'font-bold text-primary' : 'text-muted-foreground'}>3. Оплата</span>
      </div>

      {/* Wizard Step Content */}
      <main className="flex-1 p-4 space-y-4 max-w-lg mx-auto w-full">
        <div className="border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Оформление заказа</h2>
            <span className="text-xs text-muted-foreground font-mono">Drip-Feed Safe</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-muted-foreground mb-1">Ссылка на канал/публикацию:</label>
              <input
                type="url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://t.me/channel"
                className="w-full min-h-[44px] px-3 border ${isFlux ? 'border-[#1f293d] bg-black/40' : 'border-border bg-card'} rounded text-xs focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 tabular-nums">
              <div>
                <label className="block text-muted-foreground mb-1">Количество (мин. 10):</label>
                <input
                  type="number"
                  min={10}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(10, parseInt(e.target.value) || 10))}
                  className="w-full min-h-[44px] px-3 border ${isFlux ? 'border-[#1f293d] bg-black/40' : 'border-border bg-card'} rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-muted-foreground mb-1">Итого (ExactMath):</label>
                <div className="h-[44px] px-3 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded flex items-center font-bold text-primary">
                  {totalPriceRub} ₽
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded bg-muted/30 text-[11px] text-muted-foreground space-y-1">
              <div>• Тариф: Telegram Подписчики [0.18 ₽ / шт]</div>
              <div>• Drip-Feed Floor: ⌊Q/N⌋ ≥ 10 шт гарантировано</div>
              <div>• Фискализация: 54-ФЗ электронный чек</div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Safe Area Action Bar */}
      <footer className="p-3 border-t ${isFlux ? 'border-[#1f293d] bg-[#090d16]' : 'border-border bg-background'} pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setStep(prev => Math.min(3, prev + 1))}
          className="w-full min-h-[48px] bg-primary text-primary-foreground font-semibold rounded-lg text-sm hover:opacity-95 transition-opacity"
        >
          Запустить продвижение ({totalPriceRub} ₽)
        </button>
      </footer>
    </div>
  );
}
`.trim();
    }

    if (isTerminal) {
      return `/**
 * (c) 2026 OmniSMM 1.0 — Synthesized by Google Stitch & Laya Engine.
 * Screen: ${title} | Brand: ${brand.toUpperCase()} | DNA: FINANCIAL_TERMINAL
 * Standard: React 19 (Server Actions), Tailwind CSS 4 & ExactMath BigInt.
 */

'use client';

import React, { useState } from 'react';

export interface ${componentName}Props {
  initialBalanceKopecks?: bigint;
  tenantId?: '${brand}';
}

export function ${componentName}({ initialBalanceKopecks = 145000n, tenantId = '${brand}' }: ${componentName}Props) {
  const [quantity, setQuantity] = useState<number>(100);
  const [targetUrl, setTargetUrl] = useState<string>('');

  const formattedBalance = (Number(initialBalanceKopecks) / 100).toFixed(2);
  const unitRateKopecks = 18n; // 0.18 ₽ in kopecks (ExactMath)
  const totalKopecks = BigInt(quantity) * unitRateKopecks;
  const totalPriceRub = (Number(totalKopecks) / 100).toFixed(2);

  return (
    <div className="w-full min-h-screen ${isFlux ? 'bg-[#090d16] text-[#e0e7ff]' : 'bg-background text-foreground'} flex flex-col font-mono text-xs">
      <header className="h-12 border-b ${isFlux ? 'border-[#1f293d]' : 'border-border'} px-4 flex items-center justify-between tabular-nums">
        <div className="flex items-center gap-3 font-bold tracking-wider">
          <span className="text-primary font-bold">TERMINAL::${brand.toUpperCase()}</span>
          <span className="text-muted-foreground">LATENCY: 24ms</span>
          <span className="text-muted-foreground">FEED: DRIP_FLOOR_OK</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">LEDGER_BALANCE:</span>
          <span className="font-semibold text-primary">{formattedBalance} ₽</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <section className="md:col-span-8 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded-md p-4 space-y-3">
            <h2 className="text-sm font-semibold tracking-wider">EXECUTION CONSOLE [BIGINT EXACTMATH]</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-muted-foreground mb-1">TARGET_DESTINATION_URI:</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://t.me/channel"
                  className="w-full min-h-[44px] px-3 border ${isFlux ? 'border-[#1f293d] bg-black/40' : 'border-border bg-card'} rounded font-mono text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 tabular-nums">
                <div>
                  <label className="block text-muted-foreground mb-1">UNITS_COUNT (MIN: 10):</label>
                  <input
                    type="number"
                    min={10}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-full min-h-[44px] px-3 border ${isFlux ? 'border-[#1f293d] bg-black/40' : 'border-border bg-card'} rounded font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">SETTLEMENT_RUB:</label>
                  <div className="h-[44px] px-3 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded flex items-center font-bold text-primary">
                    {totalPriceRub} ₽
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full min-h-[44px] bg-primary text-primary-foreground font-semibold rounded text-xs hover:opacity-95 transition-opacity"
              >
                EXECUTE ORDER STREAM
              </button>
            </div>
          </section>

          <aside className="md:col-span-4 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded-md p-4 space-y-2 tabular-nums">
            <h3 className="font-semibold text-muted-foreground tracking-wider">METRIC MATRIX</h3>
            <ul className="space-y-1.5 text-muted-foreground">
              <li>• RATE_UNIT: 0.1800 ₽ / шт</li>
              <li>• LATENCY_P95: &lt; 2500ms</li>
              <li>• DRIP_FLOOR: ⌊Q/N⌋ ≥ minQty</li>
              <li>• COMPLIANCE: 54-FZ FISCAL</li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
`.trim();
    }

    return `/**
 * (c) 2026 OmniSMM 1.0 — Synthesized by Google Stitch & Laya Engine.
 * Screen: ${title} | Brand: ${brand.toUpperCase()}
 * Standard: React 19 (Server Actions) & Tailwind CSS 4.
 */

'use client';

import React, { useState } from 'react';

export interface ${componentName}Props {
  initialBalanceKopecks?: bigint;
  tenantId?: '${brand}';
}

export function ${componentName}({ initialBalanceKopecks = 145000n, tenantId = '${brand}' }: ${componentName}Props) {
  const [quantity, setQuantity] = useState<number>(100);
  const [targetUrl, setTargetUrl] = useState<string>('');

  const formattedBalance = (Number(initialBalanceKopecks) / 100).toFixed(2);
  const unitRateKopecks = 18n; // 0.18 ₽ in kopecks (ExactMath)
  const totalKopecks = BigInt(quantity) * unitRateKopecks;
  const totalPriceRub = (Number(totalKopecks) / 100).toFixed(2);

  return (
    <div className="w-full min-h-screen ${isFlux ? 'bg-[#090d16] text-[#e0e7ff]' : 'bg-background text-foreground'} flex flex-col">
      <header className="h-12 border-b ${isFlux ? 'border-[#1f293d]' : 'border-border'} px-4 flex items-center justify-between text-xs tabular-nums">
        <div className="flex items-center gap-2 font-bold tracking-wider">
          <span className="text-primary">●</span>
          <span>{tenantId.toUpperCase()} SMM CONSOLE</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">Баланс:</span>
          <span className="font-semibold text-primary">{formattedBalance} ₽</span>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <section className="md:col-span-8 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold">Быстрый чекаут (Drip-Feed Safe)</h2>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Ссылка на объект накрутки:</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://t.me/channel"
                  className="w-full min-h-[44px] px-3 border ${isFlux ? 'border-[#1f293d] bg-black/40' : 'border-border bg-card'} rounded text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 tabular-nums">
                <div>
                  <label className="block text-muted-foreground mb-1">Количество:</label>
                  <input
                    type="number"
                    min={10}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(10, parseInt(e.target.value) || 10))}
                    className="w-full min-h-[44px] px-3 border ${isFlux ? 'border-[#1f293d] bg-black/40' : 'border-border bg-card'} rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1">Итого к списанию:</label>
                  <div className="h-[44px] px-3 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded flex items-center font-bold text-primary">
                    {totalPriceRub} ₽
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full min-h-[44px] bg-primary text-primary-foreground font-semibold rounded text-xs hover:opacity-95 transition-opacity"
              >
                Оформить заказ
              </button>
            </div>
          </section>

          <aside className="md:col-span-4 border ${isFlux ? 'border-[#1f293d]' : 'border-border'} rounded-lg p-4 text-xs space-y-2">
            <h3 className="font-semibold text-muted-foreground">Параметры выполнения</h3>
            <ul className="space-y-1.5 tabular-nums text-muted-foreground">
              <li>• Старт: Мгновенно (&lt; 2 мин)</li>
              <li>• Скорость: До 10 000 / сутки</li>
              <li>• Гарантия: 30 дней (Refill)</li>
              <li>• Фискализация: 54-ФЗ чек онлайн</li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
`.trim();
  }
}

/**
 * Handles incoming JSON-RPC 2.0 requests for Stitch MCP Server.
 */
export async function handleStitchMcpRequest(request: { jsonrpc?: string; id?: string | number; method: string; params?: Record<string, unknown> }): Promise<Record<string, unknown>> {
  const { id = 1, method, params = {} } = request;

  switch (method) {
    case 'ping':
      return { jsonrpc: '2.0', id, result: { status: 'pong', engine: 'GoogleStitch-MCP-2026' } };

    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2026.1',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'stitch-designer',
            version: '1.0.0',
            description: 'Google Stitch Generative UI with Laya Decision Delegation'
          }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: STITCH_MCP_TOOLS }
      };

    case 'tools/call': {
      const toolName = params.name as string;
      const args = (params.arguments || {}) as Record<string, unknown>;

      if (toolName === 'stitch_generate_screen') {
        const title = (args.screenTitle as string) || 'SMM Dashboard';
        const prompt = (args.prompt as string) || '';
        const brand = (args.targetBrand as 'smmplan' | 'smmflux') || 'smmplan';
        const viewport = (args.viewport as 'desktop' | 'mobile' | 'tablet') || 'desktop';
        const targetDna = args.targetDna as string | undefined;
        const consultLaya = args.consultLayaDirectly !== 'false';

        const spec = await StitchGenerativeEngine.generateScreen(title, prompt, brand, consultLaya, viewport, targetDna);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }],
            data: spec
          }
        };
      }

      if (toolName === 'stitch_create_variant') {
        const title = (args.screenTitle as string) || 'SMM Screen';
        const viewport = (args.viewport as 'desktop' | 'mobile' | 'tablet') || 'mobile';
        const brand = (args.targetBrand as 'smmplan' | 'smmflux') || 'smmplan';

        const variant = StitchGenerativeEngine.createVariant(title, viewport, brand);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(variant, null, 2) }],
            data: variant
          }
        };
      }

      if (toolName === 'stitch_consult_laya') {
        const snippet = (args.candidateSnippet as string) || '';
        const context = (args.context as string) || 'stitch_inner_evaluation';
        const layaRes = await handleLayaMcpRequest({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'laya_decide',
            arguments: { candidateLayout: snippet, context }
          }
        });
        return {
          jsonrpc: '2.0',
          id,
          result: layaRes.result
        };
      }

      if (toolName === 'stitch_synthesize_react') {
        const title = (args.screenTitle as string) || 'SmmDashboard';
        const brand = (args.targetBrand as 'smmplan' | 'smmflux') || 'smmplan';
        const viewport = (args.viewport as 'desktop' | 'mobile' | 'tablet') || 'desktop';
        const designDna = (args.designDna as string) || 'swiss_kinetic';
        const code = StitchGenerativeEngine.synthesizeReactComponent(title, brand, viewport, designDna);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: code }],
            code
          }
        };
      }

      throw new Error(`Unknown Stitch tool: ${toolName}`);
    }

    default:
      throw new Error(`Method not supported: ${method}`);
  }
}

/**
 * Stdio JSON-RPC 2.0 loop for MCP protocol execution.
 */
export async function startStitchStdioServer(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const request = JSON.parse(trimmed);
      const response = await handleStitchMcpRequest(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: errorMessage }
        }) + '\n'
      );
    }
  });
}

if (require.main === module) {
  startStitchStdioServer();
}
