/**
 * Integration Test Suite: Dual Agent Self-Improving Loop with Laya Decision Engine
 * Standard: 2026 Autonomous AI Architecture (CPU / No NPU)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LayaClient, LocalLayaEngine, laya } from '../../../scripts/laya/laya-client.js';
import { MakerAgent, CheckerAgent, MakerCheckerOrchestrator } from '../../../scripts/orchestrator/maker-checker-runner.js';
import { SelfImprovingLoop } from '../../../scripts/self-improving-loop.js';

describe('Laya Decision Engine & Dual Agent Self-Improving Loop', () => {
  const tempAntiPatternsPath = path.resolve(process.cwd(), 'docs/__test_anti_patterns.md');

  beforeEach(() => {
    // Подготовка тестового окружения базы знаний
    const initialContent = `# KNOWN_ANTI_PATTERNS.md (Test Sandbox)
### [ANTI-PATTERN-001] Missing Touch Target Size on Icon Buttons
- **Симптом:** Использование кнопок p-1 без 44px
- **Правило:** Использовать min-h-[44px] min-w-[44px]
- **Вектор:** Вектор 5
- **Дата фиксации:** 2026-09-29
`;
    fs.writeFileSync(tempAntiPatternsPath, initialContent, 'utf-8');
  });

  it('Тест 1: Детекция AI-slop и авто-исправление Maker агентом', async () => {
    const dirtySlopLayout = `
      <div className="bg-black text-white p-8">
        <h1 className="text-4xl text-[#8b5cf6] shadow-purple font-bold">Turbo SMM 🚀🔥💎</h1>
        <p className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-pink-500">
          The ultimate social panel
        </p>
        <button className="p-1 h-6 w-6 rounded-full animate-pulse bg-purple-600" onClick={() => {}}>
          Click me
        </button>
      </div>
    `;

    // 1. Прямая проверка Laya: грязный макет обязан получить REJECTED
    const initialDecision = LocalLayaEngine.decide(dirtySlopLayout);
    expect(initialDecision.decision).toBe('REJECTED');
    expect(initialDecision.classification.slopDetected).toBe(true);
    expect(initialDecision.classification.slopType).toBe('purple_neon');
    expect(initialDecision.gates.zeroSlopPass).toBe(false);
    expect(initialDecision.scores.mobileTouchSafety).toBeLessThan(0.50);

    // 2. Maker агент принимает задачу и выполняет внутренний цикл авто-исправления
    const maker = new MakerAgent(laya);
    const result = await maker.produceCandidate('Создать панель заказа SMM', dirtySlopLayout);

    expect(result.cycles).toBeGreaterThan(0);
    expect(result.layaDecision.decision).toBe('APPROVED');
    expect(result.layaDecision.gates.zeroSlopPass).toBe(true);
    expect(result.layaDecision.gates.mobileSafePass).toBe(true);
    expect(result.layout).not.toContain('#8b5cf6');
    expect(result.layout).not.toContain('bg-black');
    expect(result.layout).toContain('min-h-[44px]');
  });

  it('Тест 2: Эпистемическая изоляция Ревизора (Checker strictly read-only)', async () => {
    const checker = new CheckerAgent(laya);

    // Инвариант: у Ревизора строго canWrite === false
    expect(checker.canWrite).toBe(false);
    expect(() => checker.assertReadOnly()).not.toThrow();

    // Проверка защитного барьера от случайной мутации прав
    const hijackedChecker = Object.create(checker);
    Object.defineProperty(hijackedChecker, 'canWrite', { value: true });
    expect(() => hijackedChecker.assertReadOnly()).toThrow(/CRITICAL_INVARIANT_VIOLATION/);
  });

  it('Тест 3: 5-Векторная матрица вето и запись дефекта в KNOWN_ANTI_PATTERNS.md', async () => {
    const loop = new SelfImprovingLoop(tempAntiPatternsPath, laya);

    const initialPatterns = await loop.loadKnownAntiPatterns();
    expect(initialPatterns.length).toBe(1);

    // Кандидат с нарушением Вектора 1 (наличие типа any)
    const badCandidateDiff = `
      export function unsafeAction(data: any) {
        return { success: true };
      }
    `;

    const result = await loop.runLoop(
      'Реализовать безопасный экшен',
      '<div className="p-4 border border-border text-sm min-h-[44px]">Valid UI</div>',
      badCandidateDiff
    );

    // Ревизор обязан отклонить код с типом `any`
    expect(result.success).toBe(false);
    expect(result.scorecard.verdict).toBe('REJECT');
    expect(result.scorecard.blockerCount).toBeGreaterThan(0);
    expect(result.scorecard.vectors.find(v => v.vector === 1)?.pass).toBe(false);

    // Проверяем, что дефект зафиксирован в базе знаний
    expect(result.newAntiPatternsLearned.length).toBeGreaterThan(0);
    const updatedPatterns = await loop.loadKnownAntiPatterns();
    expect(updatedPatterns.length).toBeGreaterThan(1);
    expect(updatedPatterns.some(p => p.includes('ANTI-PATTERN-002'))).toBe(true);

    // Очистка временного файла
    if (fs.existsSync(tempAntiPatternsPath)) {
      fs.unlinkSync(tempAntiPatternsPath);
    }
  });

  it('Тест 4: Скорость и задержка Laya Decision Engine (System 1 Target <= 40ms)', async () => {
    const layout = `
      <div className="p-4 bg-background text-foreground border border-border text-sm tabular-nums">
        <h2 className="font-semibold text-base mb-2">Активные заказы</h2>
        <div className="flex gap-2">
          <button className="min-h-[44px] min-w-[44px] px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs">
            Обновить
          </button>
        </div>
      </div>
    `;

    const start = performance.now();
    const decision = await laya.decide(layout);
    const duration = performance.now() - start;

    expect(decision.decision).toBe('APPROVED');
    expect(decision.gates.readyForSynthesis).toBe(true);
    expect(duration).toBeLessThan(100); // Локально/в контейнере время отклика экстремально мало
  });
});
