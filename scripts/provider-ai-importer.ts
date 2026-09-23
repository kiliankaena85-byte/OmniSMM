/**
 * scripts/provider-ai-importer.ts
 * Интерактивный AI-мастер автоматического импорта и классификации каталога услуг SMM-провайдеров.
 *
 * Архитектурный скилл: provider-catalog-importer (OmniSMM 1.0)
 * Стандарты: Taxonomy-First (<= 9 категорий на сеть), Human-in-the-Loop Clarification Gate,
 *            Многофакторная сортировка, Адаптивная ценовая лестница (Safety Floor >= 3.0x).
 */

// Mock server-only for standalone script execution
require.cache[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
} as any;

import * as dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
import {
  CANONICAL_NETWORKS,
  CANONICAL_CATEGORIES,
  resolveCanonicalNetwork,
  resolveCanonicalCategory,
  computeServiceSortOrder,
  calculateImportPrice,
  shouldTriggerHitlReview,
  SessionClassificationMemory,
  AiAnalyzedServiceSchema,
  type AiAnalyzedService,
  auditServiceQuality,
  isMeaninglessCategory,
} from '../src/services/providers/ai-catalog-importer';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ── OpenRouter / Gemini Configuration ──────────────────────────────────────

const OPENROUTER_KEYS = Array.from(
  new Set(
    [
      process.env.OPENROUTER_API_KEY,
      ...(process.env.OPENROUTER_API_KEYS ? process.env.OPENROUTER_API_KEYS.split(',') : []),
    ].filter(Boolean)
  )
) as string[];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const DEFAULT_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-3-flash-preview',
  'deepseek/deepseek-chat',
  'anthropic/claude-3.5-haiku',
];

function cleanJsonMarkdown(raw: string): unknown {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.includes('```json')) {
    cleaned = cleaned.split('```json')[1].split('```')[0].trim();
  } else if (cleaned.includes('```')) {
    cleaned = cleaned.split('```')[1].split('```')[0].trim();
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function queryOpenRouter(
  models: string[],
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 35000
): Promise<{ raw: string; modelUsed: string } | null> {
  if (OPENROUTER_KEYS.length === 0) return null;

  for (const model of models) {
    for (const key of OPENROUTER_KEYS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'HTTP-Referer': 'https://smmplan.pro',
            'X-Title': 'OmniSMM Provider AI Importer',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            return { raw: content, modelUsed: model };
          }
        }
      } catch {
        clearTimeout(timer);
      }
    }
  }

  return null;
}

async function queryGeminiFallback(
  systemPrompt: string,
  userPrompt: string
): Promise<{ raw: string; modelUsed: string } | null> {
  if (!GEMINI_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) {
        return { raw: content, modelUsed: 'google/gemini-2.5-flash' };
      }
    }
  } catch {
    clearTimeout(timer);
  }

  return null;
}

// ── Interactive Terminal Readline Helper ────────────────────────────────────

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// ── System Prompt for Batch Classification ─────────────────────────────────

