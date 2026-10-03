# Всесторонний аналитический аудит и динамическая проверка переноса (Dual-Repo Parity Merge)

**Кодовая база**: `OmniSMM-Core` (`e:/Omnismm`) | **Ветка**: `main`  
**Исследованные коммиты**: `f4bda3fe` (Parity Merge), `5c30714b` (Docs), `c9bac851` (ResellerSMM), `b9548ca7` (G1618 Hub)  
**Статус**: ⚠️ **ТРЕБУЕТСЯ ТОЧЕЧНАЯ КОРРЕКЦИЯ** (Выявлено 2 дефекта кэширования Redis, 1 TOCTOU-гонка алертов, 1 потеря параметров тенанта в UI)

---

## 1. Структурированный план проверки (/plan)

Воспроизводимый 6-фазный регламент верификации для любых последующих переносов кодовой базы:

```text
/plan
├── ФАЗА 1: Статический анализ и строгая типизация
│   ├── [1.1] Строгая компиляция TypeScript: npx tsc --noEmit (0 errors)
│   ├── [1.2] Аудит клиентских бандлов и секретов: node scripts/check-bundle-secrets.mjs
│   ├── [1.3] Контроль архитектурных слоев (AST): npm run lint:guardrails
│   └── [1.4] Изоляция мульти-тенантности: npm run lint:tenant
├── ФАЗА 2: Проверка кэширования и работы с памятью (Redis / Node V8)
│   ├── [2.1] Валидация сериализации BigInt/Date во всех вызовах redis.set()
│   ├── [2.2] Детерминизм генерации cacheKey (устранение миллисекундного дрейфа new Date())
│   ├── [2.3] Проверка механизмов graceful fallback при недоступности Redis
│   └── [2.4] Аудит TTL и рисков переполнения памяти в Redis
├── ФАЗА 3: Конкурентность и асинхронные цепочки (ACID / TOCTOU)
│   ├── [3.1] Аудит fire-and-forget SMTP/Telegram алертов на гонки дублирования
│   ├── [3.2] Наличие атомарных Redis-замков (SET key val EX 3600 NX) ДО сетевого I/O
│   └── [3.3] Стратегия разблокировки при сбое отправки алерта
├── ФАЗА 4: UX, маршрутизация и сохранение контекста тенанта
│   ├── [4.1] Сохранение URL searchParams (tenant, subtab, filter) при плоской навигации
│   ├── [4.2] Гидратация SSR/CSR в SystemHealthOverview (suppressHydrationWarning)
│   └── [4.3] Умная очистка категорий: сохранение реакций, капитализация, фоллбеки
├── ФАЗА 5: Интеграция поставщиков и валидность контрактов DTO
│   ├── [5.1] JSON-валидность smm-direct-providers.json (143/143 провайдера, 0 дубликатов ID)
│   ├── [5.2] Синхронизация полей supportedMethods и features
│   └── [5.3] Актуализация документации docs/SMM_PROVIDERS_REGISTRY.md (v7.2)
└── ФАЗА 6: Динамическое тестирование (Vitest Full-Matrix)
    ├── [6.1] Запуск изолированных модульных тестов: npx vitest run src/__tests__/unit/...
    ├── [6.2] Сегрегация тестов, требующих БД, от in-memory unit-тестов
    └── [6.3] Сверка финтех-расчетов 54-ФЗ / 176-ФЗ (пороги НДС и валовый приход)
```

---

## 2. Результаты сквозных проверок (Dynamic Verification Matrix)

| Вектор проверки | Инструмент / Команда | Фактический результат | Вердикт |
| :--- | :--- | :--- | :---: |
| **Компиляция TypeScript** | `npx tsc --noEmit` | **0 ошибок** на всем проекте | 🟢 **PASS** |
| **Аудит секретов** | `node scripts/check-bundle-secrets.mjs` | **0 утечек** API-ключей и паролей | 🟢 **PASS** |
| **AST Guardrails** | `npm run lint:guardrails` | 0 блокеров архитектуры | 🟢 **PASS** |
| **Multi-Tenant изоляция** | `npm run lint:tenant` | 0 утечек данных между SMMplan и SMMflux | 🟢 **PASS** |
| **Модульные тесты переноса** | `direct-provider-scanner`, `admin-transactions`, `admin-settings`, `category-semantic-guard` | **47 из 47 тестов PASS** | 🟢 **PASS** |
| **Общий пул Unit-тестов** | `npx vitest run src/__tests__/unit/` | **1 019 тестов PASS** (138 файлов из 149) | ⚠️ **11 файлов требуют БД** |

