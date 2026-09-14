---
name: self-improving-loop
description: Комплексный протокол непрерывного самосовершенствования (Self-Improving Loop) для платформы OmniSMM 1.0. Регламентирует замкнутые циклы статического аудита, автоисправления верстки (Layout Healer), TDD регрессии, верификации в песочнице Stage (:3005) и автоматической эволюции базы знаний и навыков (Skill Evolution).
---

# Self-Improving Loop Protocol (SIL-2026)

> **Стандарт платформы OmniSMM 1.0 (2026)**  
> **Фундаментальный закон:** Ни одна ошибка не должна повторяться дважды, а качество кода и верстки обязано непрерывно верифицироваться и самоисцеляться через автоматизированный замкнутый цикл с обратной связью (Closed-Loop Feedback).

---

## 1. Архитектура Замкнутого Цикла (The 5-Phase Loop)

```
                       [ ВХОДНОЙ ИМПУЛЬС ]
        (Новый код / Изменение UI / Инцидент телеметрии)
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  ФАЗА 1: STATIC HYGIENE & SECRET LEAK GATE                  │
   │  - Контроль типов: npx tsc --noEmit (0 ошибок)              │
   │  - Контроль секретов: check-bundle-secrets.mjs (0 утечек)   │
   │  - Доменные инварианты: check-api-docs-domains.ts           │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  ФАЗА 2: LAYOUT AUTO-HEAL & DENSITY SENTRY                  │
   │  - Поиск сжатых SVG, отсутствия min-w-0, w-screen           │
   │  - Автопочинка codemod-движком (healLayoutFiles --fix)      │
   │  - Контроль тач-таргетов >= 44px и мобильного автозума iOS  │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  ФАЗА 3: ADVERSARIAL TDD & REGRESSION GATE                  │
   │  - Прогон критических сьютов (ExactMath, URL-анализатор)    │
   │  - Проверка мутационной устойчивости (Red Team Mutation)    │
   │  - Защита финансовых инвариантов (WalletOps, Ledger-First)  │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  ФАЗА 4: EPHEMERAL STAGE & VISUAL LOOP (:3005)              │
   │  - Изолированный запуск stage-инстанса                      │
   │  - Многоролевой headless-аудит (Гость, B2C, Flux, Owner)    │
   │  - Контроль гидратации React 19 и отсутствия scrollWidth    │
   │  - Сохранение скриншотов в .planning/stage_visuals/         │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  ФАЗА 5: SKILL EVOLUTION & MEMORY SYNTHESIS                 │
   │  - Извлечение паттерна решения (Lesson Extraction)          │
   │  - Запись в .agents/skills/<skill>/SKILL.md                 │
   │  - Индексация в GraphRAG (POST /api/decision)               │
   │  - Генерация отчета .planning/SELF_IMPROVING_LOOP_SCORECARD │
   └─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [ HUMAN APPROVAL GATE ]
                    «Одобряю выкатку релиза»
```

---

## 2. Команды и Режимы Запуска

Пайплайн управляется единым скриптом `scripts/self-improving-orchestrator.ts`:

| Команда | Режим | Назначение |
| :--- | :--- | :--- |
| `npm run loop:self-improve` | Стандартный | Полный прогон Фаз 1–3 + отчет и проверка навыков. |
| `npm run loop:heal` | Автоисправление | Запуск Фазы 2 с автоматическим применением codemod-правок верстки (`--fix`). |
| `npx tsx scripts/self-improving-orchestrator.ts --full` | Максимальный | Включает визуальный аудит Stage (:3005) и Playwright. |
| `npm run heal:ooda` | Инцидентный | Реакция на сбои телеметрии: генерация репро-теста $\to$ хотфикс $\to$ `skill:evolve`. |

---

## 3. Жесткие Инварианты (Hard Invariants)

1. **ТАБУ №1: No Repeat Regressions (Запрет повторных регрессий):**
   - Если дефект был исправлен в рамках инцидента, выученный урок ОБЯЗАН быть зафиксирован в секции `## Known Anti-Patterns & Lessons Learned` профильного скилла через `evolveSkillWithLesson()`.
