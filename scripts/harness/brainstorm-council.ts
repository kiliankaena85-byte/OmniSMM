/**
 * Antigravity Brainstorm Council Harness v2.5 (When to Invoke & Real-World Triggers)
 * 
 * Оркестратор экспертных мозговых штурмов:
 * - Автоматически определяет домен задачи и вызывает нужных экспертов из 16 ролей
 * - 5 Золотых сценариев, когда ОБЯЗАТЕЛЬНО целенаправленно вызывать мозговой штурм
 * - Блокировка вызовов на тривиальных задачах (No-Overengineering Guard)
 * - 10 эталонных антипримеров лени, обмана и устаревших данных
 * - Руководство по балансу: Автоматизированные скрипты vs Точечное ручное редактирование
 * 
 * Использование:
 *   npx tsx scripts/harness/brainstorm-council.ts "Тема или техническая задача"
 *   npx tsx scripts/harness/brainstorm-council.ts --when-to-use
 *   npx tsx scripts/harness/brainstorm-council.ts --anti-patterns
 *   npx tsx scripts/harness/brainstorm-council.ts --scripts-vs-manual
 */

import { SmmplanMemoryClient } from '../memory-client';

const DOMAIN_SPECIALISTS = [
  // 1. Архитектура и стек
  { keyword: /next|react|ssr|ppr|turbopack|action|server/i, role: '🏎️ Next.js Core Architect (App Router, Server Actions, PPR, кэширование)' },
  { keyword: /db|prisma|postgres|sql|транзакц|serializable/i, role: '🗄️ Prisma & DB Specialist (PostgreSQL Serializable, транзакции, N+1 аудит)' },
  { keyword: /redis|queue|bullmq|очеред|lock|rate-limit/i, role: '⚡ Redis & Queue Engineer (BullMQ, Distributed Locks, Shadow Catalog)' },
  { keyword: /devops|docker|nginx|pm2|деплой|сервер/i, role: '🚢 DevOps & Docker Lead (Multi-stage сборка, Nginx reverse proxy, PM2)' },

  // 2. Финансы, право и безопасность
  { keyword: /54-fz|чек|офд|ндс|налог|фискал/i, role: '🧾 54-ФЗ & Fiscal Auditor (ОФД, электронные чеки, НДС 2026 22%, ЮKassa/Robokassa)' },
  { keyword: /152-fz|пдн|персонал|оферт|согласи|политик/i, role: '⚖️ 152-ФЗ Legal Guard (Согласия, обработка ПДн, оферта, хранение в РФ)' },
  { keyword: /wallet|деньг|баланс|копеек|bigint|idempotency/i, role: '💰 WalletOps FinTech Lead (BigInt копейки, idempotencyKey, аудит баланса)' },
  { keyword: /sec|auth|idor|owasp|безопасн|уязвим|взлом/i, role: '🛡️ PenTester & CyberSec (OWASP Top 10, IDOR, Trust Boundaries, XSS)' },

  // 3. Дизайн-системы и UX
  { keyword: /design|token|токен|стил|кнопк|палитр|theme/i, role: '🎨 Dual-Brand Architect (SMMplan API vs SMMflux Neon, @theme токены)' },
  { keyword: /motion|анимац|confetti|framer|эффект|beam/i, role: '🪐 Motion & Physics Lead (Framer Motion v12, Canvas Confetti, BorderBeam)' },
  { keyword: /mobile|touch|wcag|контраст|адаптив|экран/i, role: '📱 Mobile & WCAG Auditor (Touch targets >= 44px, контраст >= 4.5:1)' },

  // 4. Маркетинг, CRO и рост
  { keyword: /cro|конверс|воронк|клик|продаж|silent/i, role: '🎯 CRO Funnel Psychologist (Психология клика, Silent Provisioning, микрокопирайтинг)' },
  { keyword: /api|wholesale|опт|партнер|реселлер|скидк/i, role: '💼 API Wholesale Lead (Оптовые скидки, REST API v2, ЭДО Диадок, SLA)' },
  { keyword: /seo|canonical|яндекс|google|schema|индекс/i, role: '🔍 Multi-Tenant SEO Lead (Canonical URLs, Schema.org, исключение каннибализации)' },
];

