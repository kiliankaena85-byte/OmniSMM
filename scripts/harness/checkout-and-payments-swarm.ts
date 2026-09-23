/**
 * (c) 2024-2026 OmniSMM Platform. All rights reserved.
 * Adversarial Swarm Dialectic Engine for Checkout, Payments, Link Validator Bypass & Error Handling.
 *
 * Models:
 *   - Round 1: Red Team Adversary (GLM-5.2 / DeepSeek-R1) -> Edge attacks on payments, webhooks, broken link validation
 *   - Round 2: Blue Team Defender (Nemotron 3 Ultra 550B / Llama 3.3) -> Resilience evaluation & defensive guarantees
 *   - Round 3: CTO Arbiter (Inkling / Gemini 3 Flash) -> Synthesis, master report & verification
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

import { GeminiClient } from '@/services/ai/gemini-client';

async function queryModel(role: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const models = [
    'z-ai/glm-5.2:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'deepseek/deepseek-r1:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'google/gemini-2.0-flash-exp:free'
  ];

  if (OPENROUTER_API_KEY) {
    for (const model of models) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://smmplan.pro',
            'X-Title': 'OmniSMM Checkout & Payments Swarm',
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
  console.log('\x1b[36m🚀 Starting OmniSMM 1.0 Checkout, Payments, Link Bypass & Error Handling Swarm Audit...\x1b[0m\n');

  const context = `
  КОНТЕКСТ СИСТЕМЫ ПЛАТЕЖЕЙ, ЧЕКАУТА И ВАЛИДАЦИИ ССЫЛОК (OMNISMM 1.0):

  1. Платежные шлюзы и Вебхуки:
     - Поддерживаемые шлюзы: YooKassa, Robokassa, CryptoBot, Внутренний баланс (WalletOps).
     - Защита вебхуков: Fail-closed сравнение подписей и токенов через timingSafeEqual.
     - Идемпотентность подтверждения оплаты: Redis Mutex (lock:payment:{id}) + транзакции PostgreSQL.
     - Фискализация 54-ФЗ: НДС 22% (vat_code: 10) при превышении лимита УСН (20 млн ₽), до порога — без НДС (vat_code: 1).
     - Точность: Парсинг сумм в BigInt (копейки) без float-дрейфа.

  2. Оформление заказа (checkoutAction):
     - Drip-Feed Floor Invariant: объем каждого запуска строго >= service.minQty (Math.floor(quantity / runs) >= service.minQty).
     - Защита от IDOR при оплате с баланса: совпадение session.userId и email пользователя.
     - Защита от запрещенного контента (validateProhibitedContent).
     - Промокоды с ограничением себестоимости и защитой маржи (MarketingService).

  3. Валидация ссылок и Механизм обхода (isLinkOverridden & Fallback):
     - Двухуровневый анализ: IntelligenceLinkAnalyzer (распознавание платформы и типа: CHANNEL, POST, PROFILE, STORY) + getLinkValidator (строгие Zod-схемы).
     - Защита от падений (Graceful Degradation): если анализатор или мутатор ссылок выбрасывает исключение, система не падает с 500, а мягко переключается на универсальный LinkType.CUSTOM.
     - Режим обхода валидатора (isLinkOverridden = true): для нестандартных или новых форматов ссылок — валидирует базовый URL (https:// и домен), пропуская заказ в обработку.

  4. Обработка ошибок (Actionable Error Handling):
     - Все Server Actions возвращают типизированный результат { success: false, error: '...' } без необработанных throw new Error.
     - Авто-возврат средств при отмене заказов или Price Drift.
  `;

  // ROUND 1: Red Team Attack (GLM-5.2 / DeepSeek-R1)
  console.log('\x1b[31m[Round 1/3] Red Team Adversary (GLM-5.2) auditing payments, checkout, link bypass & error handling...\x1b[0m');
  const round1Prompt = `
  Ты — элитный Red Team аудитор финтех, e-commerce и платежных систем.
  Твоя задача — найти скрытые векторы отказа, краевые случаи, race conditions и ошибки валидации:
  1. Платежи и Вебхуки: атаки повторного воспроизведения (replay attacks), гонки вебхуков, округление копеек, сбои при отмене/возврате.
  2. Валидатор ссылок и Обход: попытки инъекций в URL при isLinkOverridden=true, обход запрещенного контента, сбои при неожиданных символах (эмодзи, кириллица, Punycode, IPv4/IPv6).
  3. Чекаут и Drip-Feed: перегрузка параметров runs/interval, нулевые/отрицательные суммы, конфликт промокодов.
  4. Обработка ошибок: утечки внутренних стектрейсов, маскирование ошибок Next.js, зависание клиентских форм.

  Верни структурированный отчет с конкретными векторами воспроизведения.
  `;

  const redTeamReport = await queryModel('z-ai/glm-5.2', 'Ты — Red Team Adversary.', `${context}\n\n${round1Prompt}`);
  console.log('\x1b[32m✔ Round 1 Complete.\x1b[0m\n');

  // ROUND 2: Blue Team Defense (Nemotron 3 Ultra 550B)
  console.log('\x1b[34m[Round 2/3] Blue Team Defender (Nemotron 3 Ultra 550B) assessing mitigations & resilience...\x1b[0m');
  const round2Prompt = `
  Ты — Blue Team Systems Architect и CTO OmniSMM 1.0.
  Ознакомься с отчетом Red Team:
  ---
  ${redTeamReport}
  ---
  Твоя задача:
  1. Оценить реальность каждого риска и отсечь теоретические нестыковки.
  2. Проверить надежность защитных механизмов: Redis Mutex, isLinkOverridden, DripFeedFloor, timingSafeEqual.
  3. Сформулировать четкие правила UX при отказе валидатора ссылок и обработке ошибок платежей.
  `;

  const blueTeamReport = await queryModel('nvidia/nemotron-3-ultra-550b-a55b', 'Ты — Blue Team Systems Architect.', `${context}\n\n${round2Prompt}`);
  console.log('\x1b[32m✔ Round 2 Complete.\x1b[0m\n');

  // ROUND 3: CTO Arbiter Consensus (Gemini 3 Flash / Inkling)
  console.log('\x1b[35m[Round 3/3] CTO Arbiter formulating final assessment & test roadmap...\x1b[0m');
  const round3Prompt = `
  Ты — CTO Arbiter платформы OmniSMM 1.0.
  Перед тобой состязательный дебат Red Team и Blue Team по платежам, чекауту и обходу валидации ссылок:

  [RED TEAM]:
  ${redTeamReport}

  [BLUE TEAM]:
  ${blueTeamReport}

  Сформулируй итоговый МАСТЕР-ОТЧЕТ ПО ПЛАТЕЖАМ, ЧЕКАУТУ И ВАЛИДАЦИИ:
  1. Оценка готовности и надежности платежного периметра.
  2. Статус механизма обхода валидатора ссылок (isLinkOverridden) и защиты от сбоев.
  3. Матрица обязательных проверок перед промышленной эксплуатацией.
  `;

  const ctoConsensus = await queryModel('google/gemini-2.0-flash-exp', 'Ты — CTO Arbiter OmniSMM 1.0.', round3Prompt);
  console.log('\x1b[32m✔ Round 3 Complete.\x1b[0m\n');

  const finalOutput = {
    timestamp: new Date().toISOString(),
    redTeam: redTeamReport,
    blueTeam: blueTeamReport,
    ctoConsensus: ctoConsensus
  };

  const outPath = path.resolve(process.cwd(), 'scripts/harness/checkout-and-payments-swarm-report.json');
  fs.writeFileSync(outPath, JSON.stringify(finalOutput, null, 2), 'utf8');
  console.log(`\x1b[32m💾 Полный отчет дебатов сохранен в ${outPath}\x1b[0m`);
}

main().catch(err => {
  console.error('\x1b[31m❌ Ошибка выполнения роя:\x1b[0m', err);
  process.exit(1);
});
