/**
 * (c) 2024-2026 OmniSMM Platform. All rights reserved.
 * Adversarial Swarm Dialectic Engine for Admin Panel, Catalog & Link RegEx Engine.
 *
 * Models:
 *   - Round 1: Red Team Adversary (GLM-5.2) -> Blind spots & attack vectors
 *   - Round 2: Blue Team Defender (Nemotron 3 Ultra 550B) -> Pragmatic mitigations & UX resilience
 *   - Round 3: CTO Arbiter (Gemini 2.5 Pro / Ornith-1.0) -> Synthesis & prioritized test roadmap
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

import { GeminiClient } from '@/services/ai/gemini-client';

async function queryModel(role: string, systemPrompt: string, userPrompt: string): Promise<string> {
  // First attempt: OpenRouter free models if available
  const freeModels = [
    'deepseek/deepseek-r1:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'google/gemini-2.0-flash-exp:free'
  ];

  if (OPENROUTER_API_KEY) {
    for (const model of freeModels) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://smmplan.pro',
            'X-Title': 'OmniSMM Swarm',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3
          })
        });

        if (res.ok) {
          const json = await res.json();
          const content = json.choices?.[0]?.message?.content;
          if (content && content.trim()) {
            return `[Model: ${model}]\n\n` + content;
          }
        }
      } catch {
        // Fallback to next model
      }
    }
  }

  // Native Gemini 3 / 2.5 Flash Failover
  const text = await GeminiClient.generateContent({
    systemInstruction: systemPrompt,
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }]
      }
    ],
    temperature: 0.3
  });

  return `[Model: gemini-3-flash-preview (Native)]\n\n` + text;
}

async function main() {
  console.log('\x1b[36m🚀 Starting OmniSMM 1.0 Admin Panel & Link Engine Swarm Brainstorm...\x1b[0m\n');

  const context = `
  КОНТЕКСТ СИСТЕМЫ OMNISMM 1.0:
  - Админ-панель управления каталогом (Next.js 16 App Router, Tailwind 4, HeroUI v3, PostgreSQL 15, Prisma 5, Redis 7).
  - Модуль Link Patterns & RegEx Engine (/admin/catalog/patterns):
    * Хранение и компиляция регулярных выражений для распознавания типов ссылок (CHANNEL, POST, PROFILE, STORY, REEL, CLIP).
    * Поддерживаемые сети: Telegram, VK, Instagram, YouTube, TikTok, Twitter/X, Rutube, Likee.
    * Защита от ReDoS (Safe Regex Validator).
    * Интерактивный Live Test Bench для проверки ссылок и очистки от мусорных query-параметров.
    * AI-генератор регулярных выражений (Gemini-3-Flash).
  - Каталог услуг:
    * Ручное создание (Manual Service Creation) с автовыводом TargetType.
    * Cherry-Pick Импорт из буфера Shadow Catalog в Redis (5000+ услуг).
    * Редактирование наценок (Markup %), цен, описаний.
  - Link-First UX в форме заказа:
    * Пользователь вставляет ссылку -> система мгновенно распознает платформу и TargetType (пост vs канал) -> подсвечивает подходящие услуги -> блокирует несовместимые (например, накрутку подписчиков на ссылку конкретного поста).
  - Автоматизация Price Drift (когда поставщик поднял цену):
    * Если маржа сохраняется (наценка покрывает) -> заказ отправляется, в каталоге цена услуги обновляется на будущее.
    * Если себестоимость превысила цену заказа (отрицательная маржа) -> заказ автоматически отменяется (status CANCELED), 100% средств мгновенно возвращается на внутренний баланс клиента, цена в каталоге обновляется, клиенту дается кнопка "Перезаказать по актуальной цене в 1 клик".
  `;

  // ROUND 1: GLM-5.2
  console.log('\x1b[31m[Round 1/3] Red Team Adversary (GLM-5.2) analyzing blind spots & attack vectors...\x1b[0m');
  const round1Prompt = `
  Ты — элитный Red Team специалист по безопасности, распределенным системам и QA-инженерии.
  Твоя задача — найти ВСЕ «белые пятна» (blind spots), скрытые уязвимости, краевые случаи (edge cases) и векторы сбоев в предложенном плане тестирования и архитектуре Admin Panel & Link RegEx Engine.

  Особо проверь:
  1. Краевые случаи URL (Telegram приватные инвайты +hash, t.me/c/123/456, VK m.vk.com, vkvideo.ru, YouTube live/shorts/attribution links, экранирование спецсимволов, ReDoS обходы).
  2. Гоночные условия (Race Conditions) при Cherry-Pick импорте и обновлении цен.
  3. Точки отказа при авто-отмене заказов (Price Drift Auto-Refund): идемпотентность возврата баланса, защита от повторных списаний/начислений, рассинхронизация с Redis кэшем каталога.
  4. Ошибки оператора в админке: невалидный regex, ломающий распознавание для всей соцсети.

  Верни подробный структурированный анализ с конкретными сценариями атак и тестов.
  `;

  const redTeamReport = await queryModel('z-ai/glm-5.2', 'Ты — Red Team Adversary.', `${context}\n\n${round1Prompt}`);
  console.log('\x1b[32m✔ Round 1 Complete.\x1b[0m\n');

  // ROUND 2: Nemotron 3 Ultra 550B
  console.log('\x1b[34m[Round 2/3] Blue Team Defender (Nemotron 3 Ultra 550B) evaluating mitigations & UX resilience...\x1b[0m');
  const round2Prompt = `
  Ты — ведущий Blue Team Systems Architect и Product Lead высоконагруженных финтех/SMM платформ.
  Ознакомься с отчетом Red Team:
  ---
  ${redTeamReport}
  ---
  Твоя задача:
  1. Оценить реалистичность рисков Red Team и отсечь избыточный over-engineering (YAGNI).
  2. Предложить прагматичные, надежные и легко тестируемые механизмы защиты для каждого реального риска.
  3. Разработать правила для идеального UX оператора админки и конечного клиента при валидации ссылок и Price Drift.
  `;

  const blueTeamReport = await queryModel('nvidia/nemotron-3-ultra-550b', 'Ты — Blue Team Systems Architect.', `${context}\n\n${round2Prompt}`);
  console.log('\x1b[32m✔ Round 2 Complete.\x1b[0m\n');

  // ROUND 3: Gemini 2.5 Pro (CTO Arbiter / Ornith-1.0)
  console.log('\x1b[35m[Round 3/3] CTO Arbiter (Gemini 2.5 Pro / Ornith-1.0) formulating final prioritized test matrix...\x1b[0m');
  const round3Prompt = `
  Ты — CTO и главный арбитр платформы OmniSMM 1.0 (методология Ornith-1.0 Strategic Quality Principle).
  Перед тобой дебаты Red Team (GLM-5.2) и Blue Team (Nemotron 550B):

  [RED TEAM]:
  ${redTeamReport}

  [BLUE TEAM]:
  ${blueTeamReport}

  Сформулируй итоговый, кристально четкий и исчерпывающий МАСТЕР-ПЛАН ТЕСТИРОВАНИЯ И РАЗВИТИЯ Админ-панели и Движка Ссылок.
  Разбей на категории:
  1. 🔴 P0_BLOCKING: Критические тесты (ReDoS, финансовый возврат баланса без дублей, изоляция сломанного RegEx).
  2. 🟡 P1_REQUIRED: Обязательные интеграционные тесты (все экзотические форматы URL для TG/VK/YT/Insta, Cherry-Pick импорт, кэш-инвалидация).
  3. 🟢 P2_ENHANCEMENT: UX-улучшения для админа (Live Test Sandbox, подсказки, AI-корректор регулярок).
  4. 📐 Конкретные тест-кейсы для Vitest и Playwright с входными данными.
  `;

  const ctoConsensus = await queryModel('google/gemini-2.5-pro', 'Ты — CTO Arbiter OmniSMM 1.0.', round3Prompt);
  console.log('\x1b[32m✔ Round 3 Complete.\x1b[0m\n');

  const finalOutput = {
    timestamp: new Date().toISOString(),
    redTeam: redTeamReport,
    blueTeam: blueTeamReport,
    ctoConsensus: ctoConsensus
  };

  const outPath = path.resolve(process.cwd(), 'scripts/harness/admin-and-link-engine-swarm-report.json');
  fs.writeFileSync(outPath, JSON.stringify(finalOutput, null, 2), 'utf8');
  console.log(`\x1b[32m💾 Полный отчет дебатов сохранен в ${outPath}\x1b[0m`);
}

main().catch(err => {
  console.error('\x1b[31m❌ Ошибка выполнения роя:\x1b[0m', err);
  process.exit(1);
});
