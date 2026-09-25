---
name: api-contract-evolver
description: Используй этот скилл ВСЕГДА, когда Комплексный архитектурный скилл
  для контрактной эволюции API, обеспечения 100% обратной совместимости и
  управления жизненным циклом схем в платформе OmniSMM (Next.js 16 App Router,
  Server Actions, REST эндпоинты, Webhooks провайдеров и платёжных шлюзов).
  Используй этот скилл ВСЕГДА, когда планируется изменение аргументов или
  возвращаемых типов Server Actions, обновление схем валидации Zod, модификация
  публичных API (/api/v1, /api/v2), доработка форматов вебхуков провайдеров
  (Socgress, SmmLavka, Likemania и др.), добавление полей в DTO заказов,
  пользователей или биллинга, у. НЕ применять для стилизации UI компонентов
  Tailwind CSS или сетевых настроек.
---

# API Contract Evolver — Эволюция Контрактов и Обратная Совместимость OmniSMM

## Назначение скилла

В высоконагруженной мульти-тенантной платформе **OmniSMM** (бренды **SMMplan** и **SMMflux**) API взаимодействует с сотнями распределённых клиентов: мобильные браузеры с агрессивным сервис-воркером и долгим кэшем, внешние клиенты API v2, вебхуки платёжных шлюзов (ЮKassa, Robokassa, CryptoBot) и провайдеров накрутки. 

Любое неаккуратное изменение контракта — удаление поля, сужение типа, добавление обязательного параметра без значения по умолчанию — приводит к немедленному отказу части пользователей («Silent Form Failures», рассинхронизация клиентских бандлов во время Blue-Green деплоя, зависание заказов).

Скилл **api-contract-evolver** реализует строгую методологию **Contract-First Development** на базе **Zod**, правила выявления Breaking Changes до слияния в Git, протокол версионирования и безопасной депрекации по стандартам **RFC 8594**, а также шаблоны бесшовной миграции данных и интерфейсов.

---

## Когда НЕ применять

- Внутренние приватные функции и локальные утилиты внутри одного файла (`helpers.ts`), не экспортируемые наружу и не входящие в публичный интерфейс модуля.
- Изменения визуальных CSS-классов и верстки Tailwind 4, если они не влияют на `data-*` атрибуты, используемые E2E-тестами или контрактами форм.
- Простые SQL/Prisma миграции, не затрагивающие DTO и Server Actions (для DDL используй скилл `db-evolution-zero-downtime`).

---

## 1. Дерево решений (Decision Tree / Flowchart)

### Архитектурный граф принятия решений при изменении контракта

```
              [Планируется изменение контракта API / Server Action / DTO]
                                         │
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │  Шаг 1. Классификация типа контракта          │
                 │  - Server Action (src/actions/*)             │
                 │  - REST API / External (/api/v1, /api/v2)    │
                 │  - Webhook Endpoint (/api/webhooks/*)        │
                 └──────────────────────┬───────────────────────┘
                                        │
                                        ▼
             ┌──────────────────────────────────────────────────────┐
             │  Шаг 2. Анализ природы изменения (Breaking Matrix)   │
             └──────────────────────────┬───────────────────────────┘
                                        │
         ┌──────────────────────────────┴──────────────────────────────┐
         ▼                                                             ▼
  [РАСШИРЕНИЕ (Non-Breaking)]                                   [ЛОМАЮЩЕЕ (Breaking)]
  - Добавление опционального поля                               - Удаление существующего поля
  - Добавление поля с .default()                                - Переименование ключа в схеме
  - Расширение union-типа (input)                               - Добавление required поля без default
  - Ослабление валидатора (min(3) -> min(1))                    - Сужение типа (string -> enum)
         │                                                      - Изменение формата ответа
         │                                                             │
         ▼                                                             ▼
┌────────────────────────────────┐                            ┌─────────────────────────────────┐
│ Режим Fast-Track:              │                            │ ПАТТЕРН БЕЗОПАСНОЙ МИГРАЦИИ:     │
│ 1. Обновить Zod-схему в        │                            │ 1. Создать новую версию схемы/  │
│    src/validators/             │                            │    эндпоинта (v2 или Action-v2) │
│ 2. Проверить сериализацию      │                            │ 2. Старый контракт пометить     │
│ 3. Запустить unit-тесты        │                            │    @deprecated + RFC 8594 Sunset│
│ 4. Деплой без простоя          │                            │ 3. Включить Dual-Read/Write     │
└────────────────────────────────┘                            │ 4. Мониторинг трафика (Grace)   │
                                                              │ 5. Финальный вывод из экспл-ции │
                                                              └─────────────────────────────────┘
```

