# Аудит OmniSMM: перезагрузка страницы при выборе категорий и соцсетей, а также визуальные и кодовые ошибки

> **Для кого:** AI-агент, который будет исправлять код.
> **Что проверялось:** `origin/main` @ `b627b46`, Next.js `16.3.6` (внутренности сверены по `node_modules/next/dist`), React 19.
> **Дата:** 2026-09-23.
> **Как проверялось:** статический анализ исходников, трассировка клиентского роутера Next.js 16.3.6 и прогон `eslint-plugin-react-hooks@7` поверх кода. Runtime-проверка не проводилась: в песочнице нет Postgres и Redis.
> **Жалоба пользователя:** «страница перезагружается при выборе некоторых категорий или социальных сетей».

---

## 0. TL;DR для агента

Жалобу создают как минимум **три независимых механизма**. Все пути ниже указаны от корня репозитория.

| # | Приоритет | Суть | Файл |
|---|---|---|---|
| A | **P0** | При клике по категории вызывается `window.history.replaceState(null,'','/services/<net>/<cat>')`. Next 16 перехватывает этот вызов и запускает `ACTION_RESTORE` с деревом маршрута `/` на URL `/services/...`. Итог: hard navigation, то есть полная перезагрузка, или рассинхрон `canonicalUrl`. После этого следующие server actions уходят POST-ом на другой роут. | `src/components/landing/order-engine/CategorySidebar.tsx:70-73` |
| B | **P0** | Нарушены Rules of Hooks: ранний `return null` стоит до `useMemo`/`useState`/`useEffect`. Когда список сетей или категорий становится пустым или снова наполняется (фильтр по ссылке, смена сети), React падает с ошибкой «Rendered fewer/more hooks». Error boundary заменяет страницу, и визуально это выглядит как перезагрузка или «Что-то пошло не так». | `CategorySidebar.tsx:46-49`, `NetworkSelector.tsx:15-23,68`, `drawer/DrawerOrderSummary.tsx:23-25`, `MobileCatalogModal.tsx` (проверить), `support/TemplateManagerModal.tsx:99`, `admin/bulk-actions/BulkActionsPanel.tsx:92,114` |
| C | **P0** | DDoS-щит в `src/proxy.ts` считает **RSC-запросы и server actions** в общий пул fingerprint-ов. Fingerprint строится **без IP** (UA + язык + client hints + fetch-dest/mode), поэтому все пользователи «Chrome/Windows/ru» делят одно ведро на 120 запросов в минуту. Когда лимит превышен, RSC-запрос получает JSON 429, и Next делает MPA-навигацию (полную перезагрузку) прямо на PoW-страницу. Server action в той же ситуации падает с ошибкой. | `src/proxy.ts:406-480`, `src/lib/security/ddos-shield/fingerprint.ts` |

Вторичные проблемы, которые усиливают A–C: лишние server actions при каждом нажатии клавиши и каждом `focus`, `MaintenanceGuardian` на каждую смену pathname, прямые `history.pushState/replaceState` в других компонентах, выбор «первой» категории без сортировки, молчаливые `[]` при ошибке каталога. Подробности в разделах 2–4.

**Минимальный фикс, который снимает жалобу:** A1 + B1 + C1 (раздел 5). Его стоит сделать первым и отдельным коммитом.

---

## 1. Как Next.js 16.3.6 превращает клиентские действия в полную перезагрузку

Все пути в этом разделе указаны относительно `node_modules/next/dist/client/components/`. Раздел нужен, чтобы агент понимал, **почему** фиксы должны быть именно такими.

1. **Патч `history.pushState/replaceState`** (`app-router.js` ~248–279). Если в `data` нет `__NA`/`_N`, Next копирует в запись своё внутреннее состояние, то есть **дерево текущего маршрута**, и диспатчит `ACTION_RESTORE` с новым URL (`applyUrlFromHistoryPushReplace`, ~236–247).
2. **`restoreReducer`** (`router-reducer/reducers/restore-reducer.js`) вызывает `startPPRNavigation(currentTree → treeToRestore)`. Если вернулся `task === null`, выполняется `completeHardNavigation(state, restoredUrl, 'replace')`, а это `location.replace(url)`, то есть **полная загрузка документа** (`segment-cache/navigation.js:340`, `app-router.js` ~214–231 `pushRef.mpaNavigation`).
   Если task не null, запускается `spawnDynamicRequests`. Когда сервер возвращает дерево, не совпадающее с клиентским, срабатывает `dispatchRetryDueToTreeMismatch`. Второй mismatch подряд даёт hard refresh (`ppr-navigations.js:861-863, 1076-1080`).
