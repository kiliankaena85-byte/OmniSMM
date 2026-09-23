# 🛡️ ОТЧЁТ СОСТЯЗАТЕЛЬНОГО АУДИТА: MINIMAX/MINIMAX-M3:FREE
**Объект аудита:** Архитектура управления категориями и соцсетями OmniSMM 1.0
**Дата проведения:** 2026-08-30T06:23:48.990Z

# OmniSMM 1.0 — Аудит системы управления категориями и сетями

## 1. RBAC и авторизация

**Что сделано правильно:**
- Каждое действие обёрнуто в `requireStaffPermission('CATALOG', 'edit', ...)` — единая точка контроля привилегий.
- `admin` объект из callback используется для аудита — нельзя подставить чужой `adminId`.
- В `page.tsx` сессия проверяется через `verifySession()`, однако **отсутствует серверная проверка `requireStaffPermission`** для самого рендера страницы. Если middleware допускает ролях `USER`/`SUPPORT` к этому маршруту — они увидят весь список категорий по всем тенантам.

**Найденные проблемы:**

| # | Severity | Проблема |
|---|---|---|
| AUTH-01 | High | В `CategoriesAdminPage` **нет вызова `requireStaffPermission('CATALOG', 'view')`** перед запросами к БД. Любой авторизованный пользователь с валидной сессией может читать категории, сети и `_count.services` всех тенантов (через манипуляцию `params.tenant` или cookie `x_admin_tenant`). |
| AUTH-02 | Medium | `tenantId` тенанта выбирается из **ненадёжных источников** (query-param `?tenant=`, cookie `x_admin_tenant`). Без проверки, что `user.role`/`user.tenantId` позволяет переключаться между тенантами — типичный IDOR/privilege escalation для multi-brand. |
| AUTH-03 | Low | `dynamic = "force-dynamic"` — OK, но `revalidateTag(..., 'default')` с явным аргументом профиля — избыточно и подозрительно (должен быть только ключ). Косметика, но указывает на непоследовательность API. |

**Рекомендация:** Перед `db.category.findMany` в page-компоненте выполнить `await requireStaffPermission('CATALOG', 'view')` и прокинуть `admin` в `resolveAdminTenantContext`, запретив кросс-тенантный переключатель для не-OWNER.

---

## 2. Транзакции, удаление, слияние

**Удаление категории (`deleteCategory`):**
- ✅ Корректно проверяется `db.service.count > 0` — защита от cascade-потери услуг.
- ✅ Аудит фиксирует только `target`, без `oldValue` (имя/сеть) — **снижает forensic-ценность** при расследовании инцидентов.
- ⚠️ Сообщение об ошибке возвращает `serviceCount` клиенту — допустимо для UX, но если бы был лимит попыток через брутфорс ID — могло бы стать oráculo'ом. Низкий риск.

**Слияние (`mergeCategoriesAction`):**

Это **самое опасное место** в модуле. Найдено:

| # | Severity | Проблема |
|---|---|---|
| MERGE-01 | **Critical** | **Нет проверки тенантной совместимости** `sourceCat.tenantId === targetCat.tenantId`. Админ тенанта `smmplan` может слить свою категорию с категорией тенанта `flux`, переместив все услуги в чужой тенант. Катастрофа для мультибренда. |
| MERGE-02 | High | **Нет проверки `networkId`** — можно слить категорию сети Instagram в категорию сети TikTok. Каталог станет семантически сломан, фильтры на витрине сломаются. |
| MERGE-03 | High | `db.service.updateMany` в транзакции переносит **все** услуги, включая `isActive: false`, скрытые промо, и услуги **других тенантов**, если БД-схема позволяет хранить услуги в категории с `tenantId='all'`. Без проверки инварианта `service.tenantId ∈ {cat.tenantId, 'all'}`. |
| MERGE-04 | Medium | **Нет записи `oldValue`** в аудите `CATEGORY_MERGE` — после merge невозможно восстановить, какие именно serviceId были перемещены. Рекомендуется предварительно собрать `service.findMany({ where: { categoryId: sourceId }, select: { id: true }})` и записать в `oldValue.movedServices`. |
| MERGE-05 | Medium | Транзакция `$transaction` не использует `isolation level Serializable` — при параллельном merge'е от двух админов возможен double-move или потеря услуг. |
| MERGE-06 | Low | Действие **не идемпотентно**: повторный вызов с теми же аргументами вернёт "Source category not found" после первого успешного merge, но клиентская UI может не отличить это от ошибки авторизации. |

**Hide-all (`hideCategoryAndServicesAction`):**
- ⚠️ Нет фильтра по `tenantId` при `service.updateMany` — может скрыть услуги чужих тенантов, если БД позволяет категории `tenantId='all'` содержать разнотенантные услуги.

---

## 3. Мультитенантность

**Архитектурно:**
- `tenantId` на `Category` имеет sentinel `'all'` (виртуальный глобальный тенант).
- В `createCategory`: `tenantId: data.tenantId || 'all'` — если фронт не передал, попадает в глобальный пул. **Это дыра**: непривилегированный админ может случайно или намеренно создать категорию в `'all'`, и она появится у обоих брендов.
- В `updateCategory`: `...(data.tenantId ? { tenantId: data.tenantId } : {})` — **нельзя сменить тенант** через update (защита от tampering). ✅ Плюс.
- В page: фильтр `{ in: [selectedTenant, 'all'] }` — корректно подмешивает глобальные категории.

