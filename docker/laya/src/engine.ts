// docker/laya/src/engine.ts
// Laya System 1 Decision Engine: Non-Autoregressive Control-Flow Decision Engine (RAC-2026)

import {
  DesignDnaType,
  SlopClicheType,
  LayaDecisionScores,
  LayaClassificationResult,
  LayaGates,
  LayaDecisionPayload,
  DecisionChoiceRequest,
  DecisionChoiceResponse,
  DecisionScoreRequest,
  DecisionScoreResponse,
  DecisionNoulRequest,
  DecisionNoulResponse,
  OrderRoutingRequest,
  OrderRoutingResponse,
  ActionArbitrationRequest,
  ActionArbitrationResponse,
  DialecticalArbitrationRequest,
  DialecticalVerdict,
  DialecticalCandidateRole
} from './types.js';

export class LayaEngine {
  public static readonly VERSION = 'laya-system1-v1.0.0-rac2026';

  // ==========================================================================
  // 1. PRIMITIVE: CHOICE (Non-AR Selection from N candidates)
  // ==========================================================================
  public static decideChoice(req: DecisionChoiceRequest): DecisionChoiceResponse {
    const startTime = Date.now();
    const context = (req.context + ' ' + req.instruction).toLowerCase();
    const distribution: Record<string, number> = {};

    let totalWeight = 0;
    const weights: Array<{ id: string; weight: number }> = [];

    for (const opt of req.options) {
      let weight = 1.0;
      const label = opt.label.toLowerCase();
      const id = opt.id.toLowerCase();

      // Семантический матч ключевых токенов
      const tokens = (label + ' ' + id).split(/[\s_-]+/);
      for (const t of tokens) {
        if (t.length > 2 && context.includes(t)) {
          weight += 2.0;
        }
      }

      // Приоритеты встроенных роботов и низкой стоимости
      if (id.includes('in_house') || id.includes('mtproto') || id.includes('zero_cost')) {
        weight += 2.5;
      }
      if (id.includes('safe') || id.includes('clean') || id.includes('fast')) {
        weight += 1.5;
      }
      if (id.includes('destructive') || id.includes('risky') || id.includes('deprecated')) {
        weight = Math.max(0.1, weight - 2.0);
      }

      // BUG-004 FIX: семантические веса по контексту тикета/ситуации
      const ctx = req.context.toLowerCase();
      const urgencySignals = ['третий раз', 'третий', '3 раза', 'жалоб', 'роспотреб', 'суд', 'мвд', 'банк'];
      const isUrgent = urgencySignals.some(kw => ctx.includes(kw));

      const retrySignals = ['завис', 'не пришл', 'не выполн', 'жду', 'где заказ'];
      const wantsRetry = retrySignals.some(kw => ctx.includes(kw));

      const moneySignals = ['верните деньги', 'верн', 'возврат', 'чарджбэк', 'списал'];
      const wantsRefund = moneySignals.some(kw => ctx.includes(kw));

      if (isUrgent && wantsRetry) {
        // Комбо: угроза жалобой + зависший заказ → escalate_manual абсолютный приоритет
        if (id.includes('escalate') || id.includes('manual')) weight += 8.0;
        if (id.includes('retry') && id.includes('bonus')) weight += 2.0;
        if (id === 'refund') weight += 0.8;
        if (id.includes('partial')) weight += 0.5;
      } else if (isUrgent) {
        // Только угроза (без зависания) → refund >> escalate
        if (id === 'refund') weight += 4.0;
        if (id.includes('escalate') || id.includes('manual')) weight += 2.5;
        if (id.includes('retry') && id.includes('bonus')) weight += 1.5;
        if (id.includes('partial')) weight += 1.0;
      } else if (wantsRetry) {
        // Только зависший заказ → retry_bonus предпочтителен
        if (id.includes('retry')) weight += 3.5;
        if (id === 'refund') weight -= 0.5;
      }

      if (wantsRefund && !isUrgent) {
        if (id === 'refund') weight += 3.0;
        if (id.includes('partial')) weight += 1.0;
        if (id.includes('retry')) weight -= 0.5;
      }

      weights.push({ id: opt.id, weight });
      totalWeight += weight;
    }

    // Нормализация в Softmax-подобное распределение
    let bestId = req.options[0].id;
    let maxProb = 0;
    let entropy = 0;

    for (const w of weights) {
      const prob = Number((w.weight / totalWeight).toFixed(4));
      distribution[w.id] = prob;
      if (prob > maxProb) {
        maxProb = prob;
        bestId = w.id;
      }
      if (prob > 0) {
        entropy -= prob * Math.log2(prob);
      }
    }

    const latencyMs = Math.max(1, Date.now() - startTime);

    return {
      selectedId: bestId,
      confidence: Number(maxProb.toFixed(2)),
      distribution,
      entropy: Number(entropy.toFixed(3)),
      latencyMs,
      engineVersion: this.VERSION,
    };
  }

