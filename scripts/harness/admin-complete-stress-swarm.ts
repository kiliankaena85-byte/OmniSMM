/**
 * (c) 2024-2026 OmniSMM Platform. All rights reserved.
 * Adversarial Swarm Dialectic Engine for Complete OmniSMM 1.0 Admin Panel Audit & Stress Testing.
 *
 * Models:
 *   - Round 1: Red Team Adversary (GLM-5.2 / DeepSeek-R1) -> Aggressive vulnerabilities, race conditions & edge case discovery
 *   - Round 2: Blue Team Defender (Nemotron 3 Ultra 550B / Llama 3.3) -> Realistic mitigations, threat ranking & UX resilience
 *   - Round 3: CTO Arbiter (Inkling Small / Gemini-3-Flash) -> Synthesis, prioritized risk matrix & executable Vitest stress test suite
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
            'X-Title': 'OmniSMM Admin Swarm',
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
  console.log('\x1b[36m🚀 Starting OmniSMM 1.0 Admin Panel Multi-Agent Adversarial Swarm Audit...\x1b[0m\n');

  const codebaseContext = `
  КОНТЕКСТ АРХИТЕКТУРЫ АДМИН-ПАНЕЛИ OMNISMM 1.0 (Next.js 16 App Router, Tailwind 4, HeroUI v3, PostgreSQL 15, Prisma 5, Redis 7):

  1. Каталог и Ценообразование (/admin/catalog, /admin/catalog/[id], /admin/catalog/categories, /admin/catalog/sync, /admin/catalog/quarantine, /admin/catalog/drift):
     - Двухбрендовый мульти-тенант: 'smmplan' (smmplan.pro) и 'flux' (smmflux.ru).
     - Блокировка ручной смены тарифа и лимитов min/max у услуг, привязанных к внешним API (VexBoost).
     - Серверный расчет цен с банковским округлением (applyBeautifulRounding), базисными пунктами и защитой от отрицательной маржи (AntiNegativeMargin).
     - Сохранение параметров фильтрации в URL (?returnUrl=...) при возврате из формы редактирования услуги.
     - Быстрый сброс фильтров (Reset Filters) с бейджем активных параметров.
     - Массовые операции: пакетное изменение наценок, переключение активности, мягкая архивация / жесткое удаление.

  2. Провайдеры и Ликвидность (/admin/providers, /admin/providers/import, /admin/providers/health, /admin/providers/keys):
     - Асинхронная клиентская загрузка ликвидности (LiquidityDashboard) со скелетоном и таймаутом 3000 мс.
     - Shadow Catalog: буферизация 5000+ услуг поставщиков в Redis, выборочный импорт (Cherry-Pick) в PostgreSQL.
     - Зомби-детектор: автоматическое обнаружение услуг, удаленных или отключенных на стороне поставщика.

  3. Заказы и Возвраты (/admin/orders, /admin/orders/[id], /admin/refills):
     - Статусы: PENDING, IN_PROGRESS, COMPLETED, PARTIAL, CANCELED, ERROR.
     - Точный расчет частичных возвратов (BigInt целочисленное деление без float-дрейфа).
     - Drip-Feed Floor Invariant: объем каждого запуска строго >= service.minQty.
     - Повторная отправка сбойных заказов в провайдерские шлюзы.

  4. Финансы, Казначейство и Аудит (/admin/finance, /admin/finance/treasury, /admin/finance/balance-requests, /admin/settings):
     - Финансовый Trust Boundary: любые изменения балансов только через WalletOps с LedgerEntry ДО изменения User.balance.
     - Ручные корректировки баланса (WalletOps.adminAdjust) с обязательным логированием через auditAdminAwaitable.
     - Раздел Настройки: ленивая загрузка журнала аудита (только при tab=audit), защита секретов от перезаписи масками.

  5. Персонал и Безопасность (RBAC, /admin/staff, /admin/clients):
     - Защита всех Server Actions через requireStaffPermission(section, action).
     - Изоляция ролей: OWNER, ADMIN, MANAGER, SUPPORT, CASHIER. Защита от самоповышения прав (Grant Ceiling).
  `;

  // ROUND 1: Red Team Attack (GLM-5.2 / DeepSeek-R1)
  console.log('\x1b[31m[Round 1/3] Red Team Adversary (GLM-5.2) attacking Admin Panel architecture...\x1b[0m');
  const round1Prompt = `
  Ты — ведущий состязательный Red Team аудитор высоконагруженных финтех и e-commerce платформ.
  Твоя задача — найти 5-8 скрытых критических уязвимостей, краевых случаев, гонок состояний (race conditions), утечек данных и точек отказа во всех модулях админ-панели OmniSMM 1.0.

  Сконцентрируйся на:
  1. Каталог: гонки при массовых мутациях цен, некорректные символы в поиске/фильтрах, переполнение пагинации, сбои при отмене/сохранении.
  2. Провайдеры: сбои парсинга курсов валют, зависание внешних API при импорте, дублирование externalId.
  3. Финансы & Заказы: манипуляции с частичными возвратами, гонки при одновременной ручной отмене заказа и вебхуке от провайдера, сбои при нулевом или отрицательном балансе.
  4. RBAC & Сессии: обход прав через прямые вызовы Server Actions, подмена tenantId при междоменной работе.
  5. UI & Viewport: переполнение таблиц на узких экранах, зависание клиентских таймеров, потеря несохраненных данных.

  Верни структурированный отчет: ID дефекта, модуль, сценарий воспроизведения, потенциальный ущерб.
  `;

  const redTeamReport = await queryModel('z-ai/glm-5.2', 'Ты — Red Team Adversary.', `${codebaseContext}\n\n${round1Prompt}`);
  console.log('\x1b[32m✔ Round 1 Complete.\x1b[0m\n');

  // ROUND 2: Blue Team Defense (Nemotron 3 Ultra 550B)
  console.log('\x1b[34m[Round 2/3] Blue Team Defender (Nemotron 3 Ultra 550B) evaluating defenses & pragmatic hardening...\x1b[0m');
  const round2Prompt = `
  Ты — Blue Team Systems Architect и CTO OmniSMM 1.0.
  Ознакомься с отчетом Red Team:
  ---
  ${redTeamReport}
  ---
  Твоя задача:
  1. Оценить реальность каждого риска: где реальная угроза, а где теоретический over-engineering.
  2. Предложить четкие, лаконичные механизмы защиты и валидации для подтвержденных рисков.
  3. Сформулировать требования к стресс-тестам для автоматической проверки админки.
  `;

  const blueTeamReport = await queryModel('nvidia/nemotron-3-ultra-550b-a55b', 'Ты — Blue Team Systems Architect.', `${codebaseContext}\n\n${round2Prompt}`);
  console.log('\x1b[32m✔ Round 2 Complete.\x1b[0m\n');

  // ROUND 3: CTO Arbiter Consensus (Gemini-3-Flash / Inkling)
  console.log('\x1b[35m[Round 3/3] CTO Arbiter formulating definitive audit verdict & stress matrix...\x1b[0m');
  const round3Prompt = `
  Ты — CTO Arbiter платформы OmniSMM 1.0.
  Перед тобой состязательный дебат Red Team и Blue Team:

  [RED TEAM]:
  ${redTeamReport}

  [BLUE TEAM]:
  ${blueTeamReport}

  Сформулируй итоговый МАСТЕР-ОТЧЕТ АУДИТА АДМИН-ПАНЕЛИ:
  1. Топ проверенных модулей и их статус надежности.
  2. Список обязательных защитных механизмов, которые необходимо проверить или внедрить прямо сейчас.
  3. Спецификация стресс-тестов для Vitest (параллельные мутации, экстремальные наценки, нулевые данные, фильтрация).
  `;

  const ctoConsensus = await queryModel('google/gemini-2.0-flash-exp', 'Ты — CTO Arbiter OmniSMM 1.0.', round3Prompt);
  console.log('\x1b[32m✔ Round 3 Complete.\x1b[0m\n');

  const finalOutput = {
    timestamp: new Date().toISOString(),
    redTeam: redTeamReport,
    blueTeam: blueTeamReport,
    ctoConsensus: ctoConsensus
  };

  const outPath = path.resolve(process.cwd(), 'scripts/harness/admin-complete-stress-swarm-report.json');
  fs.writeFileSync(outPath, JSON.stringify(finalOutput, null, 2), 'utf8');
  console.log(`\x1b[32m💾 Полный отчет дебатов сохранен в ${outPath}\x1b[0m`);
}

main().catch(err => {
  console.error('\x1b[31m❌ Ошибка выполнения роя:\x1b[0m', err);
  process.exit(1);
});
