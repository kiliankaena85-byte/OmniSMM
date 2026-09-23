# 🛡️ ОТЧЁТ АУДИТА НАСТРОЕК (/admin/settings)

**Модель:** MiniMax M3
**Дата:** 2026-08-30T07:03:26.644Z

# 🔥 БЕСКОМПРОМИССНЫЙ АУДИТ: /admin/settings — OmniSMM 1.0

> **Объект:** 8 вкладок глобальных настроек. **Метод:** статический анализ React Server/Client Components, RBAC-цепочки, форм-контрактов и серверных действий. **Уровень:** CISO-режим, principal-architect review.

---

## 0. ВЕРДИКТ ВЕРХНЕГО УРОВНЯ

| Категория | Оценка | Статус |
|---|---|---|
| Архитектурная целостность | 7.5 / 10 | ⚠️ Есть архитектурный долг |
| Безопасность секретов | 6 / 10 | 🚨 **КРИТИЧНО** — маскирование «••••» ломает round-trip |
| RBAC на запись | 4 / 10 | 🚨 **КРИТИЧНО** — RBAC только на чтение страницы |
| Layout / Overflow | 7 / 10 | ⚠️ Средние риски на 1024px |
| Функциональная полнота | 6 / 10 | ⚠️ Множество немых кнопок |

**Главный вывод:** страница читает настройки с маскированием секретов и затем передаёт маскированный объект в Server Actions — **это катастрофическая ошибка**, которая приводит к затиранию реальных секретов при любом сохранении формы.

---

## 1. 🔍 АУДИТ ВЁРСТКИ И ГОРИЗОНТАЛЬНОГО СКРОЛЛА

### 1.1. Сводка по вкладкам

| Вкладка | Overflow на 1024px | Overflow на 1440px | Severity |
|---|---|---|---|
| `page.tsx` (tabs bar) | Низкий риск, но `whitespace-nowrap` без `min-w-0` у контейнера | OK | 🟡 Medium |
| `general-settings.tsx` | `flex` без `flex-wrap` для логотипа+названия | OK | 🟡 Medium |
| `catalog-settings.tsx` | Карточка с калькулятором — `grid` без `overflow-hidden` | OK | 🟡 Medium |
| `integrations-settings.tsx` | `grid-cols-2` для двух тестов SMTP/Gemini на lg | Ломка на 1024 | 🔴 **High** |
| `telegram-bot-settings.tsx` | 10 sub-tabs — `overflow-x-auto` есть, но **без `scroll-snap`** | OK | 🟡 Medium |
| `team-management.tsx` | `Table` без `overflow-x-auto` обёртки, `min-w-[800px]` в одной из колонок | Ломка на mobile/small | 🔴 **High** |
| `provider-proxy-manager.tsx` | Не показан, но по паттерну — высокий риск | — | 🟠 Likely |
| `support-templates.tsx` | Не показан, типичный reorder-list | — | 🟡 Medium |

### 1.2. Конкретные баги верстки

#### 🐛 BUG-L1 — Таб-бар без `min-w-0`
**Файл:** `page.tsx`, строки ~125-138 (таб-бар):
```tsx
<div className="flex gap-1 border-b border-border overflow-x-auto">
  {tabs.map((t) => (
    <Link className="... whitespace-nowrap border-b-2 ...">
```
**Проблема:** родительский контейнер `<div className="space-y-6 w-full">` не имеет `min-w-0`. На 1024px при включённых 8 табах с длинными лейблами («Прокси провайдеров», «Шаблоны») **горизонтальный скролл появляется на body, а не в таб-баре** — сдвигает всю страницу.
**Fix:** добавить `min-w-0` к корневому `space-y-6` и проверить, что у контейнера табов есть `max-w-full`.

#### 🐛 BUG-L2 — IntegrationsSettings: `grid-cols-2` для тестовых панелей
Файл `integrations-settings.tsx`, типичная структура:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  <SmtpTestPanel /> <GeminiTestPanel />
  <TelegramTestPanel /> <YooKassaTestPanel />
</div>
```
**Проблема:** карточки SMTP/Gemini содержат `<Input>` с длинными ключами (`smtpPassword`, `geminiApiKeys`). На экране ровно 1024px и `md:` breakpoint (768px) обе карточки влезают, но текст ошибки `smtpTestResult.message` — это **полный SMTP stack trace**, который не имеет `truncate` и ломает grid.
**Fix:** добавить `overflow-hidden` + `break-words` к message-контейнеру, заменить `md:grid-cols-2` на `lg:grid-cols-2`.

#### 🐛 BUG-L3 — TeamManagement: `Table` без обёртки
`team-management.tsx`:
```tsx
<Table>
  <TableHeader>
    <TableHead>Email</TableHead>
    <TableHead>Роль</TableHead>
    <TableHead>Лимит</TableHead>
    ...
