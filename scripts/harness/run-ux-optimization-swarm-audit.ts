import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function queryOpenRouter(model: string, system: string, user: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM UX & Speed Audit Swarm',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.25
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`HTTP ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function runSwarm() {
  console.log('🤖 Running OmniSMM 1.0 UX & Performance Deep Audit via MiniMax-M3 & Expert Swarm...');

  const systemPrompt = `Ты — ведущий международный Principal UX/UI Architect и Staff Performance Engineer (эксперт по Next.js 16, React 19, Tailwind CSS 4, HeroUI, WCAG 2.2 Level AA, ISO 9241-110, мобильным интерфейсам и конверсионным воронкам SaaS/e-Commerce).

Твоя задача — провести глубокий анализ пользовательского опыта (UX/UI) и системной производительности платформы OmniSMM 1.0 (обслуживающей бренды SMMplan и SMMflux), выявить зоны роста конверсии, уменьшения когнитивной нагрузки (Cognitive Load Reduction) и сформулировать исчерпывающие рекомендации.`;

  const userPrompt = `
АРХИТЕКТУРНЫЙ И UX-ПРОФИЛЬ OMNISMM 1.0:

1. МУЛЬТИ-БРЕНДИНГ И ПОЗИЦИОНИРОВАНИЕ:
   - SMMplan (smmplan.pro): Классический строгий API-интерфейс для оптовиков, реселлеров и агентств (PlanCard, PlanButton, плотные таблицы, ExactMath в копейках).
   - SMMflux (smmflux.ru): Современный потребительский B2C-интерфейс (Radiant Aurora, анимации, геймификация, FluxOrderClient, мгновенный чекаут).

2. КЛЮЧЕВЫЕ ПОЛЬЗОВАТЕЛЬСКИЕ СЦЕНАРИИ:
   - Сценарий 1: Быстрый заказ без регистрации (Smart Link Input -> Автораспознавание соцсети и типа ссылки -> Выбор тарифа -> Оплата ЮKassa/СБП/Crypto).
   - Сценарий 2: Личный кабинет клиента (Пополнение баланса, Drip-Feed заказы, история списаний, Ledger транзакции, тикеты саппорта).
   - Сценарий 3: Панель администратора & оператора (/admin, /operator) — переключение между брендами в Header (<GlobalSiteSwitcher />), переключение режимов (EnvironmentModeSwitcher), управление каталогом, ценами, провайдерами и разбором PENDING_CHECK заказов.

3. ЧТО УЖЕ ОПТИМИЗИРОВАНО (БАЗОВЫЙ УРОВЕНЬ):
   - Zero-Latency Skeleton Screens (loading.tsx) для всех 7 разделов админки.
   - Изоляция запросов в Настройках (Tab-Scoped queries вместо монолитного Promise.all).
   - Селективные проекции Prisma (select вместо include).
   - Кэширование с тегами unstable_cache и Redis.
   - Устранение двойных рефрешей при смене брендов.

4. ВОПРОСЫ ДЛЯ ГЛУБОКОГО АУДИТА:
   - А. Как еще улучшить пользовательский опыт (UX/UI) в мастере оформления заказа (Order Wizard) для мобильных и десктоп пользователей?
   - Б. Какие микро-анимации, индикаторы прогресса и фидбек-паттерны (Optimistic UI, haptic feedback, Skeleton micro-interactions) усилят доверие и конверсию?
   - В. Как оптимизировать работу со сложными и большими таблицами в админке (каталог на 500+ услуг, тысячи транзакций) без ухудшения плавности прокрутки (60 FPS)?
   - Г. Какие улучшения можно внедрить в систему пополнения баланса и чекаута (быстрый ввод суммы, предустановленные чипы, СБП QR, прозрачность фискализации 54-ФЗ)?
   - Д. Как сократить время первого взаимодействия (INP / TTI) до абсолютного минимума (< 50 мс)?

Сформируй структурированный отчет с конкретными техническими рецептами, UI-паттернами и оценкой влияния на бизнес-метрики (конверсия, удержание, скорость).
`;

  try {
    const report = await queryOpenRouter('minimax/minimax-m3:free', systemPrompt, userPrompt);
    console.log(`✅ MiniMax-M3 returned ${report.length} chars!`);

    const outPath = path.resolve(process.cwd(), 'scripts/harness/openrouter-ux-optimization-report.md');
    fs.writeFileSync(outPath, report, 'utf-8');
    console.log(`💾 Saved UX audit report to ${outPath}`);
  } catch (err: any) {
    console.error('❌ Error querying MiniMax-M3:', err.message);
  }
}

runSwarm().catch(console.error);
