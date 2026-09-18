# ZERO-DEFECT PROTOCOL

Этот файл дополняет правила из корневого `AGENTS.md` и является обязательным к исполнению для всех AI-ассистентов в рамках данного воркспейса.

## 1. RAG-First & Knowledge Integration
- **ОБЯЗАТЕЛЬНО** перед началом любой задачи, планирования или написания кода выполнить поиск по внешней векторной памяти (Docker GraphRAG на порту 8100) с помощью запроса:
  `POST http://localhost:8100/api/search`
  Параметры: `{"query": "<контекст задачи>", "collections": ["architecture_decisions", "business_rules", "coding_conventions"], "top_k": 5}`.
  Или через локальный CLI-скрипт (если доступен): `npx tsx scripts/query-rag.ts "<запрос>"`.
- **ЗАПРЕЩЕНО** писать код "по памяти", не сверившись с актуальной базой знаний и архитектурными решениями.
- **ОБЯЗАТЕЛЬНО** после реализации важных фич или при смене архитектуры отправлять отчет в память:
  `POST http://localhost:8100/api/decision` или `POST http://localhost:8100/api/knowledge`.

## 2. No-Crutch Policy (Анти-Костыли)
- **ЗАПРЕЩЕНО** использовать заглушки `// TODO`, `any` без веского комментария-обоснования, `@ts-ignore` или `eslint-disable` без предварительного разбора проблемы.
- **ЗАПРЕЩЕНО** использовать inline-стили для цветов и отступов (`text-white`, `bg-black`, `border-[1px]`). Используйте строго семантические токены из `src/app/globals.css`.
- Все создаваемые файлы должны проходить жесткий аудит на читаемость и лаконичность (файлы до 150-200 строк с декомпозицией на субкомпоненты).

## 2.5. 🛑 ZERO-DEFECT BLUE-GREEN STAGE & DEPLOYMENT GATE (CRITICAL RULE — BGS-2026)
- **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** напрямую пересобирать или перезапускать рабочий боевой Docker-контейнер (In-Place Production Rebuild).
- **Любое изменение обязано проходить 5-шаговый пайплайн безопасного релиза:**
  1. **Изоляция в Stage-контуре (Порт 3005):** Боевой контейнер (`:3000`) не затрагивается; кандидат собирается/запускается на порту `3005` (`smmplan_stage`).
  2. **Автоматический визуальный аудит в браузере (Puppeteer MCP):** Авторизация под ролями (`USER`, `SUPPORT`, `OWNER`), снятие скриншотов измененных экранов, проверка DOM и верстки.
  3. **Отчет для человека с визуальными доказательствами (Human Approval Gate):** Подробное описание изменений, скриншоты, отсутствие утечек секретов, 100% прохождение тестов OWASP Top 10.
  4. **Прямое подтверждение пользователя:** Запрещено переключать боевой трафик до явного сообщения пользователя («Одобряю», «Выкатывай»).
  5. **Мгновенное переключение & Резервный откат (5s Instant Rollback):** Переключение на проверенную версию с сохранением предыдущего контейнера как `smmplan_backup`.

## 3. 📐 Mandatory SDD-TDD Protocol (Docs First → Tests Second → Code Last)
- **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** писать продуктовый код без предварительно созданной спецификации в `docs/specs/` и написанных падающих тестов (Red Phase).
- **Трехуровневая классификация рисков (Risk-Tiering):**
  1. **Tier 1: Critical (Деньги, Заказы, Баланс, Миграции БД, Очереди BullMQ, Безопасность):**
     * Полный цикл: Спецификация `docs/specs/SPEC-*.md` $\to$ Согласование пользователем $\to$ Написание тестов в `src/__tests__/` (Red Phase — тесты обязаны упасть) $\to$ Написание минимального кода (Green Phase) $\to$ `tsc --noEmit` & аудит секретов.
  2. **Tier 2: Standard (Новые экраны админки, Server Actions, API роуты, сложные формы):**
     * Light-SDD: Спецификация контрактов и DTO в `docs/specs/` $\to$ Согласование $\to$ Тесты контракта $\to$ Реализация.
  3. **Tier 3: Cosmetic (Стили Tailwind, тексты, замена иконок):**
     * Прямая реализация с последующим визуальным аудитом в браузере (Puppeteer/Headless Chrome) без избыточного оверхеда.