### Пошаговый алгоритм эволюции контрактов

1. **Анализ потребителей контракта:**
   - Перед любой правкой запустить `grep_search` по имени схемы, имени Server Action или пути эндпоинта по всему репозиторию (включая `__tests__`, e2e тесты, мобильные визарды).
   - Зафиксировать число активных точек вызова. Если потребителей $\ge 2$, прямое ломающее изменение **строго запрещено**.

2. **Проектирование схемы в Zod (Contract-First):**
   - Все входные данные обязаны валидироваться через строгие схемы Zod (`z.object({...})`).
   - Использовать `.strip()` (поведение по умолчанию) для фильтрации непредусмотренных полей, либо `.strict()` для закрытых протоколов интеграции с банками.
   - Любое новое поле обязано объявляться как `.optional()` с указанием `.default(val)` для сохранения совместимости со старыми формами.

3. **Фаза двух фаз (Dual-Read / Dual-Write Grace Period):**
   - **Dual-Read:** Сервер принимает как старое имя поля (`legacyField`), так и новое (`newField`), автоматически нормализуя их в доменном слое через Zod preprocess/transform.
   - **Dual-Write:** При мутации в базу пишутся оба формата (или вычисляемое свойство) на период обновления всех инстансов и клиентских кэшей.

4. **Депрекация и оповещение клиентов:**
   - Пометить устаревшие поля и методы JSDoc-тегом `@deprecated`.
   - Для HTTP-эндпоинтов возвращать заголовки `Deprecation: <date>` и `Sunset: <date>` (RFC 8594).
   - Минимальный период Grace Period для внешних REST-клиентов — 30 дней, для внутренних Server Actions — 1 релизный цикл с подтверждением сброса клиентских кэшей.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Инвариант 1: Единый типизированный контракт Server Actions
Все Server Actions обязаны возвращать строго дискриминированный union-тип `{ success: true, data?: T } | { success: false, error: string, code?: string }`. Запрещено выбрасывать необработанные исключения `throw new Error(...)` (в Next.js 16 production они маскируются до нечитаемой строки `"An unexpected response was received from the server."`).

```typescript
// ❌ АНТИПАТТЕРН: Сырой throw, отсутствие типизированного контракта, ломает клиент при сбое
export async function updateServiceAction(formData: FormData) {
  const serviceId = formData.get('serviceId') as string;
  const price = Number(formData.get('price')); // NaN при пустом вводе!
  
  if (!serviceId) {
    throw new Error('Service ID is required'); // В проде станет "An unexpected error..."
  }
  
  const updated = await db.service.update({
    where: { id: serviceId },
    data: { pricePerUnitRub: price }
  });
  
  return updated; // Сырая модель БД утекает на клиент, раскрывая внутренние поля
}

// ✅ ПРАВИЛЬНО: Zod safeParse, строгий контракт ответа, безопасная обработка ошибок
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';

const updateServiceSchema = z.object({
  serviceId: z.string().cuid({ message: 'Некорректный ID услуги' }),
  pricePerUnitRub: z.coerce.number().positive({ message: 'Цена должна быть больше нуля' }),
  // Безопасное добавление нового поля: optional + default
  minQty: z.coerce.number().int().min(1).default(10),
});

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ActionResponse<T = void> = 
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function updateServiceAction(rawInput: unknown): Promise<ActionResponse<{ id: string }>> {
  return requireStaffPermission('services', 'edit', async () => {
    const parseResult = updateServiceSchema.safeParse(rawInput);
    
    if (!parseResult.success) {
      const flattened = parseResult.error.flatten().fieldErrors;
      const firstError = Object.values(flattened)[0]?.[0] || 'Ошибка валидации данных';
      return { 
        success: false, 
        error: firstError, 
        fieldErrors: flattened 
      };
    }
    
    const { serviceId, pricePerUnitRub, minQty } = parseResult.data;
    
    try {
      const service = await db.service.update({
        where: { id: serviceId },
        data: { pricePerUnitRub, minQty },
        select: { id: true }, // Защита данных: возвращаем строго DTO, а не всю запись
      });
      return { success: true, data: service };
    } catch (e) {
      console.error('[updateServiceAction Error]:', e);
      return { success: false, error: 'Не удалось обновить услугу в базе данных' };
    }
  });
}
```

