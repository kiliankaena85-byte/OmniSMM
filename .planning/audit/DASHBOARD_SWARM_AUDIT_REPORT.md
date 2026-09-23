# 🏛️ Client Dashboard Enterprise Swarm Audit Report

**Date:** 2026-08-28T16:35:13.283Z

## Round 1: Red Team Attack
# Аудит Client Dashboard — скрытые failure scenarios

## 1. Кнопка «Повторить заказ» (RepeatOrderButton)
- **Race condition при повторе мульти-тикетного заказа:** если оригинальный заказ уже в `PARTIAL` (частично выполнен, частично в рефанде), кнопка тупо копирует `quantity` без учёта `remains` — пользователь повторно покупает уже доставленные единицы, баланс списывается дважды.
- **Устаревший serviceId:** после удаления/архивации услуги кнопка кидает 410, но UI не откатывает состояние — Optimistic заказ висит 10s TTL, а пользователь уже ушёл на новую форму.

## 2. Drip-Feed математика (Tab 2 + Tab 6)
- **Floor invariant при runs > quantity:** правило `Math.floor(quantity / runs) >= service.minQty` молча проваливается на `runs = quantity + 1` (например, qty=1000, runs=1001 → 0 ≥ minQty → false, но фронт не выдаёт внятной ошибки, просто блокирует submit без объяснения). Нужен человекочитаемый reason: «Уменьшите число запусков до ≤1000».
- **Интервал M = 0 минут:** `setInterval` с 0 приводит к DoS-циклу на бэке (если планировщик не защищён min interval guard), деньги списываются, а UI считает всё «выполнено».
- **Округление ExactMath при `quantity % runs !== 0`:** хвостовые `lastRunQty` юнитов теряются без явного информирования — пользователь заплатил за 1000, а получил 999.

## 3. Финансы / Add-Funds (Tab 4)
- **Float в комиссии шлюза:** ЮKassa возвращает комиссию в рублях с 2 знаками, конвертация `Math.round(amount * 100)` даёт расхождение на 1 копейку при больших суммах (>999 ₽). Отсутствие явного `Decimal.js` или хранения комиссии в копейках на стороне провайдера.
- **Минимальный депозит 10 ₽ vs комиссия CryptoBot:** комиссия сети может превышать сумму пополнения — кнопка «Перейти к оплате» активна, но платёж не доходит до ledger, а баланс уже «зарезервирован» Optimistic UI.
- **Двойное списание при двойном клике:** нет idempotencyKey на create-payment, два быстрых тапа по мобильной сети = два списания, ручной разбор через поддержку.

## 4. Партнёрская программа / WithdrawalModal (Tab 5)
- **LTV-агрегация с плавающим окном:** при выводе учитываются пополнения рефералов за всё время, но если реферал запросил рефанд — начисленный процент уже ушёл на баланс партнёра. Нужен clawback, иначе отрицательный LTV при выводе.
- **Минимальный порог вывода в разных валютах:** кнопка активна при 100 ₽, но в `SMMflux` (USD-tenant) та же кнопка = 100 USD ≈ 9000 ₽ — копипаст хардкода без `tenantConfig.minWithdrawal`.

## 5. Tenant Isolation (SMMplan ↔ SMMflux)
- **CSS-token leak в shared чанке:** `scoped CSS tokens` не покрывают `dynamic-imported` компоненты (например, `ChargeBreakdownModal`, `RetryPaymentModal`) — при SSR-гидратации в SMMflux мигают рублёные суммы и лого SMMplan на 200-400ms.
- **API-ключ SMM v2 cross-tenant:** пользователь генерит ключ в SMMplan, переключает tenant через URL (`/dashboard/settings/api` без перезагрузки) — ключ валиден на обоих тенантах, потому что `apiKey.tenantId` проверяется только при создании, но не при каждом запросе.
- **Реферальная ссылка без tenant-prefix:** `referrals` отдаёт единый `/r/abc123`, реферал регистрируется в случайном тенанте — комиссия улетает не тому партнёру.