  // ==========================================================================
  // 2. PRIMITIVE: SCORE (Scalar Continuous Risk / Metric Scoring [0.0..1.0])
  // ==========================================================================
  public static decideScore(req: DecisionScoreRequest): DecisionScoreResponse {
    const startTime = Date.now();
    const context = req.context.toLowerCase();
    const evidenceText = (req.evidence ?? []).join(' ').toLowerCase();
    let score = 0.05;

    switch (req.metricName) {
      case 'FRAUD_RISK': {
        // Контекстные сигналы
        if (context.includes('free-money') || context.includes('cheat') || context.includes('hack')) score += 0.50;
        if (context.includes('.xyz') || context.includes('.top') || context.includes('.click')) score += 0.35;
        if (context.includes('http://') && !context.includes('https://')) score += 0.20;
        if (context.includes('t.me/') || context.includes('vk.com/')) score -= 0.05;
        // Evidence-сигналы (BUG-001 FIX): весовая модель по evidence array
        const evidenceWeights: Array<[string, number]> = [
          ['создан 1 д', 0.25], ['создан 2 д', 0.20], ['создан 3 д', 0.15],
          ['аккаунт создан', 0.20],
          ['крипт', 0.25], ['анонимн', 0.20],
          ['инвайт', 0.20], ['закрыт', 0.15],
          ['нетипичн', 0.20], ['ip из', 0.15],
          ['аномальн', 0.25], ['50000', 0.20], ['100000', 0.30],
          ['реселл', 0.30], ['фрод', 0.40],
          ['жалоб', 0.15], ['блокировк', 0.15],
        ];
        for (const [kw, w] of evidenceWeights) {
          if (evidenceText.includes(kw) || context.includes(kw)) score += w;
        }
        break;
      }
      case 'LINK_SAFETY': {
        score = 0.90;
        if (context.includes('malware') || context.includes('phishing')) score -= 0.70;
        if (context.includes('bit.ly') || context.includes('tinyurl')) score -= 0.25;
        break;
      }
      case 'TICKET_URGENCY': {
        score = 0.20;
        if (context.includes('чарджбэк') || context.includes('банк') || context.includes('суд') || context.includes('мвд')) score += 0.70;
        if (context.includes('не пришло') || context.includes('где заказ') || context.includes('завис')) score += 0.40;
        if (context.includes('спасибо') || context.includes('как дела')) score = 0.05;
        break;
      }
      case 'CODE_SLOP_RISK': {
        const slop = this.detectSlop(req.context);
        score = slop.penalty;
        break;
      }
      case 'PROVIDER_RELIABILITY': {
        score = 0.85;
        if (context.includes('error') || context.includes('timeout') || context.includes('502')) score -= 0.40;
        if (context.includes('latency > 5000')) score -= 0.30;
        break;
      }
    }

    score = Math.min(1.0, Math.max(0.0, Number(score.toFixed(2))));
    const latencyMs = Math.max(1, Date.now() - startTime);

    return {
      metricName: req.metricName,
      score,
      isCriticalThresholdExceeded: score >= 0.75,
      latencyMs,
    };
  }

