---
name: impact-blast-radius
description: Используй этот скилл ВСЕГДА, когда Комплексный архитектурный скилл
  для анализа радиуса поражения (Blast Radius Mapping), расчёта архитектурной
  связанности (Afferent и Efferent Coupling) и состязательного моделирования
  отказов на 3 шага вперёд (Pre-Mortem Failure Simulation) в платформе OmniSMM
  (Next.js 16 App Router, React 19, Tailwind 4, Prisma 5, BullMQ, Redis).
  Используй этот скилл ВСЕГДА перед редактированием общих утилит (src/lib/*,
  src/utils/*), Server Actions (src/actions/*), хуков React, схемы базы данных
  Prisma (schema.prisma), финансового движка (WalletOps, ExactMath), прокси-слоя
  (src/proxy.ts). НЕ применять для чисто текстовых правок документации или
  изолированных тестов.
---

# Impact Blast Radius — Анализ Радиуса Поражения и Моделирование Отказов на 3 Шага Вперёд

## Назначение скилла

В сложной мульти-сервисной платформе **OmniSMM** любое изменение в так называемом «маленьком общем хелпере» или одном Server Action способно вызвать каскадный отказ критических подсистем:
- Ошибка в общей функции форматирования сумм может сломать запись в финансовый журнал `LedgerEntry` и заблокировать списание баланса.
- Случайное изменение сигнатуры метода в `src/proxy.ts` может открыть неавторизованный доступ к закрытой админке или сбросить сессионные куки сотен мобильных клиентов.
- Добавление `throw new Error` в Server Action ломает обработчик `useActionState` в React 19, оставляя кнопку формы навсегда зависшей в состоянии loading.

Скилл **impact-blast-radius** регламентирует обязательный протокол аудита **перед** внесением изменений:
1. **Картирование зависимостей (Impact Radius Mapping)** через обязательный `grep_search`.
2. **Расчёт связанности (Coupling Metrics):** $C_a$ (Afferent Coupling), $C_e$ (Efferent Coupling), индекс нестабильности $I = \frac{C_e}{C_a + C_e}$.
3. **Моделирование отказа на 3 шага вперёд (Pre-Mortem 3-Step Simulation):** «Что сломается в 3 смежных контурах, если эта логика вернёт null, упадет по таймауту или выдаст невалидный тип?».
4. **Внедрение превентивных защит (Fail-Closed Guards & Fallbacks)** до применения правки.

---

## Когда НЕ применять

- Изолированные тестовые файлы в `__tests__` или скрипты харнесов (`scripts/harness/*`), не импортируемые в рабочем коде приложения.
- Локальные переменные внутри закрытой функции, не влияющие на внешние вызовы и типы возвращаемого значения.
- Чисто текстовые правки документации (`.md`), не содержащие исполняемого кода и ссылок на контракты.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### Алгоритм оценки радиуса поражения перед любым изменением

```
                   [Задача: изменить функцию, модуль, хук или схему БД]
                                             │
                                             ▼
             ┌──────────────────────────────────────────────────────────────┐
             │  Шаг 1. Обязательный поиск зависимостей (Grep Search)        │
             │  Query: "<имя_функции_или_модуля>"                           │
             │  Область: src/ (компоненты, actions, lib, api, validators)  │
             └──────────────────────────────┬───────────────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │  Шаг 2. Подсчёт точек использования           │
                    │  N = количество уникальных импортов/вызовов   │
                    └───────────────────────┬───────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
               [N == 1 точка]                                [N >= 2 точек]
           (Изолированный компонент)                   (ОБЩИЙ МОДУЛЬ / SHARED)
                     │                                             │
                     │                                             ▼
                     │                        ┌─────────────────────────────────────────┐
                     │                        │  Шаг 3. Расчёт архитектурной связанности│
                     │                        │  Ca (входящие) / Ce (исходящие)         │
                     │                        │  Индикатор нестабильности: I = Ce/(Ca+Ce)│
                     │                        │  Если Ca >= 3: ЯДРО СИСТЕМЫ (High Risk!) │
                     │                        └────────────────────┬────────────────────┘
                     │                                             │
                     ▼                                             ▼
     ┌──────────────────────────────┐         ┌─────────────────────────────────────────┐
     │ Локальное редактирование     │         │  Шаг 4. Мозговой штурм на 3 шага вперёд │
     │ с проверкой типов:           │         │  «Если изменение вернет null / сбой:     │
     │ - npx tsc --noEmit           │         │   1. Контур Auth / Proxy?               │
     │ - Unit тест модуля           │         │   2. Ledger / Баланс / Деньги?          │
     │                              │         │   3. Кэш / Мульти-тенантность / Визард?»│
     └──────────────────────────────┘         └────────────────────┬────────────────────┘
                                                                   │
                                                                   ▼
                                              ┌─────────────────────────────────────────┐
                                              │  Шаг 5. Внедрение защитных барьеров:    │
                                              │  - 100% Обратная совместимость сигнатур │
                                              │  - Fail-Closed guards & Default fallback │
                                              │  - Сквозной прогон смежных сьютов тестов│
                                              └─────────────────────────────────────────┘
```

### Математическая модель связанности (Coupling & Stability Metrics)

Для любого модуля $M$ рассчитываются метрики:
1. **$C_a$ (Afferent Coupling — центростремительное сцепление):** число внешних модулей, зависящих от $M$. Характеризует ответственность модуля. Чем выше $C_a$, тем больше радиус поражения при его поломке.
2. **$C_e$ (Efferent Coupling — центробежное сцепление):** число внешних модулей, от которых зависит сам модуль $M$. Характеризует уязвимость модуля к внешним изменениям.
3. **$I$ (Instability — показатель нестабильности):**
   $$I = \frac{C_e}{C_a + C_e}$$
   - $I = 0$: **Максимально стабильный модуль** (ядро, например `WalletOps`, `db`, `rbac`). От него зависит вся система, он ни от кого не зависит. Править только через расширение!
   - $I = 1$: **Максимально нестабильный модуль** (конечные экраны страниц, презентационные компоненты). Менять безопасно, так как от него никто не зависит.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### Инвариант 1: Правило обратной совместимости общих модулей ($N \ge 2$)
Если функция или тип используется более чем в 1 месте репозитория, **запрещено менять сигнатуру функции** (удалять параметры, менять порядок обязательных аргументов, сужать тип возврата). Новые параметры добавляются только как опциональные через объект опций.

```typescript
// ❌ АНТИПАТТЕРН: Изменение порядка и типов аргументов в общей функции (ломает все вызовы)
// Было: export function formatPriceRub(amountKopecks: bigint): string;
// Стало (сломало 14 экранов и 3 воркера):
export function formatPriceRub(amountKopecks: number, currency = 'RUB', withSymbol = true): string {
  // Вызов formatPriceRub(1000n) теперь выбросит TypeError: Cannot convert a BigInt value to a number!
  return `${(amountKopecks / 100).toFixed(2)} ${withSymbol ? currency : ''}`;
}

// ✅ ПРАВИЛЬНО: 100% обратная совместимость через перегрузку или объект опций
export interface FormatPriceOptions {
  currency?: string;
  withSymbol?: boolean;
}

export function formatPriceRub(
  amountKopecks: bigint | number,
  options?: FormatPriceOptions
): string {
  const safeKopecks = typeof amountKopecks === 'bigint' 
    ? amountKopecks 
    : BigInt(Math.round(amountKopecks));
  
  const rubles = Number(safeKopecks) / 100;
  const withSymbol = options?.withSymbol ?? true;
  const currency = options?.currency ?? '₽';

  const formatted = rubles.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return withSymbol ? `${formatted} ${currency}` : formatted;
}
```

### Инвариант 2: Защита смежного контура «Ledger / Баланс» (Fail-Closed Barrier)
Любые модификации в заказе, корзине или тарифах провайдеров обязаны соблюдать финансовый инвариант: **ни при каких обстоятельствах пользователь не должен получить услугу бесплатно или списать баланс мимо журнала `LedgerEntry`**.

```typescript
// ❌ АНТИПАТТЕРН: Мутация баланса без предварительной блокировки и проверки леджера
export async function applyDiscountAndDebit(userId: string, orderCost: bigint) {
  // Уязвимость состояния гонки и отсутствие атомарной проводки
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user && user.balance >= orderCost) {
    await db.user.update({
      where: { id: userId },
      data: { balance: { decrement: orderCost } },
    });
    return true;
  }
  return false;
}

// ✅ ПРАВИЛЬНО: Делегирование в защищенный WalletOps внутри Serializable-транзакции
import { WalletOps } from '@/services/financial/wallet-ops';
import { runSerializableTransaction } from '@/lib/transactions';
import { auditAdminAwaitable } from '@/lib/admin-audit';

export async function applyDiscountAndDebit(
  userId: string,
  orderCostKopecks: bigint,
  idempotencyKey: string,
  tenantId: string
) {
  return runSerializableTransaction(async (tx) => {
    // 1. Проводка и списание строго через единый финансовый шлюз
    const walletResult = await WalletOps.debit({
      tx,
      userId,
      amountKopecks: orderCostKopecks,
      idempotencyKey,
      reason: 'ORDER_DEBIT',
      tenantId: tenantId || 'smmplan',
    });

    if (!walletResult.success) {
      // Fail-Closed: транзакция немедленно откатывается
      throw new Error(`[FINANCIAL_ABORT] ${walletResult.error}`);
    }

    return walletResult;
  });
}
```

### Инвариант 3: Мульти-тенантный фильтр (Multi-Tenant Invariant)
При изменении любых запросов выборки (`findMany`, `count`, `aggregate`) в общих сервисах **запрещено опускать условие `tenantId`**. Запрос без `tenantId` приводит к катастрофической утечке данных между клиентами SMMplan и SMMflux.

```typescript
// ❌ АНТИПАТТЕРН: Утечка данных чужого тенанта в общем дашборде
export async function getRecentOrdersList(status: string) {
  // Уязвимость: заказы SMMflux отобразятся в дашборде SMMplan!
  return db.order.findMany({
    where: { status },
    take: 50,
  });
}

// ✅ ПРАВИЛЬНО: Строгий скоупинг тенанта с обязательным fallback-значением
import { resolveTenantId } from '@/utils/tenant-resolver';

export async function getRecentOrdersList(status: string, requestedTenantId?: string) {
  const tenantId = resolveTenantId(requestedTenantId); // Гарантирует smmplan или flux
  
  return db.order.findMany({
    where: {
      status,
      tenantId, // Изоляция гарантирована
    },
    take: 50,
    orderBy: { createdAt: 'desc' },
  });
}
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

Агент ОБЯЗАН провести мысленный эксперимент на 3 шага вперёд по шести ключевым осям:

| Контур системы | Сценарий гипотетического отказа (Шаг 1 -> Шаг 2 -> Шаг 3) | Вероятность x Влияние | Механизм защиты в коде (Fail-Closed Guard) |
| :--- | :--- | :--- | :--- |
| **1. Auth & Session (`proxy.ts` / RBAC)** | Изменение логики извлечения токена -> sessionUser становится undefined -> Server Action падает с unhandled exception -> экран зависает в белом экране (White Screen of Death). | **Средняя x Критическое** (P0) | Все серверные действия используют `requireStaffPermission()` с явной проверкой на `null` и возвратом `{ success: false, error: 'Unauthorized' }` без падения. |
| **2. Ledger & Баланс (`WalletOps`)** | Добавление скидочного купона с плавающей точкой -> округление в копейках дает дробное число -> Prisma отклоняет запись `BigInt` -> деньги списаны, но заказ не создан. | **Высокая x Критическое** (P0) | Использование `ExactMath.calculateOrderCostKopecks()` с банковским округлением (Half-Even) и обязательный `BigInt(Math.round(...))` с порогом $\ge 1$ коп. |
| **3. Кэширование (`unstable_cache` / Redis)** | Обновление цены услуги без инвалидации ключа тенанта -> админ видит новую цену, а клиенты заказывают по старой цене в 10 раз дешевле. | **Высокая x Высокая** (P1) | Кэш-ключи обязаны включать `tenantId` (`catalog-${tenantId}`), а мутация обязана вызывать синхронный сброс: `revalidateTag(tenantId)` и `redis.del(...)`. |
| **4. Мобильный визард (React 19 / UX)** | Серверный экшен возвращает `throw` вместо `{ success: false }` -> хук `useActionState` не обновляет стейт -> форма не разблокируется, shake-анимация не срабатывает. | **Высокая x Высокая** (P1) | Запрет `throw` внутри Action, возврат объекта с `error` и перехватчик `onError` в мобильной форме с восстановлением кнопки отправки. |
| **5. Вебхуки и Очереди (`BullMQ`)** | Изменение типа поля в заказе -> фоновый воркер `ordersQueue` не может десериализовать Job payload -> воркер падает в бесконечный retry-луп (poison pill). | **Средняя x Высокая** (P1) | Использование Zod `safeParse` на входе воркера BullMQ. При ошибке схемы — перемещение задачи в Dead Letter Queue (DLQ) без падения процесса воркера. |
| **6. Мульти-тенантность (OmniSMM Engine)** | Добавление глобальной переменной состояния тенанта в модуль Node.js -> запросы клиентов перемешиваются между SMMplan и SMMflux под нагрузкой. | **Средняя x Критическое** (P0) | Полный запрет модульных синглтон-переменных состояния (`let currentTenant`). Контекст передается строго через параметры функций или `AsyncLocalStorage`. |

---

## 4. Чеклист верификации (Verification Checklist)

Перед слиянием любого изменения в общий модуль выполни следующие шаги:

- [ ] **1. Картирование зависимостей (Grep Audit):**
  - Запущен поиск по кодовой базе: `grep_search` с именем модифицируемой функции/типа.
  - Составлен полный список затронутых файлов (Callers List).
  - Если затронуто $\ge 2$ файлов — подтверждена 100% обратная совместимость сигнатуры.
- [ ] **2. Проверка 3 смежных контуров (Pre-Mortem Checklist):**
  - [ ] **Контур Auth:** Изменение не ломает сессии, куки и права доступа гостя/клиента/админа.
  - [ ] **Контур Ledger:** Изменение не обходит `WalletOps`, не использует `db.*` вместо `tx.*` внутри транзакций.
  - [ ] **Контур Мульти-тенантности:** Запросы содержат `tenantId`, кэш-ключи изолированы по тенантам.
- [ ] **3. Валидация типов и отсутствие регрессий:**
  ```bash
  # 1. Проверка типов TypeScript во всем проекте
  npx tsc --noEmit
  
  # 2. Прогон модульных тестов измененного модуля и его прямых потребителей
  npx vitest run src/utils/
  npx vitest run src/actions/
  
  # 3. Полный регрессионный сьют критических бизнес-инвариантов
  npx vitest run -c vitest.unit.config.ts
  ```
- [ ] **4. Проверка защитных барьеров (Fail-Closed):**
  - [ ] Предусмотрены значения по умолчанию (fallbacks) при `null` или `undefined`.
  - [ ] Отсутствуют unhandled exceptions `throw new Error` в публичных интерфейсах.