3. **Server Actions** (`router-reducer/reducers/server-action-reducer.js` ~74) делают POST на `state.canonicalUrl`. Если canonicalUrl уже подменён на `/services/<net>/<cat>`, action рендерится в контексте **другой страницы**, у которой свои `notFound()`/`permanentRedirect()` (`src/app/services/[network]/[category]/page.tsx:102-106`). В ответ приходит redirect или 404, клиент выполняет редирект или MPA-навигацию. Если ответ не RSC (`content-type` не `text/x-component`) и в нём нет `x-action-redirect`, клиент бросает ошибку.
4. **RSC-fetch** (`router-reducer/fetch-server-response.js` ~130–181). Если ответ `!isFlightResponse || !res.ok || !res.body`, клиент вызывает `doMpaNavigation(url)`, то есть делает **полную перезагрузку**. Сюда попадают JSON 429 от щита, 401 и 403 от proxy, а также HTML PoW-страница.
5. **`popstate`** (`app-router.js` ~284–293). Если запись истории **не** содержит `__NA`, вызывается `window.location.reload()`. Такие записи появляются после сторонних `pushState` до гидрации или при нестандартном state.
6. **Stale deploy.** Старый action id после деплоя приводит к `UnrecognizedActionError` (`server-action-reducer.js` ~104). Жалобу это не вызывает, но это ещё один путь к «сломанной» странице.

---

## 2. Корневые причины (P0)

### A. `CategorySidebar`: прямой `history.replaceState` на несуществующий в текущем дереве маршрут

**Файл:** `src/components/landing/order-engine/CategorySidebar.tsx:62-74`

```tsx
onClick={(e) => {
  e.preventDefault();
  engine.setSelectedService(null);
  setCategoryId(cat.id);
  if (typeof window !== 'undefined' && cat.slug) {
    const netSlug = engine.activeNetwork?.slug || 'services';
    window.history.replaceState(null, '', `/services/${netSlug}/${cat.slug}`);   // ← БАГ
  }
}}
```

**Что происходит:**
1. Пользователь находится на `/`, где рендерится `SmartLinkLanding` из `src/app/page.tsx`, и кликает по категории.
2. Патченый `replaceState` диспатчит `ACTION_RESTORE`, где URL равен `/services/tg/likes`, а дерево взято от `/`.
3. `restoreReducer` делает `startPPRNavigation`. В зависимости от состояния segment cache возможны два исхода:
   - `null`, и тогда выполняется `completeHardNavigation`: **полная перезагрузка на `/services/tg/likes`**. Сервер отрабатывает `[category]/page.tsx` с `force-dynamic`, запросами к БД и так далее. Отсюда «перезагружается при выборе **некоторых** категорий»: результат зависит от того, есть ли slug в каталоге и от состояния кэша.
   - task, и тогда URL уже `/services/...`, а дерево остаётся от `/`. Это рассинхрон.
4. Следующее действие пользователя (`getServicesByCategoryAction`, `calculatePriceAction`, `analyzeLink`...) — это server action. Он делает POST на `/services/tg/likes`. На сервере отрабатывает page этого маршрута:
   - если slug не найден, срабатывает `notFound()`. Так бывает, когда категорию скрыли, потому что `serviceCount 0` (`src/actions/order/catalog.ts` ~350), когда slug устарел, или когда сработал fallback `netSlug = 'services'`, из-за которого URL становится `/services/services/<cat>`, а это гарантированный 404;
   - если slug неканоничный (`c.slug.endsWith('-'+slug)`), срабатывает `permanentRedirect()`;
   - в обоих случаях получается либо MPA-навигация, либо ошибка action.
5. Кнопка «Назад» после этого ведёт на запись с деревом `/`, но URL `/services/...`. Это ещё один вход в hard navigation.

**Дополнительно:**
- `usePathname()` меняется, поэтому `MaintenanceGuardian` делает лишний `fetch('/api/maintenance-status')` на **каждый** клик по категории (раздел 3.3). Этот запрос идёт в счётчик щита C.
- На странице `/services/<net>/<cat>` компонент тот же, `SmartLinkLanding`, поэтому клик по **другой** категории снова делает `replaceState` на другой `[category]`. Сегмент page меняется, и клиентского кэша для него нет.

**Фикс A1** (обязательно):
- **Удалить** вызов `window.history.replaceState(...)` из `CategorySidebar`.
- Если URL-синхронизация нужна для SEO или шаринга, есть два варианта:
  - (a) на главной `/` не менять pathname. Допускается только query через `router.replace('?cat=<slug>', { scroll: false })`, и то лишь если действительно нужно. `SmartLinkLanding` уже умеет принимать `initialCategoryId`;
  - (b) использовать настоящую навигацию `<Link href="/services/<net>/<cat>" scroll={false}>` или `router.push`, но **только** если пользователь уже на `/services/...`. Также нужно гарантировать, что slug существует в каталоге, где категории с `serviceCount === 0` скрыты. Fallback `'services'` удалить.
- Любые оставшиеся прямые вызовы history в клиенте нужно либо заменить на `useRouter`, либо передавать в них state с сохранением `window.history.state` (см. раздел 3.1).

---

### B. Нарушения Rules of Hooks: условный ранний `return` до хуков

`eslint-plugin-react-hooks@7`, прогнанный поверх `src/`, дал **9 ошибок `rules-of-hooks`**. В `eslint.config.mjs` проекта плагин `react-hooks` **не подключён**, поэтому CI эти ошибки не ловит.

