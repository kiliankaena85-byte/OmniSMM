import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ModelAuditResult {
  model: string;
  response: string;
  durationMs: number;
}

async function queryOpenRouterModel(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://smmplan.pro',
        'X-Title': 'OmniSMM Performance Optimization Swarm',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function runOptimizationAuditSwarm() {
  console.log('🚀 Starting OmniSMM 1.0 Performance & Latency Optimization Swarm...');

  const systemPrompt = `Ты — ведущий мировой архитектор высокопроизводительных веб-систем (Next.js 16, React 19, Tailwind CSS 4, PostgreSQL/Prisma, Redis, BullMQ).
Твоя задача — провести глубокий технический аудит производительности платформы OmniSMM 1.0 (SMMplan / SMMflux), выявить узкие места задержек (TTFB, FCP, LCP, INP, Database query latency, Client-side navigation lag) и составить конкретный, приоритизированный план оптимизации.`;

  const auditContext = `
КОНТЕКСТ АРХИТЕКТУРЫ OMNISMM 1.0:
1. Стек: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4 (@theme в CSS), TypeScript 5.7, PostgreSQL 16 (Prisma 5), Redis 7 (ioredis, BullMQ), Cloudflare Tunnel.
2. Главная страница (Storefront / Landing / Order Wizard):
   - Файл: src/app/page.tsx, SmartLinkLanding.tsx, Header.tsx, FluxOrderClient.tsx.
   - Текущее состояние: "export const dynamic = 'force-dynamic'".
   - Выполняются запросы getPublicCatalogAction(tenantId), getServicesByCategoryAction(defaultCategoryId), SettingsProvider.getContactAndLegalSettings(), verifySession().
   - Используются dynamic imports для нижних блоков (FluxWhyUs, FluxReviews, MegaFooter).
3. Переключение сайтов (Multi-Tenant Switcher):
   - Файл: src/components/admin/tenant-switcher.tsx (<GlobalSiteSwitcher />).
   - Текущая логика: вызов switchAdminTenantAction(tenantId) -> router.replace(pathname + '?tenant=' + id) -> router.refresh().
   - Сохранение в куке x_admin_tenant.
4. Переключение режимов (Environment & Test Mode):
   - Файл: src/components/admin/EnvironmentModeSwitcher.tsx, src/app/admin/layout.tsx.
   - Текущая логика: getEnvironmentModeAction -> setEnvironmentModeAction -> SettingsManager.isTestMode.
5. Админ-панель и переключение вкладок:
   - Файл: src/app/admin/layout.tsx, src/components/admin/sidebar.tsx, src/components/admin/tabbed-header.tsx.
   - Вкладки: /admin/dashboard, /admin/orders, /admin/catalog, /admin/catalog/categories, /admin/providers, /admin/finance, /admin/settings, /admin/clients, /admin/tickets.
   - В большинстве разделов (/admin/catalog, /admin/finance, /admin/settings, /admin/providers) отсутствуют локальные loading.tsx (файлы Skeleton экранов), из-за чего Next.js блокирует клиентский переход до полного завершения SSR.
   - В /admin/settings/page.tsx при каждом клике на любую вкладку (system, integrations, team, proxy, telegram) выполняются запросы сразу для ВСЕХ 7 разделов одновременно через Promise.all([...]).

ЗАДАЧА АУДИТА:
1. Проанализируй узкие места задержек и медленных переключений (UX latency / UI freeze).
2. Сформулируй конкретные архитектурные решения по каждому направлению:
   - А. Главная страница (витрина и заказ услуг).
   - Б. Переключение сайтов (SMMplan / SMMflux) в шапке.
   - В. Переключение режимов (Test Mode / Sandbox / Production).
   - Г. Настройки и вкладки админки (Zero-Latency Tab Switching, локальные loading.tsx, изоляция запросов по табам).
   - Д. База данных и кэширование (Prisma select, unstable_cache tags, Redis memory caching).
3. Оцени ожидаемый эффект (на что повлияет: TTFB, скорость перехода между экранами, нагрузка на БД, LCP/INP).
`;

  // Model candidates to probe (MiniMax, GLM/JLM, Qwen, DeepSeek, Gemini)
  const candidateModels = [
    'minimax/minimax-01',
    'minimax/minimax-m3:free',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-r1:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-001',
    'google/gemini-2.0-flash-exp:free',
    'mistralai/mistral-small-24b-instruct-2501:free',
  ];

  const results: ModelAuditResult[] = [];

  for (const model of candidateModels) {
    if (results.length >= 2) break; // We need at least 2 top models for peer verification
    console.log(`📡 Querying model via OpenRouter: ${model}...`);
    const start = Date.now();
    try {
      const resp = await queryOpenRouterModel(model, systemPrompt, auditContext);
      if (resp && resp.length > 200) {
        const durationMs = Date.now() - start;
        console.log(`✅ Received audit from ${model} in ${durationMs}ms (${resp.length} chars)`);
        results.push({ model, response: resp, durationMs });
      }
    } catch (e: any) {
      console.log(`⚠️ Model ${model} skipped: ${e.message}`);
    }
  }

  // Save raw audit outputs
  const reportPath = path.resolve(process.cwd(), 'scripts/harness/openrouter-performance-audit-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`💾 Saved ${results.length} model audit responses to ${reportPath}`);
}

runOptimizationAuditSwarm().catch(err => {
  console.error('Fatal error in audit swarm:', err);
});
