import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ModelCallConfig {
  models: string[];
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  timeoutMs?: number;
}

async function callOpenRouterWithFallback(config: ModelCallConfig): Promise<string> {
  const { models, systemPrompt, userPrompt, temperature = 0.1, timeoutMs = 75000 } = config;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const payload: Record<string, any> = {
    model: models[0],
    models: models.slice(0, 3),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
  };

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'SMMplan Dashboard Enterprise Swarm',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || 'Empty response';
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

async function runDashboardSwarm() {
  console.log('\n======================================================================');
  console.log('   🏛️  SMMplan & SMMflux Client Dashboard Enterprise Swarm Audit      ');
  console.log('======================================================================\n');

  const roadmapDocument = `
# SMMplan & SMMflux Client Dashboard (Личный Кабинет) Comprehensive Audit & Testing Roadmap

## 1. ОБЗОР ЭКРАНОВ И ВКЛАДОК (ДВА ТЕНАНТА: SMMplan API / SMMflux Radiant Aurora)
- **Вкладка 1: Главная (/dashboard)**
  - Кнопки: «Быстрый заказ», «Пополнить баланс», «Повторить заказ», «Подробнее о заказе», переключатель валют/тем.
  - Математика: Баланс (RUB / Kopecks), сумма расходов за 30 дней, активные заказы, тикеты в ожидании.
- **Вкладка 2: Новый Заказ (/dashboard/new-order)**
  - Поля: Выбор соцсети (30+), Категория, Услуга, Ссылка на объект (с валидацией SafeRegexValidator), Количество (с авто-мин service.minQty).
  - Опции: Drip-Feed (Запуски N, Интервал M минут), Промокод / Скидка лояльности.
  - Математика: Стоимость = ExactMath.calculateOrderCostKopecks(qty, ratePer1k), проверка баланса, минимальный пол Drip-Feed = minQty * runs.
- **Вкладка 3: Мои Заказы (/dashboard/orders & /dashboard/orders/[id])**
  - Элементы: Фильтры статусов, Поиск по ID/ссылке/названию, Пагинация (15 строк), Кнопка Отмены (CancelOrderButton), Кнопка Гарантии (RefillRequestButton), Кнопка Повтора (RepeatOrderButton), Модалка Деталей Списаний (ChargeBreakdownModal), Модалка Доплаты (RetryPaymentModal).
  - Математика: Прогресс выполнения (startCount, remains, total), расчет суммы возврата при частичном выполнении (PARTIAL refund).
- **Вкладка 4: Финансы & История Транзакций (/dashboard/finance, /dashboard/transactions, /dashboard/add-funds, /dashboard/deposit)**
  - Элементы: Выбор платежного метода (ЮKassa, СБП, Robokassa, CryptoBot), ввод суммы пополнения, кнопка «Перейти к оплате», таблица проводок LedgerEntry.
  - Математика: Проверка минимальной суммы (от 10 ₽), расчет комиссии шлюза, строгая конвертация рублей в копейки без float-ошибок.
- **Вкладка 5: Партнерская программа (/dashboard/referrals)**
  - Элементы: Реферальная ссылка, кнопка копирования, QR-код, карточки тиров (5% -> 20%), история начислений, модалка заявки на вывод (WithdrawalModal).
  - Математика: Расчет процента от пополнений рефералов, агрегация LTV, проверка порога минимального вывода.
- **Вкладка 6: Smart Drip & Автоматизация (/dashboard/smart-drip)**
  - Элементы: Конфигуратор расписания, интервалы запусков, паузы, счетчик общего объема, предпросмотр графика, кнопка «Запустить кампанию».
  - Математика: Строгая проверка Drip-Feed Floor Invariant: Math.floor(quantity / runs) >= service.minQty.
- **Вкладка 7: Служба поддержки & Тикеты (/dashboard/tickets, /dashboard/tickets/[id], /support)**
  - Элементы: Форма создания тикета (Категория, ID Заказа, Тема, Описание, Загрузка скринов), Живой чат переписки, Telegram-синхронизация, AI Copilot.
  - Математика: Счетчик непрочитанных сообщений, SLA время ответа.
- **Вкладка 8: Настройки аккаунта & API (/dashboard/settings, /dashboard/settings/api)**
  - Элементы: Смена пароля, Привязка Telegram (Smart Bind), Генерация API-ключа (SMM v2 API), Управление вебхуками.

## 2. МАТРИЦА БЛОКЕРОВ (BLOCKERS & MITIGATIONS)
1. **Блокер: Мульти-тенантный рассинхрон (Tenant State Leak)**
   - Риск: Утечка стилей, логотипов или заказов между SMMplan и SMMflux.
   - Митигация: Строгая изоляция через ITenantDashboardStrategy, Server Actions с tenantId guard, scoped CSS tokens.
2. **Блокер: Ошибки сериализации BigInt и округления денежных сумм**
   - Риск: Next.js throw при передаче BigInt в клиентские компоненты, расхождения в копейках.
   - Митигация: Использование ExactMath + toClientKopecks(bigint) / formatRubles().
3. **Блокер: Обрезание колонок и горизонтальный скролл на мобильных устройствах**
   - Риск: Нарушение Zero Column Clipping Rule на экранах < 768px.
   - Митигация: Адаптивный Card View для мобильных (MobileOrderList), компактная плотность text-xs px-2.
4. **Блокер: Рассинхрон Optimistic UI при сбоях сети**
   - Риск: Зависание фантомных записей при сбое сервера.
   - Митигация: 10s TTL таймер авто-очистки, откат стейта с возвратом ошибки, idempotencyKey на все мутации.
5. **Блокер: Валидация недостоверных внешних систем без интернета (Sandbox Fallback)**
   - Риск: Падение тестов при обращении к реальным шлюзам ЮKassa/Robokassa.
   - Митигация: Разделение Live Tunnel Integration и Mock Sandbox API.
`;

  // ROUND 1: RED TEAM
  console.log('[ROUND 1/3] 🔴 Red Team Attack (MiniMax M3 / GLM-5.2)...');
  const r1Start = Date.now();
  const redPrompt = `Analyze the provided Dashboard Roadmap. Uncover 3-5 subtle failure scenarios, missing edge cases in buttons, inputs, financial math, tenant isolation, or mobile UX. Output concise Russian bullet points with failure modes and affected components.`;
  
  const redResponse = await callOpenRouterWithFallback({
    models: ['minimax/minimax-m3:free', 'z-ai/glm-5.2:free', 'openrouter/free'],
    systemPrompt: 'You are the Lead Adversarial Red Team Architect. Be ruthless in finding edge cases in client dashboard workflows. Reply in Russian.',
    userPrompt: `${roadmapDocument}\n\n${redPrompt}`,
    temperature: 0.1,
  });
  console.log(`✔ Round 1 Complete (${((Date.now() - r1Start)/1000).toFixed(1)}s):\n${redResponse.slice(0, 1000)}...\n`);

  // ROUND 2: BLUE TEAM
  console.log('[ROUND 2/3] 🔵 Blue Team Defense (MiniMax M2.7 / Nemotron)...');
  const r2Start = Date.now();
  const bluePrompt = `Review the Red Team critiques against the Roadmap. Defend pragmatic engineering solutions, explain how existing controls mitigate them, or accept valid gaps into the implementation plan. Reply in Russian.`;
  
  const blueResponse = await callOpenRouterWithFallback({
    models: ['minimax/minimax-m2.7:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'openrouter/free'],
    systemPrompt: 'You are the Principal Systems Architect (Blue Team). Provide realistic, production-tested defenses and actionable solutions. Reply in Russian.',
    userPrompt: `ROADMAP:\n${roadmapDocument}\n\nRED TEAM CRITIQUE:\n${redResponse}\n\n${bluePrompt}`,
    temperature: 0.1,
  });
  console.log(`✔ Round 2 Complete (${((Date.now() - r2Start)/1000).toFixed(1)}s):\n${blueResponse.slice(0, 1000)}...\n`);

  // ROUND 3: CTO ARBITER
  console.log('[ROUND 3/3] ⚖️  CTO Arbiter Consensus (MiniMax M3 / Gemini)...');
  const r3Start = Date.now();
  const ctoPrompt = `Synthesize the debate into a definitive, structured Enterprise Action Plan for the Client Dashboard:
1. Итоговый вердикт CTO и оценка готовности (Score / 100)
2. Точный список блокеров и инженерные решения для их обхода
3. Пошаговый план Smoke и E2E тестов для каждой кнопки, вкладки и поля ввода
4. Список визуальных (WCAG 2.2 AA / Tailwind 4) и UX улучшений для реальной жизни
Ответь на русском языке структурированно и ёмко.
`;

  const ctoResponse = await callOpenRouterWithFallback({
    models: ['minimax/minimax-m3:free', 'poolside/laguna-s-2.1:free', 'openrouter/free'],
    systemPrompt: 'You are the Fractional CTO & Chief Arbiter. Deliver an authoritative, production-grade master plan. Reply in Russian.',
    userPrompt: `ROADMAP:\n${roadmapDocument}\n\nRED TEAM:\n${redResponse}\n\nBLUE TEAM:\n${blueResponse}\n\n${ctoPrompt}`,
    temperature: 0.1,
  });
  console.log(`✔ Round 3 Complete (${((Date.now() - r3Start)/1000).toFixed(1)}s):\n${ctoResponse}\n`);

  fs.writeFileSync(
    path.resolve(process.cwd(), '.planning/audit/DASHBOARD_SWARM_AUDIT_REPORT.md'),
    `# 🏛️ Client Dashboard Enterprise Swarm Audit Report\n\n**Date:** ${new Date().toISOString()}\n\n## Round 1: Red Team Attack\n${redResponse}\n\n## Round 2: Blue Team Defense\n${blueResponse}\n\n## Round 3: CTO Master Synthesis\n${ctoResponse}\n`,
    'utf8'
  );
  console.log('📄 Saved complete audit to .planning/audit/DASHBOARD_SWARM_AUDIT_REPORT.md');
}

runDashboardSwarm().catch(err => {
  console.error('❌ Swarm error:', err.message);
  process.exit(1);
});