| Файл:строка | Условие раннего return | Хуки после него |
|---|---|---|
| `src/components/landing/order-engine/CategorySidebar.tsx:45-49` | `availableCategories.length === 0` | `useMemo` |
| `src/components/landing/order-engine/NetworkSelector.tsx:15-23, 68` | `catalog.length === 0` | `useMemo`, `useState`, `useEffect`, `useMemo` |
| `src/components/landing/order-engine/drawer/DrawerOrderSummary.tsx:23-25` | `!selectedService` | `React.useMemo` |
| `src/components/support/TemplateManagerModal.tsx:99` | условный | `useState` |
| `src/components/admin/bulk-actions/BulkActionsPanel.tsx:92, 114` | условный | `useCallback`, `useEffect` |
| `src/components/landing/order-engine/MobileCatalogModal.tsx` ~38–98 | эвристика нашла `return null` рядом с хуками | **проверить вручную**: скорее всего `return null` стоит внутри колбэка `useMemo`, и тогда это ложное срабатывание |

**Почему это связано с жалобой:**
- `availableCategories` вычисляется в `useOrderUrlAnalyzer.computeAvailableCategories` (`src/hooks/order-engine/useOrderUrlAnalyzer.ts:137-164`). Функция отбрасывает категории с `serviceCount 0`. Кроме того, когда ссылка введена (`url.trim().length >= 5`) и платформа совпадает, она фильтрует категории по `targetTypes`, `suggestedCategories` и **кэшу услуг** (`categoryServicesCache`). Список может стать пустым при:
  - смене сети на ту, у которой все категории пустые или несовместимые;
  - вводе или изменении ссылки;
  - загрузке услуг категории, после которой кэш заполняется, фильтр пересчитывается и все категории выпадают.
- Когда `availableCategories` переходит из `[]` в `[...]` или обратно, количество хуков в `CategorySidebar` меняется. React 19 бросает ошибку «Rendered more hooks than during the previous render». Ближайший error boundary, `src/app/error.tsx` для `/` или `src/app/services/error.tsx`, **заменяет всю страницу** плашкой «Что-то пошло не так». Пользователь воспринимает это как перезагрузку или падение. Всё состояние заказа при этом теряется.
- `NetworkSelector` ломается так же, если `catalog` меняется с пустого на непустой. Это возможно при восстановлении из sessionStorage или при ошибке `getPublicCatalogAction`, которая вернула `[]`.

**Фикс B1:**
- Во всех перечисленных компонентах перенести **все** хуки выше любых ранних `return`. Проверку пустоты делать после хуков.

  ```tsx
  const sortedCategories = useMemo(() => [...availableCategories].sort(...), [availableCategories]);
  if (availableCategories.length === 0) return null;
  ```
- В `NetworkSelector` блок `if (catalog.length === 0) return null;` перенести ниже последнего `useMemo` (строка 68).
- Подключить `eslint-plugin-react-hooks` в `eslint.config.mjs`: `rules-of-hooks: "error"`, `exhaustive-deps: "warn"`. Добавить `npm run lint` в CI. Сейчас пакета нет в `package.json`, его нужно добавить в devDependencies.

---

### C. DDoS-щит блокирует навигацию и server actions обычных пользователей

**Файлы:** `src/proxy.ts:406-480`, `src/lib/security/ddos-shield/fingerprint.ts`, `src/lib/security/ddos-shield/token-bucket-pool.ts`

**Логика сейчас:**
1. Щит пропускает только `/_next/*`, `/api/webhooks/*`, `/api/storefront/*`, favicon, robots, sitemap и сам challenge. **RSC-запросы** (`GET /services/...` с заголовком `RSC: 1`), **server actions** (`POST /` или `POST /services/...` с `Next-Action`) и `/api/maintenance-status` **считаются**.
2. Если у пользователя нет сессии и нет cookie `gatekeeper`, запрос проверяется двумя способами:
   - `checkClientHintsAnomaly(headers)`;
   - `checkFingerprintPoolLimit(fingerprint, 'smmplan', 120, 60)`. Tenant `'smmplan'` захардкожен даже для flux.
3. При нарушении:
   - document GET получает HTML PoW-страницу со статусом 429;
   - **все остальные запросы**, включая RSC и server actions, получают `NextResponse.json({error}, {status: 429})`.

**Почему это вызывает перезагрузку:**
- RSC-ответ с `content-type: application/json` и статусом 429 означает `!isFlightResponse`, поэтому `fetch-server-response.js` вызывает `doMpaNavigation(url)`. Браузер делает полный GET этого URL, щит отдаёт HTML PoW-страницу, и пользователь видит «перезагрузку» с экраном проверки.
- Server action с ответом JSON 429 заканчивается ошибкой «An unexpected response was received from the server». В колбэках `useOrderCatalogSync` это превращается в пустой список услуг и тост. Если это unhandled rejection внутри `startTransition`, срабатывает error boundary.