### Инвариант 2: Запрет внезапного сужения типов и удаления полей (Schema Evolution)
При переходе со старого формата поля на новый используется **Zod Preprocessing / Transformation** для поддержки обоих вариантов (Dual-Read).

```typescript
// ❌ АНТИПАТТЕРН: Мгновенное переименование поля ломает старый фронтенд или сохраненные драфты
const orderPayloadSchema = z.object({
  targetUrl: z.string().url(), // Старые клиенты шлют 'link' -> 100% отказов!
});

// ✅ ПРАВИЛЬНО: Поддержка алиасов с плавным переходом (Dual-Read Transformer)
export const orderPayloadSchema = z.object({
  // Принимаем либо targetUrl, либо устаревший link, нормализуя в targetUrl
  targetUrl: z.preprocess((val) => {
    if (typeof val === 'string' && val.trim().length > 0) return val.trim();
    return undefined;
  }, z.string().url({ message: 'Укажите корректную ссылку на профиль или пост' })).optional(),
  
  /** @deprecated Используйте `targetUrl`. Будет удалено в v2.4 (Sunset: 2026-12-01) */
  link: z.string().url().optional(),
}).refine((data) => data.targetUrl || data.link, {
  message: 'Необходимо указать ссылку (targetUrl)',
  path: ['targetUrl'],
}).transform((data) => ({
  targetUrl: (data.targetUrl || data.link)!,
}));
```

### Инвариант 3: RFC 8594 Стандарты Депрекации внешних REST API
Внешние HTTP эндпоинты платформы (`src/app/api/v1/...`) при устаревании обязаны возвращать стандартные заголовки `Deprecation` и `Sunset` со ссылкой на документацию миграции.

```typescript
// ✅ ПРАВИЛЬНО: src/app/api/v1/orders/create/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Выполнение бизнес-логики по старому контракту v1...
  const response = NextResponse.json({
    status: 'success',
    orderId: 'ord_12345',
    warning: 'API v1 is deprecated. Migrate to API v2 (/api/v2/orders).',
  });

  // RFC 8594 Deprecation Headers
  response.headers.set('Deprecation', '@1767225600'); // Unix timestamp или HTTP Date
  response.headers.set('Sunset', 'Wed, 01 Jul 2027 00:00:00 GMT'); // Дата отключения
  response.headers.set('Link', '<https://smmplan.pro/docs/api/v2-migration>; rel="deprecation"; type="text/html"');

  return response;
}
```

### Инвариант 4: Webhook Fail-Closed Invariant & Isolation
Провайдерские вебхуки (`src/app/api/webhooks/provider/`) обязаны:
1. Валидировать входящий payload через Zod дискриминированные объединения (`z.discriminatedUnion`).
2. Строго блокировать изменение заказов со статусами `AWAITING_PAYMENT` или `PENDING` (только `IN_PROGRESS` или `PENDING_CHECK`).
3. Возвращать `200 OK` при получении валидного вебхука для предотвращения лавины ретраев провайдера, даже если заказ уже завершён (идемпотентность).

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