## 6. Mobile UX (Zero Column Clipping)
- **MobileOrderList без свайп-действий:** кнопки «Отмена / Гарантия / Повтор» спрятаны в бургер, но `text-xs px-2` ломает touch-target (Apple HIG 44pt) — пользователь промахивается, открывает детали вместо отмены.
- **Horizontal scroll на finance-таблице:** при >5 строк LedgerEntry появляется горизонтальный скролл, а sticky-header `Итого` не закреплён — на iPhone SE сумма уезжает за пределы viewport.
- **Drip-Feed конфигуратор на 320px:** слайдер интервалов (1-1440 мин) не имеет step=10, пользователь застрянет на 137 минутах и не поймёт, как округлить.

## 7. Тикеты / AI Copilot (Tab 7)
- **Telegram-синхронизация message_id collision:** если пользователь отвечает из ЛК и из Telegram в течение 1s, два сообщения с одинаковым `client_msg_id` дублируются в ленте тикета, AI Copilot склеивает их в один ответ.
- **SLA-таймер зависает при offline-агенте:** счётчик «Ответ в течение 30 мин» продолжает тикать, хотя все операторы оффлайн — пользователь видит зелёный статус и не пишет повторно.

## Приоритет фиксов (P0 → P2)
- **P0:** Floor invariant с человекочитаемой ошибкой; idempotencyKey на платежах; BigInt serializer.
- **P1:** API-key tenant-validation per request; minWithdrawal per tenant; touch-target 44pt.
- **P2:** Mobile Drip-Feed step=10; sticky finance header; Telegram dedup.

## Round 2: Blue Team Defense
# BLUE TEAM RESPONSE: Применимость Red Team Critique к Roadmap

Анализирую каждый критический сценарий через призму уже заложенных контр-мер и честно фиксирую реальные пробелы.

---

## 1. RepeatOrderButton — Race Condition при PARTIAL

**Частично защищён, но есть пробел.**

Roadmap упоминает `RepeatOrderButton` и `ChargeBreakdownModal`, но **не описывает логику обработки PARTIAL при повторе**. Red Team прав: тупое копирование `quantity` при остатке `remains < quantity` приводит к двойной оплате уже доставленных единиц.

**Решение (принять в P0):**
- В Server Action `repeatOrder(orderId)` перед созданием нового заказа читать исходный `order.remains`.
- Если `remains > 0` и `remains < order.quantity`, по умолчанию формировать `newQuantity = order.remains` с явной подсказкой в UI: «В прошлом заказе доставлено X из Y. Повторить на X единиц?».
- Дать пользователю opt-in на полный повтор через чекбокс «Заказать полный объём заново», но с warning'ом о списании разницы.
- **Устаревший serviceId → 410:** в `RepeatOrderButton` оборачивать вызов в try/catch с HTTP-code парсингом. На 410/404 — тост «Услуга больше недоступна. Выберите аналог» + ссылка на каталог. Optimistic запись из стейта снимать немедленно (не ждать TTL 10s), иначе пользователь успеет оплатить «фантом».

---

## 2. Drip-Feed математика

**Floor invariant — Red Team на 100% прав, и это P0-блокер для релиза.**

Roadmap заявляет проверку, но **не описывает UX-сторону отказа**. Молчаливый disabled submit без объяснения причины — это support-тикет в первые сутки.

**Floor Invariant Fix (P0):**
- Валидация остаётся на сервере, но клиентский `useDripFeedValidator` (Zod-схема + кастомный refine) возвращает структурированный объект:
  ```ts
  { ok: false, code: 'RUNS_EXCEEDS_QTY', humanReason: 'Уменьшите число запусков до ≤1000', suggestedRuns: 1000 }
  ```
- Под полем ввода — inline-ошибка красным + кнопка «Применить рекомендацию», которая подставляет `suggestedRuns` без перезагрузки формы.
- На сервере в `createDripFeedOrder` дополнительно проверять `intervalMinutes >= 1` (защита от M=0 DoS) и при `quantity % runs !== 0` явно сохранять `lastRunQty = quantity - floor(quantity/runs)*(runs-1)` в `DripFeedSubOrder.lastRunQty`, чтобы UI мог показать «Последний запуск: 9 шт.»

**Tail-loss информирование (P1):**
- В OrderDetail показывать `expectedTotal = runs * floor(qty/runs) + lastRunQty` рядом с `charged = qty`, чтобы пользователь видел «вы получите 999, оплачено 1000 (1 единица ушла в хвост)».