**Почему лимит достигается при обычной работе:**
- `computeHeaderFingerprint` = sha256(`UA | primary lang | sec-ch-ua | platform | mobile | sec-fetch-dest | sec-fetch-mode`). **IP не используется.** Все посетители на одной версии Chrome/Windows с языком `ru` попадают в **одно** ведро на 120 запросов в минуту на весь сайт.
- У RSC-запросов и server actions одинаковые `sec-fetch-dest: empty` и `sec-fetch-mode: cors`, поэтому они складываются в одно общее ведро.
- Один пользователь за минуту работы с каталогом делает десятки запросов (раздел 3). Этого хватает, чтобы при нескольких одновременных посетителях щит начал резать всех.

**Ложные срабатывания `checkClientHintsAnomaly`:**
- **Android-планшеты.** UA содержит `android` без `mobile`, Chrome шлёт `sec-ch-ua-mobile: ?0`. Условие `isMobileUa` (`ua.includes('android')`) плюс `?0` помечает запрос как аномалию. **Каждый запрос планшета блокируется.**
- DevTools device emulation и режим «версия для ПК» в мобильных браузерах: UA и hints противоречат друг другу.
- Mac UA с `sec-ch-ua-platform`, отличным от `macOS`/`iOS`: iPadOS в desktop-режиме, некоторые Chromium-форки.
- Для таких клиентов проблема стабильная: при переходе по категории RSC-запрос получает 429 и выполняется MPA reload на PoW-страницу. После решения PoW появляется gatekeeper-cookie, но пока её нет, каждый клик уводит на challenge.

**Фикс C1** (обязательно):
- **Не отдавать JSON 429 на RSC-запросы и server actions без клиентской обработки.** Варианты, от наиболее к наименее предпочтительному:
  1. Лимитировать только **document GET** (`sec-fetch-dest: document` или `accept: text/html` + GET). RSC-запросы (`request.headers.has('rsc')`), prefetch (`next-router-prefetch`) и server actions (`next-action`) из пула исключить. Для них, если нужно, завести **отдельный** лимит с ключом **IP + fingerprint**.
  2. Если всё же блокировать RSC, возвращать ответ, который Next обработает осознанно. Лучше всего, если gatekeeper выдаётся при первом document GET, а RSC и actions без него просто не лимитируются.
- В ключ пула добавить IP: `x-forwarded-for` берётся только от доверенного прокси, `clientIp` уже вычисляется в той же функции. Tenant брать реальный, а не `'smmplan'`.
- `checkClientHintsAnomaly`:
  - Android без `mobile` в UA + `?0` считать нормой;
  - аномалию использовать как **сигнал для скоринга**, а не как мгновенный блок;
  - к RSC и actions аномалию не применять.
- `/api/maintenance-status` исключить из щита, так же как `/api/health`.
- Написать тесты на `proxy`:
  - RSC-запрос при исчерпанном пуле не получает 429;
  - UA Android-планшета не считается аномалией.

---

## 3. Усиливающие факторы (P1)

### 3.1. Прямые вызовы `window.history.*` в обход роутера

Каждый такой вызов проходит через патч Next из раздела 1.1 и диспатчит `ACTION_RESTORE`. Вызов с `{}`/`null` в `data` дополнительно **не содержит** `__NA`, пока Next не скопирует state. Если вызов происходит до гидрации роутера, запись остаётся без `__NA`, и `popstate` на ней вызывает `location.reload()`.

| Файл:строка | Вызов | Риск |
|---|---|---|
| `src/components/landing/order-engine/CategorySidebar.tsx:72` | `replaceState(null,'','/services/..')` | **P0**, см. A |
| `src/components/landing/order-engine/LayoutVariantToggle.tsx:52` | `replaceState({}, '', url?flow=)` | RESTORE при смене flow; меняется только search, дерево то же, поэтому обычно безопасно, но это лишний рендер всего роутера |
| `src/components/landing/order-engine/variants/AdminCheckoutVariantSwitcher.tsx:49` | `replaceState({}, '', url)` | то же |
| `src/components/landing/order-engine/variants/PlanFullscreenCheckout.tsx:65` | `pushState({smmplan_fullscreen_checkout:true}, '', href)` в `useEffect` без cleanup истории | в StrictMode (dev) эффект запускается дважды, и получаются две записи. После закрытия чекаута не крестиком, а иначе, «Назад» ведёт на мусорную запись. Слушатель `popstate` зовёт `onClose`, но Next параллельно делает traverse |
| `src/components/landing/order-engine/wizard-steps/useMobileWizard.ts:78-84` | `pushState/replaceState` с `#step-N` | хэш-навигация; на мобиле «Назад» генерирует `popstate`, на который реагируют и Next, и визард. Защита от desktop есть (`innerWidth >= 768`), но при повороте экрана она обходится |
| `src/hooks/order-engine/order-session-storage.ts:132` | `replaceState({}, '', path + '#step-4')` после auth_resume | вызывается рано, возможно до гидрации app-router, и тогда запись остаётся без `__NA`. Следующий `popstate` на ней вызывает `location.reload()` |

