# СПЕЦИФИКАЦИЯ (SDD-TDD — RAC-2026 / FA-2026)
# Архитектурное масштабирование и гипер-оптимизация производительности OmniSMM 1.0 (SMMplan & SMMflux)
# Векторы: Multi-Tenant Redis Catalog Cache, Keyset Cursor-пагинация заказов, Connection Pool Tuning

> **Статус:** DRAFT FOR REVIEW & APPROVAL  
> **Версия:** 1.0.0 (OmniSMM 1.0 RAC-2026 / FA-2026)  
> **Дата:** 23.09.2026  
> **Контур:** Tier 1 (Каталог, реестр заказов, кэш Redis, пул соединений PostgreSQL, Server Actions)  
> **Методология:** SDD (Spec-Driven Development) + TDD (Test-Driven Development)  
> **Профильные скиллы:** `postgres-query-doctor`, `nfr-performance-budget`, `concurrency-acid-guard`, `browser-visual-qa`

---

## 1. Контекст, обоснование и целевые метрики (NFR Matrix)

По результатам предварительного бенчмарка (`scripts/benchmark-system-performance.ts`) система демонстрирует суб-10ms запросы к БД при текущем объеме данных. Однако при масштабировании до десятков тысяч активных пользователей и сотен тысяч заказов вскрыты две критические зоны будущего замедления:

1. **Деградация пагинации заказов при росте базы (`OFFSET` Penalty):**
   В [`src/app/dashboard/orders/page.tsx`](file:///d:/SMM_plan_2/src/app/dashboard/orders/page.tsx) пагинация реализована через `skip: (currentPage - 1) * limit`. При переходе на 1 000-ю страницу (`OFFSET 15000`) планировщик PostgreSQL вынужден последовательно считывать с диска 15 000 строк и отбрасывать их. Задержка возрастает с 3 мс до 400–800 мс.
2. **Нагрузка на базу данных при наплыве трафика на каталог (`Cold DB Load`):**
   Публичный каталог (`/services`) и витрина запрашивают связи `db.service.findMany` с категориями и соцсетями при каждом обращении (или опираются исключительно на встроенный кэш Next.js, который сбрасывается при рестартах подов).
3. **Риск исчерпания пула соединений (`Connection Pool Starvation`):**
   При одновременной фоновой синхронизации цен (BullMQ), приеме вебхуков ЮKassa и пиковом трафике покупателей лимит `connection_limit=5` в `DATABASE_URL` создает очередь ожидания соединений.

### Целевые показатели производительности (NFR Budgets):
| Метрика | До оптимизации (Базовый) | Целевой бюджет (Budget) | Элитный стандарт |
|---|:---:|:---:|:---:|
| **TTFB каталога (`/services`)** | $52\dots72\text{ ms}$ | **$\le 25\text{ ms}$** | Tier-1 Global Edge |
| **Выборка заказов (глубокая пагинация)** | $\approx 250\dots500\text{ ms}$ (при росте) | **$\le 5\text{ ms}$** (вечная) | Stripe Keyset standard |
| **Пропускная способность чекаута** | $50\text{ RPS}$ (лимит пула 5) | **$\ge 250\text{ RPS}$** | Высокая нагрузка 2026 |
| **Хит-рейт кэша каталога в Redis** | $0\%$ (только RSC memory) | **$\ge 98\%$** | Instant Edge delivery |

---

## 2. 5 Векторов Надежности (5 Vectors of Reliability)

1. **Архитектурный стык (Server/Client Boundaries):**
   - Кэширование каталога реализуется на уровне Server Actions и сервисного слоя (`src/services/catalog/cached-catalog.service.ts`). Клиентские компоненты получают сериализованный DTO с неизменным контрактом.
   - Курсорная пагинация поддерживает обратную совместимость: если в URL передан `?page=...`, бэкенд вычисляет деградационный фоллбек, но по умолчанию использует курсор `?cursor=<orderId>`.
2. **Хаос и пустота (Edge Cases & Resilience):**
   - При отказе Redis (`ECONNREFUSED` / таймаут > 500ms) кэширующий сервис автоматически деградирует (Fail-Open) до прямого чтения из PostgreSQL без прерывания пользовательского сеанса.
   - Если курсор заказа был удален или не найден, выборка плавно стартует с первого актуального заказа без 404 / 500 ошибок.
3. **Visual & UX Density (Плотность и интерфейс):**
   - Реестр заказов сохраняет привычные кнопки навигации («Назад» / «Вперед»), но индикатор текущей позиции отображает: *«Заказы 1–15 из N»*, а переход назад/вперед использует `cursorPrev` и `cursorNext`.
   - В каталоге сохраняется мгновенная фильтрация без мерцания и сдвига верстки (CLS = 0).
4. **Доступность (WCAG 2.2 AA):**
   - Все элементы пагинации сохраняют размеры интерактивной области $\ge 44\text{px}$, поддержку клавиатурной навигации (`Tab`, `Enter`, `Space`) и атрибуты `aria-label="Следующая страница заказов"`.
5. **Security & Trust (Изоляция и IDOR):**
   - **Строгий инвариант `tenantId`:** Любой кэш в Redis обязан содержать префикс тенанта: `catalog:v1:${tenantId}:tree`. Запрещено общее пространство ключей.
   - Курсорная пагинация заказов строго фильтрует по `where: { userId: session.userId, tenantId }`, исключая подделку курсора для просмотра чужих заказов (Anti-IDOR Guard).

---

## 3. Премортем-анализ (Failure Simulation)

| Сценарий гипотетического отказа | Вероятность x Влияние | Защитный механизм в коде |
|---|:---:|---|
| **1. Падение или перезапуск Redis-сервера во время наплыва покупателей** | Средняя x Высокая | **Circuit Breaker & Fallback:** Метод `getCachedCatalog()` обернут в `try/catch` с таймаутом `AbortSignal.timeout(500)`. При ошибке Redis запрос мгновенно уходит в PostgreSQL, в лог пишется ворнинг, витрина не падает. |
| **2. Рассинхронизация цен в Redis при обновлении провайдеров** | Средняя x Высокая | **Atomic Tagged Invalidation:** Воркер `catalog.processor.ts` и `catalog-sync.service.ts` после мутации цен выполняют атомарный сброс ключей `redis.del('catalog:v1:' + tenantId + ':*')` и вызывают `revalidateTag('catalog-' + tenantId)`. |
| **3. Попытка перебора чужих курсоров в заказах (`BOLA/IDOR`)** | Низкая x Критическая | **Fail-Closed Keyset Guard:** Запрос курсора включает составной фильтр `where: { id: cursorId, userId: session.userId, tenantId }`. Если курсор принадлежит другому пользователю или тенанту, возвращается пустой список либо первая страница (доступ блокируется). |
| **4. Исчерпание пула PostgreSQL при пиковой нагрузке (`P2024 Pool Timeout`)** | Средняя x Высокая | **Connection Sizing & Pool Timeout:** Увеличение `connection_limit=15` и `pool_timeout=15` в `DATABASE_URL`, гарантирующее буфер для параллельных Server Actions. |

---

## 4. Архитектурный контракт и DTO

### 4.1. Схема курсорной пагинации (Zod DTO)
```typescript
import { z } from 'zod';

export const OrdersKeysetQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  direction: z.enum(['forward', 'backward']).default('forward'),
  limit: z.number().int().min(1).max(50).default(15),
  status: z.string().optional(),
  network: z.string().optional(),
  search: z.string().optional(),
});

export type OrdersKeysetQuery = z.infer<typeof OrdersKeysetQuerySchema>;

export interface KeysetPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}
```

### 4.2. Контракт кэширования каталога в Redis
- **Ключ:** `catalog:tree:${tenantId}:v1`
- **TTL:** 1800 секунд (30 минут)
- **Формат:** Сжатый JSON DTO дерева категорий и активных услуг
- **Инвалидация:**
  - По событиям админки: изменение цен, скрытие услуги, импорт из провайдера.
  - По событию воркера: `catalog-sync` завершен.

---

## 5. Предлагаемые изменения по компонентам

### 5.1. Уровень базы данных и кэша
1. **[NEW] [`src/services/catalog/catalog-cache.service.ts`](file:///d:/SMM_plan_2/src/services/catalog/catalog-cache.service.ts):**
   - Изолированный сервис работы с Redis-кэшем каталога с поддержкой Fallback в PostgreSQL при недоступности Redis.
2. **[MODIFY] [`src/actions/order/catalog.ts`](file:///d:/SMM_plan_2/src/actions/order/catalog.ts):**
   - Интеграция `CatalogCacheService` для отдачи публичного каталога за $\le 15\text{ ms}$.
3. **[MODIFY] [`src/services/admin/catalog/catalog-sync.service.ts`](file:///d:/SMM_plan_2/src/services/admin/catalog/catalog-sync.service.ts):**
   - Вызов инвалидации Redis-кэша после завершения синхронизации цен.

### 5.2. Уровень реестра заказов
4. **[MODIFY] [`src/app/dashboard/orders/page.tsx`](file:///d:/SMM_plan_2/src/app/dashboard/orders/page.tsx):**
   - Внедрение Keyset Cursor-пагинации с составным сортировочным ключом `[createdAt DESC, id DESC]` и поддержкой обратной совместимости.
5. **[MODIFY] [`src/components/orders/CustomerOrdersWorkspace.tsx`](file:///d:/SMM_plan_2/src/components/orders/CustomerOrdersWorkspace.tsx):**
   - Обновление панели пагинации для плавной работы с `cursorNext` / `cursorPrev`.

### 5.3. Пул соединений базы данных
6. **[MODIFY] [`.env`](file:///d:/SMM_plan_2/.env):**
   - Тюнинг параметров `DATABASE_URL`: `connection_limit=15&pool_timeout=15`.

---

## 6. План верификации (TDD — Red-to-Green)

1. **Фаза Red (Падающие тесты контрактов):**
   - Создать модульный тест `src/__tests__/unit/keyset-orders-pagination.test.ts` (проверка $O(1)$ курсорной выборки, детекция попыток IDOR по курсору).
   - Создать интеграционный тест `src/__tests__/unit/catalog-redis-cache.test.ts` (проверка попадания в кэш, изоляции `tenantId` и сценария падения Redis).
2. **Фаза Green (Реализация):**
   - Реализовать сервисы и контроллеры до прохождения всех тестов со статусом **PASS**.
3. **Фаза Refactor & Regression Gate:**
   - Запустить `npx tsc --noEmit` &rarr; 0 ошибок.
   - Запустить `npm run lint:tenant` &rarr; 0 BLOCKERs.
   - Прогнать обновленный бенчмарк `npx tsx scripts/benchmark-system-performance.ts` и зафиксировать сокращение задержек.