| Сценарий отказа | Вероятность x Влияние | Защитный механизм в коде | План восстановления при инциденте |
| :--- | :--- | :--- | :--- |
| **1. Добавление обязательного поля в Zod-схему Server Action**<br>Пользователи со старой версией SPA/PWA в кэше отправляют форму без нового поля. | **Высокая x Критическое** (P0) | Все новые поля объявляются строго с `.optional().default(...)`. Запрещены обязательные поля без дефолта в существующих Action. | Hotfix: добавить `.default()` к полю в Zod-схеме на бэкенде. Клиентский бандл перезагружать не требуется. |
| **2. Удаление поля из ответа API v1 (`/api/v1/services`)**<br>Сторонние интеграторы и боты клиентов ломаются с `TypeError: Cannot read properties of undefined`. | **Средняя x Высокая** (P1) | Схема ответа DTO сохраняет удаляемое поле как `null` или вычисляет его значение-заглушку в течение 6 месяцев. | Немедленный откат коммита (5-секундный Blue-Green откат), восстановление маппера поля в DTO. |
| **3. Webhook провайдера присылает неизвестный статус заказа**<br>Бэкенд падает с необработанной ошибкой Prisma `Invalid enum value` при записи в БД. | **Высокая x Высокая** (P1) | `z.nativeEnum(OrderStatus).catch(OrderStatus.IN_PROGRESS)` или безопасный маппер `mapProviderStatus(rawStatus)` с fallback-значением. | Перевод заказа в статус `PENDING_CHECK` с отправкой алерта в Telegram через `SecurityAlertService`. |
| **4. Рассинхронизация типов FormData в мобильном Safari**<br>Safari шлет пустую строку `""` вместо `null` для незаполненных полей ввода. | **Высокая x Средняя** (P2) | Использование `z.preprocess((v) => (v === '' ? undefined : v), ...)` перед числовыми или optional валидаторами. | Добавление sanitization middleware или замена `z.number()` на `z.coerce.number()`. |
| **5. «Зависшая депрекация» (Zombie API Debt)**<br>Устаревший эндпоинт поддерживается годами, накапливая уязвимости и создавая лишнюю нагрузку на БД. | **Средняя x Средняя** (P2) | Автоматический алерт в Sentry/Telegram при снижении трафика на депрецированном API ниже 0.1% с жесткой датой Sunset в RFC 8594. | Финальное переключение роута на возврат HTTP `410 Gone` с JSON-ответом о миграции. |

---

## 4. Чеклист верификации (Verification Checklist)

### Перед отправкой изменений контракта в PR / коммит:

- [ ] **1. Проверка радиуса поражения:** Выполнен поиск всех вхождений изменяемого метода или DTO через `grep_search`. Убедились, что нет скрытых потребителей в админке, мобильном визарде и E2E тестах.
- [ ] **2. Тест на совместимость сверху-вниз (Backward Compatibility):**
  - [ ] Старый пейлоад (без новых полей) успешно проходит валидацию Zod: `schema.safeParse(oldPayload).success === true`.
  - [ ] Новые поля имеют либо `.optional()`, либо `.default(value)`.
  - [ ] Нет удалённых ключей из объектов ответов.
- [ ] **3. Строгая типизация и отсутствие `any`:**
  - [ ] Входные аргументы типизированы через `z.infer<typeof inputSchema>`.
  - [ ] Выходной результат обернут в типизированный union `{ success: true, data: T } | { success: false, error: string }`.
  - [ ] `npx tsc --noEmit` завершается со статусом 0.
- [ ] **4. Аудит заголовков депрекации (для REST API):**
  - [ ] Присутствует заголовок `Deprecation` с датой начала устаревания.
  - [ ] Присутствует заголовок `Sunset` с датой полного вывода из эксплуатации.
  - [ ] Указан JSDoc `@deprecated` для поддержки подсказок в IDE.
- [ ] **5. Запуск юнит-тестов контрактов:**
  ```bash
  # Прогон тестов валидаторов и схем
  npx vitest run src/validators/
  # Прогон интеграционных тестов Server Actions
  npx vitest run src/actions/
  ```
- [ ] **6. Smoke-тест вебхуков:** Выполнен curl-запрос с минимальным валидным телом вебхука для проверки отсутствия 500 ошибок и корректности обработки идемпотентности.