- **Критерий завершения:** Все тесты переведены в **PASS (GREEN)**, сборка типов `npx tsc --noEmit` (0 ошибок), полный прогон сьюта `npx vitest run`.

## 3.5. 🛡️ ZERO-REGRESSION & IMPACT RADIUS (ПРАВИЛО ПРЕДОТВРАЩЕНИЯ РЕГРЕССИЙ «НЕ НАВРЕДИ»)
- **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** править изолированный модуль без картирования радиуса поражения (Impact Radius) и мозгового штурма на 3 шага вперед.
- Перед правкой агент ОБЯЗАН:
  1. Выполнить поиск всех зависимостей (`grep_search`) и обеспечить 100% обратную совместимость.
  2. Смоделировать отказ на 3 шага вперёд (как изменение затронет авторизацию, биллинг, кэш, вебхуки, мобильный визард, заказы).
  3. Прогнать ПОЛНЫЙ регрессионный сьют (`npx vitest run -c vitest.unit.config.ts`, `npx tsc --noEmit`, `npx tsx scripts/smoke-live-container.ts`). Запрещено отчитываться об успехе только по одному точечному файлу.

## 3.6. 🚀 MANDATORY PRODUCTION HARDENING GATE (PROD-SEC-2026 — CRITICAL GATE)
- **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** производить финальную выкатку платформы в продакшн без выполнения и верификации 3 обязательных задач безопасности из бэклога:
  1. **[SEC-001] Redis Authentication & Encryption (Hardening):** В боевом окружении `REDIS_URL` обязан использовать защищенный протокол с авторизацией (`rediss://...` или `redis://:<STRONG_PASSWORD>@...`), устраняя ворнинг `Redis is running in production without explicit authentication`.
  2. **[SEC-002] Content-Security-Policy (Strict-Dynamic Migration):** Провести зачистку `'unsafe-inline'` и `'unsafe-eval'` из директивы `script-src` в `src/proxy.ts`, обеспечив полную совместимость клиентских компонентов с криптографическим Nonce.
  3. **[SEC-003] Production Direct SMTP Verification:** Проверить прямую доставку почты по порту 465 без локальных прокси/TUN-адаптеров (`test-connection` к SMTP Яндекса/Mail.ru на целевом хосте), подтвердив успешную отправку Magic Link реальному пользователю.

## 3.7. 🛑 MANDATORY FULLSTACK ANALYST & HUMAN APPROVAL PROTOCOL (CRITICAL RULE — FA-2026)
- **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** вносить ЛЮБЫЕ изменения, правки в код, конфигурации (Docker, DNS, Cloudflare, туннели, сетевые маршруты) без предварительного глубокого аудита через Fullstack-аналитика и явного прямого согласования с пользователем.
- **Железный порядок действий:**
  1. **Fullstack Анализ (Предварительный аудит):** Любая задача или проблема сначала разбирается комплексно (архитектура, безопасность, суверенная доступность в РФ / ТСПУ, UX, радиус поражения).
  2. **Согласование с пользователем (Human Approval Gate):** Агент обязан предоставить понятный план и варианты решения и **ждать явного одобрения пользователя** («Делай», «Согласовано»).
  3. **Строгий запрет самовольных действий:** ❌ **ЗАПРЕЩЕНО** самовольно перенастраивать DNS, поднимать/гасить сторонние шлюзы, менять проксирование или вносить изменения за рамками согласованного скоупа.

---

# PLANNING MODE TEMPLATE (Spec-Driven Development)

При переходе в Planning Mode агент обязан создать или обновить файл `implementation_plan.md` в артефактах по следующему шаблону:

```markdown
# [Название задачи / Спецификация]

## 1. RAG Search Summary
- Результаты запроса в GraphRAG (какие архитектурные решения были учтены).

## 2. 5 Векторов Надежности
- **Архитектурный стык**: Описание границ Server/Client компонентов, hooks, реактивных зависимостей.
- **Хаос и пустота**: Обработка пустых состояний БД, сбоев транзакций Prisma, невалидных данных.
- **Visual & UX Density**: Адаптивность, минимизация пустого пространства, соответствие Tailwind 4.
- **Доступность (WCAG 2.2 AA)**: Размеры touch target (>= 44px), цветовой контраст.
- **Security & Trust**: Проверка критических операций на бэкенде (Server Actions / API), безопасные платежные логотипы.

## 3. Премортем-анализ (Failure Simulation)
Таблица рисков (минимум 3 сценария гипотетических отказов с конкретными защитными механизмами):
| Сценарий отказа | Вероятность x Влияние | Механизм защиты в коде |
| --- | --- | --- |
| ... | ... | ... |

## 4. Предлагаемые изменения
Список изменяемых / новых файлов с разбивкой по компонентам.

## 5. План верификации
Автотесты и сценарии ручной проверки.
```

*Метаданные плана должны содержать `request_feedback: true` для явного подтверждения пользователем.*

## 4. UI Pricing Policy & Drip-Feed Floor Invariant
- **CRITICAL**: В UI пользователь ВСЕГДА видит цену за 1 штуку (pricePerUnitRub), подпись: "₽ / шт". ЗАПРЕЩЕНО писать в UI "/ 1000 шт" или умножать цену на 1000 при отображении.
- ❌ **ЗАПРЕЩЕНО** добавлять навязчивые чипсы пресетов количества (`[100, 500, 1000]`). Поле объема использует чистый прямой ввод и степпер `–` / `+`.
- **CRITICAL Drip-Feed Floor Invariant**: При оформлении Drip-Feed ($N$ запусков) или Smart Drip ($D$ дней) объем на один запуск $\lfloor \text{quantity} / \text{runs} \rfloor$ **НЕ МОЖЕТ быть меньше** `service.minQty`. Минимальный общий объем заказа в UI и на бэкенде **СТРОГО** $\ge \text{service.minQty} \times N$. При переключении Drip-Feed степпер и значение объема обязаны автоматически масштабироваться до этого минимума.

## 4.1. Catalog TargetType Semantic Resolution (Zero False-Incompatibility)
- ❌ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** определять или фильтровать тип услуги через `s.targetType || inferTargetTypeFromName(s.name)`.
- Поскольку в `prisma/schema.prisma` поле `Service.targetType` имеет `@default("POST")`, оно всегда truthy, блокируя вызов функции инференса по названию. В результате ссылки на каналы (`t.me/*`) не получают услуг из-за несовместимости `LinkType.CHANNEL` с `ServiceTargetType.POST`.
- ✅ **ОБЯЗАТЕЛЬНО** использовать `resolveServiceTargetType(service)` из `@/utils/target-type-mapper` во всех фильтрах каталога, валидациях чекаута и плашках совместимости.

## 4.2. Catalog Ingestion Authority, Zero-Unknown-Platform & Service ID Invariants (CRITICAL)
- **Приоритет №1 (Выбор администратора — абсолютный):** Если администратор лично выбирает или сопоставляет категорию для услуги (`explicitId` в мастере импорта, Cherry-Pick или индивидуальном маппинге `categoryIdMap`), **это Приоритет №1**. Алгоритмический анализатор полностью отключается: система КАТЕГОРИЧЕСКИ НЕ ИМЕЕТ ПРАВА переопределять категорию, запускать семантический авто-сплит или блокировать услугу. Решение администратора исполняется безусловно.
- **Приоритет №2 (Автоматический / фоновый импорт):** Применяется при пакетной фоновой синхронизации без явного ручного маппинга администратора.
  - **Zero-Unknown-Platform Guard:** Если в данных провайдера (название, категория, описание) невозможно со 100% достоверностью определить социальную сеть (`platform === 'other' | 'unknown'`), услугу **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО импортировать**. Она отбраковывается на входе с причиной `reason: 'UNKNOWN_PLATFORM'` и выводится в отчёте импорта как отклонённая.
  - ❌ **ЗАПРЕЩЕНО** «додумывать» соцсеть по умолчанию (нативно привязывать к Telegram или любой другой сети).