---

## 3. Add-Funds — Float в комиссии и Double-Click

**IdempotencyKey отсутствует в Roadmap — это критический пробел, P0.**

Roadmap говорит про `ExactMath` для конвертации, но **не упоминает комиссию шлюза** и **не описывает дедупликацию платежей**.

**Float в комиссии (P0):**
- Ввести тип `GatewayCommissionKopecks: bigint` — провайдер возвращает `commission: string` в копейках (ЮKassa/СБП поддерживают), парсим через `BigInt(commission)`. Никаких `Math.round(amount * 100)`.
- Для Robokassa (может отдавать float) — `decimal.js` с фиксированной точностью 2 и умножение `× 100n` через `toFixed(0)`.

**Double-click (P0):**
- В Server Action `createDeposit` генерировать `idempotencyKey = crypto.randomUUID()` на клиенте и передавать в `Idempotency-Key` header.
- На бэке — Redis-клэйм `SET key NX EX 600`. Повторный запрос с тем же ключом возвращает кэшированный ответ, а не создаёт второй платёж.
- UI: блокировать кнопку «Перейти к оплате` через `useTransition` + disabled-стейт до получения redirect URL.

**CryptoBot комиссия > суммы (P1):**
- В `CryptoBotDepositModal` показывать «Комиссия сети: ~X ₽. Итого к зачислению: Y ₽» **до** нажатия «Оплатить». Если `netAmount < minDeposit` — кнопка disabled с причиной.

---

## 4. Партнёрка / WithdrawalModal

**Clawback — справедливое замечание, Red Team прав.**

Roadmap упоминает «агрегация LTV», но **clawback при рефанде реферала** действительно не описан, и без него баланс партнёра может уйти в минус после серии гарантийных возвратов.

**Решение (P1):**
- В LedgerEntry ввести тип `REFERRAL_CLAWBACK` со ссылкой на исходное `REFERRAL_ACCRUAL`.
- Cron-задача (каждые 15 мин) сканирует заказы рефералов в статусе `REFUNDED` за последние 90 дней и создаёт зеркальный clawback, если начисление ещё не откачено.
- При выводе `withdrawalAmount = availableBalance - pendingClawbacks`.

**minWithdrawal per tenant (P0 — быстрый фикс):**
- В `TenantConfig` добавить `minWithdrawal: { smmplan: 100n * 100n, smmflux: 10n * 100n }` (для USD-тенанта 10$).
- В `WithdrawalModal` читать из `useTenantConfig()`, а не из хардкода.

---

## 5. Tenant Isolation

Roadmap закладывает `ITenantDashboardStrategy` и `tenantId guard` в Server Actions — это правильный фундамент. **Но Red Team нашёл три реальных пробела.**

**CSS-token leak через dynamic import (P1):**
- В Next.js App Router `dynamic(() => import('./ChargeBreakdownModal'))` создаёт отдельный чанк, который при гидратации в SMMflux может мигнуть рублёные лейблы.
- **Фикс:** все деньговые компоненты рендерить через единый `<MoneyValue tenant={tenant}>` SSR-safe компонент, который читает tenant из `headers()` и подставляет `₽`/`$` на сервере. Никаких `Intl.NumberFormat('ru-RU')` на клиенте без tenant-контекста.
- `next/dynamic` с `ssr: false` запретить для UI, зависящего от тенанта.

**API-key per-request validation (P0):**
- В middleware апи-шлюза (`/api/v2/*`) на каждый запрос парсить `X-API-Key`, загружать `ApiKey.tenantId` и сверять с `request.headers['x-tenant-id']` (или с доменом). При несовпадении — 403.
- Это лечится одним SQL-запросом с индексом `idx_api_keys_key_hash_tenant`, latency < 5ms.

**Реферальная ссылка без tenant-prefix (P0):**
- Генерировать `/r/{tenantSlug}-{code}`, например `/r/smmplan-abc123`. Middleware при регистрации парсит slug и привязывает реферала к правильному тенанту атомарно.

---

## 6. Mobile UX

**Touch-target 44pt — Red Team прав, Roadmap не упоминает.**

Apple HIG требует минимум 44×44pt, Android Material — 48×48dp. `text-xs px-2` в бургер-меню заказов даёт ~28-32pt.

**Решение (P1):**
- Глобальный CSS-правило: `.touch-target { min-h-[44px] min-w-[44px] }` через Tailwind.
- `MobileOrderList` — оставить основные действия (Повтор/Гарантия) в видимой зоне с touch-target, а в бургер убрать только детали.

**Sticky finance header (P2):**
- В `LedgerTable` обернуть `<thead>` в `sticky top-[var(--header-h)]` с `backdrop-blur` и явной строкой «Итого: X ₽» как частью thead, а не tbody.

**Drip-Feed slider step (P2):**
- `step={10}` + `min={5}`, `max={1440}`. Дополнительно показывать «Будет применено: 140 мин» под слайдером.

---

## 7. Тикеты / AI Copilot

**Telegram dedup (P1):**
- На клиенте при отправке из ЛК генерировать `client_msg_id = crypto.randomUUID()` и отправлять в Telegram через бота с этим ID как `reply_to_message.external_id`.
- В ingestion-вебхуке Telegram проверять `INSERT ... ON CONFLICT (client_msg_id) DO NOTHING` — это схема готова, нужен только миграционный шаг.

**SLA-таймер offline-агент (P2):**
- Показывать SLA-таймер только при `agentOnline === true` (ping раз в 30s из admin-панели). При offline — серая плашка «Сейчас 02:47. Ответим утром. Вы можете продолжать переписку».

---

## Сводная таблица принятых фиксов

| Сценарий | Статус | Приоритет |
|---|---|---|
| RepeatOrder PARTIAL logic | Принято, новый | **P0** |
| Drip-Feed floor UX + reason | Принято, новый | **P0** |
| Drip-Feed interval=0 guard | Принято | **P0** |
| BigInt комиссия шлюза | Принято | **P0** |
| IdempotencyKey на платежах | Принято, критично | **P0** |
| CryptoBot комиссия UI | Принято | **P1** |
| Referral clawback | Принято, новый | **P1** |
| minWithdrawal per tenant | Принято | **P0** |
| API-key per-request tenant | Принято | **P0** |
| Реферальная ссылка + slug | Принято | **P0** |
| Touch-target 44pt | Принято | **P1** |
| Sticky finance header | Принято | **P2** |
| Drip slider step=10 | Принято | **P2** |
| Telegram client_msg_id | Принято | **P1** |
| SLA-таймер online-aware | Принято | **P2** |

**Отклонено / Mitigated already:**
- BigInt serializer → покрыт `toClientKopecks` в Roadmap.
- Optimistic UI 10s TTL → достаточно для non-payment случаев после фикса idempotency.
- Sandbox Fallback → достаточно для тестового контура, в проде не применяется.

**Итого:** 8 P0-фиксов должны попасть в текущий спринт, 4 P1 — в следующий, 3 P2 — в бэклог. Red Team выявил 3 критических P0-пробела, которые Roadmap упускал (idempotency, floor UX, API-key per-request).

## Round 3: CTO Master Synthesis
# ENTERPRISE ACTION PLAN: SMMplan & SMMflux Client Dashboard

## 1. ВЕРДИКТ CTO И ОЦЕНКА ГОТОВНОСТИ

**Общий Score: 62/100** — архитектура зрелая, фундамент (ExactMath, ITenantDashboardStrategy, Server Actions) заложен верно, но 8 критических P0-пробелов делают релиз в текущем виде **небезопасным для продакшена**.

| Домен | Score | Комментарий |
|---|---|---|
| Архитектура / Tenancy | 78/100 | ITenantStrategy есть, но 3 пробела изоляции (CSS, API-key, ref-link) |
| Денежная математика | 55/100 | ExactMath есть, но нет комиссии в bigint, нет idempotency, нет clawback |
| Drip-Feed | 60/100 | Серверная проверка есть, UX отказа отсутствует |
| Mobile UX | 50/100 | Zero Column Clipping соблюдён, touch-target и sticky — нет |
| Поддержка / SLA | 70/100 | Telegram-sync есть, dedup и online-aware SLA — нет |
| Платежи | 45/100 | Sandbox готов, но double-click, float-комиссия, CryptoBot-net — пробелы |
| Безопасность | 65/100 | tenantId guard есть, per-request API-key validation — нет |

**Вердикт:** запретить merge в `main` до закрытия всех P0. Sprint capacity: 8 P0 ≈ 12-14 story points, 4 P1 ≈ 6 sp, 3 P2 ≈ 3 sp. Целевой релиз — после полного прохождения CI-gate с E2E-матрицей.

---

## 2. БЛОКЕРЫ И ИНЖЕНЕРНЫЕ РЕШЕНИЯ

### B1. P0 — Идемпотентность платежей (отсутствует в Roadmap)
**Проблема:** двойной клик = двойное списание, нет `Idempotency-Key`.
**Решение:**
```ts
// server actions/deposits.ts
'use server';
export async function createDeposit(input: DepositInput, idempotencyKey: string) {
  const claimed = await redis.set(`idem:${idempotencyKey}`, 'pending', 'NX', 'EX', 600);
  if (!claimed) return getCachedResponse(idempotencyKey);
  const payment = await gateway.createPayment({ ...input, idempotencyKey });
  await redis.set(`idem:${idempotencyKey}`, JSON.stringify(payment), 'EX', 600);
  return payment;
}
```
Клиент: `crypto.randomUUID()` при mount формы, передача в `headers['Idempotency-Key']`.

### B2. P0 — Drip-Feed Floor Invariant UX
**Проблема:** silent disabled submit, нет `humanReason`.
**Решение:** Zod-refine + структурированный ответ:
```ts
const dripFeedSchema = z.object({
  quantity: z.number().int().positive(),
  runs: z.number().int().positive(),
  intervalMinutes: z.number().int().min(1).max(10080),
}).refine(d => Math.floor(d.quantity / d.runs) >= minQty, d => ({
  message: { code: 'RUNS_EXCEEDS_QTY', humanReason: `Уменьшите число запусков до ≤${d.quantity}`, suggestedRuns: d.quantity }
}));
```
Inline-ошибка + кнопка «Применить рекомендацию» → автоподстановка `suggestedRuns`.

### B3. P0 — Repeat Order при PARTIAL
**Проблема:** двойная оплата уже доставленных единиц.
**Решение:** в `repeatOrderAction` — `newQty = order.remains` по умолчанию, opt-in чекбокс на полный объём. На 410/404 — немедленный rollback Optimistic UI + тост с CTA на каталог.

### B4. P0 — BigInt комиссия шлюза
**Решение:** ввести `GatewayCommissionKopecks: bigint`. ЮKassa/СБП парсить строкой `BigInt(commission)`. Robokassa — `decimal.js` с `precision=20`, конвертация через `toFixed(0)`. Никаких `Math.round`.

### B5. P0 — API-key per-request tenant validation
**Решение:** middleware `/api/v2/*` — JOIN `api_keys` + проверка `key.tenantId === host-tenant`. Индекс `idx_api_keys_key_hash_tenant` (latency < 5ms). Cache 60s в Redis.

### B6. P0 — Реферальная ссылка с tenant-prefix
**Решение:** формат `/r/{tenantSlug}-{code}`. Middleware при регистрации парсит slug → `INSERT referrals (tenant_id, code) ON CONFLICT DO NOTHING`.

### B7. P0 — minWithdrawal per tenant
**Решение:** `TenantConfig.minWithdrawal: bigint`. `WithdrawalModal` читает из `useTenantConfig()`. Удалить все хардкоды `100 ₽` из компонентов.

### B8. P0 — CSS-token leak в dynamic imports
**Решение:** единый SSR-safe `<MoneyValue tenant={tenant} currency={...} />`, читает tenant из `headers()` на сервере. Запретить `dynamic(..., { ssr: false })` для денежных/брендовых компонентов (ESLint rule).

### B9. P1 — Referral clawback
**Решение:** cron каждые 15 мин сканирует `orders WHERE referrer_id IS NOT NULL AND status='REFUNDED' AND created_at > NOW()-90d` → создаёт зеркальный `LedgerEntry{type: 'REFERRAL_CLAWBACK'}`. `availableBalance = ledgerSum - pendingClawbacks`.

### B10. P1 — CryptoBot комиссия
**Решение:** перед `createInvoice` запрашивать `getNetworkFee`, если `netAmount < minDeposit` — disabled кнопка с reason «Комиссия сети превышает сумму пополнения».

### B11. P1 — Telegram client_msg_id dedup
**Решение:** миграция `messages.client_msg_id UNIQUE`, `INSERT ... ON CONFLICT DO NOTHING` в webhook.

---

## 3. ПЛАН SMOKE И E2E ТЕСТОВ

### 3.1 Smoke (после каждого PR, ≤ 3 мин)

| ID | Сценарий | Ожидаемый результат |
|---|---|---|
| SM-01 | GET `/dashboard` для обоих тенантов | SSR без ошибок, BigInt сериализован |
| SM-02 | Health-check `/api/health` | 200, DB+Redis+Gateway ping ok |
| SM-03 | Hydration mismatch check | 0 warnings в console |
| SM-04 | Tenant CSS token swap | `smmflux` не содержит «₽» / лого SMMplan |
| SM-05 | BigInt prop passing | React DevTools не показывает serialization error |

### 3.2 E2E (Playwright, matrix per tab)

#### TAB 1: Главная
- **E2E-1.1:** Баланс отображается в копейках (`100050n` → `1 000,50 ₽`), обновление через SSE
- **E2E-1.2:** Кнопка «Пополнить баланс» → редирект на `/dashboard/add-funds`
- **E2E-1.3:** Сумма расходов за 30 дней = `Σ order.cost WHERE created_at > NOW()-30d AND status IN (COMPLETED,PARTIAL)`

#### TAB 2: Новый заказ
- **E2E-2.1:** Валидный URL проходит `SafeRegexValidator`
- **E2E-2.2:** Невалидный URL (`javascript:alert(1)`) → inline error
- **E2E-2.3:** `quantity < service.minQty` → disabled submit + reason
- **E2E-2.4:** Drip-Feed `runs=1001, qty=1000` → inline error «Уменьшите до ≤1000» + кнопка «Применить»
- **E2E-2.5:** Drip-Feed `intervalMinutes=0` → inline error «Минимум 1 минута»
- **E2E-2.6:** `quantity=1000, runs=3` → tooltip «Последний запуск: 1 шт»
- **E2E-2.7:** Промокод `SAVE10` → скидка 10% видна в превью
- **E2E-2.8:** Баланс < стоимости → submit blocked с reason
- **E2E-2.9:** Стоимость = `ExactMath.calculateOrderCostKopecks(qty, ratePer1k)` совпадает с БД

#### TAB 3: Мои заказы
- **E2E-3.1:** Фильтр `PARTIAL` показывает только частичные
- **E2E-3.2:** Поиск по `id=123` находит заказ
- **E2E-3.3:** Пагинация 15 строк, page=2
- **E2E-3.4:** **RepeatOrder при PARTIAL:** UI предлагает `newQty=remains`, opt-in чекбокс «Полный объём»
- **E2E-3.5:** RepeatOrder устаревший `serviceId` → 410 → тост + rollback Optimistic
- **E2E-3.6:** CancelOrder → confirm modal → status=CANCELLED, refund в кошельке
- **E2E-3.7:** RefillRequest → форма с описанием проблемы → создание тикета
- **E2E-3.8:** ChargeBreakdownModal показывает `startCount / remains / total / cost`
- **E2E-3.9:** RetryPaymentModal на FAILED заказе → выбор метода → оплата

#### TAB 4: Финансы
- **E2E-4.1:** Минимальная сумма 10 ₽ (SMMplan) / 1 $ (SMMflux) — submit blocked ниже
- **E2E-4.2:** **Double-click protection:** два быстрых клика → один платёж в ledger, idempotencyKey виден в network
- **E2E-4.3:** ЮKassa: комиссия парсится из строки bigint, нет float
- **E2E-4.4:** CryptoBot: комиссия сети > суммы → disabled кнопка
- **E2E-4.5:** СБП: redirect URL, success → LedgerEntry создан
- **E2E-4.6:** Robokassa: decimal.js конвертация, точность до копейки
- **E2E-4.7:** **Live Tunnel vs Mock Sandbox:** `process.env.PAYMENT_MODE=sandbox` — реальные шлюзы не дёргаются
- **E2E-4.8:** LedgerEntry сортировка DESC, sticky header «Итого»

#### TAB 5: Партнёрка
- **E2E-5.1:** Ссылка `/r/smmplan-abc123` → middleware парсит slug
- **E2E-5.2:** QR-код генерируется для полной ссылки
- **E2E-5.3:** 5 тиров с правильными процентами (5/8/12/16/20)
- **E2E-5.4:** WithdrawalModal при `balance < minWithdrawal` (SMMflux < 10$) → disabled
- **E2E-5.5:** WithdrawalModal: clawback-pending вычитается из доступной суммы
- **E2E-5.6:** Реферал с REFUNDED заказом → cron создаёт CLAWBACK entry
- **E2E-5.7:** LTV агрегация = `Σ(deposits - refunds) WHERE referrer_id = X`

#### TAB 6: Smart Drip
- **E2E-6.1:** Floor invariant (P0 UX) — inline error + suggestedRuns
- **E2E-6.2:** `intervalMinutes=0` → blocked
- **E2E-6.3:** Slider `step=10`, отображение «Будет применено: 140 мин»
- **E2E-6.4:** Превью графика = `runs` точек на временной оси
- **E2E-6.5:** Запуск кампании → расписание в `drip_feed_jobs` с правильным `lastRunQty`

#### TAB 7: Поддержка
- **E2E-7.1:** Создание тикета с attachment (PNG ≤ 5MB) → 200
- **E2E-7.2:** Live chat: сообщение из ЛК появляется в Telegram (mock)
- **E2E-7.3:** **Telegram dedup:** один `client_msg_id` → одно сообщение в ленте при гонке
- **E2E-7.4:** SLA-таймер виден только при `agentOnline=true`
- **E2E-7.5:** При offline-агенте — серая плашка с временем ответа
- **E2E-7.6:** AI Copilot dedup не склеивает разные `client_msg_id`

#### TAB 8: Настройки / API
- **E2E-8.1:** Смена пароля: 8+ символов, цифра, заглавная
- **E2E-8.2:** Telegram Smart Bind: код в боте → привязка
- **E2E-8.3:** Генерация API-ключа: показ один раз + hash в БД
- **E2E-8.4:** **Cross-tenant API:** ключ SMMplan → 403 на домене SMMflux
- **E2E-8.5:** Webhook URL валидация (https only, no localhost in prod)

#### Mobile-only (iPhone SE, 320px)
- **M-1:** Zero Column Clipping: ни одна колонка не обрезана
- **M-2:** Touch-target ≥ 44×44pt на всех кнопках действий
- **M-3:** Drip-Feed slider step=10, нельзя застрять на 137
- **M-4:** Finance table sticky thead на скролле
- **M-5:** Burder menu заменён на видимые действия (Повтор/Гарантия)

---

## 4. UX / WCAG 2.2 AA / TAILWIND 4 УЛУЧШЕНИЯ

### 4.1 Доступность (WCAG 2.2 AA)

| ID | Улучшение | Стандарт |
|---|---|---|
| A-1 | Контраст текст/фон ≥ 4.5:1 для всех сумм, ошибок | WCAG 1.4.3 |
| A-2 | Focus-visible ring на всех интерактивах (2px solid) | WCAG 2.4.7 |
| A-3 | `aria-live="polite"` для SSE-обновлений баланса | WCAG 4.1.3 |
| A-4 | `aria-invalid` + `aria-describedby` на полях с ошибками | WCAG 1.3.1 |
| A-5 | Skip-link «Перейти к заказам» | WCAG 2.4.1 |
| A-6 | Keyboard nav в Drip-Feed slider (стрелки, PageUp/Down) | WCAG 2.1.1 |
| A-7 | `prefers-reduced-motion`: отключить анимацию прогресса заказа | WCAG 2.3.3 |
| A-8 | Touch-target ≥ 44×44pt (Apple HIG + WCAG 2.5.5) | WCAG 2.5.5 |
| A-9 | Модалки: focus-trap, Esc закрывает, возврат фокуса | WCAG 2.4.3 |
| A-10 | Таблицы: `<th scope="col">`, caption для LedgerEntry | WCAG 1.3.1 |

### 4.2 Tailwind 4 / Visual Polish

| ID | Улучшение | Реализация |
|---|---|---|
| V-1 | Design tokens через CSS `@theme` (Tailwind 4) | `--color-brand-{tenant}-{50..900}` |
| V-2 | `prefers-color-scheme` для дашборда (light/dark) | `dark:` variants на всех компонентах |
| V-3 | Sticky `<thead>` в LedgerTable | `sticky top-[var(--header-h)] backdrop-blur-md bg-bg/80` |
| V-4 | Skeleton loaders (не spinners) при загрузке заказов | `<Skeleton className="h-12 w-full" />` |
| V-5 | Optimistic UI: subtle pulse-анимация для pending-записей | `animate-pulse` с `data-state="pending"` |
| V-6 | `text-balance` для заголовков карточек | Tailwind 4 native |
| V-7 | Контейнерные queries для `MobileOrderList` | `@container` (Tailwind 4) |
| V-8 | `color-mix()` для tenant-accent overlays | CSS `color-mix(in oklch, var(--brand) 80%, white)` |
| V-9 | Числа tabular-nums для всех денежных колонок | `tabular-nums tracking-tight` |
| V-10 | `aria-busy="true"` на region во время SSE reconnect | WCAG + UX |

### 4.3 «Real life» UX-фиксы

| ID | Сценарий из жизни | Решение |
|---|---|---|
| R-1 | Пользователь оплатил, но платёж «завис» | Polling `/api/deposits/{id}/status` каждые 3с, макс 2 мин, затем «Связаться с поддержкой» |
| R-2 | Двойной тап по «Оплатить» | `useTransition` + visual disabled + `pointer-events: none` |
| R-3 | Потеря связи при создании заказа | `navigator.onLine` listener → offline-banner + queue retry |
| R-4 | Случайная отмена заказа | Confirm modal с вводом ID заказа или `aria-confirm` |
| R-5 | Пользователь не понял, что такое Drip-Feed | Inline `?` → popover с GIF-анимацией и примером |
| R-6 | Рефунд завис на PARTIAL | Кнопка «Ускорить возврат» → создание тикета с prefill |
| R-7 | Ошибка 502 от шлюза | Toast «Платёжный шлюз недоступен. Попробуйте другой метод» |
| R-8 | Часовой пояс пользователя ≠ UTC | `Intl.DateTimeFormat()` с tenant-локалью |
| R-9 | Скриншот ошибки в тикете | `accept="image/*" capture="environment"` для мобильных |
| R-10 | Пользователь меняет валюту в форме пополнения | Сохранение выбора в `localStorage` per-tenant |

---

## ФИНАЛЬНАЯ СВОДКА

**Готовность к релизу: 62/100 → целевой порог 92/100.**

**Sprint 1 (must-ship):** B1-B8 — 8 P0, покрытие E2E всех tab, mobile matrix. Exit-criteria: 100% P0 E2E pass + Lighthouse a11y ≥ 95.

**Sprint 2 (hardening):** B9-B11 — 4 P1, UX polish R-1..R-10, WCAG аудит. Exit-criteria: zero critical a11y issues, clawback cron работает.

**Sprint 3 (polish):** P2-фиксы, визуальные улучшения V-1..V-10, нагрузочные тесты (1000 RPS на `/dashboard/orders`). Exit-criteria: p95 latency < 300ms, error budget < 0.1%.

**Definition of Done для продакшена:**
1. Все 8 P0 закрыты + code review + 2 approvers
2. Playwright matrix зелёная (≥ 95% pass, flaky < 1%)
3. WCAG 2.2 AA audit: 0 critical, ≤ 2 serious
4. Нагрузочный тест: 1000 RPS × 5 мин без деградации
5. Security audit: tenant isolation подтверждён, idempotency работает, API-key validation per-request
6. Stakeholder demo пройдено
7. Rollback plan + feature flags для каждого P0 готовы

**Команда:** 1 Tech Lead + 2 Mid FE + 1 Mid BE + 1 QA. ETA до 92/100: 3 спринта (6 недель).
