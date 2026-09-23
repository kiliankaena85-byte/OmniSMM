---
name: nfr-performance-budget
description: >
  Комплексный архитектурный скилл для контроля нефункциональных требований (NFR), соблюдения
  бюджетов задержек (Latency Budgets P95/P99), оптимизации запросов Prisma (детекция и ликвидация
  проблемы N+1, курсорная пагинация Keyset Pagination < 30ms), контроля веса бандла и Tree-shaking
  (Next.js 16 Webpack standalone, dynamic imports heavy-библиотек) и управления бюджетом пула
  соединений (Prisma connection_limit, PgBouncer, Redis / BullMQ) в платформе OmniSMM. Используй
  этот скилл ВСЕГДА при проектировании новых страниц и таблиц админки, анализе медленных запросов
  PostgreSQL, профилировании Server Actions, подключении аналитических графиков и тяжелых редакторов
  (BlockNote, Recharts), конфигурации переменных DATABASE_URL и REDIS_URL, а также при расследовании
  деградации отклика платформы под высокой нагрузкой.
---

# NFR Performance Budget — Бюджеты Производительности и Оптимизация Ресурсов OmniSMM

## Назначение скилла

В высоконагруженной платформе **OmniSMM** с десятками тысяч заказов и транзакций соблюдение нефункциональных требований (NFR) определяет стабильность бизнеса:
- Падение времени отклика админки свыше 500ms блокирует работу службы поддержки и операторов.
- Запрос с квадратичной сложностью ($N+1$ запросов в цикле) может заблокировать пул соединений PostgreSQL за считанные секунды.
- Смещение по оффсету `OFFSET 50000 LIMIT 50` заставляет базу сканировать и отбрасывать 50 000 строк диска, поднимая задержку до 800ms+.
- Попадание тяжелых библиотек (BlockNote, Recharts, `sanitize-html`) в исходный клиентский бандл раздувает First Load JS до 1.5 Мб, ухудшая Core Web Vitals (LCP/INP) на мобильных устройствах.

Скилл **nfr-performance-budget** формулирует непреложные численные лимиты (SLA/SLO), шаблоны высокопроизводительных выборок Keyset Pagination, правила сборки Next.js 16 и протоколы сайзинга пулов соединений БД и Redis.

---

## Когда НЕ применять

- Одноразовые миграционные скрипты или CLI-утилиты обслуживания (`scripts/maintenance/*`), запускаемые вне боевого цикла обработки запросов.
- Логирование отладочной информации в локальном тестовом окружении (`CONTOUR=test`).
- Чистая верстка статических страниц (Terms of Service, Privacy Policy), не выполняющих запросы к БД.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### Архитектурный граф аудита производительности

```
                  [Разработка / Оптимизация фичи или эндпоинта]
                                         │
                                         ▼
            ┌────────────────────────────────────────────────────────────┐
            │  Шаг 1. Классификация ресурса и бюджет задержки (Latency)   │
            │  - Client Action / Публичный чекаут: P95 < 100ms, P99 < 250ms│
            │  - Admin Actions & Таблицы: P95 < 200ms, P99 < 500ms       │
            │  - Базовый запрос к БД (Prisma): t_query < 30ms            │
            └────────────────────────────┬───────────────────────────────┘
                                         │
                                         ▼
            ┌────────────────────────────────────────────────────────────┐
            │  Шаг 2. Аудит базы данных (Database Audit)                 │
            └────────────────────────────┬───────────────────────────────┘
                                         │
         ┌───────────────────────────────┴───────────────────────────────┐
         ▼                                                               ▼
  [Выборка списков (>100 строк)]                                  [Связанные сущности (Relations)]
  - Использовать OFFSET? -> ❌ ТАБУ!                               - Вызов db.* внутри .map()/.forEach()? -> ❌ ТАБУ!
  - Использовать Keyset Cursor:                                   - Использовать include/select на уровне корня
    cursor: { id, createdAt }                                     - Либо пакетный запрос: where: { id: { in: ids } }
    Гарантия: B-Tree Index Scan (<30ms)                           - Либо Dataloader паттерн
         │                                                               │
         └───────────────────────────────┬───────────────────────────────┘
                                         │
                                         ▼
            ┌────────────────────────────────────────────────────────────┐
            │  Шаг 3. Аудит бандла и Tree-Shaking (Next.js 16)           │
            │  - Размер First Load JS: < 150 Кб на страницу              │
            │  - Тяжелые библиотеки (BlockNote, Recharts, Dialogs):       │
            │    Строго через dynamic(() => import(...), { ssr: false }) │
            │  - Lucide Icons: именованный импорт, запрет barrel-star    │
            └────────────────────────────┬───────────────────────────────┘
                                         │
                                         ▼
            ┌────────────────────────────────────────────────────────────┐
            │  Шаг 4. Аудит пула соединений (Connection Pool Budget)     │
            │  - Prisma: ?connection_limit=15&pool_timeout=10            │
            │  - BullMQ: maxRetriesPerRequest: null, изоляция воркера    │
            │  - Redis App: lazyConnect: true, maxRetriesPerRequest: 3   │
            └────────────────────────────────────────────────────────────┘
```