---

## 3. Выявленные скрытые дефекты и риски

### 🔴 Дефект 1: Фатальная ошибка сериализации BigInt в кэше Redis
* **Файл:** `src/services/admin/user.service.ts` (строки 361–382).
* **Суть:** В Prisma колонка `User.balance` имеет тип `BigInt`. Запрос агрегации `db.user.aggregate({ _sum: { balance: true } })` возвращает поле `totalLiability` как `BigInt`. При вызове `JSON.stringify(result)` в Node.js выбрасывается ошибка `TypeError: Do not know how to serialize a BigInt`.
* **Следствие:** Ошибка перехватывается блоком `catch {}`, сервер не падает, но **кэш `user:stats:*` вообще никогда не записывается в Redis**, и каждый запрос идет в PostgreSQL.
* **Сопутствующая деталь:** В тесте `src/__tests__/clients/admin-user-sorting.test.ts:235` жестко ожидается `expect(stats.totalLiability).toBe(BigInt(500000))`. При исправлении сервиса нужно синхронно обновить и тест.

### 🔴 Дефект 2: Недетерминированные миллисекундные ключи (Cache Hit Rate = 0%)
* **Файлы:** `src/services/admin/order/order-timeseries.service.ts:14` и `src/services/financial/accounting.service.ts:27`.
* **Суть:** Ключи кэша формируются с миллисекундами:
  `orders:timeseries:...:${startDate.getTime()}:${endDate.getTime()}`
  При каждом заходе на страницы `/operator/dashboard` и `/admin/finance` вызывается `new Date()`. Миллисекунды всегда разные.
* **Следствие:** Кэш с TTL 45 секунд **ни разу не срабатывает (0% попаданий)**, создавая в Redis шквал одноразовых ключей.
* **Решение:** Квантовать метки времени до 30–60 секунд (`Math.floor(d.getTime() / 30000) * 30000`).

### 🟡 Дефект 3: Шторм алертов (TOCTOU-гонка) в `ProviderBalanceService`
* **Файл:** `src/services/admin/provider-balance.service.ts`.
* **Суть:** Ключ блокировки алерта в Redis записывается **после** завершения долгой отправки письма (`sendAdminAlert`). Если несколько запросов проверяют баланс одновременно, все они увидят отсутствие ключа и отправят администратору пачку дублирующих писем.
* **Решение:** Брать атомарный замок **ДО** отправки: `await redis.set(alertKey, '1', 'EX', 3600, 'NX')`.

### 🟡 Дефект 4: Сброс параметра `tenant` при переключении табов настроек
* **Файл:** `src/components/admin/settings/settings-cluster-tabs.tsx:44`.
* **Суть:** Ссылка `<Link href={'?tab=${subTab.id}'}>` затирает все текущие GET-параметры. Если администратор переключал вкладки под тенантом `?tenant=smmflux`, при клике на вкладку параметр тенанта сбрасывался.
* **Решение:** Использовать `useSearchParams` для объединения параметров.

### 🔵 Несоответствие 5: Контракт провайдера G1618
* **Файл:** `src/data/providers/smm-direct-providers.json`.
* **Суть:** У `g1618_com` в `features` указан `refill: true`, но в списке `supportedMethods` метод `"refill"` отсутствует.
* **Решение:** Добавить `"refill"` в массив `supportedMethods`.

---

## 4. План устранения (Action Items)

1. [x] **P0**: Исправить сериализацию BigInt в `user.service.ts` и обновить тест `admin-user-sorting.test.ts`.
2. [x] **P0**: Внедрить квантование дат в `order-timeseries.service.ts` и `accounting.service.ts`.
3. [x] **P1**: Внедрить атомарный замок `SET NX` в `provider-balance.service.ts`.
4. [x] **P1**: Сохранять `searchParams` в `settings-cluster-tabs.tsx`.
5. [x] **P2**: Добавить `"refill"` в `supportedMethods` для `g1618_com`.
