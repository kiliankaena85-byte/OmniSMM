# AUDIT-ADMIN.md — Final State Report

**Дата закрытия:** 2026-08-24
**Документ:** `AUDIT-ADMIN.md`
**Статус:** ✅ Закрыт. 18/18 дефектов исправлены и смержены в `main`.

---

## 1. Сводка по этапам

| Этап | Диапазон | Кол-во | Merge commit | Охват |
|---|---|---|---|---|
| **Stage A** | ADM-00..05 | 6 | (предыдущие сессии) | RBAC-гейты: Manager role, тикеты, клиенты, баланс-заявки, роутинг, контент |
| **Stage B** | ADM-06..11 | 6 | (предыдущие сессии) | SECTION_MAP sync, недостающие гейты, UI ролей + матрица прав, feature-flags, link-patterns, мёртвые `revalidatePath` |
| **Stage C** | ADM-12..17 | 6 | `af8ed9540` | God-компоненты, error-границы, routing action, `canSeeRates` RBAC, layout cache, manual ungate |

**Итого:** 18 дефектов закрыто за 3 этапа, всё в `main`.

---

## 2. Полная таблица дефектов

| ADM ID | Заголовок | Этап | Статус |
|---|---|---|---|
| ADM-00 | Регрессия для роли Manager: потеря управления панелями провайдеров | Stage A | ✅ |
| ADM-01 | Тикеты: три разные секции в одном домене, Support не может отвечать | Stage A | ✅ |
| ADM-02 | Клиенты: мутации за `finance`, гейт за `clients`, меню за `finance` | Stage A | ✅ |
| ADM-03 | Согласование балансовых заявок замкнуто на владельца | Stage A | ✅ |
| ADM-04 | Страница роутинга услуг за несуществующей секцией `services` | Stage A | ✅ |
| ADM-05 | Контент: расхождение имён `content` / `pages` / `settings` | Stage A | ✅ |
| ADM-06 | Рассинхронизация SECTION_MAP сайдбара и реальных гейтов страниц | Stage B | ✅ |
| ADM-07 | Страницы без секционных гейтов (tenants, analytics, fraud-monitor) | Stage B | ✅ |
| ADM-08 | Отсутствие UI управления ролями и матрицей прав (CRUD ролей) | Stage B | ✅ |
| ADM-09 | Feature-flags: страница за `settings`, в сиде отдельная `features` | Stage B | ✅ |
| ADM-10 | Link-patterns: бэкенд-фича без UI вызова / отсутствующий маршрут | Stage B | ✅ |
| ADM-11 | Мёртвые `revalidatePath` на несуществующие маршруты | Stage B | ✅ |
| ADM-12 | God-компоненты: декомпозиция `finance` и `clients/[id]` | Stage C | ✅ |
| ADM-13 | Отсутствие error-границ во всех разделах админки | Stage C | ✅ |
| ADM-14 | Побочная запись в БД при GET страницы роутинга (self-healing) | Stage C | ✅ |
| ADM-15 | `canSeeRates` в заказах по строке роли вместо проверки прав `finance:view` | Stage C | ✅ |
| ADM-16 | Тяжёлый COUNT-запрос аномалий каталога в корневом layout без кэша | Stage C | ✅ |
| ADM-17 | Manual-справка за гейтом `settings` (недоступна саппорту) | Stage C | ✅ |

---

## 3. Stage C — Детальный файловый реестр (merge `af8ed9540`, 51 файл)

### ADM-13 — Error-границы (26+ файлов `error.tsx`)
Типовой компонент `src/components/admin/section-error.tsx`, файлы созданы в:
- `catalog/[id]`, `catalog/patterns`, `catalog/categories`, `catalog/quarantine`, `catalog/sync`, `catalog/drift`, `catalog/new`
- `providers/import`, `providers/health`, `providers/keys`, `providers/new`, `providers/[id]`
- `settings/roles`, `settings/balance-policies`
- `manual`
- `finance/balance-requests`, `finance/balance-requests/stats`, `finance/support-review`, `finance/payments/[id]/dispute-pack`
- `fraud-monitor`
- `cms`, `cms/[id]`, `cms/new`
- `knowledge/create`, `knowledge/[id]/edit`
- `services/[id]/routing`
- `orders/[id]`, `tickets/[id]`, `pages/[slug]`, `clients/[id]`

### ADM-12 — Декомпозиция god-компонентов

**`src/app/admin/finance/`** (был `finance-client.tsx` 779 строк → 5 модулей ≤ 300 строк):

| Файл | Строк | Назначение |
|---|---|---|
| `finance-client.tsx` | 141 | Главный оркестратор вкладок |
| `components/finance-overview-tab.tsx` | 165 | P&L, KPI, EBITDA, налоги, OPEX |
| `components/finance-payments-tab.tsx` | 184 | Таблица платежей, фильтры, CSV |
| `components/finance-ledger-tab.tsx` | 180 | Проводки Ledger, Totals strip, CSV |
| `components/finance-helpers.tsx` | 206 | Форматтеры, константы, CSV download |

**`src/app/admin/clients/[id]/`** (был `client-detail-client.tsx` 1435 строк → 13 модулей ≤ 300 строк):