### Бюджеты производительности (NFR Budgets Matrix)

| Метрика | Целевой бюджет (Budget) | Критический порог (Alert) | Способ измерения |
| :--- | :--- | :--- | :--- |
| **Admin API P95** | $\le 200\text{ ms}$ | $> 500\text{ ms}$ | OpenTelemetry / Next.js Server Timing |
| **Admin API P99** | $\le 500\text{ ms}$ | $> 1000\text{ ms}$ | Sentry Performance / Nginx Logs |
| **Public Checkout P95** | $\le 100\text{ ms}$ | $> 250\text{ ms}$ | Edge Vitals / Chrome Real User Monitoring |
| **Prisma DB Query** | $\le 30\text{ ms}$ | $> 100\text{ ms}$ | `DEBUG_PRISMA=true` / `pg_stat_statements` |
| **First Load JS (Page)** | $\le 150\text{ kB}$ | $> 250\text{ kB}$ | `next build --webpack` bundle analyzer |
| **PostgreSQL Pool Usage** | $\le 70\%$ от лимита | $> 85\%$ (Риск OOM) | `SELECT count(*) FROM pg_stat_activity` |

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Инвариант 1: Искоренение проблемы $N+1$ в запросах Prisma
Категорически запрещено выполнять запросы к БД внутри синхронных циклов `for`, `map`, `Promise.all` по списку родительских сущностей. Все связанные данные обязаны извлекаться за 1 SQL-запрос через `include` с явным `select`, либо через один пакетный запрос `where: { id: { in: [...] } }`.

```typescript
// ❌ АНТИПАТТЕРН: N+1 катастрофа! Для 50 заказов генерирует 51 отдельный SQL запрос к базе
export async function getOrdersWithClientsBad(tenantId: string) {
  const orders = await db.order.findMany({
    where: { tenantId },
    take: 50,
  });

  // 50 параллельных запросов забивают пул соединений БД
  const enriched = await Promise.all(
    orders.map(async (order) => {
      const user = await db.user.findUnique({
        where: { id: order.userId },
        select: { email: true, balance: true },
      });
      return { ...order, user };
    })
  );

  return enriched;
}

// ✅ ПРАВИЛЬНО: 1 оптимизированный JOIN через include/select с ограничением полей
export async function getOrdersWithClientsOptimized(tenantId: string) {
  return db.order.findMany({
    where: { tenantId },
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      amountKopecks: true,
      createdAt: true,
      // Включение связи без N+1 с проекцией только нужных колонок
      user: {
        select: {
          id: true,
          email: true,
          balance: true,
        },
      },
    },
  });
}
```

### Инвариант 2: Табу на `OFFSET` — обязательная курсорная пагинация (Keyset Pagination)
В административных таблицах с объемами свыше 1 000 строк запрещено использовать `skip: (page - 1) * pageSize` без жесткого ограничения максимальной страницы ($\le 10$). При глубоком скролле и сортировке обязательно используется Keyset Cursor по составному ключу `(createdAt, id)` с составным B-Tree индексом `@@index([createdAt(sort: Desc), id])`.

