/**
 * scripts/mutation-testing-redteam.ts
 *
 * Исполнительный движок мутационного тестирования и состязательного взлома (Pillar 5).
 * Проверяет качество тестового покрытия в критических модулях (Tier 1: ExactMath, WalletOps, Security).
 *
 * Для каждой семантической мутации:
 * 1. Создает резервную копию файла.
 * 2. Применяет микро-дефект (Мутант).
 * 3. Запускает таргетированные тесты (Vitest).
 * 4. Фиксирует исход: KILLED (тест упал, норма) vs SURVIVED (тест прошел, дыра в QA).
 * 5. В блоке finally на 100% восстанавливает оригинальный код.
 * 6. Рассчитывает Mutation Score (MS >= 85%).
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync, spawnSync } from 'child_process';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export interface MutationDefinition {
  id: string;
  category: 'FINANCE_EXACTMATH' | 'FINANCE_WALLETOPS' | 'SECURITY_RBAC' | 'TENANT_ISOLATION' | 'UI_HEALER';
  description: string;
  targetFile: string;
  originalPattern: string | RegExp;
  mutatedReplacement: string;
  targetTestSuite: string;
}

export interface MutationResult {
  mutation: MutationDefinition;
  status: 'KILLED' | 'SURVIVED' | 'TIMEOUT' | 'ERROR';
  testOutputSnippet: string;
  elapsedMs: number;
}

export interface MutationSuiteReport {
  timestamp: string;
  totalMutants: number;
  killedCount: number;
  survivedCount: number;
  errorCount: number;
  mutationScore: number; // 0..100%
  verdict: 'APPROVED' | 'REJECTED_LOW_SCORE';
  results: MutationResult[];
}

/**
 * Каталог контролируемых семантических мутаций ядра платформы OmniSMM
 */
export const CORE_MUTATIONS: MutationDefinition[] = [
  // 1. ExactMath: Инверсия округления Half-Even
  {
    id: 'MUT-FIN-01',
    category: 'FINANCE_EXACTMATH',
    description: 'Искажение банковского округления: замена строгого неравенства остатка (нарушение Half-Even)',
    targetFile: 'src/lib/financial/exact-math.ts',
    originalPattern: 'if (remainder > halfDivisor) {',
    mutatedReplacement: 'if (remainder >= halfDivisor) { // MUTANT: Breaks Half-Even rounding to nearest even',
    targetTestSuite: 'src/__tests__/financial/exact-math.test.ts',
  },
  // 2. ExactMath: Инверсия наценки в расчете стоимости заказа
  {
    id: 'MUT-FIN-02',
    category: 'FINANCE_EXACTMATH',
    description: 'Удаление базисных пунктов наценки (заказ продается по себестоимости провайдера без маржи)',
    targetFile: 'src/lib/financial/exact-math.ts',
    originalPattern: 'const effectiveMicroKopecks = (baseMicroKopecks * (this.BPS_BASE + marginBps)) / this.BPS_BASE;',
    mutatedReplacement: 'const effectiveMicroKopecks = baseMicroKopecks; // MUTANT: Zero margin bypass',
    targetTestSuite: 'src/__tests__/financial/exact-math.test.ts',
  },
  // 3. ExactMath: Снятие защитного порога минимальной стоимости (1 копейка)
  {
    id: 'MUT-FIN-03',
    category: 'FINANCE_EXACTMATH',
    description: 'Разрешение бесплатного/нулевого заказа (отключение защиты min 1 коп floor)',
    targetFile: 'src/lib/financial/exact-math.ts',
    originalPattern: 'return finalKopecks > minChargeKopecks ? finalKopecks : minChargeKopecks;',
    mutatedReplacement: 'return 0n; // MUTANT: Zero cost free order exploit',
    targetTestSuite: 'src/__tests__/financial/exact-math.test.ts',
  },
  // 4. ExactMath: Нарушение расчета полного возврата средств
  {
    id: 'MUT-FIN-04',
    category: 'FINANCE_EXACTMATH',
    description: 'Подмена полного возврата при невыполненном заказе на нулевой возврат',
    targetFile: 'src/lib/financial/exact-math.ts',
    originalPattern: 'if (rem >= initQty) return totalChargeKopecks;',
    mutatedReplacement: 'if (rem >= initQty) return BigInt(0); // MUTANT: Full refund broken',
    targetTestSuite: 'src/__tests__/financial/exact-math.test.ts',
  },
  // 5. Layout Healer: Отключение инъекции shrink-0 (пропуск сплющивания иконок)
  {
    id: 'MUT-UI-01',
    category: 'UI_HEALER',
    description: 'Отключение исправления сплющивания: пропуск добавления shrink-0 в SVG/Lucide',
    targetFile: 'scripts/ui/layout-healer.ts',
    originalPattern: 'return `className="${classList} shrink-0"`;',
    mutatedReplacement: 'return `className="${classList}"`; // MUTANT: shrink-0 injection disabled',
    targetTestSuite: 'src/__tests__/skills/layout-overflow-sentry.test.ts',
  },
  // 6. Layout Healer: Отключение исправления горизонтального скролла w-screen
  {
    id: 'MUT-UI-02',
    category: 'UI_HEALER',
    description: 'Отключение устранения горизонтального скролла: сохранение w-screen вместо w-full max-w-full',
    targetFile: 'scripts/ui/layout-healer.ts',
    originalPattern: "line = line.replace(/(?<![\\w-])w-screen(?![\\w-])/g, 'w-full max-w-full');",
    mutatedReplacement: "// MUTANT: w-screen replacement disabled",
    targetTestSuite: 'src/__tests__/skills/layout-overflow-sentry.test.ts',
  },
  // 7. Layout Healer: Отключение защиты от iOS Auto-Zoom
  {
    id: 'MUT-UI-03',
    category: 'UI_HEALER',
    description: 'Отключение защиты от авто-зума на iPhone: сохранение мелкого шрифта text-xs в инпутах',
    targetFile: 'scripts/ui/layout-healer.ts',
    originalPattern: "line = line.replace(/\\btext-(?:xs|\\[1[0-3]px\\])\\b/g, 'text-base sm:text-xs');",
    mutatedReplacement: "// MUTANT: iOS font zoom fix disabled",
    targetTestSuite: 'src/__tests__/skills/layout-overflow-sentry.test.ts',
  },
];