| # | Severity | Проблема |
|---|---|---|
| TEN-01 | High | В `createCategory` нет серверной проверки прав на создание категории в `tenantId === 'all'`. Только владелец платформы (или явно разрешённая роль) должен иметь такую возможность. |
| TEN-02 | High | **Network не имеет `tenantId`** — сеть является глобальной сущностью. Это означает, что slug Instagram один на оба бренда, что норм. Но `deleteNetworkAction` блокирует удаление по категориям **любого тенанта**, что правильно. Однако при создании сети **нет проверки `tenantId`** контекста — создатель из `flux` создаст глобальную сеть, которую увидит `smmplan`. |
| TEN-03 | Medium | `normalizeTenantId(reqHeaders.get('x-tenant-id'))` доверяет заголовку — в multi-brand reverse-proxy конфигурации любой клиент может подменить `Host`/`x-tenant-id`. Должна быть привязка к сессии/cookie, а не к заголовку. |
| TEN-04 | Medium | В page используется `resolveAdminTenantContext(user, effectiveParamTenant)` — **fallback-цепочка cookie → header** означает, что атакующий, укравший сессионную cookie одного тенанта, может переключиться на другой тенант, подменив `?tenant=`. |

---

## 4. Валидация данных

**Zod-схемы — в целом адекватны**, но есть пробелы:

| # | Severity | Проблема |
|---|---|---|
| VAL-01 | Medium | `categorySchema.name` — `max(255)` ок, но не проверяется на **уникальность в пределах `(networkId, tenantId)`**. Два админа могут создать две "Подписчики" в одной сети — UI-хаос. |
| VAL-02 | Medium | `categorySchema.activityType: z.string().optional().nullable()` — **нет enum'а**. Клиент может прислать `"<script>alert(1)</script>"` или произвольную строку. Если `activityType` рендерится на витрине без escape — XSS на клиентском каталоге. **Критично**, если используется в dangerouslySetInnerHTML. |
| VAL-03 | Medium | `analyzerTags: z.string().max(255)` — принимает **произвольный текст**, не парсится как список тегов. Если это comma-separated, нет валидации формата. Если это JSON — нет парсинга. Семантика поля не закреплена схемой. |
| VAL-04 | Low | `warningMessage.max(1000)` ок, но `requireWarning: true` при пустом `warningMessage` — UI-логическая ошибка. Нет cross-field валидации: `.refine(d => !d.requireWarning || (d.warningMessage && d.warningMessage.length > 0))`. |
| VAL-05 | Low | `networkSchema.slug` regex `^[a-z0-9-_]+$` — ок, но **нет запрета на зарезервированные slug'и** (`admin`, `api`, `catalog`, `new`, `edit`, `delete`...). Конфликт с маршрутами. |
| VAL-06 | Low | `networkSchema.name` — нет trim. "  Instagram " и "Instagram" — разные строки с точки зрения уникальности, но одинаковые для пользователя. |
| VAL-07 | Info | `z.coerce.number().int().default(0)` для `sort` — если придёт `"abc"` превратится в `NaN`, потом `.int()` упадёт с невнятной ошибкой. Лучше явный preprocess с понятным сообщением. |
| VAL-08 | Medium | `idSchema = z.string().min(1)` — **не CUID/UUID-валидация**. Принимает любые строки, включая `../../etc/passwd`-подобные. Prisma устойчив к SQLi через параметризацию, но передача сырого ID в URL/revalidatePath может быть проблемой на downstream. |

---

## 5. Аудит и наблюдаемость

**Сильные стороны:**
- Все мутации логируются через `auditAdminAwaitable` (awaitable = не блокирует ответ, но гарантирует запись).
- `action`, `target`, `targetType`, `adminId/email` — корректный минимум.

**Слабости:**

| # | Severity | Проблема |
|---|---|---|
| AUD-01 | High | **`deleteCategory` и `deleteNetworkAction` не пишут `oldValue`** — невозможно узнать, что именно удалили, в post-incident анализе. |
| AUD-02 | High | `CATEGORY_MERGE` не пишет **список перемещённых услуг** — критично для восстановления. |
| AUD-03 | Medium | `CATEGORY_HIDE_ALL_SERVICES` пишет `categoryName` в `newValue`, но **не список ID скрытых услуг**. |
| AUD-04 | Medium | Нет фиксации **IP-адреса и User-Agent** админа. При компрометации учётки невозможно доказать, что действие выполнено не владельцем. |
| AUD-05 | Low | `auditAdmin` (sync) импортирован, но **не используется** — мёртвый код, признак незавершённого рефакторинга. |

---

## 6. Архитектурные наблюдения

1. **Двойственность `createCategory` / `updateCategory`**: используют `categorySchema.parse` (throws), а `createNetwork`/`updateNetwork` — `safeParse` с graceful-error-return. **Непоследовательный контракт ошибок**: одни actions бросают ZodError в Next.js error boundary, другие возвращают `{ success: false }`. UI должен обрабатывать оба варианта — типичный источник "невидимых" багов.

2. **`hideCategoryAndServicesAction` не имеет UI-ссылки в коде** — есть серверный action без вызывающего компонента в показанном фрагменте. Возможно, dead code или недоделанный feature.

3. **`mergeCategoriesAction` не имеет dry-run** — для столь деструктивной операции (move N услуг + delete) нужен режим предпросмотра
