/**
 * Dual Agent Protocol Orchestrator (Maker vs Checker)
 * Standard: 2026 Autonomous AI Architecture with Epistemic Isolation
 * 
 * Roles:
 * - Maker: Full write tools, TDD loop, internal Laya System 1 gate (15-35ms)
 * - Checker: Strictly READ-ONLY, Clean Slate context, 5-Vector Veto Matrix
 */

import { LayaClient, LayaDecisionPayload, laya } from '../laya/laya-client.js';

export interface VetoVectorResult {
  vector: number;
  name: string;
  pass: boolean;
  severity: 'INFO' | 'WARNING' | 'MAJOR' | 'BLOCKER';
  details: string[];
}

export interface CheckerScorecard {
  verdict: 'APPROVE' | 'REJECT';
  vectors: VetoVectorResult[];
  blockerCount: number;
  majorCount: number;
  layaPayload?: LayaDecisionPayload;
  summary: string;
}

export interface MakerCandidatePayload {
  taskSpec: string;
  codeDiff: string;
  layoutCode?: string;
  testReport?: string;
  knownAntiPatterns?: string[];
}

export interface DualAgentHandoffPackage {
  makerSessionId: string;
  timestamp: string;
  makerRefinementCycles: number;
  preflightLayaVerdict: string;
  candidate: MakerCandidatePayload;
  scorecard?: CheckerScorecard;
}

export class MakerAgent {
  public readonly canWrite = true;
  private readonly client: LayaClient;

  constructor(client: LayaClient = laya) {
    this.client = client;
  }

  /**
   * Maker выполняет быструю генерацию и внутреннюю калибровку через Laya (System 1)
   */
  public async produceCandidate(
    spec: string,
    initialLayout: string,
    knownAntiPatterns: string[] = []
  ): Promise<{ layout: string; cycles: number; layaDecision: LayaDecisionPayload }> {
    let currentLayout = initialLayout;
    let cycles = 0;
    const maxCycles = 3;

    // Инъекция известных анти-паттернов в контекст Maker'а
    if (knownAntiPatterns.length > 0) {
      // Maker знает известные анти-паттерны и избегает их
      for (const pattern of knownAntiPatterns) {
        if (pattern.includes('44px') && (currentLayout.includes('h-6 w-6') || currentLayout.includes('p-1'))) {
          currentLayout = currentLayout.replace(/h-[6-8] w-[6-8]/g, 'min-h-[44px] min-w-[44px]');
        }
      }
    }

    let decision = await this.client.decide(currentLayout);

    while ((decision.decision === 'NEEDS_REFINEMENT' || decision.decision === 'REJECTED') && cycles < maxCycles) {
      cycles++;
      currentLayout = this.healLayout(currentLayout, decision);
      decision = await this.client.decide(currentLayout);
    }

    return {
      layout: currentLayout,
      cycles,
      layaDecision: decision
    };
  }

