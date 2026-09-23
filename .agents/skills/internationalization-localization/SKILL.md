---
name: internationalization-localization
description: "i18n и l10n: полная архитектура от code-level до культурной адаптации. RTL, text expansion, ICU Message Format, Intl API, визуальная локализация, правовые требования по рынкам, pseudo-localization тестирование. Активировать при проектировании для международных рынков, при RTL поддержке, при локализации, при множественном числе, при форматах дат/чисел/валют. ALWAYS activate for multi-language design, RTL su... Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 2.0.0
---

# Internationalization & Localization — i18n/l10n

## When to activate

- Проект будет доступен на нескольких языках (даже 2 = нужен i18n)
- Нужна RTL (right-to-left) поддержка (арабский, иврит, фарси, урду)
- Локализация для конкретных рынков (EU, MENA, Азия, Россия)
- Пользователь упоминает translation, i18n, l10n, RTL, locale, pluralization
- Форматирование дат/чисел/валют для разных регионов
- Проектирование дизайн-системы с самого начала (i18n = архитектурное решение)
- Выбор шрифтов для многоязычных проектов
- Культурная адаптация иконок, изображений, цветов
- Правовые требования по рынкам (GDPR, 152-ФЗ, CCPA, ICP)
- Настройка translation management (next-intl, react-i18next, Phrase)

## ПОЧЕМУ I18N — ЭТО АРХИТЕКТУРНОЕ РЕШЕНИЕ, А НЕ ПЕРЕВОД

Internationalization (i18n) — это процесс проектирования и разработки ПО таким образом, чтобы оно могло быть адаптировано к различным языкам и регионам без изменения кода. Localization (L10n) — это фактический процесс адаптации продукта под конкретный рынок.

В 2026 году 72.4% потребителей предпочитают покупать продукты на своём родном языке. Только 40% пользователей никогда не покупают на сайтах на других языках. Без i18n вы упускаете 60%+ глобального рынка. По данным Common Sense Advisory: компании с комплексными программами локализации показывают рост выручки на 1.5x быстрее. ROI локализации: $25 возврат на каждый $1 инвестированный.

Критическое понимание: i18n — это не просто «перевести текст». Это трансформация всего дизайна: layout, типографика, цвет, иконки, изображения, форматы данных, правовые требования.

## ЧАСТЬ 1: ФУНДАМЕНТАЛЬНАЯ ПРОБЛЕМА — «АНГЛИЙСКИЙ КАК ДАННОСТЬ»

### Типичные провалы «English-first» подхода

#### ПРОВАЛ 1: Text Expansion
- Английский: "Settings" (8 символов)
- Немецкий: "Einstellungen" (14 символов, +75%)
- Результат: кнопки переполнены текстом, навигация ломается, layout разрушается

#### ПРОВАЛ 2: Text Contraction
- Английский: "OK"
- Китайский: "好" (1 символ)
- Результат: кнопка слишком маленькая, не похожа на interactive element

#### ПРОВАЛ 3: RTL Blindness
- Арабский, иврит = right-to-left
- Весь layout зеркально, иконки-стрелки меняют смысл, формы ввода ломаются

#### ПРОВАЛ 4: Date Format Chaos
- США: 12/31/2026 (MM/DD/YYYY)
- Россия: 31.12.2026 (DD.MM.YYYY)
- ISO: 2026-12-31 (YYYY-MM-DD)
- "06/07/2026" — это 6 июля или 7 июня?

#### ПРОВАЛ 5: Cultural Symbols
- Thumbs up = хорошо в США, но оскорбление в некоторых странах
- Свинья = нейтральная иконка в одних культурах, оскорбительная в мусульманских

#### ПРОВАЛ 6: Number Formatting
- США: $1,234,567.89
- Германия: 1.234.567,89 EUR
- Россия: 1 234 567,89 RUB

## ЧАСТЬ 2: АРХИТЕКТУРА I18N — ФУНДАМЕНТ С САМОГО НАЧАЛА

### 4 уровня i18n-архитектуры

#### УРОВЕНЬ 1: CODE ARCHITECTURE
- Все строки в translation files (не в JSX)
- Даты/числа через Intl API (не hardcoded format)
- Цвета/иконки через semantic tokens (не hardcoded)

#### УРОВЕНЬ 2: TRANSLATION LAYER
- Format: JSON / ICU Message Format
- Structure: namespace/key/value
- Pluralization: ICU plural rules
- Variables: {name}, {count}, {date}

#### УРОВЕНЬ 3: LAYOUT SYSTEM
- Flexible containers: min-width не fixed
- Text overflow: ellipsis + tooltip, не truncate
- RTL: CSS logical properties (not left/right)
- Icons: semantic meaning, не directional

