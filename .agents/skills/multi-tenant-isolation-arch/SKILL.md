---
name: multi-tenant-isolation-arch
description: >
  Мульти-тенантная архитектура OmniSMM 1.0 (бренды SMMplan smmplan.pro и SMMflux smmflux.ru, масштабирование
  на N тенантов), жесткая изоляция данных и юридический барьер по ст. 54.1 НК РФ. Используй этот скилл
  ВСЕГДА, когда проектируются или модифицируются схемы Prisma (модели с обязательным полем tenantId,
  составные ключи @@unique([tenantId, ...])), Server Actions с контекстом бренда, резолвинг доменов в
  src/proxy.ts (Host header, кука x_admin_tenant, переключатель <GlobalSiteSwitcher />), кэширование
  (unstable_cache с тегами catalog-${tenantId}, префиксы Redis ${tenantId}:*), разделение платежных шлюзов
  (ЮKassa, Robokassa, CryptoBot per-tenant), фискализации и онлайн-касс (54-ФЗ, базовая ставка НДС 22%
  по 425-ФЗ, лимит УСН 20 млн ₽ по 176-ФЗ / ст. 145 НК РФ), а также токены дизайн-системы UI (<Plan*>
  для SMMplan Classic API vs <Flux*> для SMMflux Radiant Aurora) для полного исключения смешения брендов
  (Brand Bleeding). Включает строгие защитные контуры против рисков «дробления бизнеса» по ст. 54.1 НК РФ.
---

# Multi-Tenant Isolation & Legal Barrier — Инженерный стандарт OmniSMM 1.0

## Назначение и зона ответственности скилла

Материнский движок **OmniSMM 1.0** спроектирован как высокопроизводительное мульти-арендное (multi-tenant) ядро, обслуживающее независимые цифровые витрины и бренды:
- **SMMplan (`smmplan.pro`):** Строгий Classic Panel API для реселлеров, агентств и оптовых заказчиков (дизайн-токены `<Plan*>`, табличный интерфейс высокой плотности, фокус на API-интеграции).
- **SMMflux (`smmflux.ru`):** Динамичная витрина в стиле Radiant Aurora для розничных создателей контента и блогеров (дизайн-токены `<Flux*>`, интерактивные анимации, калькуляторы и визуальные виджеты).
- **Архитектура N-Tenants:** Возможность бесшовного развертывания новых витрин без изменения базового кода ядра.

**Критическая важность скилла:**
1. **Безопасность и Zero-Trust изоляция данных:** Предотвращение межтенантных утечек (Cross-Tenant Data Leak / BOLA / IDOR). Клиент витрины SMMplan ни при каких условиях не должен видеть заказы, балансы или тикеты витрины SMMflux.
2. **Изоляция кэша и состояния:** Исключение эффекта Brand Bleeding («протекания бренда»), когда из-за общих ключей в `unstable_cache` или Redis пользователи одной витрины видят стили, тексты оферты или цены другого бренда.
3. **Юридический и налоговый барьер (ст. 54.1 НК РФ):** Строгое разделение операторов, юрлиц (ИП/ООО), банковских счетов, шлюзов интернет-эквайринга (разные Shop ID в ЮKassa) и онлайн-касс по 54-ФЗ. Несоблюдение ведет к обвинению ФНС РФ в искусственном «дроблении бизнеса» с доначислением НДС 22% и штрафов до 40%.

---

## 1. Дерево решений (Decision Tree / Flowchart)

### 1.1. Архитектурная схема жизненного цикла запроса и разрешения тенанта