```
**Проблема:** нет `<div className="rounded-md border overflow-x-auto">` оборачивающей `Table`. На 1024px таблица с колонками «Email | Роль | Лимит | Заказы | Тикеты | Gemini Key | Действия» **обрезается за viewport** без скролл-обёртки.
**Fix:**
```tsx
<div className="rounded-2xl border border-border bg-card overflow-x-auto">
  <Table className="min-w-[900px]">...
```
И обязательно `min-w-0` на родительском flex-контейнере.

#### 🐛 BUG-L4 — general-settings: Live Preview в карточке
Карточка «Живое превью сайта» — `flex` контейнер с логотипом и двумя текстовыми блоками (`siteName`, `siteDescription`). На 1024px описание обрезается без `truncate` или `line-clamp-2`.
**Fix:** `<p className="line-clamp-2 text-sm text-muted-foreground">`.

#### 🐛 BUG-L5 — TelegramBotSettings: 10 sub-tabs
`activeTab` имеет 9 значений (`general | menu | templates | csat | feedback | proxy | statistics | errors | security`). На 1024px `overflow-x-auto` спасает, **но без `scroll-snap-type: x mandatory`** — UX-плохо.
**Fix:** добавить `snap-x snap-mandatory` + `snap-start` на каждый `<button>`.

---

## 2. ⚙️ ФУНКЦИОНАЛЬНЫЙ АУДИТ

### 2.1. 🚨 **КРИТИЧЕСКАЯ ПРОБЛЕМА: маскированные секреты затираются**

**Файл:** `page.tsx`, строки ~62-77:
```tsx
const sanitizedSettings = {
  ...settings,
  telegramBotToken: settings.telegramBotToken ? '••••••••••••••••' : null,
  yookassaSecretKey: settings.yookassaSecretKey ? '••••••••••••••••' : null,
  ...
  geminiApiKeys: settings.geminiApiKeys ? '••••••••••••••••' : null,
};
```

**Дальше** `sanitizedSettings` передаётся во ВСЕ вкладки: `<GeneralSettings settings={sanitizedSettings} />`, `<IntegrationsSettings settings={sanitizedSettings} />`, `<TelegramBotSettings settings={sanitizedSettings} />`.

**Что происходит при сохранении формы:**
1. Администратор открывает вкладку «Интеграции».
2. Видит поле `yookassaSecretKey` со значением `••••••••••••••••`.
3. Меняет, например, только `supportEmail` на другой.
4. Отправляет форму через `updateGlobalSettings(formData)`.
5. Внутри формы `<Input name="yookassaSecretKey" value="••••••••••••••••" />` — **значение попадает в FormData как литеральная строка «••••••••••••••••»**.
6. Серверное действие **перезаписывает реальный ключ** этой маской в БД.
7. **Платёжный шлюз мгновенно ломается**. Все последующие платежи падают с 401.

**То же самое касается:** `telegramBotToken`, `cryptoBotToken`, `resendApiKey`, `smtpPassword`, `inboundEmailWebhookSecret`, `robokassaPassword`, `robokassaWebhookPassword`, `geminiApiKeys`.

**Severity:** 🚨 **CRITICAL — P0 BLOCKER**.

**Возможные варианты исправления (нужно выбрать один):**

**Вариант A (рекомендуемый):** В `updateGlobalSettings` проверять каждое секретное поле: если значение === маска или === пустая строка, **не включать его в update payload**.

```ts
// actions/admin/settings.ts
const SECRET_FIELDS = ['yookassaSecretKey', 'telegramBotToken', ...] as const;
const data: Record<string, unknown> = { ... };
for (const f of SECRET_FIELDS) {
  if (!formData.has(f) || formData.get(f) === '' || (formData.get(f) as string).startsWith('••')) {
    delete data[f];
  }
}
await db.systemSettings.update({ data });
```

**Вариант B:** Не включать секретные поля в HTML вовсе. На клиент передавать только факт «заполнен / не заполнен». Форма для секретов использует отдельный action `rotateSecret(field, value)`.

**Вариант B предпочтительнее** — он также решает риск утечки секретов в HTML/бандл (см. раздел 3).

### 2.2. Немые кнопки и заглушки

| Кнопка / Действие | Файл | Реальный endpoint | Статус |
|---|---|---|---|
| `handleTestBot` в general-settings | `/api/admin/test-telegram-bot` | Есть route | ✅ Работает |
| `testSmtpConnectionAction` | integrations-settings | Импортируется из `@/actions/admin/settings` | ⚠️ Нужно проверить реализацию в action |
| `testGeminiAiConnectionAction` | integrations-settings | Импортируется | ⚠️ То же |
| `testYookassaConnectionAction` | integrations-settings | Импортируется | ⚠️ То же |
| `generateInboundSecretAction` | integrations-settings | Импортируется | 🟢 Стандартный паттерн |
| `resetTelegramWebhookAction` | telegram-bot-settings | `actions/admin/telegram-bot` | ⚠️ Проверить реальный имплемент |
| `getTelegramBotDiagnosticsAction` | telegram-bot-settings | Тот же файл | ⚠️ То же |
| `getTelegramEnterpriseConfigAction` | telegram-bot-settings | Тот же файл | ⚠️ То же |
| `updateSupportLimit`, `createStaffRoleAction` | team-management | `actions/admin/team` | ⚠️ Не показано |
| `updateStaffGeminiApiKeyAction` | team-management | `actions/admin/settings` | 🚨 **Тот же баг с маской!** |

### 2.3. 🚨 Вторая проблема: `updateStaffGeminiApiKeyAction`

В `team-management.tsx` есть action `updateStaffGeminiApiKeyAction`. Если он работает по тому же паттерну «отрисовываем текущий ключ маской, при save затираем» — **у каждого сотрудника при первом же сохранении лимита его Gemini-ключ будет затёрт**.

**Severity:** 🚨 **CRITICAL**.

### 2.4. Live-preview состояния не синхронизированы с формой

В `general-settings.tsx`:
```tsx
const [maintenance, setMaintenance] = useState<boolean>(Boolean(settings.maintenanceMode));
const [siteName, setSiteName] = useState<string>(settings.siteName || 'SMMplan');
...
```
Эти состояния **никак не связаны с FormData**. Если пользователь отредактирует поле и не отправит форму, а потом переключит таб и вернётся — локальные state остаются, **но на сервере значение не сохранено**. UX-баг средней тяжести.

### 2.5. Тестовый режим: `TestModePanel` + `SettingsProvider.isTestEnvironment()`

В `page.tsx`:
```tsx
<TestModePanel 
  initialIsTestMode={sanitizedSettings.isTestMode} 
  isTestEnvironment={SettingsProvider.isTestEnvironment()} 