- **Канонический префикс бренда (Zero False-Branding):** Префикс бренда соцсети (`Telegram `, `VK ` и др.) добавляется в название услуги **ТОЛЬКО** в том случае, если принадлежность к этой соцсети однозначно подтверждена провайдером. Учитывать баг шрифтов Windows: эмодзи флагов (например, `🇷🇺`) рендерятся как буквы (`RU`), поэтому канонический префикс платформы (`Telegram 🇷🇺 ...`) обязателен для устранения двусмысленности.
- **Инвариант видимости `#ID` и поиска:**
  - Каждая карточка услуги во всех интерфейсах платформы (визард заказа, мобильный и десктопный каталог, SMMflux, история заказов, админка) ОБЯЗАНА отображать кликабельный бейдж `#ID` (`ServiceIdBadge`) с копированием в буфер и всплывающим тостом.
  - Строка поиска каталога и админки ОБЯЗАНА нормализовать префиксы: запросы `#1643`, `№1643`, `ID: 1643` должны автоматически очищаться и искать по точному `numericId`.

---

## 5. Multi-Tenant & SEO Verification
- Перед объявлением SEO-задачи завершённой, агент ОБЯЗАН выполнить curl-проверки из секции "Verification Protocol" корневого AGENTS.md.
- Cache key в `unstable_cache` ОБЯЗАН включать tenantId.
- Canonical ОБЯЗАН быть абсолютным через `absoluteCanonical(tenantId, path)`.
- **ЗАПРЕЩЕНО** хардкодить host.

## 6. Financial Integrity
- Все изменения баланса — только через `WalletOps`.
- Все финансовые audit — только через `await auditAdminAwaitable()`.
- Все финансовые операции — с `idempotencyKey`.
- **ЗАПРЕЩЕНО** `auditAdmin()` без await для денег.

## 7. Multi-Tenant Brands & OmniSMM 1.0 Engine
- **Материнская платформа / Движок администрирования называется строго OmniSMM 1.0.**
- Платформа OmniSMM обслуживает бренды: **SMMplan** (`smmplan.pro`) и **SMMflux** (`smmflux.ru`) с возможностью подключения новых тенантов.
- ❌ **Брендов Lovable и SMMboost НЕ существует.** Запрещено добавлять фантомные бренды в canonical, metadata, UI-текстах, селекторах или макетах.
- `normalizeTenantId('lovable')` → `'flux'` — оставить как alias.
- Компоненты `Lovable*` переименованы в `Flux*`.
- ✅ **Глобальный переключатель сайтов в Header:** переключение сайтов оператором происходит **ГЛОБАЛЬНО в верхней панели (Header)** через `<GlobalSiteSwitcher />` с сохранением в cookie `x_admin_tenant`.

## 8. Fiscal 54-FZ & VAT 2026 (CRITICAL)
- **Базовая ставка НДС:** 22% (п. 3 ст. 164 НК РФ, ФЗ № 425-ФЗ).
- **Порог освобождения УСН:** 20 000 000 ₽ (п. 1 ст. 145 НК РФ, ФЗ № 176-ФЗ / 425-ФЗ).
- **Чеки (ЮKassa/Robokassa):** До 20 млн ₽ — `vat_code: 1` (Без НДС), свыше 20 млн ₽ — `vat_code: 10` (НДС 22%).

## 9. Таблицы и компоновка данных (No Horizontal Scroll & Zero Column Clipping Rule)
- **ЗАПРЕЩЕНО** допускать появление горизонтального скролла в таблицах данных и административных интерфейсах.
- **ЗАПРЕЩЕНО** обрезать столбцы или скрывать правые колонки (действия, цены, статусы) за пределами видимой области экрана.
- **Интерфейс ОБЯЗАН на 100% умещаться по ширине в видимый экран (Viewport 100% Width Fit):**
  - Приоритезация и лимит колонок: до 7–9 емких колонок. Вторичные технические поля выносить в Tooltip или модалки деталей.
  - Компактная плотность ячеек (`px-2 py-1.5` / `px-2.5 py-2`, шрифты `text-xs` / `text-[11px]`).
  - Ограничение ширины текстовых блоков (`max-w-[180px]`, `truncate` с `title`).
  - Компактные поля ввода (`w-14` / `w-18`) и компактные кнопки действий (`h-7 w-7`).
  - Адаптивность: таблица растягивается на 100% ширины (`w-full`) без раздутых фиксированных `min-w`.