```
                [ Входящий HTTP-запрос (Next.js Proxy / Node.js) ]
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │  ШАГ 1: Определение типа маршрута        │
                       │  (src/proxy.ts — Node.js Runtime)        │
                       └──────────────────────────────────────────┘
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     │                                             │
             [ Публичный маршрут ]                         [ Маршрут /admin/* ]
             (/, /catalog, /api/...)                               │
                     │                                             ▼
                     ▼                                 ┌────────────────────────┐
        ┌─────────────────────────┐                    │ Сессия Staff валидна?  │
        │ Источник: Host Header   │                    └────────────────────────┘
        │ smmplan.pro -> smmplan  │                                │
        │ smmflux.ru  -> flux     │                    ┌───────────┴───────────┐
        │ Запрет чтения админ-кук │                    │                       │
        └─────────────────────────┘                  [НЕТ]                    [ДА]
                     │                                 │                       │
                     │                                 ▼                       ▼
                     │                        [Редирект на /login]  ┌────────────────────────┐
                     │                                              │ Чтение куки            │
                     │                                              │ x_admin_tenant         │
                     │                                              └────────────────────────┘
                     │                                                         │
                     │                                                         ▼
                     │                                              ┌────────────────────────┐
                     │                                              │ Проверка прав:         │
                     │                                              │ OWNER или allowedTenant│
                     │                                              └────────────────────────┘
                     │                                                         │
                     └──────────────────────┬──────────────────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │  ШАГ 2: Внедрение Request Context        │
                       │  Headers: x-tenant-id = normalizedTenant │
                       └──────────────────────────────────────────┘
                                            │
         ┌──────────────────────────────────┼──────────────────────────────────┐
         │                                  │                                  │
         ▼                                  ▼                                  ▼
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│  ШАГ 3: Уровень Данных  │    │  ШАГ 4: Уровень Кэша    │    │ ШАГ 5: Финансы и Чеки   │
│  (Prisma / PostgreSQL)  │    │  (Next.js Cache, Redis) │    │ (ЮKassa, 54-ФЗ, 176-ФЗ) │
├─────────────────────────┤    ├─────────────────────────┤    ├─────────────────────────┤
│ Обязательное условие:   │    │ unstable_cache ключ:    │    │ TenantPaymentContext    │
│ where: { tenantId }     │    │ ['catalog', tenantId]   │    │ Отдельный ShopId/Secret │
│ Составные ключи:        │    │ Кэш-тег:                │    │ Проверка порога 20 млн ₽│
│ @@unique([slug, tenant])│    │ catalog-${tenantId}     │    │ ст. 145 / 425-ФЗ:       │
│ Предотвращение IDOR     │    │ Redis: ${tenantId}:*    │    │ vat_code 1 vs 10 (22%)  │
└─────────────────────────┘    └─────────────────────────┘    └─────────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │  ШАГ 6: Уровень Отображения (UI Tokens)  │
                       ├──────────────────────────────────────────┤
                       │ SMMplan: Classic API (<Plan*>, Gray-900) │
                       │ SMMflux: Radiant Aurora (<Flux*>, Glow)  │
                       │ Запрет Brand Bleeding в одном интерфейсе │
                       └──────────────────────────────────────────┘
```

### 1.2. Пошаговая логика изоляции

1. **Разрешение тенанта на уровне Next.js Proxy (`src/proxy.ts` — Node.js Runtime):**
   - **Среда исполнения Next.js 16 (Node.js Runtime):** В Next.js 16 App Router платформы OmniSMM файл `src/proxy.ts` выполняется в полноценной среде **Node.js (`Node.js Runtime`)**, а не в ограниченном Edge Runtime. Это устраняет типичные ограничения Edge (урезанные API, отсутствие нативного crypto и Buffer, лимиты памяти) и обеспечивает полноценный доступ ко всем Node.js API (`Buffer`, `node:crypto`, `AsyncLocalStorage`) для быстрой и надежной обработки запросов.
   - **Публичные страницы (`/`, `/services`, `/catalog`, `/login`):** Тенант определяется **СТРОГО по заголовку `host`** через `normalizeTenantId(req.headers.get('host'))`. Значение куки `x_admin_tenant` здесь **ИГНОРИРУЕТСЯ**, чтобы администратор, переключивший бренд в админке, случайно не открыл публичную страницу с искаженным контекстом или не отравил SSR-кэш.
   - **Административная панель (`/admin/*`):** Проверяется авторизация сотрудника. Тенант считывается из куки `x_admin_tenant`. Для роли `OWNER` разрешено переключение на любой тенант. Для остальных ролей (`SUPPORT`, `OPERATOR`, `MANAGER`) проверяется массив `user.allowedTenants`. Если запрошенный тенант не входит в разрешенные — доступ блокируется с ошибкой 403.
   - Заголовок `x-tenant-id` проставляется в `request.headers` и передается во все Server Components и Server Actions.