```typescript
// ❌ АНТИПАТТЕРН: OFFSET сканирует и сбрасывает миллионы строк, t_query растет линейно
export async function getLedgerEntriesDeepOffset(page: number, pageSize = 50) {
  return db.ledgerEntry.findMany({
    skip: (page - 1) * pageSize, // При page=1000 это OFFSET 49950! Время отклика > 1200ms
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  });
}

// ✅ ПРАВИЛЬНО: Keyset Pagination через курсор — стабильные < 15ms независимо от глубины
export async function getLedgerEntriesCursor(cursorId?: string, pageSize = 50) {
  return db.ledgerEntry.findMany({
    take: pageSize + 1, // +1 для определения флага hasNextPage
    ...(cursorId
      ? {
          cursor: { id: cursorId },
          skip: 1, // Пропускаем сам элемент курсора
        }
      : {}),
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }, // Детерминированный tie-breaker для записей с одинаковым timestamp
    ],
    select: {
      id: true,
      userId: true,
      amount: true,
      reason: true,
      createdAt: true,
    },
  });
}
```

### Инвариант 3: Динамический импорт тяжелых UI библиотек (Tree-Shaking)
Любые интерактивные компоненты весом $> 30\text{ kB}$ (графики `recharts`, визивиг `BlockNote`, модальные диалоги экспорта в Excel) обязаны загружаться через `next/dynamic` с отложенным рендерингом (`ssr: false` для компонентов, зависящих от `window`).

```typescript
// ❌ АНТИПАТТЕРН: Статический импорт Recharts и BlockNote раздувает First Load бандл на 400 Кб
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts';
import { BlockNoteView } from '@blocknote/react';

// ✅ ПРАВИЛЬНО: Ленивая загрузка по требованию (Code Splitting)
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export const AnalyticsAreaChart = dynamic(
  () => import('@/components/admin/analytics/lazy-chart').then((mod) => mod.LazyAreaChart),
  {
    loading: () => <Skeleton className="w-full h-[320px] rounded-xl" />,
    ssr: false, // Отключаем SSR для чисто клиентской графической библиотеки
  }
);

export const RichEditor = dynamic(
  () => import('@/components/editor/blocknote-editor').then((mod) => mod.BlockNoteEditor),
  {
    loading: () => <div className="p-4 text-xs text-muted-foreground animate-pulse">Загрузка редактора...</div>,
    ssr: false,
  }
);
```

### Инвариант 4: Лимиты пулов соединений PostgreSQL и Redis (Connection Pool Sizing)
1. **Prisma Connection Limit:** Строго рассчитывается по формуле:
   $$\text{connection\_limit} = \frac{\text{Max PG Connections} - 20}{\text{Number of App Containers}}$$
   В строке подключения `DATABASE_URL` обязательно указывается: `?connection_limit=15&pool_timeout=10&connect_timeout=5`.
2. **BullMQ vs Redis App:** Запрещено шарить одно соединение Redis между фоновыми очередями BullMQ (требующими блокирующих команд `BRPOPLPUSH` и `maxRetriesPerRequest: null`) и общим кэшем приложения (требующим `maxRetriesPerRequest: 3`).

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

