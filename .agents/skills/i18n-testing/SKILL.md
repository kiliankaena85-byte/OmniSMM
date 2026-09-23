---
name: i18n-testing
description: "I18N Testing: 4 уровня тестирования (pseudo-localization, visual, functional, cultural), missing translation detection, automated i18n audit через browser agent. Активировать при настройке i18n тестирования, при CI/CD для многоязычных проектов, при проверке качества локализации. ALWAYS activate for i18n testing, pseudo-localization, visual locale testing, missing translation detection, i18n CI/CD, locale v... Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# I18N Testing — 4 уровня проверки

## When to activate

- Настройка тестирования для многоязычного проекта
- CI/CD pipeline для i18n
- Проверка качества локализации
- Pseudo-localization перед релизом
- Missing translation detection
- Пользователь упоминает i18n testing, pseudo-localization, locale QA

## УРОВЕНЬ 1: Pseudo-localization (без переводчиков)

Заменяет все символы на удлинённые unicode версии: "Settings" -> "[Setttings n n n]". Обнаруживает hardcoded строки и layout overflow без реальных переводов.

**Инструменты:**
- pseudo-localization npm package
- next-intl built-in pseudo mode
- Chrome DevTools: Emulate locale

**Когда:** на каждой CI итерации, перед каждым релизом

**Проверяет:**
- [ ] Hardcoded строки (не в translation files)
- [ ] Layout overflow при расширении текста
- [ ] Обрезанный текст без ellipsis/tooltip
- [ ] Fixed-width контейнеры

## УРОВЕНЬ 2: Visual Testing (браузерный агент)

Browser Agent переключает locale и делает screenshots для сравнения:

```typescript
const localesForVisualTest = ['en', 'de', 'ar', 'ja', 'ru']

for (const locale of localesForVisualTest) {
  await page.goto(`/${locale}/dashboard`)
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot(
    `dashboard-${locale}.png`,
    { fullPage: true }
  )
}
```

**Чеклист:**
- [ ] Текст не overflow из контейнеров (немецкий)
- [ ] RTL layout корректен (арабский)
- [ ] Шрифты загрузились (CJK)
- [ ] Числа/даты в правильном формате
- [ ] Иконки зеркалируются где нужно (RTL)

**Инструменты:** Playwright visual regression, Percy, Chromatic

## УРОВЕНЬ 3: Functional Testing

- Сортировка работает по locale правилам (Intl.Collator)
- Date picker начинается с правильного дня недели
- Number input принимает local decimal separator
- Form validation messages на правильном языке
- Error messages локализованы
- Currency форматирование корректно
- Pluralization работает для всех форм

## УРОВЕНЬ 4: Cultural Review (человеческий)

Нельзя автоматизировать:
- Естественность переводов
- Культурная уместность изображений
- Тон и голос в контексте культуры
- Правовые требования конкретного рынка

## Missing Translation Detection

```typescript
// CI check на пропущенные переводы
import { validateTranslations } from './i18n-validator'

const result = validateTranslations({
  baseLocale: 'en',
  locales: ['de', 'fr', 'ru', 'ar', 'ja'],
  translationDir: './locales'
})

if (result.missing.length > 0) {
  console.error('Missing translations:')
  result.missing.forEach(({ locale, key }) => {
    console.error(`  [${locale}] ${key}`)
  })
  process.exit(1)  // Блокировать CI
}
```

## Automated I18N Audit через Browser Agent

1. Переключает все локали по очереди
2. Скриншотит ключевые страницы
3. Сравнивает: текст overflow? RTL корректен?
4. Проверяет: все строки переведены? (ищет английские строки на не-English локале)
5. Генерирует i18n health report
6. Сохраняет в brain/i18n/audit-[locale].md

## CI/CD Integration

```yaml
# .github/workflows/i18n-check.yml
name: I18N Check
on: [push, pull_request]
jobs:
  i18n:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check missing translations
        run: npx i18n-validator --base-locale en --locales de,fr,ru,ar,ja
      - name: Pseudo-localization visual test
        run: npx playwright test --project=pseudo-l10n
      - name: Visual regression per locale
        run: npx playwright test --project=visual-l10n
```

## Step-by-step execution protocol

1. **Setup pseudo-localization:** Добавить в dev-режим и CI pipeline
2. **Setup visual regression:** Playwright screenshots для каждого locale
3. **Add missing translation check:** validateTranslations() блокирует CI при пропущенных ключах
4. **Write functional tests:** Проверить сортировку, даты, числа, pluralization
5. **Schedule cultural review:** Человеческая проверка перед каждым релизом на новом рынке
6. **Generate i18n health report:** Автоматический отчёт по результатам всех 4 уровней

## Scope boundaries

### DOES
- Настраивать pseudo-localization pipeline
- Настраивать visual regression по locale
- Настроить missing translation detection в CI
- Рекомендовать functional i18n тесты
- Генерировать i18n health reports

### DOES NOT
- Выполнять культурный review (только рекомендовать процесс)
- Переводить контент
- Заменять human QA для cultural appropriateness
- Настраивать translation management

## Error handling

| Scenario | Response |
|----------|----------|
| Missing translations обнаружены в CI | Блокировать деплой, вывести список [locale] key |
| Pseudo-localization показывает overflow | Создать баг с приоритетом, исправить CSS контейнеры |
| RTL visual regression failed | Проверить: logical properties, icon mirroring, font loading |
| CJK шрифты не загружаются на тесте | Проверить: unicode-range, CDN доступность, font-display |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)