**Фикс:**
- Для search и hash используйте `router.replace(url, { scroll: false })` из `next/navigation`. Next 16 официально поддерживает нативный `history.pushState/replaceState`, **но только если pathname не меняется**, иначе см. A.
- Для модалок и чекаута не используйте pushState с тем же URL. Если нужна поддержка «Назад», добавляйте query-флаг (`?checkout=1`) через `router.push` и закрывайте через `router.back()`.
- `order-session-storage.ts`: выполнять очистку URL в `useEffect` после монтирования через `router.replace`.

### 3.2. Каскад лишних server actions: нагрузка на щит C и мерцание UI

1. **`src/hooks/order-engine/useOrderCatalogSync.ts:99-190`**, эффект загрузки услуг:
   - в deps лежит **выражение** `url.trim().length >= 5`, на которое указывает eslint `exhaustive-deps`. Эффект перезапускается, когда ссылка пересекает порог в 5 символов, и повторно фильтрует или загружает данные. Нужно вынести его в `const isLinkFilled = ...` и добавить в deps;
   - `detectedType` тоже в deps, поэтому каждое изменение анализа ссылки перезапускает эффект. При отсутствии кэша это новый POST;
   - фильтр совместимости `finalSvcs = svcs.filter(...)` **может дать пустой массив**. В `usePlanSlideOrderState.ts:329` и `useSmmplanOrderWizard` есть fallback «если compatible пуст, оставить всё», а здесь его **нет**. Пользователь видит пустую категорию, а через `computeAvailableCategories` и кэш эта категория исчезает из сайдбара, что даёт переход `[] ↔ [...]` и ошибку B;
   - `onResetDrip` мемоизирован (`useOrderDripState.ts:12`, `useCallback`), здесь всё в порядке.
2. **`useOrderCatalogSync.ts:193-225`**, `getFreshServiceAction` на **каждый** `focus` и **каждый** `visibilitychange`, включая переход во `hidden`. Переключение вкладок даёт 2 POST-а. Нужно отфильтровать `document.visibilityState === 'visible'`, добавить throttle (≥ 30 с) и убрать дублирующий `focus`.
3. **`src/components/orders/wizard/useSmmplanOrderWizard.ts`** (дашборд):
   - `:66` `changeStep`, в нём `router.replace(...)` с query. Смена searchParams перезапускает эффекты ниже;
   - `:70-91` restore-эффект, deps: `searchParams`, `selectedNetwork`. Он перезапускается после собственного `router.replace` (петля «шаг → URL → restore»);
   - `:110-134` эффект загрузки услуг, deps: `link`, `searchParams`, `detectedType`. **Каждое нажатие клавиши в поле ссылки** запускает `getServicesByCategoryAction` (POST) без debounce и без проверки актуальности ответа, отсюда гонки;
   - `:44-51` гейтвеи перезапрашиваются на каждую смену `gateway`.
   - Фикс: кэш по `categoryId`, как в `useOrderCatalogSync`; фильтрацию по ссылке делать **на клиенте**, без повторного запроса; debounce на `link`; request-id guard.
4. **`src/components/landing/order-engine/variants/slide/usePlanSlideOrderState.ts:320-345`** `selectCategory`: нет guard-а от гонок, поэтому при быстрых кликах результат старой категории перезаписывает новую. Кэша тоже нет. Нужно добавить request-id.

### 3.3. `MaintenanceGuardian` (`src/components/providers/MaintenanceGuardian.tsx`, обёртка в `src/app/layout.tsx:~299`)

- Делает `fetch('/api/maintenance-status')` при **каждой** смене `pathname`, включая фейковые смены через `replaceState` из A, плюс `setInterval` раз в 60 с. Все эти запросы проходят через щит C.
- Когда maintenance активен, **весь** `children` заменяется на `PreLaunchHoldingScreen`. Состояние заказа теряется, и это визуально неотличимо от перезагрузки.
- `AbortSignal.timeout(5000)` передаётся **вместо** `controller.signal`, поэтому `controller.abort()` в cleanup ничего не отменяет. Нужен `AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])` с fallback.
- Исключения путей дублируют серверную логику `x-pathname`/`MAINTENANCE_MODE` из `proxy.ts` (~633–668). Этот источник правды должен быть единственным.
- Фикс: зависимость только от «первого монтирования + интервал», без `pathname`. Либо вообще опираться на серверный редирект proxy. `/api/maintenance-status` исключить из щита.

### 3.4. Выбор соцсети: `NetworkSelector.handleNetworkSelect` (`NetworkSelector.tsx:40-66`)

- Вызывает `engine.setCategoryId(net.categories[0].id)`, то есть **первую сырую** категорию:
  - без фильтра `serviceCount > 0`, так что она может быть скрыта в сайдбаре. `categoryId` указывает на невидимую категорию, `getServicesByCategoryAction` возвращает `[]`, и пользователь видит пустой экран;
  - без сортировки по `getCategoryDemandScore`, которую использует `CategorySidebar`. Выбрана одна категория, а в сайдбаре первой стоит другая.