  // ==========================================================================
  // 3. PRIMITIVE: NOUL (Non-Autoregressive Unconditional Logic / Binary Gate)
  // ==========================================================================
  public static decideNoul(req: DecisionNoulRequest): DecisionNoulResponse {
    const startTime = Date.now();
    const prop = req.proposition.toLowerCase();
    const ctx = req.context.toLowerCase();
    const riskWeight = req.riskWeight ?? 1.0;

    let probYes = 0.50;

    // Оценка логического соответствия
    const affirmativeKeywords = ['safe', 'valid', 'pass', 'clean', 'approved', 'безопасен', 'подтвержден'];
    const negativeKeywords = ['risk', 'danger', 'fail', 'slop', 'corrupt', 'опасно', 'сбой', 'блокировка'];

    for (const kw of affirmativeKeywords) {
      if (prop.includes(kw) && ctx.includes(kw)) probYes += 0.20;
    }
    for (const kw of negativeKeywords) {
      if (prop.includes(kw) || ctx.includes(kw)) probYes -= 0.25;
    }

    probYes = Math.min(1.0, Math.max(0.0, Number(probYes.toFixed(2))));
    const threshold = Math.min(0.90, Math.max(0.50, 0.65 * riskWeight));
    const verdict = probYes >= threshold;
    // BUG-002 FIX: isUncertain = true когда probYes вблизи 0.5 (макс. энтропия), а не вблизи threshold
    const isUncertain = Math.abs(probYes - 0.5) < 0.12;
    const latencyMs = Math.max(1, Date.now() - startTime);

    return {
      verdict,
      probabilityYes: probYes,
      riskAdjustedThreshold: Number(threshold.toFixed(2)),
      isUncertain,
      latencyMs,
    };
  }

  // ==========================================================================
  // 4. DOMAIN: ORDER ROUTING GATEWAY (InHouse vs External Provider)
  // ==========================================================================
  public static decideRouteOrder(req: OrderRoutingRequest): OrderRoutingResponse {
    const startTime = Date.now();

    // 1. Если внутренний пул свободен и маржа 100% -> направляем во внутренний MTProto пул
    if (req.inHouseAvailable && req.inHouseUnitCostRub <= 0.05) {
      return {
        orderId: req.orderId,
        destinationType: 'IN_HOUSE_PRODUCTION',
        selectedTargetId: 'in_house_mtproto',
        confidence: 0.98,
        estimatedMarginPercent: 100.0,
        routingReason: 'Внутренний пул Tier-0 роботов свободен с себестоимостью 0 ₽',
        latencyMs: Math.max(1, Date.now() - startTime),
      };
    }

    // 2. Арбитраж: если In-House доступен — используем его с приоритетом, даже если inHouseUnitCostRub > 0.05
    const inHouseCandidate = req.candidates?.find(
      (c) => c.providerId === 'inhouse_mtproto' || c.providerId === 'in_house_mtproto'
    );

    if (req.inHouseAvailable && inHouseCandidate) {
      const reliability = typeof inHouseCandidate.reliabilityScore === 'number'
        ? Math.round(inHouseCandidate.reliabilityScore * 100)
        : 91;
      const cost = inHouseCandidate.unitCostRub ?? req.inHouseUnitCostRub ?? 0;
      const marginPct = cost > 0
        ? Math.round((1 - cost / 0.45) * 100)
        : 100;
      return {
        orderId: req.orderId,
        destinationType: 'IN_HOUSE_MTPROTO',
        selectedTargetId: inHouseCandidate.providerId,
        confidence: 0.95,
        estimatedMarginPercent: marginPct,
        routingReason: `InHouse MTProto выбран приоритетно: надёжность ${reliability}%, себестоимость ${cost} ₽/шт`,
        latencyMs: Math.max(1, Date.now() - startTime),
      };
    }

    if (!req.candidates || req.candidates.length === 0) {
      return {
        orderId: req.orderId,
        destinationType: 'MANUAL_REVIEW',
        selectedTargetId: 'none',
        confidence: 0.20,
        estimatedMarginPercent: 0,
        routingReason: 'Нет доступных кандидатов провайдеров',
        latencyMs: Math.max(1, Date.now() - startTime),
      };
    }

    // Скоринг внешних провайдеров — поддержка обоих форматов полей
    let bestCandidate = req.candidates[0];
    let highestScore = -Infinity;

    for (const c of req.candidates) {
      const successRate = c.reliabilityScore ?? c.historicalSuccessRate ?? 0.80;
      const cost = c.unitCostRub ?? c.costRub ?? 0.45;
      const errors = c.activeErrorsLastHour ?? 0;
      const sovereign = c.isSovereign !== false ? 0.10 : 0;
      const score = (successRate * 0.5) - (cost * 0.2) - (errors * 8) + sovereign;
      if (score > highestScore) {
        highestScore = score;
        bestCandidate = c;
      }
    }

    const bestReliability = bestCandidate.reliabilityScore ?? bestCandidate.historicalSuccessRate ?? 0.80;
    const bestCost = bestCandidate.unitCostRub ?? bestCandidate.costRub ?? 0.45;
    const bestErrors = bestCandidate.activeErrorsLastHour ?? 0;
    const bestMargin = bestCost > 0 ? Math.round((1 - bestCost / 0.50) * 100) : 0;

    return {
      orderId: req.orderId,
      destinationType: 'EXTERNAL_WHOLESALE',
      selectedTargetId: bestCandidate.providerId,
      confidence: Number(Math.min(0.95, 0.60 + bestReliability * 0.35).toFixed(2)),
      estimatedMarginPercent: Math.max(0, bestMargin),
      routingReason: `Выбран ${bestCandidate.providerName ?? bestCandidate.providerId}: надёжность ${Math.round(bestReliability * 100)}%, цена ${bestCost} ₽/шт, ошибок: ${bestErrors}`,
      latencyMs: Math.max(1, Date.now() - startTime),
    };
  }