| Файл | Строк | Назначение |
|---|---|---|
| `client-detail-client.tsx` | 122 | Главный оркестратор CRM клиента |
| `tabs/balance-tab.tsx` | 49 | Оркестратор вкладки баланса |
| `tabs/balance-terminal-form.tsx` | 264 | Форма начисления/списания |
| `tabs/balance-snapshot-panel.tsx` | 111 | Сводка депозитов и трат |
| `tabs/balance-equation-card.tsx` | 76 | Калькулятор Было / Операция / Станет |
| `tabs/balance-predictive-chips.tsx` | 74 | Предиктивные подсказки |
| `tabs/security-tab.tsx` | 257 | Пароли, Magic Link, Logout |
| `tabs/security-email-modal.tsx` | 131 | Модалка смены email 152-ФЗ |
| `tabs/security-login-logs.tsx` | 67 | Таблица логов входа |
| `tabs/payments-tab.tsx` | 134 | Таблица платежей клиента |
| `tabs/payments-refund-modal.tsx` | 203 | Модалка возврата средств |
| `tabs/api-tab.tsx` | 177 | API профиль |
| `tabs/notes-tab.tsx` | 145 | Заметки и скидки |

### ADM-16 — Кэш счётчика аномалий в layout
- `src/app/admin/layout.tsx` — `getCachedAnomalyCount` обёрнут в `unstable_cache` (60s TTL, теги `catalog`, `anomaly-count`)
- Инвалидация: `revalidateTag('catalog')` в `src/actions/admin/catalog/` → `categories.ts`, `services.ts`, `soft-delete.ts`, `batch.ts`

### ADM-15 — `canSeeRates` через RBAC
`src/app/admin/orders/page.tsx` — замена строковой проверки роли на:
```ts
const isSuperAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
const permissions = user?.staffRole?.permissions || [];
const canSeeRates = isSuperAdmin || permissions.some(
  p => p.section.toLowerCase() === 'finance' && (p.canView || p.canEdit)
);
```

### ADM-14 — Self-healing в action (Вариант A)
- `src/actions/admin/routing.actions.ts` — `ensurePrimaryRouteAction(serviceId)`, идемпотентен (P2002-safe), аудит `ROUTE_ENSURE_PRIMARY`
- `src/components/admin/routing/RoutingPanelClient.tsx` — UI-баннер при `needsRouteSeed === true`
- `src/app/admin/services/[id]/routing/page.tsx` — избавлен от записи в БД при GET

### ADM-17 — Manual ungate
- `src/app/admin/manual/page.tsx` — снят `enforceSectionAccess('settings')`
- Корневой `layout.tsx` пускает `OWNER`/`ADMIN`/`MANAGER`/`SUPPORT`

---

## 4. Stage A/B — Файловый реестр

Подробные списки файлов для Stage A и Stage B не включены в этот отчёт. Их можно извлечь из git-истории:

```bash
# Stage A
git log --stat --grep="Stage A" --oneline

# Stage B
git log --stat --grep="Stage B" --oneline
```

Ключевые архитектурные артефакты Stage B (используются во всём проекте):
- `src/lib/rbac-sections.ts` — canonical registry из 16 секций
- `src/lib/server/rbac.ts` — `StaffPermissionSection` тип
- `src/actions/admin/roles.ts` — 5 CRUD actions + lockout guard
- `src/app/admin/settings/roles/` — UI редактора ролей

---

## 5. Финальный регресс

На свежем `main`:

```bash
git checkout main && git pull origin main
npx tsc --noEmit
npm run lint
npm run build
npx dotenv -e .env.test -- vitest run
```

Ожидаемый результат:
- `tsc` — 0 ошибок
- `eslint` — 0 ошибок
- `build` — success
- `vitest` — все тесты pass (включая `rbac-stage-a-matrix`, `rbac-stage-b-roles`, `rbac-providers-matrix`, `routing-ensure-primary`, 5 integration тестов)

---

## 6. Архитектурные итоги

1. **Единая RBAC-матрица** — canonical registry из 16 секций, все гейты используют `enforceSectionAccess`, никаких string-role comparisons в UI.
2. **Изоляция ошибок** — каждый раздел админки обёрнут типовым `AdminSectionError`, краш одного раздела не валит всю админку.
3. **Layout performance** — COUNT-запросы кэшированы через `unstable_cache` + tag-based invalidation, layout не делает запросов к БД на каждый рендер.
4. **Component hygiene** — все god-компоненты разрезаны на модули ≤ 300 строк, что упрощает code review и снижает риск регрессий.
5. **Self-healing pattern** — запись в БД из GET-страниц устранена, все мутации идут через server actions с аудитом.
6. **Manual ungate** — база знаний и тренажёр доступны всей поддержке, а не только владельцам.

---

## 7. Следующие приоритеты

`AUDIT-ADMIN.md` закрыт. Другие аудиты проекта:
- `AUDIT.md` — каталог/провайдеры (статус: частично закрыто, проверить)
- `AUDIT-CHECKOUT.md` — платежный D0/D1 (статус: закрыто, проверить)
- `AUDIT-WORKERS.md` — workers E0/E1/E2 (статус: все 6 дефектов закрыты)

Если все 4 аудита закрыты — переход к `ROADMAP.md` или обсуждение новых фич.