- `setNetworkId` в `useOrderCatalogSync` местами вызывает `setCategoryId` **внутри updater-функции** `setNetworkId`. Это side-effect в updater: в StrictMode он выполняется дважды и может вызвать предупреждение «Cannot update a component while rendering».
- Фикс: брать первую категорию из того же массива, который рендерит сайдбар, то есть `computeAvailableCategories(net)` + сортировка. Вынести `getCategoryDemandScore` в общий util. Не вызывать setState внутри updater.

### 3.5. Сервер: каталог молча отдаёт пустые данные

- `src/actions/order/catalog.ts:380` `getServicesByCategoryAction`: `try { ... } catch { console.error; return [] }`. Если Redis или БД недоступны, либо `unstable_cache` упал, клиент получает пустую категорию, неотличимую от «нет услуг». Нужно возвращать `{ success:false, error }` или бросать ошибку, чтобы клиент показал ретрай, как в `useOrderCatalogSync` `toast.error`.
- `catalog.ts` ~350: категории с `serviceCount 0` скрываются. Но страница `/services/<net>/<cat>` делает `notFound()`, если категории нет. Поэтому ссылки из sitemap, SEO-хабов и `replaceState` (A) на временно пустые категории дают 404 и hard navigation. Нужно либо отдавать страницу с «услуги временно недоступны», либо исключить такие категории из sitemap и перелинковки.
- Кэш `unstable_cache` обновляется раз в 60 с, при этом `serviceCount` в каталоге и реальные услуги могут расходиться до 60 с. Это ещё один источник «пустых» категорий, а значит и перехода `[] ↔ [...]` (B).

### 3.6. `proxy.ts`: прочие пути к перезагрузке

- `:26-42` legacy 301 (`/boost` → `/services/telegram/busty` и другие). Корректно, но RSC-запрос на legacy-путь получает 301 на другой pathname, и Next обрабатывает это как mismatch/MPA.
- `:684` Обработка `rsc`/`next-action` (401 JSON) есть **только** для `/admin`, `/dashboard`, `/operator`. Для щита (C) и host-проверок (403 JSON, ~395–404, ~602–609) такой обработки нет, поэтому любой такой ответ на RSC превращается в MPA reload.
- Строгая проверка host для контура (`TRUSTED_CONTOUR_MAP`, ~602) при неправильном `x-forwarded-host` за CDN или туннелем даёт 403 на **каждый** запрос. Нужно проверить конфиг продакшн-прокси.

---

## 4. Визуальные и прочие баги (P2–P3)

| # | Файл:строка | Проблема | Фикс |
|---|---|---|---|
| V1 | `src/components/landing/SmartLinkLanding.tsx:83` | `dark:emerald-500/5`: пропущен префикс утилиты, Tailwind класс не генерирует, в тёмной теме блоб остаётся `bg-emerald-500/10` | `dark:bg-emerald-500/5` |
| V2 | `src/components/landing/order-engine/CategorySidebar.tsx:77` | `ring-slate-100` на активной категории в тёмной теме даёт светлое кольцо на тёмном фоне. Остальная тема на HeroUI-токенах (`bg-content1`) | `ring-divider` или `ring-border`, либо `dark:ring-white/10` |
| V3 | `CategorySidebar.tsx:77` | `scale-[1.02]` на активной кнопке внутри `lg:overflow` контейнера на границе обрезается и сдвигает соседей (layout shift при клике) | заменить на `shadow`/`ring` без scale, либо добавить отступ контейнеру |
| V4 | `src/components/landing/LandingCatalogContent.tsx:121-124` | Когда `NetworkSelector`/`CategorySidebar` возвращают `null` (после фикса B), сайдбар исчезает, и `lg:w-[280px]` колонка схлопывается, контент прыгает | рендерить skeleton или плейсхолдер вместо `null` |
| V5 | `LandingCatalogContent.tsx` ~130 | `services.length === 0 && isLoading` показывает skeleton, а при `services.length === 0 && !isLoading` пустое состояние. Если ошибка сервера возвращает `[]` (3.5), показывается «нет услуг» вместо «ошибка, повторить» | разделять error/empty состояния |
| V6 | `PlanFullscreenCheckout.tsx:67-72` | `window.scrollTo(smooth)` при монтировании + pushState из 3.1: на desktop прыжок страницы | убрать или сделать scroll только при необходимости |
| V7 | `useMobileWizard.ts` | хэши `#step-N` при desktop-guard, срабатывающем только при монтировании: поворот планшета или ресайз окна приводит к автоскроллу к якорю | проверять ширину на каждый переход или не использовать хэши |

