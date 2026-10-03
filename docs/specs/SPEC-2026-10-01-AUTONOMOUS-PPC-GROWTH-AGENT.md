# SPEC-2026-10-01: Autonomous PPC Growth Agent (OmniSMM Direct Autopilot)

> **Статус:** DRAFT (Подлежит аудиту через Dual-Agent Self-Improving Loop)  
> **Версия спецификации:** 1.0.0  
> **Целевой стандарт:** SDD-TDD 2026, AGENTS.md (v4.2), OWASP Top 10:2026, RFC 9331 (RateLimit), Circuit Breaker  
> **Затрагиваемые компоненты:** 
> - `src/services/ppc/autonomous-ppc-agent.ts` (Главный координатор цикла OODA)
> - `src/services/ppc/yandex-direct-client.ts` (Строго типизированный клиент API v5)
> - `src/services/ppc/yandex-metrika-client.ts` (Клиент телеметрии и поисковых фраз)
> - `src/services/ppc/intent-classifier.ts` (LLM-классификатор мусорных интентов на gemini-3-flash)
> - `src/services/ppc/clickfraud-sentinel.ts` (Детектор ботов и синхронизация сегмента -100%)
> - `src/services/ppc/cro-retention-webhook.ts` (Триггерный дожим брошенных регистраций)
> - `scripts/ppc-autopilot-daemon.ts` (Ежедневный фоновый запуск в 02:00 МСК)

---

## 1. Назначение и Архитектурные Инварианты

Автономный агент осуществляет непрерывную 24/7 оптимизацию рекламных кампаний SMMplan в Яндекс.Директ без участия человека, повышая рентабельность маркетинга (ROAS), защищая бюджет от скликивания ботами и стимулируя конверсию в первую оплату в рамках строгого лимита **28 000 ₽ / нед (4 000 ₽ / день)**.

### Архитектурные Инварианты:
1. **INVARIANT-PPC-1 (Budget Ceiling Guard):** Агент категорически не имеет права увеличивать дневной лимит свыше значения `maxDailyBudgetRub` (по умолчанию 4 000 ₽). Любые оптимизации ставок обязаны оставаться внутри согласованного потолка.
2. **INVARIANT-PPC-2 (Fail-Closed Token & Auth):** Доступ к Яндекс API осуществляется строго через защищенный токен из `.yandex-oauth-token` (или Vault). При ошибках авторизации (401/403) агент немедленно прерывает выполнение, переходит в безопасный режим и отправляет алерт в Telegram владельцу.
3. **INVARIANT-PPC-3 (Zero-Any Strict Typing):** Никаких деклараций `any` во взаимодействии с API Яндекса. Все ответы API Direct v5 и Metrika API обязаны валидироваться через схемы Zod или строгие TypeScript интерфейсы.
4. **INVARIANT-PPC-4 (Circuit Breaker & Rate Limiting):** Запросы к API Яндекса лимитируются экспоненциальной задержкой (Exponential Backoff с jitter) и тайм-аутом `AbortSignal.timeout(15000)`. При 3 последовательных сбоях шлюза срабатывает Circuit Breaker на 30 минут.
5. **INVARIANT-PPC-5 (Auditable Ledger of Changes):** Каждая мутация ставок, добавление минус-слов или блокировка IP протоколируется в таблицу базы данных `PpcActionLog` и локальный журнал `.planning/ACTION_DECISIONS_LOG.md` с хэшем изменений.
6. **INVARIANT-PPC-6 (Policy 15 Immunity):** Агент проверяет любое новое объявление или ключевую фразу на стоп-слова («накрутка», «боты», «инвайтинг», «спам») до отправки на модерацию в Директ.

---

## 2. Модульная Структура Сервисов

### 2.1. YandexDirectClient (`src/services/ppc/yandex-direct-client.ts`)
Инкапсулирует вызовы к официальному API Яндекс.Директ v5:
- `getCampaigns(ids?: number[]): Promise<DirectCampaign[]>`
- `updateKeywordBids(bids: Array<{ keywordId: number; bidRub: number }>): Promise<void>`
- `appendMinusKeywords(campaignId: number, minusWords: string[]): Promise<void>`
- `getSearchQueriesReport(dateFrom: string, dateTo: string): Promise<SearchQueryStat[]>`

### 2.2. YandexMetrikaClient (`src/services/ppc/yandex-metrika-client.ts`)
Взаимодействует со счетчиком `113263331`:
- `getSearchPhrasesWithBounceRate(days: number): Promise<MetrikaPhrasePerformance[]>`
- `getHighProbabilityRobots(days: number): Promise<string[]>`
- `syncRobotsAdjustment(campaignIds: number[]): Promise<void>` (установка сегмента `-100%`)

