/**
 * Self-Improving Loop Orchestrator (2026 AI Autonomous Standard)
 * Implements continuous learning from defects, auto-evolution of KNOWN_ANTI_PATTERNS.md,
 * and zero-regression injection into the Maker agent's context.
 */

import fs from 'fs';
import path from 'path';
import { MakerCheckerOrchestrator, DualAgentHandoffPackage, CheckerScorecard } from './orchestrator/maker-checker-runner.js';
import { laya, LayaClient } from './laya/laya-client.js';

export interface DefectRecord {
  title: string;
  symptom: string;
  rule: string;
  vector: string;
}

export interface SelfImprovingIterationResult {
  success: boolean;
  handoff: DualAgentHandoffPackage;
  scorecard: CheckerScorecard;
  newAntiPatternsLearned: string[];
  totalKnownAntiPatterns: number;
}

export class SelfImprovingLoop {
  private readonly antiPatternsPath: string;
  private readonly orchestrator: MakerCheckerOrchestrator;

  constructor(
    antiPatternsPath = path.resolve(process.cwd(), 'docs/KNOWN_ANTI_PATTERNS.md'),
    client: LayaClient = laya
  ) {
    this.antiPatternsPath = antiPatternsPath;
    this.orchestrator = new MakerCheckerOrchestrator(client);
  }

  /**
   * Загрузка известных анти-паттернов из базы знаний
   */
  public async loadKnownAntiPatterns(): Promise<string[]> {
    if (!fs.existsSync(this.antiPatternsPath)) {
      return [];
    }
    const content = fs.readFileSync(this.antiPatternsPath, 'utf-8');
    const patternHeaders = content.match(/###\s+\[ANTI-PATTERN-\d+\].+/g) || [];
    return patternHeaders.map(h => h.replace(/^###\s+/, '').trim());
  }

  /**
   * Формализация и дозапись нового анти-паттерна в базу знаний
   */
  public async recordDefect(defect: DefectRecord): Promise<string> {
    const existing = await this.loadKnownAntiPatterns();
    const nextIndex = String(existing.length + 1).padStart(3, '0');
    const patternCode = `[ANTI-PATTERN-${nextIndex}] ${defect.title}`;

    const today = new Date().toISOString().split('T')[0];
    const entryMarkdown = `\n### ${patternCode}\n- **Симптом:** ${defect.symptom}\n- **Правило:** ${defect.rule}\n- **Вектор:** ${defect.vector}\n- **Дата фиксации:** ${today}\n`;

    fs.appendFileSync(this.antiPatternsPath, entryMarkdown, 'utf-8');
    return patternCode;
  }

  /**
   * Запуск замкнутого цикла Maker -> Checker -> Laya -> Self-Improving Loop
   */
  public async runLoop(
    taskSpec: string,
    initialLayout: string,
    codeDiff: string
  ): Promise<SelfImprovingIterationResult> {
    // 1. Загружаем текущие анти-паттерны (Память системы)
    const knownPatterns = await this.loadKnownAntiPatterns();

    // 2. Запускаем оркестратор двух агентов
    const { handoff, scorecard } = await this.orchestrator.executePipeline(
      taskSpec,
      initialLayout,
      codeDiff,
      knownPatterns
    );

    const newAntiPatternsLearned: string[] = [];

    // 3. Если есть замечания ревизора, обучаемся на ошибках
    if (scorecard.verdict === 'REJECT') {
      for (const vector of scorecard.vectors) {
        if (!vector.pass) {
          for (const detail of vector.details) {
            const recorded = await this.recordDefect({
              title: `${vector.name}: ${detail.slice(0, 50)}...`,
              symptom: detail,
              rule: `Строго предотвращать дефекты вектора '${vector.name}'. Проверка обязана проходить до передачи ревизору.`,
              vector: `Вектор ${vector.vector} (${vector.name})`
            });
            newAntiPatternsLearned.push(recorded);
          }
        }
      }
    }

    const updatedPatterns = await this.loadKnownAntiPatterns();

    return {
      success: scorecard.verdict === 'APPROVE',
      handoff,
      scorecard,
      newAntiPatternsLearned,
      totalKnownAntiPatterns: updatedPatterns.length
    };
  }
}

// Запуск при прямом вызове из терминала
if (process.argv[1] && process.argv[1].endsWith('self-improving-loop.ts')) {
  (async () => {
    console.log('🔄 Запуск Dual Agent Self-Improving Loop...');
    const loop = new SelfImprovingLoop();
    const patterns = await loop.loadKnownAntiPatterns();
    console.log(`📚 Загружено известных анти-паттернов: ${patterns.length}`);
    for (const p of patterns) {
      console.log(`  - ${p}`);
    }
  })().catch(err => {
    console.error('Ошибка в Self-Improving Loop:', err);
    process.exit(1);
  });
}