**Остальные предупреждения `exhaustive-deps`** в пользовательской части (проверить вручную, это потенциальные stale closures):
- `InlineCheckoutForm.tsx:72`
- `PaymentGatewaySelectionModal.tsx:54`
- `PlatformLinkGuideDrawer.tsx:44`
- `ServiceGrid.tsx:172`
- `StickyCheckoutTriggerBar.tsx:55`
- `drawer/CheckoutDrawer.tsx:89`
- `useCheckoutOrchestrator.ts:34`
- `PlanFullscreenCheckout.tsx:100`
- `usePlanSlideOrderState.ts:369`
- `useMobileWizard.ts:139`
- `useOrderPricingEngine.ts:62`
- `useOrderUrlAnalyzer.ts:134`
- `use-user-balance.ts:48`
- `dashboard/flux/hooks/useFluxDashboardWizardState.ts:336`

**Инфраструктура:**
- `next.config.mjs`: `typescript.ignoreBuildErrors: true`, поэтому ошибки типов попадают в прод, если CI пропущен.
- `eslint.config.mjs`: нет `react-hooks` и `@next/next`. Плагин `@next/next` там **заглушка** с пустым правилом.
- `serverActions.allowedOrigins` содержит туннельные wildcard-ы вне прод-контура. Это вопрос безопасности, к жалобе он не относится.

**Проверено, проблем нет:**
- `OrderFilters.tsx:146`: `e.preventDefault()` на месте.
- `PreLaunchHoldingScreen.tsx:193`, `PlanFullscreenCheckout.tsx:156`, модалки auth и `EmailPromptModal` используют `onSubmit`.
- `StepCheckoutParams.tsx:69` `<form action={props.formAction}>`: это React 19 form action. При гидрации нативный submit не выполняется, но **до гидрации** (медленная сеть) Enter в поле отправит нативный POST на текущий URL, и страница перезагрузится. Риск низкий; можно добавить `onSubmit={e => !hydrated && e.preventDefault()}`.
- `error.tsx`, `global-error.tsx`, `services/error.tsx` в порядке, `reload()` не вызывают.

---

## 5. План исправлений для агента (по порядку)

> Правило репозитория (`.agents/AGENTS.md` §3.5): перед правкой картировать радиус поражения. Для каждого пункта ниже он уже указан.

### Шаг 1: A1 (CategorySidebar)
1. Удалить блок `if (typeof window !== 'undefined' && cat.slug) { ... replaceState ... }` в `CategorySidebar.tsx:70-73`.
2. Если продукт требует URL категории: на `/services/...` использовать `router.replace('/services/<net>/<cat>', { scroll: false })` **только** для slug из текущего `availableCategories`, а на `/` ничего не менять.
3. Радиус поражения: `LandingCatalogContent` (desktop), страницы `/` и `/services/[network]/[category]`.

### Шаг 2: B1 (Rules of Hooks)
1. `CategorySidebar.tsx`: `useMemo` поставить выше `if (availableCategories.length === 0) return null`.
2. `NetworkSelector.tsx`: `if (catalog.length === 0) return null` перенести после последнего хука (после `useMemo` на ~строке 68, до JSX).
3. `drawer/DrawerOrderSummary.tsx`: `useMemo` поставить выше `if (!selectedService) return null`, внутри мемо обработать null.
4. `support/TemplateManagerModal.tsx:99` и `admin/bulk-actions/BulkActionsPanel.tsx:92,114`: то же самое.
5. Вручную проверить `MobileCatalogModal.tsx`.
6. Добавить `eslint-plugin-react-hooks` в devDependencies и `eslint.config.mjs`:

   ```js
   import reactHooks from "eslint-plugin-react-hooks";
   // ...
   { plugins: { "react-hooks": reactHooks },
     rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" } }
   ```

### Шаг 3: C1 (DDoS-щит)
1. `src/proxy.ts` ~446: перед лимитом добавить проверку

   ```ts
   const isRscOrAction = request.headers.has('rsc') || request.headers.has('next-action') || request.headers.has('next-router-prefetch');
   const isDocument = request.method === 'GET' && (request.headers.get('sec-fetch-dest') === 'document' || (request.headers.get('accept') || '').includes('text/html'));
   ```

   Пул и аномалию применять **только если `isDocument`**. Для `isRscOrAction` использовать отдельный, более мягкий лимит с ключом `ip + fingerprint`. При его превышении отвечать `503` с HTML только для document; для RSC пропускать или отдавать ошибку, которую клиент покажет тостом.
2. `fingerprint.ts`: добавить IP (или его /24 подсеть) в `computeHeaderFingerprint`, либо собирать ключ пула в proxy как `${clientIp}:${fingerprint}`.
3. `checkClientHintsAnomaly`: Android без `mobile` в UA + `?0` — не аномалия (планшеты).
4. `checkFingerprintPoolLimit(fingerprint, finalTenantId, ...)` вместо `'smmplan'`. Tenant вычисляется ниже по коду, поэтому блок нужно переставить или вычислять tenant раньше.
5. Исключить `/api/maintenance-status` и `/api/health` из щита.
6. Тесты в `src/lib/security/ddos-shield/__tests__` или `test/`: RSC и action при исчерпанном пуле; UA Android-планшета.