### 2.3. IntentClassifier (`src/services/ppc/intent-classifier.ts`)
Семантический классификатор на базе `gemini-3-flash`:
- Вход: массив поисковых фраз пользователей за сутки.
- Анализ: определение намерений (Коммерческое B2B, Информационное/Обучение, Поиск халявы/взлом, Поиск работы, Омонимы).
- Выход: строго типизированный массив новых минус-слов для автоматического добавления в кампанию.

### 2.4. ClickFraudSentinel (`src/services/ppc/clickfraud-sentinel.ts`)
Сторожевой пес защиты от скликивания:
- Выявляет аномальные всплески кликов по конкурентным кампаниям (CPC 48 ₽);
- При обнаружении ботнет-паттернов (время на сайте < 3 сек, нулевой скролл) автоматически заносит IP/ClientID в сегмент блокировки.

### 2.5. CroRetentionWebhook (`src/services/ppc/cro-retention-webhook.ts`)
Модуль бесплатного дожима лидов:
- Слушает событие `USER_REGISTERED` в Prisma;
- Проверяет через 20 минут статус первого пополнения баланса (`User.balance > 0`);
- При нулевом балансе отправляет персонализированное уведомление в Telegram-бот: *«Вам доступен приветственный тест SMMplan. Активируйте бонус в личном кабинете!»*.

---

## 3. Модель Данных Prisma (Схема хранения телеметрии)

Для сохранения полной истории оптимизаций в `prisma/schema.prisma` добавляется легковесная модель:

```prisma
model PpcActionLog {
  id            String   @id @default(cuid())
  tenantId      String   @default("smmplan")
  actionType    String   // MINUS_WORDS_ADDED | BID_ADJUSTED | BOT_BLOCKED | RETENTION_PUSH
  campaignId    BigInt?
  details       Json     // Список добавленных слов, старая/новая ставка, метрики
  impactEstimate String? // Прогноз экономии бюджета
  createdAt     DateTime @default(now())

  @@index([tenantId, createdAt])
}
```

### 3.1. Схемы валидации контрактов Zod (Contract-First DTOs)

Все ответы и полезные нагрузки взаимодействия с внешними API строго валидируются через Zod:

```typescript
import { z } from 'zod';

export const YandexDirectBidUpdateSchema = z.object({
  KeywordId: z.number().int().positive(),
  Bid: z.number().int().positive().max(100000000), // Ставка в микро-рублях (1 ₽ = 1 000 000)
});

export const YandexDirectBidsPayloadSchema = z.object({
  method: z.literal('set'),
  params: z.object({
    Bids: z.array(YandexDirectBidUpdateSchema).min(1).max(10000),
  }),
});

export const YandexMetrikaSearchQueryItemSchema = z.object({
  dimensions: z.array(z.object({ name: z.string() })),
  metrics: z.array(z.number()),
});

export const YandexMetrikaResponseSchema = z.object({
  data: z.array(YandexMetrikaSearchQueryItemSchema),
  total_rows: z.number().optional(),
});

export const IntentClassifierResultSchema = z.object({
  commercialKeywords: z.array(z.string()),
  negativeKeywordsToAdd: z.array(z.string()),
  botRiskKeywords: z.array(z.string()),
  reasoning: z.string(),
});
```

---

## 4. План TDD (Red-Green-Refactor)

1. **Unit-тесты контрактов (`src/__tests__/unit/ppc-autonomous-agent.test.ts`):**
   - Тест `Budget Ceiling Guard`: попытка выставить суточный бюджет 5 000 ₽ при лимите 4 000 ₽ бросает `BudgetLimitExceededError`.
   - Тест `Policy 15 Guard`: фраза со словом «накрутка» блокируется валидатором офферов.
   - Тест `IntentClassifier`: фразы «скачать бесплатно» и «смотреть фильм» классифицируются как мусор и попадают в список минус-слов.
   - Тест `Rate Limiting & Exponential Backoff`: имитация 429 от Яндекса с успешным повтором через backoff.
2. **Интеграционный тест (`src/__tests__/integration/ppc-metrika-direct-loop.test.ts`):**
   - Эмуляция суточного цикла: выгрузка 20 фраз из фиктивной Метрики -> классификация -> формирование вызова `appendMinusKeywords` -> запись в `PpcActionLog`.

---

## 5. График и Регламент Запуска (Cron)

Агент запускается через автономный скрипт `scripts/ppc-autopilot-daemon.ts`, подключенный к системному планировщику:
- **Время запуска:** Ежедневно в 02:30 МСК (когда Яндекс финализирует статистику предыдущих суток).
- **Telegram Уведомления:** Каждое утро в 08:00 МСК отправка отчета администратору платформы.
- **Fail-Safe Режим:** При возникновении 2 последовательных критических ошибок агент отключает модификацию ставок, фиксирует их на базовых значениях (36.5 ₽ TG, 31 ₽ VK, 48 ₽ Конкуренты, 22 ₽ MAX) и переходит в режим пассивного аудита.
