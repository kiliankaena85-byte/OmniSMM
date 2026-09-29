/**
 * creativity-catalyst.ts
 * Катализатор креативности и расширения пространства решений (Solution Space Expander).
 * 
 * Позволяет даже самым дешевым и легковесным генеративным моделям (Gemini Flash, DeepSeek, GPT-4o-mini)
 * выходить из локальных минимумов поверхностных заплаток и находить архитектурные решения Senior-уровня
 * через метод трех ортогональных парадигм (Диалектика Гегеля + ТРИЗ в ПО).
 */

import { ActionCategory, ActionOption } from './types';

export interface DialecticalChallenge {
  promptTemplate: string;
  creativeVectors: string[];
  diversityScore: number;
}

export class CreativityCatalyst {
  /**
   * Генерирует диалектический промпт для генеративной модели,
   * требуя 3 фундаментально разных инженерных парадигмы.
   */
  public static generateDialecticalBrief(intent: string, category: ActionCategory): string {
    return [
      `🎯 ЦЕЛЬ: "${intent}" (Категория: ${category})`,
      '',
      '⚠️ ТРЕБОВАНИЕ КРЕАТИВНОСТИ И РАЗНООБРАЗИЯ РЕШЕНИЙ (TRIAD DIVERGENCE):',
      'Запрещено предлагать поверхностные косметические заплатки или 3 вариации одного и того же if-else.',
      'Вы обязаны спроектировать ровно 3 варианта реализации из трех взаимно перпендикулярных парадигм:',
      '',
      '1. [ПАРАДИГМА: CONSERVATIVE (Тезис)]:',
      '   - Минимальный радиус поражения, 100% обратная совместимость.',
      '   - Проверенное стандартное решение без внедрения новых сущностей.',
      '',
      '2. [ПАРАДИГМА: RADICAL_CLEAN (Антитезис)]:',
      '   - Clean Architecture / DDD инвариант.',
      '   - Полная изоляция через интерфейс, фабрику или Transactional Outbox.',
      '   - Защита от регрессий на системном уровне.',
      '',
      '3. [ПАРАДИГМА: INVERSION_TRIZ (Синтез / Out-of-the-Box)]:',
      '   - Инвертируйте проблему: почему этот дефект вообще возможен?',
      '   - Устраните саму первопричину: сделайте ошибку невозможной физически (на уровне типов TypeScript, Zod брендинга, атомарного CAS или детерминированного jobId).',
      '',
      'Для каждого варианта укажите: riskLevel (LOW/MEDIUM/HIGH), touchesFinancialLedger, touchesAuthOrSecrets, estimatedImpactFiles, qualityScore (0-100).'
    ].join('\n');
  }

  /**
   * Вычисляет индекс разнообразия пула решений (Solution Diversity Index — 0.0 до 1.0).
   * Если все варианты просто повторяют один подход, разнообразие низкое.
   */
  public static calculateDiversity(options: ActionOption[]): number {
    if (options.length <= 1) return 0.0;

    let score = 0;
    
    // 1. Разнообразие парадигм
    const paradigms = new Set(options.map(o => o.paradigm).filter(Boolean));
    if (paradigms.size >= 3) score += 0.5;
    else if (paradigms.size === 2) score += 0.3;
    else score += 0.1;

    // 2. Разброс по объему воздействия (файлам)
    const fileImpacts = options.map(o => o.estimatedImpactFiles);
    const minImpact = Math.min(...fileImpacts);
    const maxImpact = Math.max(...fileImpacts);
    if (maxImpact > minImpact) score += 0.25;

    // 3. Текстовое разнообразие названий и описаний
    const titles = options.map(o => o.title.toLowerCase());
    const isDistinctTitles = new Set(titles).size === titles.length;
    if (isDistinctTitles) score += 0.25;

    return Math.min(1.0, score);
  }

  /**
   * Генерирует направляющие векторы мышления (Epistemic Thought Anchors)
   * в зависимости от категории и контекста проблемы.
   */
  public static generateEpistemicVectors(intent: string, category: ActionCategory): string[] {
    const general = [
      'Инверсия первопричины (TRIZ): устраните саму возможность возникновения этой ошибки конструктивно.',
      'Compile-Time Immunity: перенесите валидацию из runtime if-проверок в систему типов TypeScript (Zod/Branded Types).',
      'Idempotency-First: используйте детерминированные ключи идемпотентности вместо блокировок состояния.'
    ];

    switch (category) {
      case 'BUGFIX':
        return [
          ...general,
          'Атомарный CAS (Compare-And-Swap): вместо параллельных SELECT/UPDATE используйте updateMany с фильтром по текущему состоянию.',
          'Decoupled Isolation: изолируйте проблемную ветку через стратегию Fail-Closed с автооткатом.'
        ];
      case 'REFACTOR':
        return [
          ...general,
          'Single-Responsibility Decomposition: декомпозируйте метод так, чтобы каждый шаг трогал <= 2 файлов.',
          'Interface Segregation: выделите интерфейс шлюза для устранения прямого зацепления с реализацией.'
        ];
      case 'OPTIMIZATION':
        return [
          ...general,
          'Singleflight & Coalescing: объединяйте идентичные одновременные запросы в один промис.',
          'Memory-Efficient Streaming: перейдите от буферизации массивов в памяти к стримингу или курсорам.'
        ];
      default:
        return general;
    }
  }
}
