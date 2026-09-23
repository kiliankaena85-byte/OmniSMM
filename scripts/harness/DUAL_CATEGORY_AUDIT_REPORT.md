# 🛡️ ОТЧЁТ ДВУХКОМПОНЕНТНОГО АУДИТА: MINIMAX M3 & GLM-5.2

**Дата аудита:** 2026-08-30T06:50:51.917Z
**Объект:** /admin/catalog/categories (Создание, редактирование, слияние и удаление соцсетей и категорий)

## 🤖 Вердикт аудита от MiniMax M3

# 🔍 OmniSMM 1.0 — Аудит модуля `/admin/catalog/categories`

## РЕЗЮМЕ

Аудит проведён в режиме состязательного (adversarial) ревью: каждый компонент проверен на устойчивость к типичным атакам (RBAC bypass, IDOR, tenant-leak, race condition, TOCTOU), а также на архитектурную целостность и UX-надёжность. Ниже — детальный разбор.

---

## 1. 🛡️ БЕЗОПАСНОСТЬ И RBAC

### ✅ Сильные стороны

| Аспект | Статус | Комментарий |
|---|---|---|
| `requireStaffPermission('CATALOG', 'edit')` на каждом action | ✅ | Покрывает все 8 server actions. Создание, обновление, удаление, скрытие, объединение, CRUD networks — везде явный guard. |
| `enforceSectionAccess('catalog')` на server-page | ✅ | Двойной эшелон: проверка на уровне страницы + на уровне action. |
| Аудит через `auditAdminAwaitable` | ⚠️ Частично | Все действия пишутся в аудит, **но** значение `oldValue` неполное (см. ниже). |
| Zod-валидация входных данных | ✅ | Используется `categorySchema`, `networkSchema`, `idSchema` — все критичные поля ограничены по длине и типу. |
| Slug regex | ✅ | `/^[a-z0-9-_]+$/` блокирует инъекции path-traversal и URL-обходов. |
| Refine на связку `requireWarning → warningMessage` | ✅ | Серверная кросс-валидация зависимых полей предотвращает логические инвалидные состояния. |

### 🚨 Критические и серьёзные находки

#### F-01 🔴 CRITICAL — `deleteCategory`: IDOR + блокирующее поведение на «у нас есть сервис»
**Файл:** `categories.ts:deleteCategory`

```ts
const category = await db.category.findUnique({ where: { id }, include: { _count: ... } });
if (category._count.services > 0) {
  return { success: false, hasServices: true, serviceCount: ..., error: ... };
}
await db.category.delete({ where: { id } });
```

**Проблема:** классическая **TOCTOU (Time-Of-Check-Time-Of-Use)** гонка. Между `_count` и `delete` параллельная транзакция (другой админ, webhook, импортёр) может создать сервис в категории → получится **висячий `categoryId`** в `Service`. Prisma не имеет `ON DELETE RESTRICT` на этом FK на уровне приложения — нужен constraint check в БД.

**Решение:**
```ts
await db.$transaction(async (tx) => {
  const cnt = await tx.service.count({ where: { categoryId: id } });
  if (cnt > 0) throw new Error('CATEGORY_NOT_EMPTY');
  await tx.category.delete({ where: { id } });
}, { isolationLevel: 'Serializable' });
```
И **обязательно** миграция: `FOREIGN KEY (categoryId) REFERENCES category(id) ON DELETE RESTRICT`.

#### F-02 🟠 HIGH — `updateCategory`: race condition на `tenantId`
**Файл:** `categories.ts:updateCategory`

```ts
...(data.tenantId ? { tenantId: data.tenantId } : {}),
```

**Проблема:** при `tenantId = null` поле **не обновляется вообще** (spread игнорирует falsy). Если админ пытается сбросить категорию на «all», он не сможет. Более опасный сценарий: при `data.tenantId === ''` (из-за `.optional().nullable()` Zod может вернуть `""` при coercion) — silent no-op, либо запись пустой строки в `tenantId`.

**Решение:**
```ts
tenantId: data.tenantId ?? 'all',
```
И добавить `.refine(d => d.tenantId !== '', ...)` в Zod.

#### F-03 🟠 HIGH — `mergeCategoriesAction`: IDOR + отсутствие проверки tenantId в merge-источнике на уровне «нельзя влить категорию приёмника из чужого тенанта»
**Файл:** `categories.ts:mergeCategoriesAction`