2. **ТАБУ №2: Blind Deployment (Запрет слепого деплоя):**
   - Любое изменение верстки обязано проходить проверку отсутствия горизонтального скролла (`scrollWidth <= innerWidth`) и размера тач-зон.
3. **ТАБУ №3: Human Approval Mandate:**
   - Никакие автоматические автоисправления не выкатываются в продакшн (`:3000`) без финального подтверждения человека.
4. **ТАБУ №4: Strict Zero Secrets Leak:**
   - Любое появление токенов, секретных ключей или незамаскированного PII немедленно блокирует прохождение цикла со статусом `FAIL`.

---

## 4. Known Anti-Patterns & Lessons Learned

### [LESSON-2026-09-14] self-improving-loop-initial-standard
- **Trigger Condition:** Ручной запуск изолированных скриптов проверки без единого координатора приводил к пропуску шагов проверки верстки или секретов.
- **Enforced Solution Pattern:** Использование единого оркестратора `scripts/self-improving-orchestrator.ts` (`npm run loop:self-improve`), агрегирующего все 5 фаз в единую матрицу готовности.
- **Verified Date:** 2026-09-14

### [LESSON-2026-09-14-SIL-A] link-rules-substring-domain-trap (CRITICAL)
- **Trigger Condition:** SIL мутационный тест-вектор `music.yandex.com` обнаружил, что паттерн `(?:twitter\.com|x\.com)` матчит `x.com` как подстроку внутри `yandex.com` → все Яндекс-ссылки неверно классифицировались как TWITTER.
- **Root Cause:** Regex без хост-якоря (`(?:^|[./])`) позволяет короткому домену (`x.com`) совпадать внутри более длинного (`yandex.com`). Паттерн работает на нормализованном URL-строке, не на parsed hostname.
- **Enforced Solution Pattern:** Все платформенные regex-паттерны в `LINK_RULES` для коротких/ambiguous доменов (особенно TLD-like: `x.com`, `t.co`, `is.gd`) ОБЯЗАНЫ использовать якорь-префикс `(?:^|[./])` перед доменом.
- **Anti-Pattern:** `/(x\.com)\//` — ловит yandex.com, marx.com, linux.com
- **Correct Pattern:** `/(?:^|[./])x\.com\//` — только точное совпадение хоста
- **Files Affected:** `src/services/analyzer/link-rules.ts`
- **Verified Fix Commit:** SIL-2026-09-14
- **Verified Date:** 2026-09-14

### [LESSON-2026-09-14-SIL-B] query-param-striplist-greedy-prefix (MEDIUM)
- **Trigger Condition:** SIL аудит выявил, что `si` в blacklist через `startsWith()` удаляет query-параметры `size`, `sidebar`, `signal`, `side` у сторонних сайтов.
- **Root Cause:** Использование единого `prefixBlocklist` со `startsWith()` для коротких ключей без prefix (2 буквы `si`) — избыточно жадно.
- **Enforced Solution Pattern:** Разделить tracking-список на два: `exactBlocklist` (Set, full-key match) для `si`, `ref`, `igsh` и `prefixBlocklist` (array, startsWith) только для `utm_`.
- **Anti-Pattern:** `blackListPrefixes.some(p => key.startsWith(p))` с `si` в списке
- **Correct Pattern:** `exactBlocklist.has(key) || prefixBlocklist.some(p => key.startsWith(p))`
- **Files Affected:** `src/utils/link-normalizer.ts`
- **Verified Fix Commit:** SIL-2026-09-14
- **Verified Date:** 2026-09-14