## 10. Official Tunnel & Network Binding Invariants (Tailscale Funnel)
- ❌ **Cloudflare API и Cloudflare Tunnel заблокированы на территории РФ** и вызывают сбои TLS handshake и таймауты. ЗАПРЕЩЕНО использовать Cloudflare API и контейнеры cloudflared.
- ✅ **Официальный туннель платформы — Tailscale Funnel:** Все внешние запросы маршрутизируются через ноду `https://desktop-25m6el7.tailbb9d28.ts.net`, стабильно проксирующую на `http://127.0.0.1:3000`.
- ✅ Сервер Next.js обязан запускаться с `HOSTNAME="0.0.0.0"` и `PORT="3000"`, гарантируя стабильный доступ для Tailscale Funnel и браузерных E2E-тестов.

## 11. Modal Hoisting, Viewport Density & Realtime Daemons (CRITICAL)
- ❌ **ЗАПРЕЩЕНО** рендерить модальные окна (`Modal`, `Dialog`) внутри `DropdownMenuContent`, `Popover` или `Tooltip`. Состояние модалов объявляется на уровне экрана (`unified-workspace.tsx`), кнопки дропдаунов передают колбэки (`onOpenModal`).
- ❌ **ЗАПРЕЩЕНО** нанизывать более 3 фиксированных элементов `w-max` в flex-шапках без `min-w-0` и адаптивного сворачивания в меню на экранах `< 1536px`.
- ✅ **Idempotent Telegram Polling:** Всегда сбрасывать вебхуки через `await bot.telegram.deleteWebhook({ drop_pending_updates: true })` перед `bot.launch({ dropPendingUpdates: true })` для предотвращения ошибки `409 Conflict`.
- ✅ **Optimistic UI:** Любое оптимистичное сообщение/мутация с `temp-id` ОБЯЗАНА иметь 10-12s TTL таймер авто-очистки и немедленный откат стейта с возвратом текста при ошибке `{ success: false }`.

## 12. Zero-Trust, RBAC & Lifecycle Boundaries (CRITICAL INVARIANTS)
- ❌ **ЗАПРЕЩЕНО** писать проверки IDOR вида `if (sessionUser && item.userId !== sessionUser.id)` без обработки гостевого контекста.
- ✅ **Guest-Proof IDOR:** Если сущность принадлежит пользователю (`item.userId`), доступ разрешается СТРОГО при `if (item.userId && (!sessionUser || item.userId !== sessionUser.id)) { return { error: 'Access denied' }; }`.
- ❌ **ЗАПРЕЩЕНО** включать статусы неоплаченных заказов (`AWAITING_PAYMENT`, `PENDING`) в фильтры поиска вебхуков провайдеров (`src/app/api/webhooks/provider/`). Провайдерские вебхуки могут модифицировать СТРОГО заказы со статусами `IN_PROGRESS` или `PENDING_CHECK`.
- ❌ **ЗАПРЕЩЕНО** интерполировать переменные в Cypher-запросы Neo4j без проверки по белому списку `VALID_LABELS = {'class', 'module', 'function', 'file'}`.
- ❌ **ЗАПРЕЩЕНО** позволять сотрудникам назначать роли самим себе (`admin.id === targetUserId`) или выдавать права, превышающие их собственный набор полномочий (`Grant Ceiling`).
- ❌ **ЗАПРЕЩЕНО** переименовывать `src/proxy.ts` в `src/middleware.ts` — в Next.js 16 App Router для платформы зафиксирован `src/proxy.ts`.

## 13. Adversarial Red Team & Pre-Mortem Quality Gate (CRITICAL)
- ❌ **ЗАПРЕЩЕНО** сдавать задачи, затрагивающие финансовый баланс (`WalletOps`, `pricing`), заказы (`Drip-Feed`), обратный прокси (`src/proxy.ts`, `auth`) или очереди (`BullMQ`, `Redis`), без состязательного аудита `npm run audit:swarm`.
- ✅ **Planning Pre-Mortem:** В каждом плане реализации агент обязан формулировать минимум 3 сценария гипотетических отказов (Премортем) с конкретными защитными механизмами.
- ✅ **ExactMath Invariant:** Все денежные вычисления сумм заказов обязаны использовать `ExactMath.calculateOrderCostKopecks()` с банковским округлением (Half-Even), базисными пунктами наценок и защитным порогом $\ge 1$ коп.