Guard на тенант есть только для пары `sourceCat.tenantId !== 'all' && targetCat.tenantId !== 'all'`. **Но** если `targetCat.tenantId === 'all'`, то админ smmflux через `sourceCat` (smmplan-категорию) может влить smmplan-услуги в категорию `all`, и они появятся на витрине smmflux. Утечка кросс-брендовая.

**Решение:** запретить merge в `tenantId === 'all'` приёмник, **если источник имеет конкретный тенант**. Или явно требовать, чтобы оба имели одинаковый тенант, либо оба были `'all'`.

#### F-04 🟡 MEDIUM — `auditAdminAwaitable` неполный `oldValue`
**Файл:** `createCategory`, `updateCategory`, `deleteCategory`

- В `createCategory` нет `oldValue` (это нормально для создания).
- В `updateCategory` нет `oldValue` — **нельзя откатить аудит-историю** при расследовании инцидента.
- В `deleteCategory` `oldValue` берётся из `category` **до** удаления — здесь ОК.

**Решение:**
```ts
const oldCat = await db.category.findUnique({ where: { id } });
if (!oldCat) return { success: false, error: 'Not found' };
const cat = await db.category.update({ where: { id }, data: ... });
await auditAdminAwaitable({
  ...,
  oldValue: { name: oldCat.name, networkId: oldCat.networkId, ... },
  newValue: { name: cat.name, ... }
});
```

#### F-05 🟡 MEDIUM — Нет CSRF-токена / `Origin` валидации в server actions
Server actions в Next.js защищены тем, что это POST с encrypted action ID, но:
- Mutating-операции (`deleteCategory`, `mergeCategoriesAction`, `deleteNetworkAction`) могут быть вызваны **из любого origin**, если action reference утечёт (например, через SSR-кеш для неавторизованного пользователя).
- Нет проверки `Origin`/`Referer` в actions.

**Решение:** централизованный CSRF middleware для всех `*Action` мутаций (проверка `origin` совпадает с `host`).

#### F-06 🟡 MEDIUM — `parseInt(catSort, 10)` без `MIN_SAFE_INTEGER`/`MAX_SAFE_INTEGER` clamp
**Файл:** `category-manager.tsx`

```ts
sort: parseInt(catSort, 10) || 0
```

Zod схема использует `z.coerce.number().int()` без границ. Если админ введёт `99999999999999999999` → переполнение Int32 в Postgres (если колонка `Integer`) → exception. Если `BigInt` — нормализация в JS до `Number.MAX_SAFE_INTEGER`, потеря точности, неконсистентный sort.

**Решение:** в Zod `.int().min(-2147483648).max(2147483647)`.

#### F-07 🟢 LOW — `Network.slug` уникален по `findFirst`, но без race-safe constraint
**Файл:** `createNetworkAction`, `updateNetworkAction`

Между `findFirst` и `create`/`update` — гонка. **Должен быть UNIQUE constraint на `Network.slug`** в схеме БД + обработка `P2002`.

#### F-08 🟢 LOW — Двойная запись аудита в одну транзакцию
`auditAdminAwaitable` пишет аудит **отдельным запросом**, не в `$transaction`. Если DB commit прошёл, а аудит упал — действие есть, следа нет. Для критичных операций (delete, merge) — нужен `audit` внутри транзакции или outbox-pattern.

---

## 2. 🏢 МУЛЬТИТЕНАНТНОСТЬ

### ✅ Сильные стороны

| Аспект | Статус |
|---|---|
| Фильтрация категорий на page-level через `tenantId: { in: [selectedTenant, 'all'] }` | ✅ |
| `resolveAdminTenantContext` принимает решения на основе user/cookie/header | ✅ |
| Теги кэша разделены по тенантам: `catalog-smmplan`, `catalog-flux`, `services-smmplan`, `services-flux` | ✅ |
| Guard на merge: запрет cross-network | ✅ |
| Guard на merge: частичный запрет cross-tenant | ⚠️ Неполный (см. F-03) |

### 🚨 Находки

#### T-01 🟠 HIGH — `createCategory`: `tenantId` не пробрасывается явно
**Файл:** `categories.ts:createCategory`

```ts
tenantId: data.tenantId || 'all',
```

Если админ smmplan забыл указать tenantId, создаётся категория с `tenantId='all'` → она появится **и у smmflux**. Утечка.

**Решение:** server-action должен **принудительно** подставлять `tenantId = selectedTenant` (из контекста), а поле `tenantId` либо убрать из payload клиента, либо принимать только `'all'` от SUPER_ADMIN.