const AI_IMPORT_SYSTEM_PROMPT = `
Вы — Старший AI Архитектор и Куратор Каталога API SMM платформы OmniSMM 1.0 (SMMplan / SMMflux).
Ваша задача — обработать массив грязных услуг от внешних SMM-провайдеров и вернуть СТРОГО JSON-массив структурированных объектов без лишнего текста и без обертки markdown.

Правила классификации и систематизации:
1. Социальная сеть (networkCode):
   Допустимые значения: "TELEGRAM", "INSTAGRAM", "VK", "YOUTUBE", "TIKTOK", "TWITCH", "DISCORD", "TWITTER", "RUTUBE", "DZEN", "OTHER".
   Если сеть не ясна, пишите "OTHER".
2. Каноническая категория (canonicalCategoryCode):
   СТРОГО одна из канонических категорий первого уровня:
   "SUBSCRIBERS", "LIKES", "VIEWS", "REACTIONS", "COMMENTS", "REPOSTS", "STORIES", "BOOSTS", "STREAMS", "AUTO_SERVICES", "OTHER".
   - Запрещено придумывать свои категории (например "Подписчики РФ" -> category: "SUBSCRIBERS", geo: "RU").
   - Автопросмотры, автолайки, подписки на будущие посты -> "AUTO_SERVICES".
   - Бусты канала -> "BOOSTS".
   - Зрители на стрим -> "STREAMS".
3. Очистка имени (cleanName):
   - Удаляйте мусор провайдеров: [Сервер 1], [ID 1234], [R30], лишние эмодзи в начале.
   - Сформируйте краткое и понятное русское название для витрины: например, "Подписчики — Быстрый запуск (с гарантией)".
4. Метаданные (features):
   - geo: код страны ("RU", "WORLDWIDE", "USA", "KZ", "UZ").
   - warrantyDays: количество дней гарантии от списаний (0 если нет).
   - speedText: скорость выполнения, например "до 50k / день" или "Мгновенно".
   - targetType: тип целевой ссылки ("CHANNEL", "POST", "PROFILE", "VIDEO", "STORY", "COMMENTS", "CUSTOM").
   - qualityTier: "VIP", "PREMIUM", "STANDARD", "ECONOMY".
5. Уверенность (confidence):
   - Число от 0.0 до 1.0. Если есть сомнение в соцсети или категории — ставьте < 0.85 и needsHumanReview: true с причиной в reviewReason.
6. Выявление нерабочих и мусорных услуг (isGarbage):
   - Если услуга нерабочая, сломанная, тестовая ("test only", "не заказывать", "down", "сломано"), ставьте isGarbage: true и укажите причину в garbageReason.

Формат каждого элемента массива:
{
  "externalId": "...",
  "networkCode": "TELEGRAM",
  "networkName": "Telegram",
  "canonicalCategoryCode": "SUBSCRIBERS",
  "categoryName": "Подписчики",
  "cleanName": "Подписчики — Реальные пользователи (Гарантия 30 дней)",
  "description": "⚡️ Запуск: 0–2 часа\\n🚀 Скорость: 1–5k / день\\n🛡 Гарантия: 30 дней\\n💧 Качество: Реальные пользователи",
  "targetType": "CHANNEL",
  "qualityTier": "PREMIUM",
  "geo": "RU",
  "warrantyDays": 30,
  "speedText": "1–5k / день",
  "isPrivateAware": false,
  "confidence": 0.95,
  "needsHumanReview": false,
  "reviewReason": "",
  "isGarbage": false,
  "garbageReason": ""
}
`;