  // ==========================================================================
  // 5. AUTONOMOUS ACTION ARBITRATION (AAA-2026 Protocol)
  // ==========================================================================
  public static decideActionArbitration(req: ActionArbitrationRequest): ActionArbitrationResponse {
    const startTime = Date.now();

    // Запрет несанкционированных деструктивных операций без отката в проде
    if (req.environment === 'PRODUCTION' && req.isDestructive && !req.hasRollbackPlan) {
      return {
        actionId: req.actionId,
        verdict: 'ESCALATE_TO_HUMAN',
        confidenceScore: 0.99,
        rationale: 'Деструктивная операция в PRODUCTION без плана отката требует явного подтверждения человека (BGS-2026)',
        latencyMs: Math.max(1, Date.now() - startTime),
        tokenCost: 0,
      };
    }

    // Защита финансового леджера
    if (req.touchesFinancialLedger && req.isDestructive) {
      return {
        actionId: req.actionId,
        verdict: 'REJECT',
        confidenceScore: 1.0,
        rationale: 'Прямая деструктивная модификация финансового леджера строго запрещена (Ledger-First Invariant)',
        latencyMs: Math.max(1, Date.now() - startTime),
        tokenCost: 0,
      };
    }

    // Если операция безопасная, локальная и имеет малый радиус
    if (!req.isDestructive && req.hasRollbackPlan && req.estimatedImpactFiles <= 3) {
      return {
        actionId: req.actionId,
        verdict: 'PROCEED',
        confidenceScore: 0.96,
        rationale: 'Безопасное атомарное изменение с планом отката и минимальным радиусом поражения одобрено',
        latencyMs: Math.max(1, Date.now() - startTime),
        tokenCost: 0,
      };
    }

    return {
      actionId: req.actionId,
      verdict: 'REDIRECT_SAFE',
      confidenceScore: 0.88,
      rationale: 'Перенаправлено на безопасный путь с изоляцией изменений',
      latencyMs: Math.max(1, Date.now() - startTime),
      tokenCost: 0,
    };
  }