export class MutationTestingHarness {
  private projectRoot: string;

  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Безопасное применение мутации с гарантированным откатом
   */
  private runSingleMutation(mutation: MutationDefinition): MutationResult {
    const fullPath = path.resolve(this.projectRoot, mutation.targetFile);
    if (!fs.existsSync(fullPath)) {
      return {
        mutation,
        status: 'ERROR',
        testOutputSnippet: `Target file not found: ${mutation.targetFile}`,
        elapsedMs: 0,
      };
    }

    const originalContent = fs.readFileSync(fullPath, 'utf-8');

    // Проверяем наличие целевого паттерна
    if (typeof mutation.originalPattern === 'string') {
      if (!originalContent.includes(mutation.originalPattern)) {
        return {
          mutation,
          status: 'ERROR',
          testOutputSnippet: `Pattern not matched in ${mutation.targetFile}: "${mutation.originalPattern}"`,
          elapsedMs: 0,
        };
      }
    }

    const backupPath = `${fullPath}.mutation_bak`;
    fs.writeFileSync(backupPath, originalContent, 'utf-8');

    const startTime = Date.now();
    let status: 'KILLED' | 'SURVIVED' | 'TIMEOUT' | 'ERROR' = 'ERROR';
    let outputSnippet = '';

    try {
      // Применяем мутацию
      const mutatedContent = originalContent.replace(mutation.originalPattern, mutation.mutatedReplacement);
      fs.writeFileSync(fullPath, mutatedContent, 'utf-8');

      // Запускаем Vitest в изолированном процессе
      const testArgs = ['vitest', 'run', mutation.targetTestSuite, '--reporter=basic'];
      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      const runResult = spawnSync(npxCmd, testArgs, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout: 60000,
        shell: process.platform === 'win32',
        env: {
          ...process.env,
          DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/smmplan_test?schema=public&sslmode=disable',
          PATH: `C:\\Program Files\\nodejs;${process.env.PATH}`,
          NODE_ENV: 'test',
        },
      });

      const stdout = runResult.stdout || '';
      const stderr = runResult.stderr || '';
      outputSnippet = (stdout + stderr).slice(-500).trim();

      if (runResult.error && (runResult.error as any).code === 'ETIMEDOUT') {
        status = 'TIMEOUT';
      } else if (runResult.status !== 0) {
        // Тест упал — значит, мутант успешно УБИТ!
        status = 'KILLED';
      } else {
        // Тест прошел успешно при сломанном коде — мутант ВЫЖИЛ!
        status = 'SURVIVED';
      }
    } catch (e: any) {
      status = 'ERROR';
      outputSnippet = e.message;
    } finally {
      // КРИТИЧЕСКИЙ ШАГ: 100% откат оригинального содержимого
      if (fs.existsSync(backupPath)) {
        const restored = fs.readFileSync(backupPath, 'utf-8');
        fs.writeFileSync(fullPath, restored, 'utf-8');
        fs.unlinkSync(backupPath);
      }
    }