#### T-02 🟠 HIGH — `updateCategory` может «увести» категорию в чужой тенант
Нет проверки, что текущий `category.tenantId` соответствует тенанту админа. Админ smmflux через `updateCategory(id)` может поменять `tenantId` категории smmplan → она исчезнет у smmplan и появится у smmflux.

**Решение:** на старте проверять `if (existing.tenantId && existing.tenantId !== selectedTenant && existing.tenantId !== 'all') → 403`.

#### T-03 🟡 MEDIUM — `_count.services` на page filter и `tenantFilter` неконсистентны
В page:
```ts
_count: { select: { services: { where: tenantFilter ? { tenantId: tenantFilter } : undefined } } }
```
а ниже:
```ts
const tenantFilter = selectedTenant ? { in: [selectedTenant, 'all'] } : undefined;
```
В обе ветки одно и то же. ОК. **Но** `hideCategoryAndServicesAction` НЕ фильтрует по тенанту при подсчёте:
```ts
select: { id: true, name: true, _count: { select: { services: true } } }
```
Если категория с `tenantId='all'` — окей. Если конкретный тенант — скрываются **все** услуги категории в обоих брендах.

**Решение:** добавить фильтр `services: { where: { tenantId: ... } }` в `_count` и в `updateMany`.

#### T-04 🟢 LOW — Cookie `x_admin_tenant` без подписи
Cookie `x_admin_tenant` управляется клиентом? Если так — злоумышленник может поставить `cookie` в `smmflux` и читать чужие категории. Нужно сделать cookie **httpOnly, signed** (HMAC).

---

## 3. 🔄 ЦЕЛОСТНОСТЬ ДАННЫХ И КАСКАДНЫЕ ОПЕРАЦИИ

### ✅ Сильные стороны

| Аспект | Статус |
|---|---|
| Атомарность merge через `db.$transaction` | ✅ |
| Guard `networkId` mismatch в merge | ✅ |
| Запрет удаления network с категориями | ✅ |
| Запрет удаления category с сервисами | ⚠️ TOCTOU (F-01) |
| Slug regex предотвращает инъекции | ✅ |
| Zod `.max(1000)` на `warningMessage` | ✅ |

### 🚨 Находки

#### D-01 🟠 HIGH — `mergeCategoriesAction`: внутри `$transaction` нет re-fetch
```ts
await tx.service.updateMany({ where: { categoryId: sourceCategoryId }, data: { categoryId: targetCategoryId } });
await tx.category.delete({ where: { id: sourceCategoryId } });
```
Если между `findUnique` и `$transaction` появились **новые** сервисы в источнике (созданные параллельно) — они будут **потеряны**, потому что `sourceCat.services.length` рассчитан до транзакции.

**Решение:**
```ts
const movedCount = await tx.service.updateMany({...}).then(r => r.count);
await tx.category.delete({...});
// Audit movedCount, а не пред-рассчитанную длину
```

#### D-02 🟡 MEDIUM — Нет ON DELETE правил на `Service.categoryId`
Prisma по умолчанию ставит `ON DELETE SET NULL` или `RESTRICT` в зависимости от optional. Если `RESTRICT` — удалить категорию с сервисами нельзя (это спасает). Но если `SET NULL` — сервисы превратятся в «потеряшек», и фильтр по категории на витрине сломается.

**Решение:** миграция с явным `ON DELETE RESTRICT` + индекс `Service.categoryId`.

#### D-03 🟡 MEDIUM — Отсутствует проверка `tenantId` услуг при merge
После `updateMany` услуги `sourceCategoryId` (с `tenantId='smmplan'`) переезжают в `targetCategoryId` (с `tenantId='flux'`). Сервис оказывается в «чужой» категории по тенанту. На витрине это вызовет рассинхрон.

**Решение:** при merge внутри транзакции — нормализовать `tenantId` всех перенесённых услуг к тенанту приёмника, **либо запретить merge при расхождении**.

#### D-04 🟢 LOW — Slug категории нигде не валидируется
`CategoryItem.slug` — это автогенерируемое поле (slugify из имени?). Если нет — при ручном импорте возможен коллизии. В коде нет `unique(slug)` проверки.

---

## 4. 🎨 UX & ОПЕРАЦИОННАЯ НАДЁЖНОСТЬ

### ✅ Сильные стороны

| Аспект | Оценка |
|---|---|
| Группировка таблиц по соцсетям | ⭐⭐⭐⭐⭐ |
| Inline-кнопка «Добавить» в шапке группы | ⭐⭐⭐⭐⭐ |
| `EyeOff` виден только при `_count.services > 0` | ⭐

---

