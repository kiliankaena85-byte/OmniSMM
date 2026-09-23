# ТЕХНИЧЕСКОЕ ЗАДАНИЕ ДЛЯ АНАЛИТИКА (ANALYST TASK BRIEF)
## Комплексная унификация и оптимизация подсистемы валидации и анализа ссылок

> **Проект:** OmniSMM 1.0 (`smmplan.pro` / `smmflux.ru`)  
> **Контур:** Tier 1 (Критическая бизнес-логика: чекаут, валидация ссылок, роутинг каталога, заказы)  
> **Дата выдачи:** 14.09.2026  
> **Исполнитель:** Lead Systems / Fullstack Analyst  
> **Постановщик:** Antigravity Architect Gate (Session `caae7a93-6e4f-4599-9849-29d7debba16a`)  
> **Связанные документы:** 
> - [`link_subsystem_audit.md`](file:///C:/Users/ZVER/.gemini/antigravity/brain/b54de4ce-2f1a-4c99-9792-af36a317d044/link_subsystem_audit.md)
> - [`SPEC-2026-09-14-url-validator-and-catalog-engine-rearchitecture.md`](file:///e:/SMM/docs/specs/SPEC-2026-09-14-url-validator-and-catalog-engine-rearchitecture.md)
> - [`AGENTS.md`](file:///e:/SMM/AGENTS.md) (Контракт разработки v4.1)

---

## 1. Контекст и цели задачи

Подсистема обработки ссылок платформы OmniSMM отвечает за:
1. Определение социальной платформы и типа объекта (канал, пост, сторис, профиль, бот, видео, опрос).
2. Фильтрацию витрины каталога (Шаги 1–2 визарда оформления заказа).
3. Проверку совместимости выбранной услуги и переданной ссылки (Шаг 4 визарда, Server Action `checkout.ts`, Telegram-бот).
4. Канонизацию и мутацию URL (удаление трекинговых параметров, нормализация wall/post, извлечение ID).

### Главная проблема
В ходе углубленного аудита выявлено **критическое архитектурное дублирование**: в системе сосуществуют **два независимых движка совместимости и нормализации типов**, разработанные в разное время разными авторами, имеющие **несовпадающие таблицы истинности** и **несогласованные enum-типы**:
- **Движок №1:** `src/constants/link-service-compatibility.ts` (`LinkType`, `ServiceTargetType`, `isLinkServiceCompatible`, `COMPATIBILITY_MAP`)
- **Движок №2:** `src/utils/target-type-mapper.ts` (`TargetTypeEnum`, `ServiceTargetType` (type union), `isTargetTypeCompatible`, `normalizeTargetType`, `resolveServiceTargetType`)

Оба движка одновременно импортируются и перекрестно вызываются в `checkout.ts`, `useOrderEngine.ts`, `mass.ts`, `bot/index.ts` и `order.service.ts`.

### Цель аналитика
Разработать исчерпывающее аналитическое решение и архитектурный план объединения двух движков в единый фасад **с нулевым риском регрессий (Zero-Regression)** и **без нарушения обратной совместимости (Zero-Breaking Changes)**.

---

## 2. Результаты дополнительного глубокого аудита (Дефекты и Аномалии)

### 🔴 АНОМАЛИЯ 1: Расхождения в таблицах истинности совместимости
При детальном побайтовом сравнении матриц совместимости выявлены критические расхождения между `isLinkServiceCompatible()` и `isTargetTypeCompatible()`:

| Входная ссылка (Detected Link) | Целевой тип услуги (Service Target) | Движок №1 (`lsc.ts`) | Движок №2 (`mapper.ts`) | Бизнес-риск / Диагноз |
|---|---|---|---|---|
| **POST** (ссылка на пост) | **POLL / POLL_VOTES** (опрос) | ✅ **РАЗРЕШЕНО** | ❌ **ЗАПРЕЩЕНО** | Если услуга опроса привязана к посту (напр. опрос внутри поста ВК/ТГ), Движок №2 отклонит её, а Движок №1 пропустит! |
| **PROFILE** (ссылка на профиль) | **CHANNEL_POSTS** (авто-просмотры) | ✅ **РАЗРЕШЕНО** | ❌ **ЗАПРЕЩЕНО** | Автопросмотры на новые посты профиля (Instagram/TikTok): Движок №1 разрешает, Движок №2 блокирует! |
| **VIDEO** (ссылка на видео/клип) | **COMMENTS** (комментарии) | ✅ **РАЗРЕШЕНО** | ❌ **ЗАПРЕЩЕНО** | Заказ комментариев на YouTube/VK видео: Движок №2 вернет ошибку несовместимости! |
| **POLL** (ссылка на опрос) | **POST / POST_INTERACTION** | ✅ **РАЗРЕШЕНО** | ✅ **РАЗРЕШЕНО** | Согласовано |
| **CHANNEL** (ссылка на канал) | **PROFILE** | ✅ **РАЗРЕШЕНО** | ✅ **РАЗРЕШЕНО** | Согласовано |

> ⚠️ **Критический вывод:** Движок №1 (`link-service-compatibility.ts`) более гибкий и учитывает реальные сценарии SMM (комментарии на видео, опросы в постах, авто-активности на профили). Движок №2 имеет зауженные правила, что вызывает ложные блокировки в визарде!

---

### 🔴 АНОМАЛИЯ 2: Потеря типов в нормализаторах (Fall-through в CUSTOM)
Сравнение функций нормализации строк:
- В `link-service-compatibility.ts::normalizeServiceTargetType`:
  - `AUTO_VIEWS`, `AUTO_POSTS`, `AUTO` $\to$ `ServiceTargetType.CHANNEL_POSTS`
  - `POLL_VOTES`, `POLL`, `VOTES` $\to$ `ServiceTargetType.POLL_VOTES`
  - `BOT_STARTS`, `BOT`, `REFERRAL` $\to$ `ServiceTargetType.BOT_STARTS`
  - `REVIEWS`, `COMMENTS`, `COMMENT` $\to$ `ServiceTargetType.COMMENTS`
- В `target-type-mapper.ts::normalizeTargetType`:
  - Строка `AUTO_VIEWS` $\to$ **ОТСУТСТВУЕТ!** (падает в `default: TargetTypeEnum.CUSTOM`)
  - Строка `POLL_VOTES` $\to$ **ОТСУТСТВУЕТ!** (падает в `default: TargetTypeEnum.CUSTOM`)
  - Строка `BOT_STARTS` $\to$ **ОТСУТСТВУЕТ!** (падает в `default: TargetTypeEnum.CUSTOM`)
  - Строка `REVIEWS` $\to$ **ОТСУТСТВУЕТ!** (падает в `default: TargetTypeEnum.CUSTOM`)

> ⚠️ **Последствие:** Поскольку `CUSTOM` в обоих движках считается универсальным пропуском (`return true`), падение в `CUSTOM` **выключало валидацию** для этих услуг вместо строгой проверки!

---

### 🔴 АНОМАЛИЯ 3: Семантический разрыв в именовании Enum
- В `link-service-compatibility.ts`:
  - Разделены понятия физического объекта (`LinkType.POST`) и действия над ним (`ServiceTargetType.POST_INTERACTION`, `VIDEO_INTERACTION`, `STORY_INTERACTION`, `POLL_VOTES`, `BOT_STARTS`).
- В `target-type-mapper.ts`:
  - Используются плоские имена сущностей: `POST`, `VIDEO`, `STORY`, `POLL`, `BOT`.

В кодовой базе разработчики вынуждены писать костыли вида:
```typescript
// useOrderEngine.ts
isLinkServiceCompatible(detectedType, resolveServiceTargetType(s))
```
Где `detectedType` — это lowercase строка из `link-analyzer.ts` (например, `'channel'`), а `resolveServiceTargetType(s)` возвращает строку из `target-type-mapper.ts` (например, `'CHANNEL'`), которая затем передается в функцию из `link-service-compatibility.ts`, где повторно нормализуется через `normalizeServiceTargetType`!

---

### 🟡 АНОМАЛИЯ 4: In-Memory кэш анализатора в Server Action
В `src/actions/order/analyze-url.ts`:
```typescript
const analyzeCache = new Map<string, { data: IntelligenceAnalysisResult; expiresAt: number }>();
```
- **Проблема 1:** Память Node.js процесса не шарится между воркерами Standalone/Docker. При наличии 2+ реплик кэш неэффективен.
- **Проблема 2:** Вытеснение реализовано как FIFO (`keys().next().value`), а не LRU. При всплеске запросов вытесняются наиболее популярные ссылки.
- **Проблема 3:** Кэширование происходит по `url`, но до полной канонизации (разные регистры протокола или trailing slash создают дублирующие записи).

---

### 🟡 АНОМАЛИЯ 5: Legacy-дублеры, требующие вывода из эксплуатации
1. `src/utils/url-analyzer.ts` (61 строка) — содержит функции `getUrlFlags()` и `getServiceFlags()`, построенные на простых проверках `urlLower.includes('t.me/c/')` и регулярках.
   - **Статус использования:** Используется ровно в **1 месте** во всей системе: `src/components/landing/order-engine/DynamicPayloadWarnings.tsx`.
   - **Риск:** Дублирует функционал `IntelligenceLinkAnalyzer`, не поддерживает Telegram Stories, Highlights, форумы/топики.
2. `src/utils/link-extractor.ts` (47 строк) — функция `detectPlatformLite()`:
   - **Статус использования:** **0 вызовов** во всем репозитории (`grep_search` показал 0). Полностью мертвый код.
3. `src/utils/social-link-placeholder.ts` (919 строк, 37.9 Кб) — массив `SOCIAL_LINK_MATRIX`:
   - Хардкодит доменные имена и алиасы 22 соцсетей, дублируя данные из `src/services/analyzer/link-rules.ts`.

---

## 3. Пакеты работ для аналитика (Work Packages)

Аналитик обязан проработать и предоставить решения по следующим 5 пакетам:

### 📦 WP-1: Проектирование канонической системы типов (Unified Types Contract)
1. Разработать единый TypeScript Enum/Тип, объединяющий `LinkType`, `TargetTypeEnum` и `ServiceTargetType`.
2. Предложить стратегию наименования:
   - Сохранить плоские имена (`POST`, `VIDEO`, `CHANNEL`, `PROFILE`, `STORY`, `POLL`, `BOT`, `COMMENTS`, `CHANNEL_POSTS`, `CUSTOM`) как базовые.
   - Обеспечить 100% обратную совместимость для существующих констант `POST_INTERACTION`, `VIDEO_INTERACTION`, `POLL_VOTES`, `BOT_STARTS`, `STORY_INTERACTION` через TypeScript alias / Enum proxy.
3. Документировать поведение при получении неизвестных или поврежденных типов (`CUSTOM` fallback).

### 📦 WP-2: Гармонизация матрицы совместимости (Unified Truth Table)
1. Составить финальную, бесконфликтную таблицу истинности для всех 10 типов ссылок и 10 типов услуг.
2. Разрешить спорные кейсы из Аномалии 1:
   - *Разрешать ли `COMMENTS` для `VIDEO`?* (Аналитическое обоснование: **ДА**, комментарии на видеоролики — популярная услуга).
   - *Разрешать ли `POLL` для `POST`?* (Аналитическое обоснование: **ДА**, голосования в Telegram/VK размещаются внутри постов).
   - *Разрешать ли `CHANNEL_POSTS` для `PROFILE`?* (Аналитическое обоснование: **ДА**, для Instagram/TikTok, где лента постов принадлежит профилю).
3. Зафиксировать образовательные русскоязычные сообщения об ошибках для каждого несовместимого сочетания (`getCompatibilityError`).

### 📦 WP-3: Архитектура единого фасада и план миграции импортов (Zero-Breaking Facade)
1. Разработать структуру экспортов:
   - Единый источник правды: `src/utils/target-type.ts` (или `src/services/link/`).
   - Файл `src/constants/link-service-compatibility.ts` переводится в режим `@deprecated` re-export фасада, транслирующего вызовы в единый модуль без поломки внешних потребителей.
   - Файл `src/utils/target-type-mapper.ts` инкапсулирует расширенный словарь нормализации (включая `AUTO_VIEWS`, `POLL_VOTES`, `BOT_STARTS`, `REVIEWS`).
2. Составить реестр всех 26 файлов-потребителей с оценкой влияния по Tier-классификации (Tier 1: чекаут/ордер, Tier 2: визард/UI, Tier 3: хелперы).

### 📦 WP-4: Спецификация вывода из эксплуатации Legacy-компонентов (Sunsetting Legacy)
1. Спроектировать рефакторинг `DynamicPayloadWarnings.tsx`:
   - Заменить вызов `getUrlFlags(url, activeCategory)` на использование уже имеющегося в хуке объекта `engine.analysisResult` (`IntelligenceAnalysisResult`).
   - Описать маппинг полей `isPrivateTelegramPost`, `isVkPhotoOrVideo`, `isPostUrl`, `isChannelUrl` через `analysisResult.type` и `analysisResult.metadata`.
2. Подготовить решение по безопасному удалению `src/utils/url-analyzer.ts`.
3. Подготовить решение по удалению неиспользуемой функции `detectPlatformLite` из `link-extractor.ts`.

### 📦 WP-5: Спецификация оптимизации производительности и кэширования
1. Разработать требования к кэшированию URL-анализа:
   - Временный этап: замена примитивного FIFO в `analyzeCache` на настоящий LRU с лимитом размера (1000 элементов) и нормализацией ключа (`url.trim().toLowerCase()`).
   - Целевой этап: интеграция с существующим `RedisService` (с учетом правила `[SEC-001]` из `AGENTS.md`) для multi-container Standalone сборки.
2. Оптимизация `category-matcher.ts`:
   - Кэширование скомпилированных `RegExp` в WeakMap/Map для предотвращения повторной компиляции регулярок на каждый рендер списка категорий.

---

## 4. Критерии приёмки работы аналитика (Definition of Done)

Работа аналитика считается выполненной, если предоставлены:
1. 📋 **Согласованная матрица совместимости:** Таблица 10×10 с четким обоснованием каждого `TRUE` / `FALSE`.
2. 📐 **Интерфейсный контракт TypeScript:** Готовые DTO и сигнатуры функций для единого фасада.
3. 🛡️ **План премортем-тестирования (Pre-Mortem Failure Scenarios):** Минимум 3 сценария гипотетических регрессий с превентивными мерами защиты.
4. 🚦 **Пошаговый план внедрения для инженера:** Детальная разбивка на коммиты с контрольными точками `tsc --noEmit` и `vitest`.

---

> **Важно соблюдать инвариант из AGENTS.md §0.9 (FA-2026):**
> Любые изменения кода производятся только после явного согласования сформированного аналитического решения пользователем.