#### УРОВЕНЬ 4: LOCALE-SPECIFIC
- Dates: Intl.DateTimeFormat
- Numbers: Intl.NumberFormat
- Currency: Intl.NumberFormat (style: 'currency')
- Sorting: Intl.Collator
- Relative time: Intl.RelativeTimeFormat

## ЧАСТЬ 3: TEXT EXPANSION — ДИЗАЙН ДЛЯ «НЕМЕЦКОГО ТЕСТА»

### Expansion rates по языкам (English baseline = 100%)

| Язык | Expansion | Примечание |
|------|-----------|------------|
| Немецкий | +35-50% | Самый длинный в EU |
| Французский | +15-25% | |
| Испанский | +15-25% | |
| Португальский | +15-20% | |
| Итальянский | +15-20% | |
| Русский | +15-20% | |
| Арабский | +20-25% | + RTL |
| Японский | -30-40% | Более компактный |
| Корейский | -10-20% | |
| Китайский | -30-40% | |

**Практическое правило:** Если текст умещается в немецком — умещается везде. "German Test" как стандартная QA проверка.

### Дизайн-решения для expansion

**Кнопки:**
```css
/* ПЛОХО: Фиксированная ширина */
.button { width: 120px; }

/* ХОРОШО: Контентная ширина с ограничениями */
.button {
  width: auto;
  min-width: 80px;
  max-width: 240px;
  padding-inline: var(--space-component-lg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Navigation items:**
- ПЛОХО: Горизонтальный nav с fixed spacing
- ХОРОШО: Flex-wrap или ограничить nav items, или перейти на icon + tooltip для expanded states

**Card titles:**
```css
.card-title {
  min-height: 2lh;   /* 2 line heights */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

**Table cells:**
- ПЛОХО: Фиксированная ширина колонок
- ХОРОШО: `th { min-width: 100px; }` + flexible

### Pseudo-localization тест

Перед отдачей дизайн-системы: запустить pseudo-localization (удлинение строк), все строки x 1.4 (симуляция немецкого), проверить что ничего не сломалось.

Инструменты: i18n Pseudo-localization NPM библиотека, Chrome DevTools: Pseudo-localization mode.

## ЧАСТЬ 4: RTL — «ЗЕРКАЛЬНЫЙ МИР»

### Языки RTL — масштаб рынка
- Арабский (RTL): 420+ миллионов носителей
- Иврит (RTL): 9+ миллионов
- Персидский/Фарси (RTL): 80+ миллионов
- Урду (RTL): 170+ миллионов

### ПРИНЦИП 1: CSS Logical Properties (обязательно)

НЕ ИСПОЛЬЗОВАТЬ (физические): margin-left, margin-right, padding-left, padding-right, border-left, border-right, left, right, text-align: left/right

ИСПОЛЬЗОВАТЬ (логические): margin-inline-start/end, padding-inline-start/end, border-inline-start/end, inset-inline-start/end, text-align: start/end

Почему: logical properties автоматически зеркалируются при dir="rtl"

### ПРИНЦИП 2: HTML dir attribute
```html
<html lang="ar" dir="rtl">
  <!-- весь контент автоматически RTL -->
</html>

<!-- Для смешанного контента: -->
<p dir="auto">Автоопределение направления</p>
<span dir="ltr">English term</span>  <!-- в RTL тексте -->
```

### ПРИНЦИП 3: Что зеркалировать — что нет

**ЗЕРКАЛИРОВАТЬ (flip для RTL):**
- Layout: nav, sidebar, content column positions
- Иконки направления: стрелка вправо становится стрелкой влево
- Breadcrumbs: порядок reversed
- Progress bars: заполнение справа налево
- Слайдеры: увеличение справа налево
- Аккордеоны: иконка с левой стороны (было правая)

**НЕ ЗЕРКАЛИРОВАТЬ:**
- Иконки без направления: сердце, звезда, корзина
- Часы: стрелки всегда по часовой
- Графики и charts (по договорённости)
- Номера телефонов, числа (всегда LTR)
- Email, URL (всегда LTR)
- Видео playback controls
- Логотипы (если не специфично для рынка)

### ПРИНЦИП 4: Typography для RTL

Шрифты с Arabic glyphs: Noto Sans Arabic, IBM Plex Sans Arabic, Cairo, Tajawal (Google Fonts).

Font size: арабский обычно читается лучше при +1-2px по сравнению с латиницей. Использовать em/rem масштабирование.

Line height: арабский требует больше межстрочного (1.6-1.8 вместо 1.5).

### CSS RTL-ready компонент — полный пример

```css
/* Navigation item */
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-component-sm);
  padding-inline: var(--space-component-md); /* logical */
  padding-block: var(--space-component-sm);
  /* Иконка слева в LTR, справа в RTL — автоматически */
}

/* Card с акцентной границей */
.card {
  padding: var(--space-component-lg);
  border-inline-start: 3px solid var(--color-action-primary);
}

/* Input с иконкой */
.input-icon {
  position: absolute;
  inset-inline-start: var(--space-3); /* left в LTR, right в RTL */
  top: 50%;
  transform: translateY(-50%);
}

.input {
  padding-inline-start: var(--space-10); /* место для иконки */
}

/* Breadcrumb separator — auto-flip */
[dir="rtl"] .breadcrumb-separator::before { content: "\2039"; }
[dir="ltr"] .breadcrumb-separator::before { content: "\203A"; }

/* Scroll indicator — fade gradient меняется для RTL */
.scroll-container {
  mask-image: linear-gradient(
    to var(--scroll-end, right),
    transparent 0%, black 5%, black 95%, transparent 100%
  );
}
[dir="rtl"] { --scroll-end: left; }
[dir="ltr"] { --scroll-end: right; }
```



## ЧАСТЬ 5: Локализация и детали реализации

Подробные руководства по форматированию (Intl API, ICU Message Format, локализация изображений, типографика, региональные стандарты и технический стек) вынесены в отдельный справочный документ:
- [i18n-details.md](file:///d:/SMM_plan_2/.agent/skills/internationalization-localization/references/i18n-details.md)

## Step-by-step execution protocol

1. **Identify target locales:** Определить целевые языки и регионы, правовые требования каждого рынка
2. **Audit architecture:** Проверить отделение content от code, все ли строки в translation files
3. **Setup CSS logical properties:** Заменить все left/right на inline-start/end для RTL-ready
4. **Test text expansion:** Запустить pseudo-localization (строки x 1.4), проверить layout
5. **Implement Intl API:** Настроить форматирование дат/чисел/валют через Intl, никогда не хардкодить
6. **Setup ICU MessageFormat:** Настроить pluralization для каждого языка, select для гендера
7. **Audit visual content:** Проверить иконки на культурную нейтральность, изображения на региональную уместность
8. **Typography per script:** Настроить шрифты и line-height для каждого скрипта (Latin, Arabic, CJK)
9. **Legal compliance:** Добавить обязательные элементы по рынкам (GDPR, 152-ФЗ, CCPA, ICP)
10. **Testing pipeline:** Pseudo-localization на CI, visual testing по locale, missing translation detection
11. **Translation management:** Настроить Phrase/Lokalise + i18n Ally, workflow MT -> human review
12. **Cultural review:** Человеческая проверка естественности, уместности, тона для каждого рынка

## Scope boundaries

### DOES
- Проектировать flexible layout для text expansion
- Настраивать RTL поддержку через CSS logical properties
- Аудитить культурную семантику цветов, иконок, изображений
- Рекомендовать pluralization и форматирование через Intl API
- Проектировать архитектуру i18n (4 уровня)
- Рекомендовать правовые требования по рынкам
- Настраивать translation management pipeline
- Проектировать шрифтовые стратегии для многоязычных проектов
- Рекомендовать i18n-тестирование (4 уровня)

### DOES NOT
- Переводить контент (только проектировать для перевода)
- Заменять профессиональных переводчиков и cultural reviewers
- Создавать locale-specific контент (только рекомендации)
- Юридическая консультация (только awareness и чеклисты)
- Настраивать i18n framework (рекомендации по выбору и настройке)

## Error handling

| Scenario | Response |
|----------|----------|
| Нет переводов для тестирования | Использовать pseudo-localization (строки x 1.4), Chrome DevTools pseudo mode |
| RTL ломает layout | Перейти на CSS logical properties полностью, убрать все физические left/right |
| Красный CTA для китайского рынка | Предложить альтернативу: золотой для positive actions, зелёный для go/confirm |
| Нет бюджета на все locales | Приоритизировать: English + top 2 рынка по revenue, pseudo-localization для остальных |
| Русский pluralization не работает | Использовать ICU MessageFormat с all 4 forms: one/few/many/other |
| CJK шрифты слишком тяжёлые | Unicode subset через @font-face, CDN с font subsetting, system font stack fallback |
| Missing translations в проде | CI check: validateTranslations() блокирует деплой если есть пропущенные ключи |
| GDPR cookie banner нужен | Включить в дизайн-систему как обязательный компонент, не откладывать |
| Арабский текст не читается | Проверить: Arabic-specific font, line-height 1.7+, font-size +1-2px |
| Иконки зеркалируются неправильно | Разделить на MIRRORABLE_ICONS и NO_MIRROR_ICONS, проверить каждое RTL-зеркалирование |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)