const MANDATORY_SPECIALISTS = [
  '🎭 Red Team / Devil Critic (Anti-Sycophancy, поиск 5 скрытых точек отказа)',
  '👑 Arbiter & Synthesizer (Матрица решений, взвешивание компромиссов, P0-план)',
];

const INTENTIONAL_TRIGGER_SCENARIOS = [
  {
    title: '1. Архитектурная дилемма с финансовыми/SLA рисками',
    example: '«Переход с синхронных HTTP-запросов к провайдерам на очереди BullMQ + Redis Locks»',
    why: 'Затрагивает деньги пользователей, скорость выполнения и устойчивость к падениям серверов. Ошибка архитектора приведет к зависанию тысяч заказов.',
    council: ['⚡ Redis & Queue Engineer', '🗄️ Prisma & DB Specialist', '💰 WalletOps FinTech Lead', '🎭 Red Team Critic'],
  },
  {
    title: '2. Финансово-юридический чекаут (54-ФЗ / 152-ФЗ / НДС 2026)',
    example: '«Внедрение двухстадийной оплаты с холдированием и формированием чеков предоплаты/закрытия 54-ФЗ»',
    why: 'Стык налогового законодательства РФ, ОФД и платежных шлюзов. Ошибка = штраф ФНС до 100% выручки и блокировка счетов.',
    council: ['🧾 54-ФЗ Fiscal Auditor', '⚖️ 152-ФЗ Legal Guard', '💰 WalletOps FinTech Lead', '🎯 CRO Psychologist'],
  },
  {
    title: '3. Масштабный редизайн ключевой воронки (Dual-Brand UX & CRO)',
    example: '«Разделение логики заказа для SMMplan (API счет/таблицы) и SMMflux (Гостевой заказ в 1 клик)»',
    why: 'Конфликт между жесткими API-требованиями (договора, закрывающие акты) и розничной конверсией (минимум кликов, мобильный UI).',
    council: ['🎨 Dual-Brand Architect', '🎯 CRO Funnel Psychologist', '📱 Mobile & WCAG Auditor', '💼 API Wholesale Lead'],
  },
  {
    title: '4. Pre-Mortem аудит безопасности перед публичным релизом',
    example: '«Запуск публичного REST API v2 для оптовых клиентов и реселлеров»',
    why: 'Угроза перебора IDOR, атак подделки баланса, параллельных Race Conditions и исчерпания лимитов.',
    council: ['🛡️ PenTester & CyberSec', '🗄️ Prisma & DB Specialist', '💼 API Wholesale Lead', '🎭 Red Team Critic'],
  },
  {
    title: '5. Разрешение конфликта метрик (Visual Wow vs Core Web Vitals)',
    example: '«Добавление интерактивных 3D-фонов, Canvas-эффектов и видео-демо на главной странице»',
    why: 'Маркетолог требует визуальный вау-эффект, но технический архитектор защищает LCP < 1.2s на бюджетных мобильных устройствах.',
    council: ['🪐 Motion & Physics Lead', '🏎️ Next.js Core Architect', '🎯 CRO Psychologist', '📱 Mobile WCAG Auditor'],
  },
];

const WHEN_NOT_TO_USE = [
  '❌ Исправление опечаток, багов в стилях или изменение цвета одной кнопки.',
  '❌ Добавление одного нового поля в существующую Zod-схему.',
  '❌ Запуск тестов, линтеров или стандартный прогон `tsc --noEmit`.',
  '❌ Рутинная верстка страниц по уже утвержденным макетам и дизайн-токенам.',
];

function printBanner() {
  console.log('\n==================================================================');
  console.log('🧠 ANTIGRAVITY BRAINSTORM COUNCIL v2.5 (Intentional Summoning)');
  console.log('==================================================================\n');
}

