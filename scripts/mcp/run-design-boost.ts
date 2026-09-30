/**
 * (c) 2026 SMMplan & OmniSMM 1.0.
 * CLI Runner: /boost — Gemini-Stitch-Laya Tri-Partite UI Generation.
 *
 * Usage:
 *   npx tsx scripts/mcp/run-design-boost.ts
 *   npx tsx scripts/mcp/run-design-boost.ts --brand smmflux --intent "Mobile Checkout Wizard"
 */

import fs from 'fs';
import path from 'path';
import { GeminiStitchLayaOrchestrator, OrchestrationGoal } from './gemini-stitch-laya-orchestrator';
import { LayaNpuProvider } from './laya-npu-provider';

async function main() {
  const args = process.argv.slice(2);
  let intent = 'SMM High-Density Dashboard & Checkout Console';
  let intentSet = false;
  let brand: 'smmplan' | 'smmflux' = 'smmplan';
  let viewport: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  let targetDna: 'swiss_kinetic' | 'financial_terminal' | 'tactile_hardware' | 'neo_editorial' | 'obsidian_monolith' | 'bio_mechanical' | undefined;
  let exportPath: string | undefined;
  let useNpu = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
⚡ /BOOST CLI RUNNER — OmniSMM 1.0 (Gemini ↔ Stitch ↔ Laya)

Использование:
  npm run design:boost -- [опции] [интент]

Опции:
  --intent <текст>      Бизнес-цель или интент экрана (или позиционный аргумент)
  --brand <smmplan|smmflux> Бренд платформы (по умолчанию: smmplan)
  --viewport <desktop|mobile|tablet> Вьюпорт генерации (по умолчанию: desktop)
  --dna <dna>           Целевая ДНК: swiss_kinetic, financial_terminal, obsidian_monolith, tactile_hardware, neo_editorial, bio_mechanical
  --export <путь>       Путь для сохранения сгенерированного React 19 компонента (.tsx)
  --npu                 Принудительное аппаратное ускорение на чипе Intel(R) AI Boost (NPU) через OpenVINO
  --help, -h            Показать эту справку

Примеры:
  npm run design:boost -- "Быстрый чекаут" --viewport mobile
  npm run design:boost -- --brand smmflux --dna financial_terminal --npu
      `.trim());
      return;
    } else if (args[i] === '--npu') {
      useNpu = true;
    } else if (args[i] === '--intent' && args[i + 1]) {
      intent = args[i + 1];
      intentSet = true;
      i++;
    } else if (args[i] === '--brand' && (args[i + 1] === 'smmplan' || args[i + 1] === 'smmflux')) {
      brand = args[i + 1] as 'smmplan' | 'smmflux';
      i++;
    } else if (args[i] === '--viewport' && (args[i + 1] === 'desktop' || args[i + 1] === 'mobile' || args[i + 1] === 'tablet')) {
      viewport = args[i + 1] as 'desktop' | 'mobile' | 'tablet';
      i++;
    } else if ((args[i] === '--dna' || args[i] === '-d') && args[i + 1]) {
      targetDna = args[i + 1] as typeof targetDna;
      i++;
    } else if (args[i] === '--export' && args[i + 1]) {
      exportPath = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-') && !intentSet) {
      intent = args[i];
      intentSet = true;
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('⚡ /BOOST: GEMINI-STITCH-LAYA TRI-PARTITE UI ORCHESTRATION PIPELINE');
  console.log('   Standard: SDD-TDD 2026 | System 1 (Laya) + System 2 (Gemini) + Stitch');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  console.log(`🎯 Goal Intent:  "${intent}"`);
  console.log(`🏢 Target Brand: ${brand.toUpperCase()} (OmniSMM 1.0)`);
  console.log(`📱 Viewport:     ${viewport.toUpperCase()}`);
  if (targetDna) {
    console.log(`🧬 Target DNA:   ${targetDna.toUpperCase()}`);
  }

  const hw = await LayaNpuProvider.detectHardware();
  const hardwareBadge = hw.npuDeviceName
    ? `⚡ ${hw.npuDeviceName} (NPU OpenVINO Hardware Acceleration)`
    : 'Host CPU (Heuristic Calibrated Fallback)';
  console.log(`🧠 Acceleration: ${hardwareBadge}`);

  console.log('🔄 Orchestration Strategy:');
  console.log('   1. [Gemini System 2] High-level goal planning & structured prompt compilation');
  console.log('   2. [Stitch Generative UI] Multi-candidate layout generation & DOM tree synthesis');
  console.log('   3. [Laya System 1 Sidecar] Inner-loop candidate pruning (~1ms NPU / ~15ms CPU pass)');
  console.log('   4. [Zero-Slop Gating] Elimination of purple neon, blob mesh, emoji bento');
  console.log('   5. [React 19 Synthesis] Conversion of approved layout into typed component\n');

  console.log('🚀 Executing Orchestration Loop...\n');
  const startTime = Date.now();

  const goal: OrchestrationGoal = {
    userIntent: intent,
    targetBrand: brand,
    viewport,
    targetDna,
    maxIterations: 3
  };

  const result = await GeminiStitchLayaOrchestrator.execute(goal);
  const totalElapsed = Date.now() - startTime;

  console.log('───────────────────────────────────────────────────────────────────────');
  console.log(`📊 Итог Оркестрации (${result.success ? '🟢 УСПЕШНО' : '🔴 ОШИБКА'}):`);
  console.log(`   Экран:               ${result.screenTitle}`);
  console.log(`   Дизайн-ДНК:          ${result.finalDna.toUpperCase()}`);
  console.log(`   Вьюпорт:             ${result.viewport.toUpperCase()}`);
  console.log(`   Итераций:            ${result.totalIterations}`);
  console.log(`   Время Laya System 1: ${result.totalLayaLatencyMs} ms`);
  console.log(`   Общее время цикла:   ${totalElapsed} ms`);
  console.log(`   Экономия токенов:    ~${result.estimatedTokensSaved} токенов (за счет Laya вместо LLM)`);
  console.log('───────────────────────────────────────────────────────────────────────');
  console.log('📈 Скоринг метрик качества (Laya System 1 Proper Scoring):');
  console.log(`   • Информационная плотность: ${(result.finalScores.density * 100).toFixed(0)}% (порог >= 65%)`);
  console.log(`   • Визуальная иерархия:      ${(result.finalScores.hierarchy * 100).toFixed(0)}%`);
  console.log(`   • Контрастность WCAG 2.2:   ${(result.finalScores.wcag * 100).toFixed(0)}% (порог >= 70%)`);
  console.log(`   • Эргономика Touch Target:  ${(result.finalScores.mobileSafety * 100).toFixed(0)}% (порог >= 65%)`);
  console.log('───────────────────────────────────────────────────────────────────────\n');

  if (result.candidateScorecards.length > 0) {
    console.log('🔍 Внутренний контур Stitch ↔ Laya (Отбор кандидатов):');
    for (const cand of result.candidateScorecards) {
      const statusIcon = cand.selected ? '✅ ВЫБРАН' : cand.decision === 'REJECTED' ? '❌ ОТКЛОНЕН' : '⚠️ ОТСЕЯН';
      console.log(`   • [${cand.candidateId}] ${cand.name} (${(cand.score * 100).toFixed(0)}% score) -> ${statusIcon}`);
      if (cand.rejectionReason) {
        console.log(`     └─ Причина: ${cand.rejectionReason}`);
      }
    }
    console.log('');
  }

  console.log('📜 Хронология итераций и решений:');
  for (const step of result.iterationHistory) {
    const dec = step.layaDecision;
    const gateIcon = dec.gates.readyForSynthesis ? '✅' : '⚠️';
    console.log(`   [Итерация ${step.iteration}] Stitch кандидатов: ${step.stitchCandidatesEvaluated} | Laya вердикт: ${dec.decision} (${(dec.confidence * 100).toFixed(0)}% conf) ${gateIcon}`);
    console.log(`     └─ Действие Gemini: ${step.geminiAction}`);
    if (dec.refinements.length > 0) {
      console.log(`     └─ Рекомендации Laya: ${dec.refinements.join('; ')}`);
    }
  }

  if (result.synthesizedReactCode) {
    if (exportPath) {
      const fullPath = path.resolve(process.cwd(), exportPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, result.synthesizedReactCode, 'utf8');
      console.log(`\n💾 Сгенерированный компонент сохранен в: ${fullPath}`);
    }

    console.log('\n───────────────────────────────────────────────────────────────────────');
    console.log('💻 Сгенерированный компонент React 19 (Превью первых 25 строк):');
    console.log('───────────────────────────────────────────────────────────────────────');
    const previewLines = result.synthesizedReactCode.split('\n').slice(0, 25).join('\n');
    console.log(previewLines);
    console.log('   ...\n');
  }

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 /BOOST PIPELINE ЗАВЕРШЕН УСПЕШНО!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