// ── Main Orchestration ─────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 [OmniSMM 1.0] Запуск интерактивного AI-мастера импорта каталога (provider-catalog-importer)');
  console.log('────────────────────────────────────────────────────────────────────────────────');

  // Dynamic imports after server-only mock has loaded into require.cache
  const { db } = await import('../src/lib/db');
  const { providerService } = await import('../src/services/providers/provider.service');
  const { SettingsProvider } = await import('../src/lib/settings');

  // 1. Parse CLI arguments
  const args = process.argv.slice(2);
  const getArg = (name: string): string | null => {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.split('=')[1] : null;
  };
  const isDryRun = args.includes('--dry-run');
  const targetTenant = (getArg('tenant') || 'smmplan') as 'smmplan' | 'flux' | 'both';
  const limitArg = getArg('limit') ? parseInt(getArg('limit')!, 10) : 50;
  const batchSize = getArg('batch-size') ? parseInt(getArg('batch-size')!, 10) : 15;
  const specifiedProvider = getArg('provider');

  // 2. Select Provider
  const providers = await db.provider.findMany({
    where: { isActive: true },
    select: { id: true, name: true, balanceCurrency: true },
  });

  if (providers.length === 0) {
    console.error('❌ В базе данных нет активных провайдеров.');
    process.exit(1);
  }

  let selectedProvider = providers[0];
  if (specifiedProvider) {
    const match = providers.find(
      (p) => p.id === specifiedProvider || p.name.toLowerCase().includes(specifiedProvider.toLowerCase())
    );
    if (match) selectedProvider = match;
  }

  console.log(`📡 Выбран провайдер: ${selectedProvider.name} (ID: ${selectedProvider.id}) | Валюта: ${selectedProvider.balanceCurrency || 'USD'}`);
  console.log(`⚙️ Параметры: limit=${limitArg}, batchSize=${batchSize}, targetTenant=${targetTenant}, dryRun=${isDryRun}`);

  // 3. Load Raw Services
  let rawServices: Array<{ service: string | number; name: string; category?: string; rate: string | number; min: string | number; max: string | number; desc?: string; refill?: boolean }> = [];
  try {
    const instance = await providerService.getProviderInstance(selectedProvider);
    const live = await instance.getServices();
    rawServices = (live as unknown as Array<{ service: string | number; name: string; category?: string; rate: string | number; min: string | number; max: string | number; desc?: string; refill?: boolean }>).slice(0, limitArg);
  } catch (err) {
    console.warn(`⚠️ Не удалось получить живой API провайдера (${err}), читаем из теневого каталога...`);
    const shadows = await db.shadowService.findMany({
      where: { providerId: selectedProvider.id },
      take: limitArg,
    });
    rawServices = shadows.map((s) => ({
      service: s.externalId,
      name: s.name,
      category: s.category || '',
      rate: s.rate,
      min: s.min,
      max: s.max,
      refill: s.refill,
    }));
  }

  if (rawServices.length === 0) {
    const existing = await db.service.findMany({
      where: { providerId: selectedProvider.id },
      take: limitArg,
      include: { category: true },
    });
    rawServices = existing.map((s) => ({
      service: s.externalId || s.id,
      name: s.name,
      category: s.category?.name || '',
      rate: s.rate,
      min: s.minQty,
      max: s.maxQty,
      refill: s.isRefillEnabled,
    }));
  }

  if (rawServices.length === 0) {
    console.log('ℹ️ Нет доступных услуг для импорта.');
    process.exit(0);
  }

  console.log(`📦 Загружено ${rawServices.length} услуг от провайдера для AI-обработки.`);

  // 3.5. Sanitary Audit & Quality Gatekeeper (INV-IMP-006)
  const sanitaryStats = {
    garbage: 0,
    invalidParams: 0,
    orphan: 0,
    toxic: 0,
  };
  const rejectedServices: Array<{ id: string; name: string; reason: string; category: string }> = [];
  const validServices: typeof rawServices = [];
  const recoveredServices: typeof rawServices = [];

  for (const s of rawServices) {
    const audit = auditServiceQuality({
      service: s.service,
      name: s.name,
      category: s.category,
      rate: s.rate,
      min: s.min,
      max: s.max,
    });

    if (audit.status === 'REJECT') {
      if (audit.rejectCategory === 'GARBAGE') sanitaryStats.garbage++;
      else if (audit.rejectCategory === 'INVALID_PARAMS') sanitaryStats.invalidParams++;
      else if (audit.rejectCategory === 'ORPHAN') sanitaryStats.orphan++;
      else if (audit.rejectCategory === 'TOXIC') sanitaryStats.toxic++;

      rejectedServices.push({
        id: String(s.service),
        name: s.name,
        reason: audit.reason || 'Отклонено санитарным фильтром',
        category: audit.rejectCategory || 'GARBAGE',
      });
      continue;
    }

    if (audit.status === 'NEEDS_REVIEW') {
      recoveredServices.push(s);
    }
    validServices.push(s);
  }

  console.log('\n🛡️ [Sanitary Gate] Результаты санитарного аудита качества:');
  console.log(`  ✅ Допущено к AI-обработке: ${validServices.length} из ${rawServices.length}`);
  if (recoveredServices.length > 0) {
    console.log(`  🔧 Восстановлено услуг без категории (определена соцсеть): ${recoveredServices.length}`);
  }
  if (rejectedServices.length > 0) {
    console.log(`  🛑 Отклонено нерабочих/мусорных услуг: ${rejectedServices.length}`);
    if (sanitaryStats.garbage > 0) console.log(`     - 🗑️ Нерабочие / тестовые / архивные: ${sanitaryStats.garbage}`);
    if (sanitaryStats.invalidParams > 0) console.log(`     - 📐 Невалидные параметры (min/max/rate): ${sanitaryStats.invalidParams}`);
    if (sanitaryStats.orphan > 0) console.log(`     - 👻 Бессмысленные сироты (нет категории и сети): ${sanitaryStats.orphan}`);
    if (sanitaryStats.toxic > 0) console.log(`     - ☣️ Токсичные / запрещенные: ${sanitaryStats.toxic}`);
  }

  rawServices = validServices;

  if (rawServices.length === 0) {
    console.log('\nℹ️ Все загруженные услуги были отклонены санитарным фильтром как мусорные или невалидные.');
    process.exit(0);
  }

  // 4. Financial constants setup
  const usdRate = await SettingsProvider.getExchangeRateUSD();
  const sessionMemory = new SessionClassificationMemory();

  let totalImported = 0;
  let totalReviewed = 0;
  let totalSkipped = 0;

  // 5. Batch processing
  for (let i = 0; i < rawServices.length; i += batchSize) {
    const batch = rawServices.slice(i, i + batchSize);
    console.log(`\n⏳ Обработка батча ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawServices.length / batchSize)} (${batch.length} услуг)...`);

    const userPrompt = `Услуги для обработки:\n${JSON.stringify(
      batch.map((s) => ({
        externalId: String(s.service),
        name: s.name,
        category: s.category || '',
        rate: s.rate,
        min: s.min,
        max: s.max,
      })),
      null,
      2
    )}`;

    let aiResult: unknown = null;
    const openRouterRes = await queryOpenRouter(DEFAULT_MODELS, AI_IMPORT_SYSTEM_PROMPT, userPrompt);
    if (openRouterRes) {
      aiResult = cleanJsonMarkdown(openRouterRes.raw);
    }

    if (!aiResult) {
      const geminiRes = await queryGeminiFallback(AI_IMPORT_SYSTEM_PROMPT, userPrompt);
      if (geminiRes) {
        aiResult = cleanJsonMarkdown(geminiRes.raw);
      }
    }

    let parsedServices: AiAnalyzedService[] = [];
    if (Array.isArray(aiResult)) {
      parsedServices = aiResult
        .map((item) => {
          const res = AiAnalyzedServiceSchema.safeParse(item);
          return res.success ? res.data : null;
        })
        .filter(Boolean) as AiAnalyzedService[];
    }

    // Fallback if AI call failed
    if (parsedServices.length === 0) {
      console.warn('⚠️ Сбой ответа AI, применяем локальный эвристический парсер для данного батча.');
      parsedServices = batch.map((s) => {
        const net = resolveCanonicalNetwork(s.name + ' ' + (s.category || ''));
        const cat = resolveCanonicalCategory(s.name + ' ' + (s.category || ''));
        return {
          externalId: String(s.service),
          networkCode: net.code,
          networkName: net.name,
          canonicalCategoryCode: cat.code,
          categoryName: cat.name,
          cleanName: s.name.replace(/\[.*?\]/g, '').trim(),
          targetType: cat.targetType,
          qualityTier: 'STANDARD',
          geo: 'WORLDWIDE',
          warrantyDays: s.refill ? 30 : 0,
          speedText: 'Стандартная',
          isPrivateAware: false,
          confidence: 0.80,
          needsHumanReview: true,
          reviewReason: 'Локальный эвристический fallback (требует подтверждения)',
        };
      });
    }

    // 6. Human-in-the-Loop Clarification Gate & Multi-Factor Processing
    for (const analyzed of parsedServices) {
      const rawMatch = batch.find((b) => String(b.service) === analyzed.externalId);
      if (!rawMatch) continue;

      // Check if AI flagged as garbage
      if (analyzed.isGarbage) {
        console.log(`\n🗑️ [AI Garbage Gate] Услуга [ID: ${analyzed.externalId}] "${rawMatch.name}" отклонена ИИ: ${analyzed.garbageReason || 'Мусорная услуга'}`);
        totalSkipped++;
        continue;
      }

      // Check Session Memory first
      const rawCatKey = rawMatch.category || rawMatch.name;
      if (sessionMemory.has(rawCatKey)) {
        const cached = sessionMemory.get(rawCatKey)!;
        analyzed.networkCode = cached.networkCode;
        analyzed.canonicalCategoryCode = cached.canonicalCategoryCode;
        analyzed.confidence = 1.0;
        analyzed.needsHumanReview = false;
      }

      // Check if HITL review is triggered
      const hitlCheck = shouldTriggerHitlReview({
        networkCode: analyzed.networkCode,
        canonicalCategoryCode: analyzed.canonicalCategoryCode,
        confidence: analyzed.confidence,
        needsHumanReview: analyzed.needsHumanReview,
      });

      if (hitlCheck.triggered) {
        totalReviewed++;
        console.log('\n┌────────────────────────────────────────────────────────────────────────┐');
        console.log('│ ❓ ТРЕБУЕТСЯ УТОЧНЕНИЕ ОПЕРАТОРА (HUMAN-IN-THE-LOOP)                  │');
        console.log('├────────────────────────────────────────────────────────────────────────┤');
        console.log(`│ Услуга: [ID: ${analyzed.externalId}] "${rawMatch.name}"`);
        console.log(`│ Исходная категория провайдера: "${rawMatch.category || 'Нет'}"`);
        console.log(`│ Оценка ИИ: Сеть=${analyzed.networkName} | Категория=${analyzed.categoryName} | Уверенность: ${(analyzed.confidence * 100).toFixed(0)}%`);
        console.log(`│ Причина сомнения: ${hitlCheck.reason || analyzed.reviewReason || 'Неизвестно'}`);
        console.log('├────────────────────────────────────────────────────────────────────────┤');
        console.log('│ Варианты действия:');
        console.log(`│  [1] Подтвердить вариант ИИ ("${analyzed.categoryName}")`);
        console.log('│  [2] Выбрать другую каноническую категорию');
        console.log('│  [3] Пропустить данную услугу');
        console.log('│  [4] Подтвердить вариант ИИ и ЗАПОМНИТЬ для всех подобных услуг в батче');
        console.log('└────────────────────────────────────────────────────────────────────────┘');

        const choice = await askQuestion('👉 Ваш выбор (1-4) [По умолчанию 1]: ');

        if (choice === '3') {
          console.log(`⏭️ Услуга ${analyzed.externalId} пропущена оператором.`);
          totalSkipped++;
          continue;
        } else if (choice === '2') {
          console.log('\nДоступные канонические категории:');
          CANONICAL_CATEGORIES.forEach((c, idx) => {
            console.log(`  [${idx + 1}] ${c.name} (${c.code})`);
          });
          const catIdxStr = await askQuestion('👉 Введите номер категории (1-11): ');
          const catIdx = parseInt(catIdxStr, 10) - 1;
          if (catIdx >= 0 && catIdx < CANONICAL_CATEGORIES.length) {
            const picked = CANONICAL_CATEGORIES[catIdx];
            analyzed.canonicalCategoryCode = picked.code;
            analyzed.categoryName = picked.name;
            console.log(`✅ Назначена категория: ${picked.name}`);
          }
        } else if (choice === '4') {
          sessionMemory.set(rawCatKey, {
            networkCode: analyzed.networkCode,
            canonicalCategoryCode: analyzed.canonicalCategoryCode,
          });
          console.log(`💾 Выбор сохранен в память сессии для паттерна "${rawCatKey}".`);
        }
      }

      // 7. Calculate Pricing
      const pricing = calculateImportPrice({
        rawRate: typeof rawMatch.rate === 'number' ? rawMatch.rate : parseFloat(String(rawMatch.rate)) || 0,
        providerCurrency: selectedProvider.balanceCurrency || 'USD',
        usdRate,
      });

      // 8. Commit to Database (if not dry run)
      if (!isDryRun) {
        const netDef = resolveCanonicalNetwork(analyzed.networkCode);
        const catDef = resolveCanonicalCategory(analyzed.canonicalCategoryCode);

        // Ensure Network
        let networkRecord = await db.network.findFirst({
          where: { slug: netDef.slug },
        });
        if (!networkRecord) {
          networkRecord = await db.network.create({
            data: {
              name: netDef.name,
              slug: netDef.slug,
              sortOrder: netDef.sortOrder,
              tenantId: 'all',
              isActive: true,
            },
          });
        }

        // Ensure Category
        let categoryRecord = await db.category.findFirst({
          where: {
            networkId: networkRecord.id,
            activityType: catDef.code,
          },
        });
        if (!categoryRecord) {
          categoryRecord = await db.category.create({
            data: {
              name: catDef.name,
              slug: `${netDef.slug}-${catDef.code.toLowerCase().replace(/_/g, '-')}`,
              networkId: networkRecord.id,
              activityType: catDef.code,
              sortOrder: catDef.sortOrder,
              targetType: catDef.targetType,
              tenantId: 'all',
              isActive: true,
            },
          });
        }

        // Calculate Sort Order
        const sortOrder = computeServiceSortOrder({
          qualityTier: analyzed.qualityTier,
          warrantyDays: analyzed.warrantyDays,
          pricePerUnitRub: pricing.pricePerUnitRub,
          priceRankIndex: 0,
        });

        const slug = `${netDef.slug}-${catDef.code.toLowerCase().replace(/_/g, '-')}-${analyzed.externalId}`;
        const tenants = targetTenant === 'both' ? ['smmplan', 'flux'] : [targetTenant];

        for (const tId of tenants) {
          await db.service.upsert({
            where: {
              tenantId_providerId_externalId: {
                tenantId: tId,
                providerId: selectedProvider.id,
                externalId: String(analyzed.externalId),
              },
            },
            update: {
              name: analyzed.cleanName,
              description: analyzed.description || null,
              rate: pricing.costPer1kRub,
              markup: pricing.effectiveMarkup,
              pricePer1000Cents: pricing.pricePer1000Cents,
              targetType: analyzed.targetType,
              qualityTier: analyzed.qualityTier as 'STANDARD' | 'VIP' | 'PREMIUM' | 'ECONOMY',
              sortOrder,
              isActive: true,
            },
            create: {
              name: analyzed.cleanName,
              slug,
              description: analyzed.description || null,
              categoryId: categoryRecord.id,
              providerId: selectedProvider.id,
              externalId: String(analyzed.externalId),
              rate: pricing.costPer1kRub,
              markup: pricing.effectiveMarkup,
              pricePer1000Cents: pricing.pricePer1000Cents,
              minQty: typeof rawMatch.min === 'number' ? rawMatch.min : parseInt(String(rawMatch.min), 10) || 10,
              maxQty: typeof rawMatch.max === 'number' ? rawMatch.max : parseInt(String(rawMatch.max), 10) || 10000,
              targetType: analyzed.targetType,
              qualityTier: analyzed.qualityTier as 'STANDARD' | 'VIP' | 'PREMIUM' | 'ECONOMY',
              sortOrder,
              tenantId: tId,
              isDripFeedEnabled: true,
              isRefillEnabled: analyzed.warrantyDays > 0,
              isActive: true,
            },
          });
        }
      }

      totalImported++;
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log('🎉 ИМПОРТ И СИСТЕМАТИЗАЦИЯ КАТАЛОГА ЗАВЕРШЕНЫ УСПЕШНО!');
  console.log(`📊 Успешно импортировано/допущено услуг: ${totalImported}`);
  console.log(`🛡️ Отсеяно санитарным фильтром качества: ${rejectedServices.length}`);
  if (rejectedServices.length > 0) {
    console.log(`   - 🗑️ Нерабочие / тестовые / архивные: ${sanitaryStats.garbage}`);
    console.log(`   - 📐 Невалидные параметры: ${sanitaryStats.invalidParams}`);
    console.log(`   - 👻 Бессмысленные сироты: ${sanitaryStats.orphan}`);
    console.log(`   - ☣️ Токсичные / запрещенные: ${sanitaryStats.toxic}`);
  }
  console.log(`❓ Прошли через Human-in-the-Loop: ${totalReviewed}`);
  console.log(`⏭️ Пропущено услуг (ИИ / оператор): ${totalSkipped}`);
  console.log(`🎯 Целевой тенант: ${targetTenant} | Режим: ${isDryRun ? 'DRY-RUN (без записи)' : 'БОЕВАЯ ЗАПИСЬ'}`);
  console.log('════════════════════════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Критическая ошибка выполнения:', err);
  process.exit(1);
});