  /**
   * Внутренний авто-хилер верстки Maker'а на основе рекомендаций Laya
   */
  private healLayout(layout: string, decision: LayaDecisionPayload): string {
    let healed = layout;

    // Устранение Purple Neon
    healed = healed
      .replace(/#8b5cf6|#a855f7|purple-[56]00|violet-[56]00/gi, '#2563eb')
      .replace(/shadow-purple|shadow-violet/gi, 'shadow-sm')
      .replace(/bg-black|bg-slate-950|bg-zinc-950/gi, 'bg-background');

    // Устранение мелких тач-таргетов
    if (decision.refinements.some(r => r.includes('TOUCH_TARGET_VIOLATION') || r.includes('44x44px'))) {
      healed = healed
        .replace(/p-1(?=\s|")/g, 'p-2.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center')
        .replace(/h-[6-8] w-[6-8](?=\s|")/g, 'min-h-[44px] min-w-[44px] inline-flex items-center justify-center');
    }

    // Устранение Bento Emoji
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    healed = healed.replace(emojiRegex, '');

    // Устранение пульсирующих пилюль
    healed = healed.replace(/rounded-full animate-pulse/g, 'rounded-md');

    // Устранение градиентного текста (gradient keywords)
    healed = healed
      .replace(/bg-clip-text text-transparent bg-gradient-to-r[^\"]*/gi, 'text-muted-foreground')
      .replace(/bg-clip-text/gi, '')
      .replace(/text-transparent/gi, '')
      .replace(/bg-gradient-to-[a-z]+/gi, '');

    // Повышение информационной плотности (High Density Standard)
    if (healed.includes('py-24') || healed.includes('py-32')) {
      healed = healed.replace(/py-24|py-32/g, 'py-8');
    }

    if (!healed.includes('text-sm') && !healed.includes('text-xs')) {
      healed = healed.replace(/text-4xl/g, 'text-base font-semibold');
      healed += '\n<span className="text-xs text-muted-foreground tabular-nums">v1.0</span>';
    }

    return healed;
  }
}

export class CheckerAgent {
  // Жесткий архитектурный инвариант: Ревизор СТРОГО READ-ONLY!
  public readonly canWrite = false;
  private readonly client: LayaClient;

  constructor(client: LayaClient = laya) {
    this.client = client;
  }

  /**
   * Безопасная проверка: Ревизору запрещено вызывать любые инструменты записи
   */
  public assertReadOnly(): void {
    if (this.canWrite) {
      throw new Error('[CRITICAL_INVARIANT_VIOLATION] Checker agent MUST be strictly read-only!');
    }
  }

  /**
   * Сквозной аудит кандидата по 5-векторной матрице вето
   */
  public async reviewHandoff(handoff: DualAgentHandoffPackage): Promise<CheckerScorecard> {
    this.assertReadOnly();

    const vectors: VetoVectorResult[] = [];
    const diff = handoff.candidate.codeDiff || '';
    const layout = handoff.candidate.layoutCode || '';

    // Вектор 1: Спецификация и контракты типов (Spec & Zod DTO)
    const v1Details: string[] = [];
    let v1Pass = true;
    if (diff.includes(': any') || diff.includes('as any')) {
      v1Pass = false;
      v1Details.push('Обнаружены запрещенные типы `any`. Требуется строгая типизация.');
    }
    vectors.push({
      vector: 1,
      name: 'Spec & Contract Integrity',
      pass: v1Pass,
      severity: v1Pass ? 'INFO' : 'BLOCKER',
      details: v1Details
    });

    // Вектор 2: Целостность данных и отсутствие гонок (TOCTOU, Data Integrity)
    const v2Details: string[] = [];
    let v2Pass = true;
    if (diff.includes('findFirst') && diff.includes('update') && !diff.includes('transaction') && !diff.includes('idempotencyKey')) {
      v2Pass = false;
      v2Details.push('Потенциальная уязвимость TOCTOU (findFirst без транзакции или блокировки).');
    }
    vectors.push({
      vector: 2,
      name: 'Data & State Integrity',
      pass: v2Pass,
      severity: v2Pass ? 'INFO' : 'MAJOR',
      details: v2Details
    });

    // Вектор 3: Безопасность и отсутствие секретов (Security & Pentest)
    const v3Details: string[] = [];
    let v3Pass = true;
    const secretRegex = /(?:api[_-]?key|secret|password|bearer|jwt)\s*[:=]\s*['"][a-zA-Z0-9_\-.]{16,}['"]/i;
    if (secretRegex.test(diff)) {
      v3Pass = false;
      v3Details.push('Обнаружена утечка жестко зашитого секрета в коде diff.');
    }
    vectors.push({
      vector: 3,
      name: 'Security & Pentest Immunity',
      pass: v3Pass,
      severity: v3Pass ? 'INFO' : 'BLOCKER',
      details: v3Details
    });

    // Вектор 4: Чистота кода и анти-костыли (Code Hygiene & Anti-Crutch)
    const v4Details: string[] = [];
    let v4Pass = true;
    if (diff.includes('// TODO') || diff.includes('// FIXME') || diff.includes('@ts-ignore')) {
      v4Pass = false;
      v4Details.push('Обнаружены маркеры технического долга (// TODO, // FIXME, @ts-ignore).');
    }
    vectors.push({
      vector: 4,
      name: 'Code Hygiene & Anti-Crutch',
      pass: v4Pass,
      severity: v4Pass ? 'INFO' : 'MAJOR',
      details: v4Details
    });

    // Вектор 5: UI/UX & Доступность (Laya Decision Engine Gate)
    const v5Details: string[] = [];
    let v5Pass = true;
    let layaPayload: LayaDecisionPayload | undefined;

    if (layout) {
      layaPayload = await this.client.decide(layout);
      if (layaPayload.decision === 'REJECTED') {
        v5Pass = false;
        v5Details.push(`Laya REJECTED: ${layaPayload.refinements.join('; ')}`);
      } else if (layaPayload.decision === 'NEEDS_REFINEMENT') {
        v5Pass = false;
        v5Details.push(`Laya NEEDS_REFINEMENT: ${layaPayload.refinements.join('; ')}`);
      }
    }

    vectors.push({
      vector: 5,
      name: 'UI/UX Accessibility & Laya Gate',
      pass: v5Pass,
      severity: v5Pass ? 'INFO' : 'BLOCKER',
      details: v5Details
    });

    const blockerCount = vectors.filter(v => !v.pass && v.severity === 'BLOCKER').length;
    const majorCount = vectors.filter(v => !v.pass && v.severity === 'MAJOR').length;

    const verdict = (blockerCount === 0 && majorCount === 0) ? 'APPROVE' : 'REJECT';
    const summary = verdict === 'APPROVE'
      ? '✅ Все 5 векторов вето пройдены успешно. Кандидат допущен к релизу.'
      : `❌ ВЕТО РЕВИЗОРА: Обнаружено ${blockerCount} BLOCKER и ${majorCount} MAJOR замечаний. Возврат Maker'у.`;

    return {
      verdict,
      vectors,
      blockerCount,
      majorCount,
      layaPayload,
      summary
    };
  }
}

export class MakerCheckerOrchestrator {
  private readonly maker: MakerAgent;
  private readonly checker: CheckerAgent;

  constructor(client: LayaClient = laya) {
    this.maker = new MakerAgent(client);
    this.checker = new CheckerAgent(client);
  }

  public async executePipeline(
    taskSpec: string,
    initialLayout: string,
    codeDiff: string,
    knownAntiPatterns: string[] = []
  ): Promise<{
    handoff: DualAgentHandoffPackage;
    scorecard: CheckerScorecard;
  }> {
    // 1. Maker фаза: создание и предварительная калибровка
    const makerResult = await this.maker.produceCandidate(taskSpec, initialLayout, knownAntiPatterns);

    // 2. Формирование Handoff пакета для изолированного Ревизора
    const handoff: DualAgentHandoffPackage = {
      makerSessionId: `maker-${Date.now()}`,
      timestamp: new Date().toISOString(),
      makerRefinementCycles: makerResult.cycles,
      preflightLayaVerdict: makerResult.layaDecision.decision,
      candidate: {
        taskSpec,
        codeDiff,
        layoutCode: makerResult.layout,
        knownAntiPatterns
      }
    };

    // 3. Checker фаза: независимый строгий аудит в Read-Only изоляции
    const scorecard = await this.checker.reviewHandoff(handoff);
    handoff.scorecard = scorecard;

    return { handoff, scorecard };
  }
}