2. **Строгая изоляция в Prisma ORM:**
   - Каждая сущность, принадлежащая арендатору (`User`, `Order`, `Category`, `Service`, `Ticket`, `Payment`, `LedgerEntry`), ОБЯЗАНА содержать поле `tenantId: String`.
   - Любой запрос на чтение или модификацию ОБЯЗАН включать условие `where: { tenantId }`.
   - Все уникальные сущности витрины (например, категория соцсети, slug услуги) используют составные индексы `@@unique([slug, tenantId])`.

3. **Изоляция уровней кэширования:**
   - **`unstable_cache`:** Ключ кэша ОБЯЗАН включать `tenantId` в виде первого или второго аргумента: `['services-list', tenantId]`. Тег ревалидации ОБЯЗАН быть изолированным: `tags: [\`catalog-${tenantId}\`]\`.
   - **Redis Storage:** Любые разделяемые ключи обязаны начинаться с неймспейса бренда: `${tenantId}:rate-limit:${userId}`, `${tenantId}:cart:${sessionId}`.

4. **Финансово-налоговый барьер (ст. 54.1 НК РФ, 54-ФЗ, 425-ФЗ):**
   - Каждый тенант связывается с независимым объектом `TenantPaymentContext`:
     - Собственные юридические реквизиты (Наименование, ИНН, ОГРНИП, юридический адрес).
     - Отдельный договор эквайринга (уникальный `yookassaShopId` и `yookassaSecretKey`).
     - Собственная облачная онлайн-касса (отдельный серийный номер ФН и регистрационный номер ККТ).
   - **Расчет порога УСН (20 млн ₽):** Функция `checkVatThreshold(tenantId)` рассчитывает чистую выручку (Gross minus Refunds) в BigInt копейках индивидуально для юрлица каждого бренда. До 20 млн ₽ — `vat_code: 1` (Без НДС), свыше 20 млн ₽ — `vat_code: 10` (НДС 22% согласно 425-ФЗ). Перекрестный зачет выручки между тенантами категорически запрещен.
   - **Финансовый Fallback:** В финансовых операциях `tenantId` ОБЯЗАН разрешаться строго через цепочку: `tenantId || user?.tenantId || 'smmplan'`.

5. **Изоляция дизайн-системы и фронтенда:**
   - Витрина `smmplan` использует компоненты `@/components/ui/plan` (`<PlanButton>`, `<PlanCard>`, `<PlanTable>`, строгий монохром, четкие границы).
   - Витрина `smmflux` использует компоненты `@/components/ui` (`<FluxButton>`, `<FluxCard>`, `<BorderBeam>`, `<NumberTicker>`, Aurora градиенты).
   - Смешивание стилей или импорт `<FluxButton>` на страницы SMMplan расценивается как нарушение контракта дизайн-системы.

6. **Изоляция фоновых процессов (Background Jobs & BullMQ):**
   - Фоновые задачи выполняются вне HTTP-контекста, поэтому Next.js `headers()` недоступны.
   - Полезная нагрузка (Payload) задачи BullMQ **ОБЯЗАНА** включать `tenantId` при планировании.
   - Воркер обязан обернуть логику в `runWithTenant(job.data.tenantId, async () => { ... })` для активации автоматической защиты `PrismaTenantEnforcer`.

7. **Изоляция внешних Webhooks и Email-рассылок:**
   - Внешние шлюзы (Yookassa, CryptoBot, Telegram) не передают заголовок `Host` целевой витрины при HTTP Callback.
   - Тенант в вебхуке **ОБЯЗАН** разрешаться из URL (`/api/webhooks/yookassa/flux`) или из криптографически подписанных метаданных (`metadata.tenantId`).
   - Шаблоны Email (Magic Links, Отчеты) **ОБЯЗАНЫ** использовать `TenantContext` для выбора логотипа витрины, `Support Email` и обратных ссылок, чтобы не допустить путаницы пользователей.

---

## 2. Жесткие инварианты и табу (Hard Invariants & Anti-Patterns)

### 2.1. Табу 1: Запросы в Prisma без фильтрации по `tenantId` (Межтенантный IDOR)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** выполнять выборку или мутацию сущностей без явного указания `tenantId` в блоке `where`.

```typescript
// ❌ АНТИПАТТЕРН: Поиск заказа только по ID позволяет злоумышленнику с smmflux.ru
// просматривать или отменять заказы API-клиентов с smmplan.pro (BOLA / IDOR)
export async function badGetOrder(orderId: string) {
  return await db.order.findUnique({
    where: { id: orderId } // ❌ Уязвимость! Нет проверки принадлежности тенанту!
  });
}
```

```typescript
// ✅ ПРАВИЛЬНО: Строгий скоупинг по tenantId и userId с Fail-Closed гарантией
export async function safeGetOrder(orderId: string, tenantId: string, userId: string) {
  const order = await db.order.findFirst({
    where: {
      id: orderId,
      tenantId, // ✅ Жесткая привязка к текущему бренду
      userId,   // ✅ Проверка владения ресурсом
    },
    include: {
      service: {
        select: { name: true, platform: true }
      }
    }
  });

  if (!order) {
    // Единый отказ предотвращает перечисление чужих ID (Enumeration Protection)
    return { success: false, error: 'Заказ не найден' };
  }

  return { success: true, data: order };
}
```

---

### 2.1.1. 🛡️ Ядро защиты: Автоматический Prisma Tenant Enforcer (`src/lib/prisma-tenant-enforcer.ts`)

> 🔒 **Архитектурный инвариант безопасности (BOLA/IDOR Immunity):**
> Для гарантированного исключения человеческого фактора на уровне ORM развернут автоматический перехватчик запросов Prisma через `createTenantEnforcerExtension()`, работающий в связке с контекстом `AsyncLocalStorage` (`src/lib/tenant-context.ts`).

#### Контролируемые модели (TENANT_SCOPED_MODELS):
`Order`, `Payment`, `Ticket`, `User`, `Service`, `Category`, `LedgerEntry`, `SmartCampaign`, `OrderRefill`, `ServiceSmartConfig`, `AuthToken`.

#### Автоматические гарантии Enforcer:
1. **Чтение списков (`findMany`, `findFirst`, `count`, `aggregate`):** Автоматически подмешивает `tenantId` в условие `where`. Если разработчик забыл указать `tenantId`, запрос ограничивается активным тенантом из контекста.
2. **Преобразование `findUnique` $\to$ `findFirst` (IDOR Shield):** Поскольку `id` в PostgreSQL глобален, запрос `db.order.findUnique({ where: { id } })` автоматически конвертируется в `db.order.findFirst({ where: { id, tenantId } })`. Попытка прочитать чужой ID возвращает `null`.
3. **Защита при записи (`create`, `createMany`):** Автоматически выставляет `data.tenantId`. Если в запросе передан `tenantId`, не совпадающий с активным контекстом тенанта, транзакция прерывается с ошибкой безопасности `[PrismaTenantEnforcer] Cross-tenant write forbidden`.
4. **Контекстный запуск и санкционированный обход:**
```typescript
import { runWithTenant, runWithTenantBypass, resolveActiveTenantId } from '@/lib/tenant-context';