    const elapsedMs = Date.now() - startTime;
    return {
      mutation,
      status,
      testOutputSnippet: outputSnippet,
      elapsedMs,
    };
  }

  /**
   * Запуск полного цикла мутационного тестирования
   */
  public run(mutations: MutationDefinition[] = CORE_MUTATIONS): MutationSuiteReport {
    console.log('\n\x1b[1m\x1b[31m======================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[31m   👾 OmniSMM 1.0 LLM Mutation Testing & Adversarial Red Teaming       \x1b[0m');
    console.log('\x1b[1m\x1b[31m======================================================================\x1b[0m\n');

    console.log(`🎯 Evaluating ${mutations.length} controlled semantic mutations in critical modules...\n`);

    const results: MutationResult[] = [];

    for (let i = 0; i < mutations.length; i++) {
      const mut = mutations[i];
      console.log(`[Mutant ${i + 1}/${mutations.length}] 💉 Injecting: [${mut.id}] ${mut.description}`);
      console.log(`   Target: ${mut.targetFile} -> Test: ${mut.targetTestSuite}`);

      const res = this.runSingleMutation(mut);
      results.push(res);

      if (res.status === 'KILLED') {
        console.log(`   💀 KILLED in ${(res.elapsedMs / 1000).toFixed(2)}s (Test successfully caught the defect)\n`);
      } else if (res.status === 'SURVIVED') {
        console.log(`   🚨 SURVIVED in ${(res.elapsedMs / 1000).toFixed(2)}s (CRITICAL: Test suite failed to detect bug!)\n`);
      } else {
        console.log(`   ⚠️ ${res.status}: ${res.testOutputSnippet.slice(0, 100)}\n`);
      }
    }

    const killedCount = results.filter((r) => r.status === 'KILLED').length;
    const survivedCount = results.filter((r) => r.status === 'SURVIVED').length;
    const errorCount = results.filter((r) => r.status === 'ERROR' || r.status === 'TIMEOUT').length;
    const validCount = killedCount + survivedCount;
    const mutationScore = validCount > 0 ? Number(((killedCount / validCount) * 100).toFixed(1)) : 0;
    const verdict = mutationScore >= 85.0 && survivedCount === 0 ? 'APPROVED' : 'REJECTED_LOW_SCORE';

    console.log('----------------------------------------------------------------------');
    console.log('📊 MUTATION TESTING SCORECARD:');
    console.log(`   - Total Mutants:  ${mutations.length}`);
    console.log(`   - 💀 Killed:      ${killedCount}`);
    console.log(`   - 🧟 Survived:    ${survivedCount}`);
    console.log(`   - ⚠️ Errors:      ${errorCount}`);
    console.log(`   - 📈 Mutation Score: ${mutationScore}% (Required >= 85.0%)`);
    console.log(`   - Final Verdict:  ${verdict === 'APPROVED' ? '🟢 APPROVED (Immune to mutations)' : '🔴 REJECTED'}`);
    console.log('----------------------------------------------------------------------\n');

    const report: MutationSuiteReport = {
      timestamp: new Date().toISOString(),
      totalMutants: mutations.length,
      killedCount,
      survivedCount,
      errorCount,
      mutationScore,
      verdict,
      results,
    };

    // Сохранение официального отчета
    const reportMd = `# Mutation Testing & Adversarial Red Teaming Report

**Timestamp:** ${report.timestamp}  
**Overall Verdict:** \`${report.verdict}\`  
**Mutation Score:** \`${report.mutationScore}%\` (Required threshold: $\\ge 85.0\\%$)  
**Killed Mutants:** ${report.killedCount} / ${report.totalMutants}  
**Survived Mutants (Test Blindspots):** ${report.survivedCount}  

---

## 1. Mutation Score Summary
| Метрика | Значение | Норматив | Статус |
| :--- | :--- | :--- | :--- |
| **Mutation Score ($MS$)** | **${report.mutationScore}%** | $\\ge 85.0\\%$ | ${report.mutationScore >= 85 ? '🟢 PASS' : '🔴 FAIL'} |
| **Убитые мутанты (Killed)** | ${report.killedCount} | Максимум | 💀 Успешно |
| **Выжившие мутанты (Survived)** | ${report.survivedCount} | 0 | ${report.survivedCount === 0 ? '🟢 0 Дыр' : '🛑 ТРЕБУЕТСЯ ДОРАБОТКА'} |

---

## 2. Detailed Breakdown by Mutant

${results
  .map(
    (r, idx) => `### ${idx + 1}. [${r.status === 'KILLED' ? '💀 KILLED' : '🧟 SURVIVED'}] ${r.mutation.id} (${r.mutation.category})
- **Описание:** ${r.mutation.description}
- **Целевой файл:** \`${r.mutation.targetFile}\`
- **Тестовый сьют:** \`${r.mutation.targetTestSuite}\`
- **Время реакции тестов:** ${(r.elapsedMs / 1000).toFixed(2)}s
- **Статус:** \`${r.status}\`
`
  )
  .join('\n---\n\n')}

---

## 3. Human Approval Gate
${
  report.verdict === 'APPROVED'
    ? '🟢 **ОДОБРЕНО:** Тестовый сьют доказал 100% чувствительность к критическим искажениям бизнес-логики и финансовой математики.'
    : '🛑 **ОТКЛОНЕНО:** Обнаружены выжившие мутанты. Требуется написать дополнительные assert в Vitest.'
}
`;

    const reportPath = path.resolve(this.projectRoot, '.planning/MUTATION_TEST_REPORT.md');
    fs.writeFileSync(reportPath, reportMd, 'utf-8');
    console.log(`📄 Official Mutation Report written to: ${reportPath}\n`);

    return report;
  }
}

// CLI Execution
if (process.argv[1]?.includes('mutation-testing-redteam.ts')) {
  const harness = new MutationTestingHarness();
  const report = harness.run();
  if (report.verdict !== 'APPROVED') {
    process.exit(1);
  }
  process.exit(0);
}
