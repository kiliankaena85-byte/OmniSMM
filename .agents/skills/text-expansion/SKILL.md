---
name: text-expansion
description: "Text Expansion для i18n: German Test, expansion rates по языкам, pseudo-localization, CSS решения для кнопок/nav/cards/tables. Активировать при проверке layout на переполнение при переводе, при pseudo-localization тестировании, при проектировании flexible контейнеров. ALWAYS activate for i18n text overflow, German test, pseudo-localization, flexible layout design for translations. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Text Expansion — «Немецкий тест» и гибкий layout

## When to activate

- Проект переводится на другие языки (даже 1 дополнительный = нужен)
- Проверка layout на переполнение при длинных переводах
- Проектирование кнопок, навигации, карточек, таблиц для i18n
- Pseudo-localization тестирование
- Пользователь упоминает text expansion, German test, overflow, i18n layout

## Expansion rates по языкам (English baseline = 100%)

| Язык | Expansion | Примечание |
|------|-----------|------------|
| Немецкий | +35-50% | Самый длинный в EU, "German Test" стандарт |
| Французский | +15-25% | |
| Испанский | +15-25% | |
| Португальский | +15-20% | |
| Итальянский | +15-20% | |
| Русский | +15-20% | |
| Арабский | +20-25% | + RTL |
| Японский | -30-40% | Более компактный (иероглифы) |
| Корейский | -10-20% | |
| Китайский | -30-40% | Самый компактный |

**Практическое правило:** Если текст умещается в немецком — умещается везде. "German Test" как стандартная QA проверка перед отдачей макетов.

## CSS решения для expansion

### Кнопки

```css
/* ПЛОХО: Фиксированная ширина — ломается при длинных переводах */
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

### Navigation items

- ПЛОХО: Горизонтальный nav с fixed spacing
- ХОРОШО: Flex-wrap или ограничить nav items
- Альтернатива: icon + tooltip для expanded states

### Card titles

```css
.card-title {
  min-height: 2lh;   /* 2 line heights — резерв для expansion */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

### Table cells

```css
/* ПЛОХО: Фиксированная ширина колонок */
th { width: 150px; }

/* ХОРОШО: min-width + flexible */
th { min-width: 100px; }
```

## Pseudo-localization тест

Перед отдачей дизайн-системы:
1. Запустить pseudo-localization (удлинение строк)
2. Все строки x 1.4 (симуляция немецкого)
3. Проверить: ничего не сломалось?

Инструменты:
- i18n Pseudo-localization NPM библиотека
- Chrome DevTools: Pseudo-localization mode
- next-intl built-in pseudo mode

Когда: на каждой CI итерации, перед каждым релизом

## Чеклист проверки

- [ ] Все кнопки выдерживают немецкий текст (+40%)
- [ ] Навигация не ломается при expansion
- [ ] Card titles имеют min-height для 2 строк
- [ ] Table columns используют min-width, не fixed width
- [ ] Pseudo-localization не вызывает overflow
- [ ] Текст с ellipsis имеет tooltip для полного текста
- [ ] Японский/китайский текст не делает кнопки слишком маленькими

## Step-by-step execution protocol

1. **Identify target languages:** Определить языки перевода и их expansion rates
2. **Run pseudo-localization:** Удлинить все строки на 40% в dev-режиме
3. **Audit buttons:** Проверить все кнопки на overflow при expansion
4. **Audit navigation:** Проверить nav на переполнение
5. **Audit cards:** Проверить card titles на min-height
6. **Audit tables:** Проверить колонки на flexible width
7. **Fix CSS:** Заменить fixed widths на min-width/max-width
8. **Visual regression:** Скриншот-сравнение до/после pseudo-localization

## Scope boundaries

### DOES
- Проектировать flexible layout для text expansion
- Рекомендовать CSS решения для кнопок, нав, карточек, таблиц
- Настраивать pseudo-localization pipeline
- Проверять layout на переполнение при переводах

### DOES NOT
- Переводить контент
- Заменять RTL обработку (используй rtl-design skill)
- Проектировать шрифтовую систему (используй multilingual-typography skill)

## Error handling

| Scenario | Response |
|----------|----------|
| Немецкий текст ломает layout | Заменить fixed width на min-width/max-width, добавить text-overflow: ellipsis |
| Японский текст делает кнопку слишком маленькой | Установить min-width на кнопках |
| Pseudo-localization показывает hardcoded строки | Найти и вынести в translation files |
| Нет возможности запустить pseudo-localization | Ручная проверка: заменить все строки на "XXXXX" длиной x1.4 |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)