// 1. Выполнение операции в контексте конкретного тенанта
await runWithTenant('flux', async () => {
  const orders = await db.order.findMany(); // Автоматически where: { tenantId: 'flux' }
});

// 2. Межтенантный аудит или системный cron (СТРОГО с указанием причины)
await runWithTenantBypass('System cron sync across all tenants', async () => {
  const allOrders = await db.order.findMany(); // Обход разрешен и залогирован
});
```

---

### 2.2. Табу 2: Общие ключи кэширования без суффикса бренда (Brand Bleeding)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** кэшировать данные каталога, настроек или страниц без включения идентификатора тенанта в массив ключей и список тегов.

```typescript
// ❌ АНТИПАТТЕРН: Общий кэш-ключ. Первый пользователь прогревает кэш ценами SMMplan,
// после чего розничные покупатели SMMflux видят оптовые цены API!
export const getBadCatalog = unstable_cache(
  async () => {
    return await db.service.findMany({ where: { isActive: true } });
  },
  ['catalog-cache-key'], // ❌ Отсутствует tenantId!
  { revalidate: 3600 }
);
```

```typescript
// ✅ ПРАВИЛЬНО: Изолированный составной ключ и тег ревалидации per-tenant
export const getSafeCatalog = (tenantId: string) => {
  const cleanTenant = normalizeTenantId(tenantId) || 'smmplan';

  return unstable_cache(
    async () => {
      return await db.service.findMany({
        where: {
          tenantId: cleanTenant,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      });
    },
    ['catalog-services', cleanTenant], // ✅ Уникальный ключ кэша для каждого бренда
    {
      revalidate: 600,
      tags: [`catalog-${cleanTenant}`, 'catalog-global'], // ✅ Точечная инвалидация
    }
  )();
};
```

---

### 2.3. Табу 3: Смешение юрлиц, эквайринга и касс (Угроза ст. 54.1 НК РФ)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** направлять платежи с разных брендов (SMMplan и SMMflux) на один и тот же мерчант-аккаунт или формировать чеки от лица одной компании, если они зарегистрированы на разные юрлица/ИП.
> Согласно разъяснениям ФНС РФ (Письмо № БС-4-11/13018@, ст. 54.1 НК РФ), единый эквайринг, общий сайт и отсутствие явного разделения потоков выручки трактуются как **умышленное дробление бизнеса** с целью неправомерного сохранения права на освобождение от НДС (порог 20 млн ₽ по УСН).

```typescript
// ❌ АНТИПАТТЕРН: Один секрет ЮKassa на все сайты — прямой путь к уголовному делу по ст. 199 УК РФ
export async function badCreatePayment(amountKopecks: bigint) {
  // ❌ Хардкод единого мерчанта для разных доменов
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  // Смешение денежных потоков!
}
```

```typescript
// ✅ ПРАВИЛЬНО: Раздельные контексты оплаты и фискализации по ст. 54.1 НК РФ
import { checkVatThreshold, TenantPaymentContext } from '@/services/financial/payment-gateway.service';

export async function getTenantPaymentContext(tenantId: string): Promise<TenantPaymentContext> {
  const cleanTenant = tenantId === 'flux' ? 'flux' : 'smmplan';

  if (cleanTenant === 'flux') {
    return {
      tenantId: 'flux',
      legalCompanyName: process.env.FLUX_LEGAL_COMPANY_NAME || 'ИП Розничный С.М.',
      legalCompanyInn: process.env.FLUX_LEGAL_COMPANY_INN || '770123456789',
      yookassaShopId: process.env.FLUX_YOOKASSA_SHOP_ID!,
      yookassaSecretKey: process.env.FLUX_YOOKASSA_SECRET_KEY!,
      fiscalTaxSystemCode: 2, // УСН Доходы
      fiscalVatCode: (await checkVatThreshold('flux')) ? 10 : 1, // НДС 22% при >20 млн ₽
    };
  }

  // SMMplan API Context
  return {
    tenantId: 'smmplan',
    legalCompanyName: process.env.PLAN_LEGAL_COMPANY_NAME || 'ООО «СММ План Корпорейт»',
    legalCompanyInn: process.env.PLAN_LEGAL_COMPANY_INN || '779876543210',
    yookassaShopId: process.env.PLAN_YOOKASSA_SHOP_ID!,
    yookassaSecretKey: process.env.PLAN_YOOKASSA_SECRET_KEY!,
    fiscalTaxSystemCode: 1, // ОСНО или УСН Доходы-Расходы
    fiscalVatCode: (await checkVatThreshold('smmplan')) ? 10 : 1,
  };
}
```

---

### 2.4. Табу 4: Использование куки администратора `x_admin_tenant` в публичном контуре

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** определять тенант из куки `x_admin_tenant` на публичных клиентских страницах (`/`, `/catalog`, `/login`).
> Кука `x_admin_tenant` имеет силу **ТОЛЬКО** в путях `/admin/*`. В публичном контуре источник правды — **СТРОГО Host Header**.

```typescript
// ❌ АНТИПАТТЕРН: Чтение админской куки на публичном лендинге
export default async function BadPublicPage() {
  const cookieStore = await cookies();
  // ❌ Если админ переключил куку на flux и открыл smmplan.pro, он увидит дизайн flux на домене smmplan.pro!
  const tenant = cookieStore.get('x_admin_tenant')?.value || 'smmplan';
  return <LandingHero tenant={tenant} />;
}
```

```typescript
// ✅ ПРАВИЛЬНО: Строгий резолвинг через заголовки, проставленные Next.js Proxy (Node.js Runtime)
import { headers } from 'next/headers';

export default async function SafePublicPage() {
  const headersList = await headers();
  // ✅ Заголовок x-tenant-id сформирован в proxy.ts на основе Host Header
  const tenant = headersList.get('x-tenant-id') || 'smmplan';
  
  return (
    <main>
      {tenant === 'flux' ? <FluxHeroSection /> : <PlanHeroSection />}
    </main>
  );
}
```

---

### 2.5. Табу: Запрет фантомных брендов Lovable и SMMboost (Brand Ghosting)

> ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** использовать, упоминать или создавать ссылки на фантомные бренды `Lovable` и `SMMboost` в исходном коде, канонических URL (`canonical`), метаданных страниц (SEO Metadata), текстах интерфейса, CSS/тест-селекторах, конфигурационных файлах или дизайн-макетах.
> 
> **Ключевой инвариант архитектуры брендов OmniSMM 1.0:**
> - Материнская платформа / ядро администрирования называется строго **OmniSMM 1.0** (в шапке, сайдбаре, системных уведомлениях и заголовках).
> - Платформа OmniSMM 1.0 обслуживает **СТРОГО** две витрины:
>   1. **`smmplan`** — портал `smmplan.pro` (Classic API).
>   2. **`smmflux`** — витрина `smmflux.ru` (Radiant Aurora).
> - Брендов **`Lovable`** и **`SMMboost`** в системе **НЕ СУЩЕСТВУЕТ**. Их использование расценивается как критический дефект «Brand Ghosting» (фантомные бренды).
> - Вспомогательный алиас `normalizeTenantId('lovable') -> 'flux'` в `src/lib/tenant.ts` сохранен **ИСКЛЮЧИТЕЛЬНО** для обратной совместимости с историческими внешними ссылками/вебхуками и не должен тиражироваться. Все компоненты `Lovable*` окончательно переименованы в `Flux*` (`<FluxButton>`, `<FluxCard>`).

```typescript
// ❌ АНТИПАТТЕРН: Использование несуществующих брендов Lovable / SMMboost
// Приводит к генерации битых canonical ссылок, нарушению индексации SEO и путанице клиентов
export function badGenerateMetadata(tenantId: string) {
  if (tenantId === 'lovable') { // ❌ Фантомный бренд! Брендов Lovable и SMMboost НЕ существует!
    return {
      title: 'Lovable SMM — Панель накрутки',
      metadataBase: new URL('https://lovable.app'), // ❌ Несуществующий хост
      alternates: { canonical: 'https://lovable.app/catalog' },
    };
  }
  if (tenantId === 'smmboost') { // ❌ Фантомный бренд! Запрещено в коде и конфигах!
    return { title: 'SMMboost Panel' };
  }
}
```

```typescript
// ✅ ПРАВИЛЬНО: Строго smmplan и smmflux с алиасом Lovable только для обратной совместимости
import { normalizeTenantId, getTenantHost, absoluteCanonical, TenantId } from '@/lib/tenant';

export function safeGenerateMetadata(rawTenant: string, path: string = '') {
  // normalizeTenantId безопасно нормализует вход, приводя legacy 'lovable' к 'flux'
  const tenantId: TenantId = normalizeTenantId(rawTenant) || 'smmplan';

  const brandConfig = {
    smmplan: {
      name: 'SMMplan',
      host: getTenantHost('smmplan'), // smmplan.pro
      title: 'SMMplan — Профессиональная API-панель SMM-услуг',
    },
    flux: {
      name: 'SMMflux',
      host: getTenantHost('flux'), // smmflux.ru
      title: 'SMMflux — Платформа продвижения в социальных сетях',
    },
  }[tenantId];

  return {
    title: brandConfig.title,
    metadataBase: new URL(`https://${brandConfig.host}`),
    alternates: {
      // ✅ Canonical строго абсолютный через getTenantHost / absoluteCanonical
      canonical: absoluteCanonical(tenantId, path),
    },
  };
}
```

---

## 3. Премортем-анализ и моделирование отказов (Failure Scenarios / Pre-Mortem)

В таблице представлены критические риски мульти-тенантной модели и инженерные контрмеры:

| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде | Стратегия локализации и устранения |
| :--- | :--- | :--- | :--- |
| **1. Межтенантный BOLA/IDOR (Доступ к чужому заказу/пользователю)** | **Высокая (4/5)** x **Критическое (5/5)** = **20/25** | Все запросы Prisma принудительно включают составной ключ `{ id, tenantId }`. В Server Actions выполняется проверка `item.tenantId === session.tenantId`. | Возврат единого кода 404/403. Регистрация события безопасности в `auditAdminAwaitable` с типом `CROSS_TENANT_BREACH_ATTEMPT`. Немедленный бан IP нарушителя в Redis Rate Limiter. |
| **2. Brand Bleeding в SSR-кэше (Цены или дизайн одного бренда на домене другого)** | **Средняя (3/5)** x **Высокое (4/5)** = **12/25** | `unstable_cache` изолирован составными ключами `['module', tenantId]`. В `src/proxy.ts` для публичных маршрутов игнорируется кука `x_admin_tenant`. Заголовки `Vary: Host, x-tenant-id`. | Точечная инвалидация кэша тенанта: `revalidateTag('catalog-' + tenantId)`. Прогон регрессионного теста `src/__tests__/multitenant-isolation.test.ts`. |
| **3. Претензия ФНС по ст. 54.1 НК РФ (Обвинение в «дроблении бизнеса» и доначисление НДС)** | **Низкая (2/5)** x **Катастрофическое (5/5)** = **10/25** | Архитектурное разделение `TenantPaymentContext`: раздельные банковские счета, договоры эквайринга, фискальные накопители ККТ. Автоматический контроль порога 20 млн ₽ (`checkVatThreshold`). | Выгрузка юридических логов аудита проводок `LedgerEntry` с раздельными ИНН и фискальными признаками документов (ФПД). Полная автономность юрлиц подтверждается кодом платформы. |
| **4. Ошибка оператора техподдержки при межтенантном переключении** | **Средняя (3/5)** x **Среднее (3/5)** = **9/25** | Ограничение `user.allowedTenants` для всех ролей кроме `OWNER`. Визуальный баннер активного бренда в `<GlobalSiteSwitcher />` и Header с четкой цветовой дифференциацией (Синий SMMplan vs Неоновый SMMflux). | Запись каждого переключения в Redis `staff:${userId}:active_tenant` и аудит-лог. Блокировка попытки редактирования каталога чужого бренда с возвратом понятного алерта. |
| **5. Смешение токенов дизайн-системы (Всплытие компонентов `<Flux*>` на SMMplan)** | **Средняя (3/5)** x **Низкое (2/5)** = **6/25** | CI-валидатор дизайн-системы (`npx tsx scripts/harness/ui-forge.ts validate`). Проверка AST-дерева страниц SMMplan на отсутствие недопустимых импортов анимаций или неоновых классов. | Автоматический билд-гейт блокирует коммит. Компоненты-адаптеры используют семантические токены Tailwind 4 из `src/app/globals.css`. |
| **6. Потеря контекста бренда в фоновых задачах (BullMQ) или вебхуках (Email с неверным логотипом, ошибка БД)** | **Высокая (4/5)** x **Высокое (4/5)** = **16/25** | Запрет обработки задач без `tenantId` в Payload. Обертка воркеров в `runWithTenant`. Разрешение вебхуков строго из URL или `metadata.tenantId`. | Проверка `job.data.tenantId` в начале каждого воркера. Регрессионный тест на отправку email: `TenantContext` должен совпадать с `order.tenantId`. |

---

## 4. Чеклист верификации (Verification Checklist)

Перед релизом любых изменений в мульти-тенантном контуре выполните следующий чеклист:

### 4.1. Автоматизированные тесты изоляции тенантов
- [ ] **Запуск тестов автоматического Prisma Tenant Enforcer (BOLA/IDOR Shield):**
  ```bash
  npx dotenv -e .env.test -- npx vitest run src/__tests__/architecture/automatic-prisma-tenant-enforcer.test.ts
  ```
  *Проверяемые инварианты:*
  - Автоматическая инъекция `tenantId` в `findMany`, `count`, `aggregate`.
  - Преобразование `findUnique` в `findFirst` с фильтрацией по `tenantId`.
  - Автоматическое присвоение `data.tenantId` и отсечение чужого `tenantId` при создании.
  - Поддержка контекста `runWithTenant` и санкционированного обхода `runWithTenantBypass`.
- [ ] **Запуск базового сьюта изоляции данных и кэша:**
  ```bash
  npx vitest run src/__tests__/multitenant-isolation.test.ts
  ```
  *Проверяемые инварианты:*
  - Изоляция кэш-тегов в функциях каталога (`catalog-smmplan` vs `catalog-flux`).
  - Изоляция рейт-лимитов одного пользователя в разных тенантах.
  - Игнорирование куки `x_admin_tenant` на публичных маршрутах.
- [ ] **Запуск тестов изоляции прав доступа сотрудников (Staff RBAC):**
  ```bash
  npx vitest run src/__tests__/multitenant-staff-isolation.test.ts
  ```
  *Проверяемые инварианты:*
  - Запрет переключения на неразрешенные бренды для `SUPPORT` и `OPERATOR`.
  - Полномочия роли `OWNER` на глобальное переключение.
- [ ] **Проверка фискализации и соответствия 54-ФЗ / 176-ФЗ:**
  ```bash
  npx vitest run src/__tests__/legal/legal-compliance-and-enterprise-pages.test.ts
  ```

### 4.2. Сетевая проверка резолвинга (cURL / HTTP)
- [ ] **Проверка заголовка `x-tenant-id` для SMMplan:**
  ```bash
  curl -I -H "Host: smmplan.pro" http://127.0.0.1:3000/services
  ```
  *Ожидается:* Заголовок `x-tenant-id: smmplan`.
- [ ] **Проверка заголовка `x-tenant-id` для SMMflux:**
  ```bash
  curl -I -H "Host: smmflux.ru" http://127.0.0.1:3000/services
  ```
  *Ожидается:* Заголовок `x-tenant-id: flux`.
- [ ] **Проверка админского маршрута с кукой переключения:**
  ```bash
  curl -I -H "Host: smmplan.pro" -H "Cookie: x_admin_tenant=flux; session_token=VALID_ADMIN" http://127.0.0.1:3000/admin/orders
  ```
  *Ожидается:* В админке тенант успешно переключается на `flux`.

### 4.3. Аудит исходного кода и схем
- [ ] **Проверка уникальности индексов в `prisma/schema.prisma`:**
  Убедиться, что все новые таблицы каталога содержат `@@unique([slug, tenantId])` или `@@index([tenantId, createdAt])`.
- [ ] **Проверка строгой типизации TypeScript:**
  ```bash
  npx tsc --noEmit
  ```
  *Требование:* 0 ошибок типизации.
- [ ] **Проверка отсутствия фантомных брендов (Zero Phantom Brands Audit):**
  Убедиться через поиск по кодовой базе, что отсутствуют ссылки на фантомные бренды `lovable` (кроме обратной совместимости в `normalizeTenantId`) и `smmboost`:
  ```bash
  git grep -i "smmboost"
  ```
  *Требование:* 0 совпадений в коде и конфигурациях.