### [LESSON-2026-09-14-SIL-C] declarative-link-specs-catalog-enrichment (HIGH)
- **Trigger Condition:** При импорте услуг от провайдеров для Rutube, Dzen, Likee, Discord генератор спецификаций ссылок сваливался в `Universal Fallback` (`https://...`), лишая чекаут нативных плейсхолдеров, подсказок и валидаторов.
- **Root Cause:** Реестр `link-rules-registry.ts` содержал строгие правила только для Top-5 сетей (TG, VK, YT, IG, TT), а нишевые и суверенные РФ платформы не имели канонических декларативных спецификаций.
- **Enforced Solution Pattern:** Все поддерживаемые каталогом платформы обязаны быть декларативно описаны в `UNIFIED_REGEX` и `getUnifiedLinkSpecification()` с ReDoS-safe паттернами, локализованными подсказками и строгими валидаторами формата ссылок.
- **Anti-Pattern:** Падение в `DEFAULT_SPEC` для валидных платформ каталога.
- **Correct Pattern:** Канонические регулярные выражения и спецификации для всех 10+ поддерживаемых провайдерами платформ (включая Rutube, Dzen, Likee, Discord).
- **Files Affected:** `src/services/link-engine/link-rules-registry.ts`, `src/services/admin/catalog.service.ts`
- **Verified Date:** 2026-09-14

### [LESSON-2026-09-14-SIL-D] manual-provider-service-creation-parity (HIGH)
- **Trigger Condition:** При ручном создании услуги через `/admin/catalog/new` или `createServiceAction` поля правил валидации ссылок оставались пустыми, приводя к деградации интерфейса чекаута.
- **Root Cause:** Метод создания услуги не обращался к `getUnifiedLinkSpecification()` и требовал от оператора ручного ввода регулярных выражений и подсказок.
- **Enforced Solution Pattern:** Все точки входа добавления услуг (как пакетный импорт, так и ручное создание) обязаны вызывать канонический резолвер `getUnifiedLinkSpecification(platform, targetType, activityType)`, предзаполняя валидаторы, плейсхолдеры, подсказки и технические требования.
- **Anti-Pattern:** Создание услуги с `linkValidatorRegex: null` при наличии канонических правил для целевой платформы.
- **Correct Pattern:** Автоматическое обогащение через Unified Link Engine с сохранением возможности ручного оверрайда оператором.
- **Files Affected:** `src/actions/admin/catalog/services.ts`, `src/app/admin/catalog/components/service-edit-form.tsx`, `src/app/admin/catalog/new/page.tsx`
- **Verified Date:** 2026-09-14

### [LESSON-2026-09-14-SIL-E] checkout-session-link-retention-invariant (CRITICAL)
- **Trigger Condition:** Вставка или ввод URL в поле оформления заказа (`PlanFullscreenCheckout`) сбрасывала `selectedService` в `null`, что приводило к внезапному закрытию формы заказа и принудительному выбросу пользователя обратно в каталог услуг.
- **Root Cause:** Тройная регрессия в `useOrderEngine.ts`:
  1. `analyzeUrl` при несовпадении `targetType` ссылки вызывал `setSelectedService(null)` и переключал `categoryId`.
  2. Эффект 2 (каскадный выбор категорий) при несовместимости `detectedType` вызывал `setSelectedService(null)`.
  3. Эффект 3 (загрузка услуг) зависел от `url.trim().length >= 5` и `detectedType`, и при пустом кэше SSR вызывал `setSelectedService(null)` при любом вводе символа в поле URL.
- **Enforced Solution Pattern:** Железный инвариант удержания сессии чекаута (Checkout Session Retention Invariant — CSR-2026): как только пользователь выбрал услугу (`selectedServiceRef.current` установлен), любые манипуляции со ссылкой (вставка, стирание, редактирование, ReDoS/incompatible link) ОБЯЗАНЫ сохранять `selectedService`. Ошибки и несовместимости ссылки должны отображаться строго в виде предупреждений/валидаторов внутри формы (`linkCompatibilityWarning`), а не приводить к демонтажу компонента чекаута.
- **Anti-Pattern:** Вызов `setSelectedService(null)` из асинхронных эффектов анализа URL или смены категорий при активном чекауте.
- **Correct Pattern:** Ограждение `if (!selectedServiceRef.current)` для всех автоматических переключений сети, категорий и очистки выбранной услуги; кэширование `initialServices` при инициализации.
- **Files Affected:** `src/hooks/useOrderEngine.ts`, `src/__tests__/checkout-link-retention.test.ts`
- **Verified Date:** 2026-09-14


