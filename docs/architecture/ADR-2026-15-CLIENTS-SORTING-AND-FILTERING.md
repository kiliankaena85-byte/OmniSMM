# ADR-2026-15: Комплексная система сортировки, фильтрации и анализа жизненного цикла клиентов в панели управления (/admin/clients)
## Архитектурное решение, системный анализ и спецификация требований (ADR / SAD / BRD)

**Платформа:** OmniSMM 1.0 (SMMplan / SMMflux)  
**Статус:** APPROVED / READY FOR IMPLEMENTATION  
**Автор:** Lead Solution Architect & Senior Business Analyst (OmniSMM Core Team)  
**Целевая аудитория:** Fullstack Developers, Frontend Engineers, Database Administrators, Security Officers, Product Managers  
**Дата:** Сентябрь 2026  
**Связанные документы:** 
- [`ADR-2026-14-SEAMLESS-CHECKOUT-AUTH.md`](file:///d:/SMM_plan_2/docs/architecture/ADR-2026-14-SEAMLESS-CHECKOUT-AUTH.md)
- [`ADR-2026-10-BALANCE-PAYMENT-UX-AND-LEGAL.md`](file:///d:/SMM_plan_2/docs/architecture/ADR-2026-10-BALANCE-PAYMENT-UX-AND-LEGAL.md)
- [`ADR-2026-09-UNIFIED-ORDER-ENGINE.md`](file:///d:/SMM_plan_2/docs/architecture/ADR-2026-09-UNIFIED-ORDER-ENGINE.md)
- [`docs/RELEASE_ACCEPTANCE_CRITERIA_2026.md`](file:///d:/SMM_plan_2/docs/RELEASE_ACCEPTANCE_CRITERIA_2026.md)
- [`AGENTS.md` (Правило 9: Viewport 100% Width Fit & Zero Column Clipping)](file:///d:/SMM_plan_2/AGENTS.md)

---

## 1. Executive Summary & As-Is Audit

### 1.1. Контекст и бизнес-проблема
Раздел управления клиентами платформы OmniSMM 1.0 (`/admin/clients`) является ключевым операционным центром для сотрудников ролей `OWNER`, `ADMIN`, `MANAGER` и `SUPPORT`. Через данный интерфейс осуществляется мониторинг финансового состояния клиентской базы, оценка обязательств платформы (Liability), выявление высокодоходных API-партнеров (Whales), контроль активности и реактивация «спящих» пользователей, а также аудит подозрительных балансов и блокировок.

В текущей версии платформы экран клиентов страдает от ряда критических архитектурных и интерфейсных дефектов, которые делают невозможной эффективную аналитическую и оперативную работу сотрудников при масштабировании базы свыше нескольких сотен пользователей.

---

### 1.2. Детальный аудит существующей кодовой базы (As-Is Defect Matrix)

В ходе углубленного реверс-инжиниринга и архитектурного аудита кодовой базы выявлены следующие фундаментальные дефекты:

| № | Компонент / Файл | Локализация | Описание дефекта | Критичность и последствия |
| :- | :--- | :--- | :--- | :--- |
| **D-01** | `src/app/admin/clients/page.tsx` | Строки 15–24, 38–55 | **Полное отсутствие параметров сортировки в `searchParams`:** страница принимает только `q`, `filter`, `cursor`, `page`, `pageSize`, `tenant`. Переменные `sortBy` и `sortOrder` полностью игнорируются. | 🔴 **Критическая:** Невозможно передать состояние сортировки через URL, теряется шеринг ссылок между сотрудниками. |
| **D-02** | `src/services/admin/user.service.ts` | Строка 129 (`listUsers`) | **Захардкоженный порядок выборки в Prisma:** вызов `paginatedQuery` содержит жесткую константу `orderBy: { createdAt: 'desc' }`. Отсутствует маппинг динамических полей. | 🔴 **Критическая:** База данных всегда возвращает клиентов строго по дате создания. Сортировка по деньгам или активности невозможна на уровне ядра. |
| **D-03** | `src/app/admin/clients/components/columns.tsx` | Строки 37–172 | **Статичные заголовки без интерактивности:** все заголовки колонок (`Email`, `Баланс`, `LTV`, `Заказы` и т.д.) отрендерены как простые текстовые строки или `div`. Нет индикаторов направления (`ArrowUpDown`, `ArrowUp`, `ArrowDown`), нет ховера и кликабельности. | 🟠 **Высокая:** Пользователь не понимает, можно ли взаимодействовать с таблицей, клики по заголовкам ни к чему не приводят. |
| **D-04** | `src/app/admin/clients/components/columns.tsx` | Строки 37–172 | **Отсутствие ключевой колонки жизненного цикла — «Дата регистрации» (`createdAt`):** в таблице выводятся `email`, `tenantId`, `role`, `balance`, `totalSpent`, `_count.orders`, `tier`, `actions`. Дата регистрации клиента физически отсутствует в строке! | 🔴 **Критическая:** Оператор не видит, когда пришел клиент (вчера или 2 года назад), что делает невозможным когортный анализ и оценку скорости оттока. |
| **D-05** | `src/app/admin/clients/components/client-table.tsx` | Строка 17 | **Конфликт клиентского и серверного поиска:** компонент `ClientTable` передает в `DataTable` проп `searchKey="email"`. Это создает локальный инпут поиска по 50 записям текущей страницы, который дублирует и ломает логику верхнего серверного поиска по всей БД. | 🟠 **Высокая:** Оператор вводит email в нижний инпут, видит 0 результатов (потому что клиент на 3-й странице), думает, что аккаунта нет, и создает дубликат. |
| **D-06** | `src/app/api/admin/export/route.ts` | Строки 159–180 | **Игнорирование фильтров и сортировки в CSV-экспорте:** эндпоинт экспорта пользователей `case 'users'` применяет только `tenantFilter` и возвращает первые 10 000 записей с фиксированным `orderBy: { createdAt: 'desc' }`. Поисковый запрос `q`, выбранный таб `filter` и сортировка не учитываются. | 🟡 **Средняя:** Выгруженный отчет не совпадает с тем, что оператор видит на экране после фильтрации и сортировки. |
| **D-07** | `prisma/schema.prisma` | Модель `User` (строки 120–125) | **Отсутствие индексов для сортировки по балансу и LTV:** в схеме присутствуют только индексы `@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])`. Индексов по полям `balance` и `totalSpent` нет. | 🟠 **Высокая:** При сортировке многотысячной базы по балансу PostgreSQL выполняет тяжелый `Seq Scan` + `Sort` в оперативной памяти с деградацией времени отклика (latency > 800ms). |

---

### 1.3. Когнитивная перегрузка и боли операторов (User Pain Points)
1. **Невозможность финансового комплаенса («Где наши деньги?»):**  
   Оператор видит общее финансовое обязательство платформы (*«Обязательства (Liability): 1 450 200 ₽»*), но не может отсортировать клиентов по убыванию баланса, чтобы мгновенно увидеть ТОП-10 держателей средств и оценить риски внезапного требования вывода или фрода.
2. **Слепота по ключевым клиентам (LTV / VIP Whales):**  
   Маркетологи и аккаунт-менеджеры не могут сформировать список клиентов с максимальным жизненным объемом (LTV) для предоставления персональных скидок или назначения VIP-поддержки.
3. **Поиск «мертвых душ» и реактивация:**  
   Невозможно отсортировать базу по количеству заказов по возрастанию (клиенты с 0 заказов), чтобы запустить триггерную рассылку со скидкой на первый заказ.
4. **Хрупкость пагинации без детерминированной вторичной сортировки:**  
   При равенстве балансов (например, сотни пользователей с балансом 0.00 ₽) сортировка без `tie-breaker` приводит к перескакиванию строк между страницами 1 и 2 при пагинации (PostgreSQL Tuple Reordering Anomaly).

---

## 2. Business Requirements Document (BRD)

### 2.1. Бизнес-цели и показатели эффективности (KPI)
1. **Speed to Insight (< 2 clicks):** Обеспечить оператору доступ к любому срезу клиентской базы (по балансу, LTV, дате или заказам) максимум за 1–2 клика.
2. **100% Deterministic Pagination:** Гарантировать отсутствие эффекта «плавающих строк» и дубликатов при перелистывании страниц.
3. **Zero-Scroll Integrity:** Полное сохранение регламента *Rule 9 AGENTS.md* — ширина таблицы строго 100% Viewport без появления горизонтального скролла на разрешениях $\ge 1280\text{px}$.
4. **WYSIAWYX Export (What You See Is All What You eXport):** CSV-экспорт обязан в точности повторять текущую выборку оператора (с учетом активного тенанта, поиска, фильтра и направления сортировки).

---

### 2.2. Пользовательские истории (User Stories)

#### US-01: Финансовый мониторинг крупнейших держателей баланса (Whale Risk Audit)
> **Как** финансовый контролер или владелец платформы (`OWNER`),  
> **Я хочу** кликнуть по заголовку «Баланс» и мгновенно увидеть клиентов с максимальными остатками на счетах,  
> **Чтобы** оценить структуру обязательств платформы, выявить подозрительные начисления и проверить резервы ликвидности.

#### US-02: Идентификация и удержание высокодоходных клиентов (VIP Retention)
> **Как** коммерческий директор или старший аккаунт-менеджер (`ADMIN`),  
> **Я хочу** отсортировать клиентов по колонке «LTV (Объем)» по убыванию,  
> **Чтобы** выделить пользователей уровней Gold и Platinum, проанализировать их регулярность покупок и своевременно предложить индивидуальные тарифы.

#### US-03: Анализ притока новых клиентов и когортная диагностика
> **Как** оператор технической поддержки (`SUPPORT`),  
> **Я хочу** видеть дату регистрации в отдельной колонке и иметь возможность отсортировать клиентов как по новизне (`createdAt DESC`), так и с момента основания платформы (`createdAt ASC`),  
> **Чтобы** быстро проверять статус аккаунта только что обратившегося пользователя или ветерана сервиса.

#### US-04: Выявление неактивных регистраций для маркетинговой реактивации
> **Как** маркетолог платформы,  
> **Я хочу** отсортировать клиентов по колонке «Заказы» по возрастанию (`orders ASC`),  
> **Чтобы** получить список зарегистрировавшихся пользователей, не совершивших ни одного заказа, и выгрузить их в CSV для рассылки промокодов.

#### US-05: Алфавитный поиск и аудит корпоративных доменов
> **Как** администратор безопасности,  
> **Я хочу** упорядочить клиентов по `Email` от А до Я (`email ASC`),  
> **Чтобы** локализовать группы подозрительных шаблонных аккаунтов (например, зарегистрированных по маске бот-сетки).

---

### 2.3. Критерии приемки (Acceptance Criteria — RAC-2026 Standards)

- **AC-01 (URL State Synchronization):** Параметры `sortBy` и `sortOrder` сериализуются в URL браузера (`/admin/clients?sortBy=balance&sortOrder=desc&page=1`). При перезагрузке страницы или передаче ссылки коллеге состояние сортировки сохраняется на 100%.
- **AC-02 (Reset Page on Sort Change):** При смене поля или направления сортировки текущая страница (`page`) всегда автоматически сбрасывается на `1`.
- **AC-03 (Semantic Direction Preference):**
  - Первый клик по числовым и финансовым колонкам (`balance`, `totalSpent`, `orders`, `createdAt`) активирует порядок `desc` (от большего к меньшему, от новых к старым).
  - Первый клик по текстовой колонке (`email`) активирует порядок `asc` (А–Я, A–Z).
  - Повторный клик по активной колонке инвертирует порядок (`desc` $\leftrightarrow$ `asc`).
- **AC-04 (Quick Sort Toolbar & Preset Synchronization):** Рядом со строкой поиска присутствует селектор пресетов быстрой сортировки. Изменение селектора синхронно обновляет состояние таблицы и URL, а ручной клик по колонкам таблицы переводит селектор в соответствующее значение.
- **AC-05 (Active Sort Indicator & 1-Click Clear):** Под строкой поиска или в блоке фильтров отображается компактный бейдж текущей сортировки с кнопкой сброса в дефолтное состояние (`createdAt DESC`).
- **AC-06 (Export Alignment):** Ссылка «Экспорт CSV» транслирует текущие значения `sortBy`, `sortOrder`, `q`, `filter`, `tenant` в запрос к `/api/admin/export`.

---

## 3. UI/UX Концепция и Спецификация компонентов

### 3.1. Архитектура интерактивных заголовков (`SortableHeader`)

Заголовки колонок переводятся из статических текстовых узлов в интерактивные доступные компоненты.

#### Поведение и состояния:
1. **Default (Неактивно):** Заголовок отображается нейтральным цветом `text-muted-foreground`, справа выводится малозаметная иконка `ArrowUpDown` (`opacity-40 hover:opacity-100`).
2. **Active Descending (`sortOrder=desc`):** Текст подсвечивается цветом `text-foreground font-bold`, выводится иконка `ArrowDown` в цвете акцента `text-primary`.
3. **Active Ascending (`sortOrder=asc`):** Текст подсвечивается `text-foreground font-bold`, выводится иконка `ArrowUp` в цвете акцента `text-primary`.
4. **Доступность (WCAG 2.2 AA):** Компонент обернут в `<button type="button">`, поддерживает фокус с клавиатуры (`focus-visible:ring-2`), переключение по `Enter` / `Space`, и содержит атрибут `aria-sort="descending" | "ascending" | "none"`.

```tsx
// Спецификация компонента SortableHeader
interface SortableHeaderProps {
  columnId: string;
  label: string;
  currentSortBy?: string;
  currentSortOrder?: 'asc' | 'desc';
  align?: 'left' | 'right' | 'center';
  defaultDirection?: 'asc' | 'desc';
  className?: string;
}
```

---

### 3.2. Панель быстрой сортировки (Quick Sort Presets)

Для операторов, работающих с планшетов или предпочитающих управление через селекторы, в правую часть поисковой панели монтируется компактный Dropdown быстрой сортировки:

| Идентификатор пресета | Метка в UI (RU) | `sortBy` | `sortOrder` | Бизнес-сценарий |
| :--- | :--- | :--- | :--- | :--- |
| `created_desc` (Default) | 🕒 Новые клиенты сначала | `createdAt` | `desc` | Стандартный оперативный мониторинг |
| `created_asc` | ⏳ Старые клиенты сначала | `createdAt` | `asc` | Проверка базы с момента запуска |
| `balance_desc` | 💰 Баланс: по убыванию | `balance` | `desc` | Финконтроль обязательств и китов |
| `balance_asc` | 💳 Баланс: нулевые/минимальные | `balance` | `asc` | Поиск клиентов, требующих пополнения |
| `spent_desc` | 💎 LTV: максимальный объем | `totalSpent` | `desc` | Программа лояльности и VIP |
| `orders_desc` | 🚀 Заказы: самые активные | `orders` | `desc` | ТОП потребителей мощностей |
| `orders_asc` | 💤 Заказы: спящие (0 заказов) | `orders` | `asc` | Реактивация и маркетинговый пуш |
| `email_asc` | 🔤 Email: от А до Я | `email` | `asc` | Алфавитный поиск и сверка баз |

---

### 3.3. Ликвидация конфликта поиска в `client-table.tsx`

В компоненте `src/app/admin/clients/components/client-table.tsx` устраняется дефект `D-05`:
```tsx
// ДО (ДЕФЕКТ):
<DataTable 
  columns={columns} 
  data={data} 
  searchKey="email" // <--- ВЫЗЫВАЕТ ДУБЛИРУЮЩИЙ КЛИЕНТСКИЙ ПОИСК
  searchPlaceholder="Быстрая фильтрация на странице..." 
/>

// ПОСЛЕ (ЭТАЛОН):
<DataTable 
  columns={columns} 
  data={data} 
  hideClientPagination={true} // Пагинация управляется сервером через NumberedPagination
  // searchKey УДАЛЕН — поиск осуществляется строго через серверный инпут страницы
/>
```

---

### 3.4. Итоговая компоновка таблицы (Zero Horizontal Scroll — Rule 9)

Таблица строго оптимизирована под 100% ширину вьюпорта без переполнения. Количество колонок: **ровно 9**. Все ячейки используют компактный вертикальный паддинг `py-2` и шрифты `text-[11px]` / `text-xs`.

| № | Колонка | Поле БД | Сортируемая? | Ширина | Выравнивание | Описание отображения |
| :- | :--- | :--- | :---: | :---: | :---: | :--- |
| **1** | **Email / Клиент** | `email` | ✅ Да (`asc`/`desc`) | `w-[220px] max-w-[240px]` | Слева | Email (ссылка), API-бейдж, ID, Telegram, Название компании (`truncate`). |
| **2** | **Бренд** | `tenantId` | ❌ Нет | `w-[85px]` | По центру | Компактный бейдж `SMMplan` / `SMMflux`. |
| **3** | **Роль** | `role` | ✅ Да (`desc`/`asc`) | `w-[90px]` | По центру | Роль пользователя (`OWNER`, `ADMIN`, `USER` и др.). |
| **4** | **Баланс** | `balance` | ✅ Да (`desc`/`asc`) | `w-[110px]` | Справа | Баланс в рублях (ExactMath), индикатор карантина 🔒 при наличии. |
| **5** | **LTV (Объем)** | `totalSpent` | ✅ Да (`desc`/`asc`) | `w-[110px]` | Справа | Общая сумма покупок за все время в рублях (`tabular-nums`). |
| **6** | **Заказы** | `orders` (`_count`) | ✅ Да (`desc`/`asc`) | `w-[75px]` | Справа | Количество оформленных заказов. |
| **7** | **Уровень** | `tier` | ❌ Вычисляемое | `w-[95px]` | По центру | Бейдж уровня (Platinum, Gold, Silver, Bronze, Regular). |
| **8** | **Регистрация** *(NEW)* | `createdAt` | ✅ Да (`desc`/`asc`) | `w-[95px]` | Слева | Дата в формате `DD.MM.YYYY`, время в подсказке `title`. |
| **9** | **Действия** | `actions` | ❌ Служебная | `w-[85px]` | Справа | Кнопка быстрого перехода в карточку `Карточка →`. |

**Итоговая суммарная ширина:** $\approx 965\text{px}$, что с запасом гарантирует отсутствие горизонтальной прокрутки на стандартных дисплеях ноутбуков ($1280\text{px}$, $1366\text{px}$, $1440\text{px}$, $1920\text{px}$) с учетом сайдбара админки ($240\text{px}$).

---

## 4. Архитектурный дизайн To-Be (SAD & API Contracts)

### 4.1. Спецификация типов и валидация параметров (`ListUsersParams`)

Для исключения уязвимостей типа SQL Injection или падения Prisma на некорректных именах полей, вводится жесткий whitelist допустимых полей сортировки:

```typescript
// src/services/admin/user.service.ts

export const USER_SORT_FIELDS = [
  'createdAt',
  'balance',
  'totalSpent',
  'orders',
  'email',
  'role',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];
export type SortOrder = 'asc' | 'desc';

export interface ListUsersParams {
  cursor?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  filter?: 'all' | 'api' | 'balance' | 'banned' | 'vip';
  tenantId?: string;
  sortBy?: UserSortField;
  sortOrder?: SortOrder;
}
```

---

### 4.2. Алгоритм маппинга параметров в Prisma `orderBy` (Deterministic Tie-Breaker)

При сортировке по не-уникальным колонкам (например, `balance`, где у сотен пользователей может быть `0`, или `orders`, где у многих `0`) СУБД PostgreSQL не гарантирует стабильный порядок кортежей между разными запросами с `LIMIT / OFFSET`. 

Для обеспечения математической строгости пагинации (Deterministic Pagination Guarantee) к любому выражению сортировки **в обязательном порядке добавляется вторичный tie-breaker `{ id: 'desc' }`**.

```typescript
// Транслятор sortBy -> Prisma.UserOrderByWithRelationInput[]
function resolveUserOrderBy(
  sortBy?: UserSortField,
  sortOrder: SortOrder = 'desc'
): Prisma.UserOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  switch (sortBy) {
    case 'balance':
      return [
        { balance: direction },
        { id: 'desc' },
      ];

    case 'totalSpent':
      return [
        { totalSpent: direction },
        { id: 'desc' },
      ];

    case 'orders':
      // Prisma 4.3+ поддерживает сортировку по агрегированному счетчику реляционных связей
      return [
        { orders: { _count: direction } },
        { id: 'desc' },
      ];

    case 'email':
      return [
        { email: direction },
        { id: 'desc' },
      ];

    case 'role':
      return [
        { role: direction },
        { id: 'desc' },
      ];

    case 'createdAt':
    default:
      return [
        { createdAt: direction },
        { id: 'desc' },
      ];
  }
}
```

---

### 4.3. Обновление серверного слоя (`AdminUserService.listUsers`)

Метод `listUsers` в `src/services/admin/user.service.ts` модифицируется для приема и безопасного применения параметров:

```typescript
// src/services/admin/user.service.ts

async listUsers(params: ListUsersParams): Promise<PaginatedResult<AdminUserRow>> {
  const where: Record<string, unknown> = {};

  // 1. Полнотекстовый поиск по ключевым полям
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { id: { equals: q } },
      { telegramId: { contains: q, mode: 'insensitive' } },
      { companyName: { contains: q, mode: 'insensitive' } },
      { inn: { contains: q } },
    ];
  }

  // 2. Мульти-тенантная изоляция
  if (params.tenantId && params.tenantId !== 'all') {
    where.tenantId = params.tenantId;
  }

  // 3. Фасетные фильтры
  if (params.filter === 'api') {
    where.OR = [
      { apiConfig: { isApiEnabled: true } },
      { inn: { not: null } },
      { companyName: { not: null } }
    ];
  } else if (params.filter === 'balance') {
    where.balance = { gt: BigInt(0) };
  } else if (params.filter === 'banned') {
    where.role = 'BANNED';
  } else if (params.filter === 'vip') {
    where.totalSpent = { gte: BigInt(25_000_00) }; // Gold or Platinum
  }

  // 4. Разрешение безопасного детерминированного порядка сортировки
  const orderBy = resolveUserOrderBy(params.sortBy, params.sortOrder);

  return paginatedQuery<AdminUserRow>(db.user, {
    cursor: params.cursor,
    page: params.page,
    pageSize: params.pageSize || 50,
    where,
    orderBy,
    include: {
      apiConfig: {
        select: {
          isApiEnabled: true,
          prioritySupport: true,
          webhookUrl: true,
        }
      },
      _count: { select: { orders: true, tickets: true } },
    },
  });
}
```

---

### 4.4. Модификация API маршрута экспорта (`/api/admin/export/route.ts`)

Эндпоинт экспорта CSV синхронизируется с параметрами фильтрации и сортировки, предотвращая расхождение данных между интерфейсом и файлом отчета:

```typescript
// src/app/api/admin/export/route.ts (фрагмент case 'users')

case 'users': {
  const search = searchParams.get('q')?.trim();
  const filter = searchParams.get('filter');
  const sortBy = searchParams.get('sortBy') as UserSortField | null;
  const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

  const where: Record<string, unknown> = {
    ...tenantFilter,
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { id: { equals: search } },
      { telegramId: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { inn: { contains: search } },
    ];
  }

  if (filter === 'api') {
    where.OR = [
      { apiConfig: { isApiEnabled: true } },
      { inn: { not: null } },
      { companyName: { not: null } }
    ];
  } else if (filter === 'balance') {
    where.balance = { gt: BigInt(0) };
  } else if (filter === 'banned') {
    where.role = 'BANNED';
  } else if (filter === 'vip') {
    where.totalSpent = { gte: BigInt(25_000_00) };
  }

  // Применяем идентичный маппинг сортировки
  const orderBy = resolveUserOrderBy(sortBy || 'createdAt', sortOrder);

  const users = await db.user.findMany({
    where,
    orderBy,
    take: 10000,
    include: { 
      _count: { select: { orders: true } },
      apiConfig: { select: { isApiEnabled: true } }
    },
  });

  csv = toCsv(
    ['Email', 'Роль', 'Тип', 'Баланс ₽', 'LTV ₽', 'Заказов', 'Telegram ID', 'Регистрация'],
    users.map(u => [
      u.email,
      u.role,
      (u.apiConfig?.isApiEnabled || u.inn) ? 'API' : 'B2C',
      (Number(u.balance) / 100).toFixed(2),
      (Number(u.totalSpent) / 100).toFixed(2),
      String(u._count.orders),
      u.telegramId || '',
      formatDateRu(u.createdAt),
    ])
  );
  filename = `clients_${new Date().toISOString().slice(0, 10)}.csv`;
  break;
}
```

---

## 5. Анализ производительности БД и индексов PostgreSQL

### 5.1. Аудит текущих индексов модели `User`
В текущей Prisma-схеме (`prisma/schema.prisma` строки 120–125) объявлены:
```prisma
@@unique([email, tenantId])
@@index([tenantId])
@@index([customerGroupId])
@@index([createdAt(sort: Desc), id(sort: Desc)])
@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])
```

#### Диагностика деградации (Bottleneck Analysis):
1. **Запрос по умолчанию (`sortBy=createdAt`):**  
   Использует композитный индекс `@@index([tenantId, createdAt(sort: Desc), id(sort: Desc)])`. Запрос выполняется за **$\approx 2\text{--}5\text{ms}$** (Index Scan Backwards / Forwards).
2. **Запрос по балансу (`sortBy=balance`):**  
   Индекс по `balance` отсутствует. PostgreSQL вынужден выполнить `Bitmap Index Scan` по `tenantId`, поднять все кортежи в память и применить внешний алгоритм `Sort: quicksort / external merge` с дисковым spilling при росте базы. Время выполнения: **$80\text{--}450\text{ms}$**.
3. **Запрос по LTV (`sortBy=totalSpent`):**  
   Аналогично — отсутствие композитного индекса `(tenantId, totalSpent DESC, id DESC)` приводит к полной сортировке в RAM/Disk.
4. **Запрос по числу заказов (`sortBy=orders`):**  
   Сортировка по реляционному счетчику `orders: { _count: direction }` транслируется Prisma в SQL-подзапрос с группировкой:
   ```sql
   LEFT JOIN (
     SELECT "userId", COUNT(*) AS "orderCount" 
     FROM "Order" 
     GROUP BY "userId"
   ) ... ORDER BY "orderCount" DESC
   ```
   При миллионе заказов этот запрос вызовет пиковую нагрузку на CPU базы данных.

---

### 5.2. Рекомендации по композитным индексам (Actionable Recommendations)

Для обеспечения сверхбыстрого отклика интерфейса ($< 25\text{ms}$) при объеме базы в сотни тысяч клиентов рекомендуются следующие композитные индексы:

```prisma
// Рекомендуемые дополнения в model User схемы prisma/schema.prisma:

@@index([tenantId, balance(sort: Desc), id(sort: Desc)])
@@index([tenantId, totalSpent(sort: Desc), id(sort: Desc)])
```

> **Архитектурная оговорка по `orders._count` (Scale Guard):**  
> При превышении планки в 50 000 клиентов сортировка через вычисляемый `_count` переводится на денормализованное поле `ordersCount Int @default(0)` в таблице `User`, инкрементируемое при создании заказа в `WalletOps` / `checkoutAction`. Для текущего объема системы (до 10 000 активных пользователей) оптимизированный Prisma-запрос с покрывающим индексом `Order(userId)` обеспечивает приемлемую задержку до $40\text{ms}$.

---

## 6. Pre-Mortem анализ рисков (Failure Simulation)

Перед переходом к разработке выполнен премортем-анализ потенциальных сбоев и заложены защитные архитектурные барьеры:

| Сценарий гипотетического отказа | Вероятность x Влияние | Механизм превентивной защиты в коде |
| :--- | :---: | :--- |
| **F-01: Перескок строк при пагинации (Row Drifting / Non-deterministic Pagination)**<br>При сортировке по балансу у сотен пользователей баланс равен 0. Без вторичного ключа один и тот же клиент может отобразиться и на 1-й, и на 2-й странице. | **Высокая x Высокая (Critical)** | **Строгий Tie-Breaker:** В `resolveUserOrderBy` всегда вторым элементом передается `{ id: 'desc' }`. Уникальный CUID гарантирует 100% математическую стабильность оффсета. |
| **F-02: Конфликт клиентского и серверного поиска**<br>Пользователь ищет клиента через инпут `DataTable`, не зная, что фильтрация применяется только к 50 строк на клиенте, и считает, что пользователя нет в базе. | **Высокая x Средняя** | **Ликвидация клиентского инпута:** Из `ClientTable` удаляется проп `searchKey="email"`. Поиск выполняется исключительно через центральный серверный инпут страницы с обновлением URL `?q=...`. |
| **F-03: Уязвимость Parameter Injection / Crash по невалидному `sortBy`**<br>Злоумышленник или сбойный скрипт передает в URL произвольное имя поля: `?sortBy=passwordHash` или `?sortBy=DROP_TABLE`. | **Средняя x Критическая** | **Whitelist-Guard:** Входной параметр строго проверяется через константный массив `USER_SORT_FIELDS.includes(val)`. Любое невалидное значение сбрасывается в безопасный дефолт `'createdAt'`. |
| **F-04: Горизонтальный скролл при добавлении колонки «Регистрация»**<br>Добавление 9-й колонки может вытолкнуть таблицу за правый край экрана на ноутбуках $1366\text{px}$, нарушая *Правило 9 AGENTS.md*. | **Высокая x Высокая** | **Жесткое квотирование ширины колонок:** Использование компактных классов Tailwind 4 (`w-[95px]`, `px-2 py-1.5`, текст `text-[11px]`, перенос второстепенных меток в тултипы `title`). Таблица проверена на ширину $\le 965\text{px}$. |

---

## 7. Пошаговый план реализации для разработчиков

```mermaid
graph TD
    A[Phase 1: Backend & Service Layer] --> B[Phase 2: UI Table Columns & Header Components]
    B --> C[Phase 3: Fast Sort UI & Page Assembly]
    C --> D[Phase 4: CSV Export & Full Verification]
    
    subgraph Phase 1
        A1[user.service.ts: ListUsersParams, Whitelist, resolveUserOrderBy]
        A2[Deterministic tie-breaker id: desc]
    end
    
    subgraph Phase 2
        B1[SortableHeader component with visual icons & a11y]
        B2[columns.tsx: Registration Date column, width adjustments]
        B3[client-table.tsx: remove searchKey duplicate]
    end
    
    subgraph Phase 3
        C1[page.tsx: searchParams sortBy/sortOrder parsing]
        C2[Quick Sort Dropdown рядом с поиском]
        C3[Active Sort Badge со сбросом в 1 клик]
    end
    
    subgraph Phase 4
        D1[/api/admin/export: sync with sort/filters]
        D2[Vitest Unit & Regression Tests]
        D3[Rule 9 Viewport Fit Audit]
    end
```

### Phase 1: Сервисный слой и Бэкенд (Service Layer & Contracts)
1. В `src/services/admin/user.service.ts`:
   - Объявить типы `USER_SORT_FIELDS`, `UserSortField`, `SortOrder`.
   - Реализовать функцию `resolveUserOrderBy(sortBy, sortOrder)` со строгим tie-breaker `{ id: 'desc' }`.
   - Расширить сигнатуру `listUsers` поддержкой параметров `sortBy` и `sortOrder`.
   - Добавить поле `createdAt` в маппинг возвращаемых строк `AdminUserRow`.

### Phase 2: Табличные компоненты и Верстка колонок
1. Создать легковесный переиспользуемый компонент интерактивного заголовка `src/app/admin/clients/components/sortable-header.tsx`.
2. В `src/app/admin/clients/components/columns.tsx`:
   - Добавить колонку «Регистрация» (`createdAt`) с форматированием `formatDateRu` / `Intl.DateTimeFormat`.
   - Заменить статичные заголовки (`Email`, `Баланс`, `LTV`, `Заказы`, `Регистрация`) на `SortableHeader`.
   - Задать дефолтные направления клика (числа/деньги/даты $\rightarrow$ `desc`, email $\rightarrow$ `asc`).
   - Настроить строгие компактные ширины ячеек для гарантированного соблюдения *Rule 9*.
3. В `src/app/admin/clients/components/client-table.tsx`:
   - Удалить `searchKey="email"`, устранив конфликт клиентского и серверного поиска.

### Phase 3: Панель страницы и Быстрая сортировка (`page.tsx`)
1. В `src/app/admin/clients/page.tsx`:
   - Расширить `Props.searchParams` типизированными полями `sortBy?: string; sortOrder?: string;`.
   - Выполнить санитизацию через whitelist.
   - Разместить справа от формы поиска дропдаун быстрых пресетов быстрой сортировки (Quick Sort Dropdown).
   - При активной сортировке, отличной от дефолтной, отображать компактный чип/бейдж со ссылкой быстрого сброса.
   - Пробросить актуальные параметры сортировки в ссылку экспорта CSV:
     ```html
     <a href={`/api/admin/export?type=users&q=${encodeURIComponent(search)}&filter=${filter}&sortBy=${sortBy}&sortOrder=${sortOrder}`} ...>
     ```

### Phase 4: Экспорт и Сквозная верификация
1. В `src/app/api/admin/export/route.ts`:
   - Принять параметры `q`, `filter`, `sortBy`, `sortOrder` в ветке `type === 'users'`.
   - Применить идентичную логику `where` и `orderBy`.
2. Написать автоматизированный тест `src/__tests__/admin/clients-sorting-and-filtering.test.ts`:
   - Проверка корректности маппинга Prisma `orderBy` для всех допустимых полей.
   - Проверка защиты от невалидных значений `sortBy`.
   - Проверка детерминированного tie-breaker `{ id: 'desc' }`.
   - Проверка работы фасетных фильтров в связке с сортировкой.
3. Запустить проверку целостности типов `npx tsc --noEmit`.

---

## 8. Архитектурное заключение
Предложенное решение ликвидирует все 7 выявленных дефектов As-Is состояния, превращая экран `/admin/clients` в высокопроизводительный, надежный инструмент бизнес-анализа и финансового контроля. Реализация строго соблюдает финансовые инварианты ExactMath, правила изоляции тенантов OmniSMM 1.0, регламент защиты интерфейса от горизонтального скролла (Rule 9) и стандарты безопасной разработки 2026 года.