### Шаг 4: P1 (раздел 3)
1. `useOrderCatalogSync.ts`:
   - вынести `isLinkFilled` в переменную;
   - добавить fallback «если после фильтра пусто, показать всё с предупреждением совместимости», как в slide-варианте;
   - в `focus`/`visibilitychange` добавить проверку `visibilityState === 'visible'` и throttle;
   - убрать `setCategoryId` из updater.
2. `NetworkSelector.handleNetworkSelect`: первая категория берётся из `computeAvailableCategories(net)` + сортировки по спросу. Вынести `getCategoryDemandScore` в `src/lib/catalog/category-demand.ts`.
3. `useSmmplanOrderWizard.ts`: кэш услуг по категории, debounce на `link`, request-id guard, разорвать петлю `router.replace` ↔ restore-эффект.
4. `usePlanSlideOrderState.selectCategory`: request-id guard и кэш.
5. `MaintenanceGuardian`: убрать `pathname` из deps, правильно объединить signal-ы.
6. Прямые `history.*` из таблицы 3.1 заменить на `router.replace`/`router.push` или хотя бы вызывать их после гидрации с сохранением `window.history.state`.
7. `getServicesByCategoryAction`: различать ошибку и пустой результат.

### Шаг 5: визуальные баги (раздел 4, V1–V7)

---

## 6. Как воспроизвести (для проверки до и после)

1. `npm run dev`. Нужны БД и Redis, иначе каталог будет пустым и щит перейдёт в fail-open.
2. **A:** открыть `/` на desktop (≥ 1024 px), DevTools → Network → включить «Preserve log», кликнуть по категории в левом сайдбаре.
   - До фикса: адресная строка меняется на `/services/<net>/<cat>`. У части категорий в Network появляется запрос с `Type: document`, то есть полная загрузка. Следующий server action делает POST на `/services/...`, а не на `/`.
   - Особенно заметно на категории, slug которой не совпадает с каноническим, и при `activeNetwork == null` (URL `/services/services/...` → 404).
3. **B:** на `/` ввести ссылку, например `https://t.me/durov`, затем сменить сеть на ту, где после фильтра не остаётся категорий, или стереть ссылку. В консоли появится «Rendered fewer hooks than expected», на экране error boundary.
4. **C:** в `.env` временно поставить лимит 5 вместо 120 или отправить 121 запрос с одинаковым UA через `curl` с `-H 'RSC: 1'`. Затем кликнуть по ссылке каталога в браузере с тем же UA: появится полная перезагрузка на PoW-страницу. Второй вариант: DevTools → Device toolbar → «Galaxy Tab» или любой Android-планшет, перейти по категории, получить PoW.
5. Проверить `curl -I -H 'RSC: 1' -H 'User-Agent: Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 Chrome/128 Safari/537.36' -H 'sec-ch-ua-mobile: ?0' -H 'sec-ch-ua-platform: "Android"' http://localhost:3000/`. До фикса ответ `429 application/json`.

---

## 7. Чек-лист приёмки

- [ ] `grep -rn "history\.\(push\|replace\)State" src --include=*.tsx --include=*.ts` не находит вызовов, которые меняют **pathname**.
- [ ] `npx eslint src --rule '{"react-hooks/rules-of-hooks":"error"}'` (с подключённым плагином) даёт 0 ошибок.
- [ ] `npx tsc --noEmit` зелёный. Предварительно выполнить `npx prisma generate`, иначе сотни ложных ошибок `@prisma/client`.
- [ ] `npm test`: тесты proxy и щита (RSC и action не получают 429 от пула, Android-планшет не аномалия) зелёные.
- [ ] Вручную, desktop: 20 кликов подряд по разным категориям и 10 смен соцсети на `/` и на `/services/<net>/<cat>`. В Network **ни одного** запроса типа `document`, URL на `/` не меняется (или меняется только query), в консоли нет ошибок React.
- [ ] Вручную, mobile и планшет (эмуляция Android tablet): выбор сети, категории, услуги, «Назад» — без перезагрузок и без PoW-экрана.
- [ ] Ввод ссылки посимвольно: не больше одного `getServicesByCategoryAction` на категорию (кэш), нет POST на каждое нажатие клавиши.
- [ ] Переключение вкладки браузера: не больше одного `getFreshServiceAction` за 30 с.
- [ ] Тёмная тема: блоб в hero светится изумрудным с меньшей прозрачностью (V1), у активной категории нет светлого кольца (V2).
- [ ] Нагрузочный тест: 3–5 параллельных «пользователей» с одинаковым UA 2 минуты кликают по каталогу, PoW не появляется.

---

## 8. Ограничения аудита

- Runtime-воспроизведение не выполнялось: в песочнице нет Postgres, Redis и движков Prisma. Выводы сделаны по коду приложения и исходникам Next 16.3.6 из `node_modules`.
- Какой из путей A-hard / A-mismatch / C срабатывает у конкретного пользователя, зависит от состояния segment cache, трафика и UA. Чинить нужно **все три**.
- PR #1 (`arena/01a0cf02-omnismm`) этих проблем не затрагивает. Его изменения ортогональны и конфликтов с `main` не имеют.