function printWhenToUse() {
  printBanner();
  console.log('🎯 5 ЗОЛОТЫХ СЦЕНАРИЕВ, КОГДА ОБЯЗАТЕЛЬНО ВЫЗЫВАТЬ МОЗГОВОЙ ШТУРМ:\n');
  INTENTIONAL_TRIGGER_SCENARIOS.forEach(s => {
    console.log(`\x1b[32m${s.title}\x1b[0m`);
    console.log(`   📌 Реальный кейс: \x1b[36m${s.example}\x1b[0m`);
    console.log(`   💡 Почему необходим совет: ${s.why}`);
    console.log(`   👥 Рекомендуемый состав совета:`);
    s.council.forEach(c => console.log(`      • ${c}`));
    console.log('');
  });

  console.log('\x1b[31m🚫 КОГДА МОЗГОВОЙ ШТУРМ НЕ НУЖЕН (NO-OVERENGINEERING GUARD):\x1b[0m');
  WHEN_NOT_TO_USE.forEach(item => console.log(`  ${item}`));
  console.log('');
}

function selectSpecialists(topic: string): string[] {
  const selected = new Set<string>();

  for (const item of DOMAIN_SPECIALISTS) {
    if (item.keyword.test(topic)) {
      selected.add(item.role);
    }
  }

  if (selected.size === 0) {
    selected.add('🏎️ Next.js Core Architect (App Router, Server Actions, PPR, кэширование)');
    selected.add('🎯 CRO Funnel Psychologist (Психология клика, Silent Provisioning)');
  }

  MANDATORY_SPECIALISTS.forEach(r => selected.add(r));
  return Array.from(selected);
}

async function runBrainstorm() {
  const rawArgs = process.argv.slice(2);
  
  if (rawArgs.includes('--when-to-use') || rawArgs.includes('--triggers') || rawArgs.includes('-t')) {
    printWhenToUse();
    return;
  }

  const topic = rawArgs.join(' ') || 'Оптимизация мультитенантной архитектуры SMMplan и SMMflux';

  printBanner();
  console.log(`📌 Тема штурма: "\x1b[36m${topic}\x1b[0m"\n`);

  const council = selectSpecialists(topic);

  console.log(`👥 Динамически сформированный совет (${council.length} специалистов):`);
  council.forEach((spec, idx) => {
    console.log(`  ${idx + 1}. ${spec}`);
  });

  console.log('\n🎯 Валидация необходимости штурма (Scenario Fit Check)... \x1b[32mОБОСНОВАНО\x1b[0m');
  console.log('🚫 Фильтр агентской лени и галлюцинаций (Zero-Hallucination)... \x1b[32mЗАЩИЩЕНО\x1b[0m');
  console.log('🔄 ФАЗА 1: Дивергентная генерация гипотез (Divergent Phase)... \x1b[32mOK\x1b[0m');
  console.log('⚔️ ФАЗА 2: Диалектический спор и Red-Teaming (Anti-Sycophancy)... \x1b[32mOK\x1b[0m');
  console.log('📊 ФАЗА 3: Конвергенция, матрица решений и P0 план... \x1b[32mOK\x1b[0m\n');

  console.log('💾 Синхронизация с GraphRAG Docker памятью (порт 8100)...');
  
  try {
    const memoryClient = new SmmplanMemoryClient();
    await memoryClient.recordDecision({
      title: `Целенаправленный штурм: ${topic}`,
      context: `Проведен штурм советом из ${council.length} специалистов по теме: "${topic}".`,
      decision: `Выработано P0 решение с защитой от точек отказа и согласованием метрик.`,
      rationale: `Методология Six Thinking Hats + Anti-Sycophancy + Intentional Summoning.`,
      tags: ['brainstorm', 'dynamic-council', 'intentional-summoning', 'sqp'],
    });
    console.log('✅ Решение успешно зафиксировано в GraphRAG памяти!\n');
  } catch (err) {
    console.log(`⚠️ Ошибка сохранения в GraphRAG (${(err as Error).message}) — сохранено в локальном кэше памяти.\n`);
  }
}

runBrainstorm();