  // ==========================================================================
  // 6. DIALECTICAL SELF-LOOP IMPROVING ARBITER (Anti-Mediocrity Barrier)
  // ==========================================================================
  public static decideDialecticalSynthesis(req: DialecticalArbitrationRequest): DialecticalVerdict {
    const startTime = Date.now();
    const violations: Record<string, string[]> = {};

    let alphaRisk = 0.50;
    let betaRisk = 0.30;
    let gammaRisk = 0.15;

    let hasGamma = false;
    let winningRole: DialecticalCandidateRole = 'BETA_CONSERVATIVE';

    for (const c of req.candidates) {
      violations[c.role] = [];

      if (c.role === 'ALPHA_RADICAL') {
        if (c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL') {
          alphaRisk += 0.30;
          violations[c.role].push('Высокий риск архитектурной нестабильности и оверхеда');
        }
        if (c.estimatedBlastRadius > 5) {
          alphaRisk += 0.15;
          violations[c.role].push(`Чрезмерный радиус поражения (${c.estimatedBlastRadius} модулей)`);
        }
      }

      if (c.role === 'BETA_CONSERVATIVE') {
        if (c.cons.some(con => con.toLowerCase().includes('предел') || con.toLowerCase().includes('медленн'))) {
          betaRisk += 0.20;
          violations[c.role].push('Консервативный предел производительности при пиковых нагрузках');
        }
      }

      if (c.role === 'GAMMA_SYNTHESIS') {
        hasGamma = true;
        if (c.estimatedBlastRadius <= 4 && c.riskLevel !== 'CRITICAL') {
          gammaRisk = 0.10;
        } else {
          gammaRisk = 0.35;
        }
      }
    }

    alphaRisk = Math.min(1.0, Number(alphaRisk.toFixed(2)));
    betaRisk = Math.min(1.0, Number(betaRisk.toFixed(2)));
    gammaRisk = Math.min(1.0, Number(gammaRisk.toFixed(2)));

    // Синтез Gamma побеждает, если снимает противоречие и имеет минимальный риск
    let rationale = '';
    if (hasGamma && gammaRisk < betaRisk && gammaRisk < alphaRisk) {
      winningRole = 'GAMMA_SYNTHESIS';
      rationale = 'Синтез GAMMA снимает системное противоречие между Alpha и Beta, обеспечивая надежность без оверхеда';
    } else if (betaRisk <= alphaRisk) {
      winningRole = 'BETA_CONSERVATIVE';
      rationale = 'Выбран консервативный вариант Beta с гарантией Zero-Overhead и отказоустойчивостью';
    } else {
      winningRole = 'ALPHA_RADICAL';
      rationale = 'Одобрен смелый вариант Alpha с максимальной производительностью';
    }

    const latencyMs = Math.max(1, Date.now() - startTime);

    return {
      taskId: req.taskId,
      winningRole,
      confidenceScore: winningRole === 'GAMMA_SYNTHESIS' ? 0.98 : 0.89,
      invariantViolations: violations,
      riskAssessment: {
        alphaRiskScore: alphaRisk,
        betaRiskScore: betaRisk,
        gammaRiskScore: hasGamma ? gammaRisk : undefined,
      },
      rationale,
      recommendedAction: 'EXECUTE_IMMEDIATELY',
      latencyMs,
    };
  }

  // ==========================================================================
  // 7. LEGACY UI / SLOP DETECTION METHODS (Preserved for compatibility)
  // ==========================================================================
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

    // 3. Пульсирующие пилюли
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

    let density = 0.50;
    if (text.includes('text-xs') || text.includes('text-sm')) density += 0.20;
    if (text.includes('tabular-nums')) density += 0.15;
    if (text.includes('px-2 py-1') || text.includes('p-2') || text.includes('gap-2')) density += 0.10;
    if (text.includes('h-screen') || text.includes('py-24') || text.includes('py-32')) density -= 0.30;
    density = Math.min(1.0, Math.max(0.0, density - slop.penalty * 0.3));

    let hierarchy = 0.60;
    if (text.includes('font-semibold') || text.includes('font-medium')) hierarchy += 0.15;
    if (text.includes('text-muted-foreground') || text.includes('text-secondary')) hierarchy += 0.15;
    hierarchy = Math.min(1.0, Math.max(0.0, hierarchy - slop.penalty * 0.2));

    let wcag = 0.85;
    if (text.includes('text-gray-400') && (text.includes('bg-white') || text.includes('bg-gray-100'))) wcag -= 0.40;
    if (text.includes('text-zinc-600') && text.includes('bg-zinc-900')) wcag -= 0.35;
    if (text.includes('border-border') || text.includes('text-foreground')) wcag += 0.10;
    wcag = Math.min(1.0, Math.max(0.0, wcag));

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
