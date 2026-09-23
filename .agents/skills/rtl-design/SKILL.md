---
name: rtl-design
description: "RTL Design: CSS logical properties, зеркалирование layout/иконок, bidi контент, Arabic/Hebrew typography. Активировать при RTL поддержке, при арабском/иврите, при зеркалировании layout, при CSS logical properties. ALWAYS activate for RTL, right-to-left, Arabic, Hebrew, bidi, dir attribute, logical properties, icon mirroring. Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# RTL Design — «Зеркальный мир»

## When to activate

- Нужна RTL (right-to-left) поддержка (арабский, иврит, фарси, урду)
- Проектирование layout для международных рынков
- Пользователь упоминает RTL, right-to-left, Arabic, Hebrew, bidi, dir
- Выбор CSS свойств (нужно использовать logical properties)
- Зеркалирование иконок и directional элементов

## Языки RTL — масштаб рынка

- Арабский (RTL): 420+ миллионов носителей
- Иврит (RTL): 9+ миллионов
- Персидский/Фарси (RTL): 80+ миллионов
- Урду (RTL): 170+ миллионов

При поддержке арабского вы немедленно получаете доступ к 420+ миллионам носителей, рынкам MENA со значительной покупательной способностью, конкурентному преимуществу в регионе.

## ПРИНЦИП 1: CSS Logical Properties (обязательно)

### НЕ ИСПОЛЬЗОВАТЬ (физические):
- margin-left, margin-right
- padding-left, padding-right
- border-left, border-right
- left, right (в position)
- text-align: left / right

### ИСПОЛЬЗОВАТЬ (логические):
- margin-inline-start, margin-inline-end
- padding-inline-start, padding-inline-end
- border-inline-start, border-inline-end
- inset-inline-start, inset-inline-end
- text-align: start / end

Почему: logical properties автоматически зеркалируются при dir="rtl"

## ПРИНЦИП 2: HTML dir attribute

```html
<html lang="ar" dir="rtl">
  <!-- весь контент автоматически RTL -->
</html>

<!-- Для смешанного контента: -->
<p dir="auto">Автоопределение направления</p>
<span dir="ltr">English term</span>  <!-- в RTL тексте -->
```

## ПРИНЦИП 3: Что зеркалировать — что нет

### ЗЕРКАЛИРОВАТЬ (flip для RTL):
- Layout: nav, sidebar, content column positions
- Иконки направления: стрелка вправо -> стрелка влево
- Breadcrumbs: порядок reversed
- Progress bars: заполнение справа налево
- Слайдеры: увеличение справа налево
- Аккордеоны: иконка с левой стороны (было правая)

### НЕ ЗЕРКАЛИРОВАТЬ:
- Иконки без направления: сердце, звезда, корзина
- Часы: стрелки всегда по часовой
- Графики и charts (по договорённости)
- Номера телефонов, числа (всегда LTR)
- Email, URL (всегда LTR)
- Видео playback controls
- Логотипы (если не специфично для рынка)

## ПРИНЦИП 4: Typography для RTL

Шрифты с Arabic glyphs: Noto Sans Arabic, IBM Plex Sans Arabic, Cairo, Tajawal (Google Fonts).

Font size: арабский обычно читается лучше при +1-2px. Использовать em/rem.

Line height: арабский требует больше межстрочного (1.6-1.8 вместо 1.5).

## Полный CSS пример RTL-ready компонента

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
.input-wrapper { position: relative; }

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

/* Icon mirroring */
[dir="rtl"] .icon--mirrored { transform: scaleX(-1); }
```

## Directional иконки — чёткие списки

```typescript
// Зеркалировать в RTL:
const MIRRORABLE_ICONS = [
  'arrow-left', 'arrow-right', 'chevron-left', 'chevron-right',
  'forward', 'reply', 'undo', 'redo', 'text-align-left'
]

// НЕ зеркалировать:
const NO_MIRROR_ICONS = [
  'search', 'heart', 'star', 'trash', 'settings',
  'user', 'home', 'clock', 'calendar', 'checkmark', 'close'
]
```

## Step-by-step execution protocol

1. **Audit CSS:** Найти все физические свойства (left/right) и заменить на logical
2. **Add dir attribute:** Установить html lang + dir для RTL локалей
3. **Test layout:** Переключить на арабский locale, проверить зеркалирование
4. **Audit icons:** Разделить на mirrorable и no-mirror, добавить CSS классы
5. **Fix typography:** Подключить Arabic шрифты, увеличить line-height
6. **Visual regression:** Скриншоты LTR vs RTL для ключевых страниц
7. **Test forms:** Проверить input, select, date picker в RTL режиме

## Scope boundaries

### DOES
- Настраивать RTL через CSS logical properties
- Зеркалировать layout и иконки
- Рекомендовать Arabic/Hebrew шрифты и типографику
- Настраивать HTML dir attribute

### DOES NOT
- Обрабатывать text expansion (используй text-expansion skill)
- Переводить контент на арабский/иврит
- Настраивать translation management (используй internationalization-localization skill)

## Error handling

| Scenario | Response |
|----------|----------|
| RTL ломает layout | Аудит: найти все физические left/right, заменить на logical properties |
| Иконки зеркалируются неправильно | Разделить на MIRRORABLE и NO_MIRROR списки, проверить каждое |
| Арабский текст не читается | Проверить: Arabic-specific font, line-height 1.7+, font-size +1-2px |
| Bidi контент смешивается | Использовать dir="auto" для пользовательского контента, dir="ltr" для email/URL |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)