## 14. Zero-Hallucination Source Verification Hierarchy (Rule of 3 Tiers)
- ❌ **ЗАПРЕЩЕНО** писать код интеграций с внешними техническими системами (ЮKassa, Robokassa, CryptoBot, Cloudflare, Telegram, ФНС 54-ФЗ, 1С), полагаясь исключительно на память модели.
- ✅ **ОБЯЗАТЕЛЬНО соблюдать 3-уровневую иерархию проверки:**
  1. **Уровень 1 (Официальная документация):** Первичная проверка по официальным эндпоинтам документации (`read_url_content`, официальные API reference вендоров).
  2. **Уровень 2 (Поисковая верификация):** Поиск актуальных релизов протоколов (2025/2026 гг.), выявление устаревших методов (SOAP/XML vs REST/JSON).
  3. **Уровень 3 (Память модели):** Используется ТОЛЬКО как вспомогательная гипотеза с обязательным предупреждением пользователю: `[ГИПОТЕЗА: Требуется валидация документацией]`.

---

## 15. Security-by-Design, Pentest Immunity & Live Standards Verification (OWASP/PCI DSS)
- ❌ **ЗАПРЕЩЕНО** писать код без предварительной сверки с мировыми стандартами безопасности: **OWASP Top 10:2025, OWASP ASVS 4.0.3, WSTG v4.2, PCI DSS 4.0, RFC 9116 (security.txt), RFC 9331 (RateLimit headers)**.
- ✅ **Live Standards Search:** Перед проектированием любой архитектуры, аутентификации или платежного флоу агент ОБЯЗАН провести поиск актуальных стандартов и уязвимостей в интернете (`search_web`).
- ❌ **Zero-Secrets in Client Bundles:** Никаких секретов, паролей или токенов в `NEXT_PUBLIC_*` или компонентах клиентского бандла (`use client`).
- ❌ **No Information Disclosure:** Запрещено раскрывать внутренние пути (`/dev`, `/test`, `/operator`, `/client-demo`) в публичном `robots.txt` (использовать `X-Robots-Tag: noindex, nofollow`).
- ✅ **Symmetric Cookie Sanitation:** Сброс сессионных кук ОБЯЗАН содержать полный набор атрибутов: `Secure; HttpOnly; SameSite=Lax; MaxAge=0; Expires=0; Path=/`.
- ✅ **Granular RBAC Enforcement:** Все серверные операции сотрудников обязаны проходить через `requireStaffPermission()` с проверкой прав по секциям (`view`/`edit`).

---