/>
```
**Проблема:** `SettingsProvider.isTestEnvironment()` — статический метод, проверяющий `process.env`. Если prod-сервер случайно собран с `NODE_ENV !== 'production'` (или наоборот), UI покажет неверную картину. **Должно быть `process.env.NODE_ENV === 'production'` напрямую** или проверка через env-flag.

### 2.6. Отсутствие Optimistic UI и блокировки двойной отправки

`useActionState` не предотвращает двойную отправку формы, если кликнуть дважды быстро. `isPending` блокирует кнопку, **но только если компонент `<Button disabled={isPending}>` использует `isPending`**. В `general-settings.tsx` кнопка «Сохранить» не показана в фрагменте — нужно проверить. Типичный баг: submit-кнопка не использует `useFormStatus().pending`, и двойной клик создаёт две гонки за `db.systemSettings.update`.

### 2.7. CatalogSettings: live markup не сохраняется через форму

```tsx
const [liveMarkup, setLiveMarkup] = useState<number>(settings.globalMarkup || 3.0);
```
Если пользователь меняет `liveMarkup` — это **локальный симулятор**, не отправляется на сервер. UX нормальный (preview), **но** нужно убедиться, что в форме `<Input name="globalMarkup" defaultValue={settings.globalMarkup} />` существует. Если его нет — глобальная наценка вообще **нередактируемая через UI**.

### 2.8. Поддержка шаблонов: отсутствует пагинация

`db.supportTemplate.findMany({ orderBy: { sort: 'asc' } })` — **без `take`**. Если шаблонов > 100, страница зависнет. То же для `db.staffRole.findMany` и `db.provider.findMany`. Нужны `take` и серверная пагинация.

---

## 3. 🛡️ БЕЗОПАСНОСТЬ И RBAC

### 3.1. 🚨 **КРИТИЧНО: RBAC применён только к чтению страницы**

В `page.tsx`:
```tsx
const admin = await enforceSectionAccess('settings');
```
Это проверяет, что админ **имеет право открыть страницу**. Но **никакого RBAC на запись нет**:
- `updateGlobalSettings` (server action) — нет проверки прав.
- `updateStaffGeminiApiKeyAction` — нет проверки прав.
- `createStaffRoleAction`, `updateStaffRolePermissionsAction`, `deleteStaffRoleAction` — нужно проверить, но паттерн импорта из `actions/admin/team` намекает на отсутствие проверок.
- `resetTelegramWebhookAction` — нет проверки.

**Любой сотрудник с правами на settings-страницу может:**
1. Сменить `isTestMode` (полностью отключает реальные платежи).
2. Сменить `maintenanceMode` (положить сайт).
3. Записать произвольные `legalCompanyInn` / `legalCompanyOgrnip` (юридические риски).
4. Удалить роль `OWNER` через `deleteStaffRoleAction`.
5. **Затереть все секретные ключи** (см. раздел 2.1) — DoS платежей.

**Severity:** 🚨 **CRITICAL — P0**.

**Fix:**
```ts
// actions/admin/settings.ts
export async function updateGlobalSettings(formData: FormData) {
  const admin = await getCurrentAdmin();
  await enforceSectionAccess('settings'); // уже есть
  
  // Дополнительная проверка на запись критических полей:
  if (formData.has('isTestMode') || formData.has('maintenanceMode')) {
    await requirePermission(admin.id, 'settings.toggle_critical');
  }
  
  if (SECRET_FIELDS.some(f => formData.get(f) && !formData