| Сценарий отказа | Вероятность x Влияние | Защитный механизм в коде | План ликвидации аварии |
| :--- | :--- | :--- | :--- |
| **1. Исчерпание пула соединений PostgreSQL (`Timed out fetching connection from pool`)**<br>Всплеск трафика или зависшая транзакция блокирует все 15 коннектов инстанса. | **Высокая x Критическое** (P0) | Таймаут пула `pool_timeout=10`, строгие сетевые таймауты `statement_timeout = '15s'` на уровне БД и изоляция транзакций через `runSerializableTransaction`. | Перезапуск зависших транзакций (`SELECT pg_terminate_backend(pid)`), временное масштабирование PgBouncer. |
| **2. Взрывной рост времени отклика при глубокой пагинации заказов**<br>Операторы кликают на 500-ю страницу таблицы заказов -> PostgreSQL уходит в 100% CPU на сканировании диска. | **Высокая x Высокая** (P1) | Keyset Pagination по `(createdAt, id)` с композитным индексом. В UI лимит быстрого перехода: не более 10 страниц вперед. | Включение кэширования страницы в Redis на 60 сек, добавление составного индекса в Prisma. |
| **3. Memory Leak в Node.js из-за неконтролируемого накопления соединений Redis**<br>Повторное создание `new Redis()` при каждом Server Action в среде HMR / Standalone. | **Средняя x Критическое** (P0) | Паттерн синглтона `globalThis.redis` с проверкой существующего инстанса (см. `src/lib/redis.ts`) и `lazyConnect: true`. | Экстренный рестарт контейнера через docker-compose (`docker-compose restart web`), фиксация глобального синглтона. |
| **4. Лавинообразное падение пропускной способности из-за N+1 запросов**<br>Новый виджет дашборда запрашивает статус каждого провайдера в цикле. | **Высокая x Высокая** (P1) | Обязательный batch-запрос `findMany({ where: { id: { in: ids } } })` и кэширование в Redis с TTL 60с (`provider:balances`). | Подключение фонового cron-воркера опроса балансов провайдеров раз в 60с с чтением из кэша. |
| **5. Превышение лимита памяти контейнера (Docker OOMKilled Code 137)**<br>Сборка продакшн-бандла Next.js запускается внутри контейнера с лимитом 1 Гб RAM. | **Высокая x Высокая** (P1) | Железное правило BGS-2026: сборка `npm run build` выполняется СТРОГО на хосте, в Docker копируется готовый `.next/standalone`. | Увеличение лимита памяти контейнера (`--memory=2g`) и сборка артефактов до копирования в образ. |

---

## 4. Чеклист верификации (Verification Checklist)

Перед сдачей любого изменения функционала, связанного с данными или UI:

- [ ] **1. Проверка отсутствия $N+1$ запросов:**
  - [ ] В коде нет вызовов `db.*` внутри `map()`, `forEach()`, `for (...)`.
  - [ ] Связанные сущности запрашиваются через `include: { ... }` или единый `findMany({ where: { in: [...] } })`.
  - [ ] Логи Prisma (`DEBUG_PRISMA=true`) показывают фиксированное число запросов (1–2) при любом объеме выборки.
- [ ] **2. Аудит пагинации и индексов:**
  - [ ] Для списков свыше 1 000 строк используется Keyset Pagination (`cursor: { id }`).
  - [ ] Поля сортировки и фильтрации покрыты индексами в `prisma/schema.prisma` (`@@index([tenantId, createdAt])`).
  - [ ] Время выполнения запроса на тестовой базе (50k+ записей) составляет $< 30\text{ ms}$.
- [ ] **3. Аудит клиентского бандла и Tree-Shaking:**
  - [ ] Библиотеки графиков и визуальных редакторов обернуты в `next/dynamic` с `{ ssr: false }`.
  - [ ] Отсутствуют импорты серверных пакетов (`ioredis`, `bullmq`, `sanitize-html`) в клиентских файлах (`'use client'`).
  - [ ] Размер первой загрузки страницы (First Load JS) в отчете `next build --webpack` не превышает 150 Кб.
- [ ] **4. Аудит конфигурации пулов соединений:**
  - [ ] В `DATABASE_URL` присутствует директива `connection_limit` ($\le 15$ на процесс).
  - [ ] Соединения Redis используют глобальный синглтон `globalForRedis`.
  - [ ] Клиент BullMQ изолирован от общего кэша приложения (`maxRetriesPerRequest: null`).
- [ ] **5. Запуск нагрузочных и регрессионных тестов:**
  ```bash
  # 1. Проверка типов TypeScript
  npx tsc --noEmit
  
  # 2. Тесты производительности и целостности данных
  npx vitest run src/__tests__/ai-draft-caching-speed.test.ts
  npx vitest run src/__tests__/admin-stress/
  ```