## 16. OmniSMM Architectural Skills Suite (ARCH-SKILLS-2026 — CRITICAL CONTRACT)
- ⚠️ **КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО** вносить архитектурные, инфраструктурные или структурные изменения в платформу без предварительной сверки с профильным архитектурным скиллом из единого реестра [`.agents/skills/INDEX.md`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/INDEX.md).
- **ОБЯЗАТЕЛЬНАЯ АКТИВАЦИЯ СКИЛЛОВ ПО ДОМЕНАМ:**
  1. **Слои, границы, размер компонентов:** [`arch-boundary-guard`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/arch-boundary-guard/SKILL.md) — Hexagonal Clean Architecture, разделение DTO/Domain/DB, запрет `"use server"` в `page.tsx`, лимит компонентов $\le 200$ строк.
  2. **Агрегаты и бизнес-правила:** [`ddd-aggregate-invariants`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/ddd-aggregate-invariants/SKILL.md) — закон «1 транзакция = 1 агрегат», Drip-Feed Floor ($\lfloor Q/N \rfloor \ge \text{minQty}$), Shadow Catalog buffer в Redis.
  3. **Архитектурные решения:** [`adr-architect`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/adr-architect/SKILL.md) — стандарт MADR 3.0, фиксация контекста/последствий, предотвращение амнезии.
  4. **Деньги, баланс, гонки:** [`concurrency-acid-guard`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/concurrency-acid-guard/SKILL.md) — TOCTOU, Row-Level Locking, Ledger-First, ExactMath (копейки BigInt), детекция Transaction Escape (`db` vs `tx`), `idempotencyKey`.
  5. **Миграции и DDL БД:** [`db-evolution-zero-downtime`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/db-evolution-zero-downtime/SKILL.md) — Expand/Contract pattern, `CREATE INDEX CONCURRENTLY`, лимиты `lock_timeout`.
  6. **Очереди и события:** [`event-driven-reliability`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/event-driven-reliability/SKILL.md) — Transactional Outbox (защита от Dual-Write), идемпотентные консьюмеры BullMQ, DLQ.
  7. **Внешние API и сбои:** [`resilience-bulkhead-circuit`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/resilience-bulkhead-circuit/SKILL.md) — Circuit Breaker (Redis), Per-Tenant/Per-Provider Bulkhead, обязательные таймауты `AbortSignal.timeout()`.
  8. **Мульти-тенантность:** [`multi-tenant-isolation-arch`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/multi-tenant-isolation-arch/SKILL.md) — изоляция OmniSMM (SMMplan / SMMflux), tenant-aware кэши, барьер ст. 54.1 НК РФ.
  9. **API и DTO:** [`api-contract-evolver`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/api-contract-evolver/SKILL.md) — Contract-First (Zod), Zero Breaking Changes, RFC 8594 Sunset/Deprecation.
  10. **Анализ влияния:** [`impact-blast-radius`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/impact-blast-radius/SKILL.md) — картирование зависимостей через `grep_search`, моделирование отказа на 3 шага вперед.
  11. **Производительность:** [`nfr-performance-budget`](file:///c:/Users/Shadow/Documents/SMM/.agents/skills/nfr-performance-budget/SKILL.md) — P95/P99 latency budgets, детекция N+1 в Prisma, Keyset пагинация, connection pool limits.

---

## 17. Production Post-Mortem Hard Invariants (Lessons Learned 2026-09-17)
- ❌ **Multi-Tenant Purge Hazard:** Запрещено оценивать возможность удаления сущностей (категорий, услуг) только по счетчику активного тенанта (`tenantServicesCount === 0`). При наличии элементов в базе (`globalServicesCount > 0`) деструктивные действия обязаны блокироваться.
- ❌ **Unverified Gateway Refund Trap:** Запрещено переводить заявку на возврат на карту в статус `EXECUTED` для шлюзов без API автоматического возврата (Robokassa, CryptoBot). Обязательно требовать `manualConfirmed: true` от оператора с фиксацией в аудите.
- ❌ **Dev Runners in Production Containers:** Запрещено указывать `tsx` или пути к `src/` в `docker-compose.prod.yml` и `docker-compose.staging.yml`. Использовать строго скомпилированные точки входа (`node bot.js`, `node worker.js`).
- ✅ **Infinite Infrastructure Backoff:** Сетевые драйверы Redis и PostgreSQL обязаны использовать бесконечный цикл переподключения с прогрессивным backoff (до 3000 мс), исключая обрыв соединения после N попыток.
- ✅ **54-FZ Fiscal Schema Completeness:** Чеки 54-ФЗ во всех шлюзах (Робокасса, ЮKassa) обязаны содержать контактные данные покупателя (`client: { email }` / `phone`) согласно требованиям ФФД 1.2.
- ✅ **WHATWG URL Flag Invariant:** Для безымянных флагов URL (например, `?boost`) использовать прямое назначение `urlObj.search = '?boost'`, исключая появление артефактного знака `?boost=`.
- ✅ **Edge Proxy Trailing Slash Normalization:** Словари редиректов в `src/proxy.ts` обязаны нормализовать завершающие слэши (`pathname.replace(/\/+$/, '')`).
- ✅ **Exact Financial Telemetry:** Метрики дашборда обязаны разделять Net Profit (в рублях за вычетом COGS, комиссий и УСН 6%) и Margin (в %), а процент успешности заказов рассчитывать строго по терминальным заказам без учета неоплаченных корзин.

