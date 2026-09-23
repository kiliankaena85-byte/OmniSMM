---
name: multilingual-typography
description: "Multilingual Typography: шрифтовые стратегии по скриптам (Latin, Cyrillic, Arabic, CJK, Hebrew), Unicode font coverage, line-height по скриптам, @font-face с unicode-range. Активировать при выборе шрифтов для многоязычных проектов, при настройке типографики для RTL, при CJK поддержке. ALWAYS activate for multilingual fonts, Arabic typography, CJK fonts, Cyrillic fonts, unicode-range, script-specific line-h... Use this skill to scan, check, and validate when auditing or implementing this topic."
version: 1.0.0
---

# Multilingual Typography — шрифты для всего мира

## When to activate

- Выбор шрифтов для многоязычного проекта
- Нужна поддержка Arabic, CJK, Hebrew скриптов
- Настройка line-height для разных скриптов
- Настройка @font-face с unicode-range
- Пользователь упоминает Arabic fonts, CJK fonts, multilingual typography

## Unicode и font coverage

### Минимальные требования для coverage

| Скрипт | Unicode range | Языки |
|--------|---------------|-------|
| Latin Extended | U+0000-00FF + диакритика | Европейские языки |
| Cyrillic | U+0400-045F + расширенная | Русский, болгарский |
| Arabic | U+0600-06FF + forms | Арабский, фарси, урду |
| CJK Unified | U+4E00-9FFF + kana/hangul | Китайский, японский, корейский |
| Hebrew | U+0590-05FF | Иврит |

## Шрифтовая стратегия по скриптам

### Latin + Cyrillic (один шрифт может покрыть оба)

- **Geist:** Имеет Cyrillic extension
- **Inter:** Полный Cyrillic support
- **IBM Plex Sans:** Cyrillic + Arabic варианты

```css
@font-face {
  font-family: 'Geist';
  unicode-range: U+0000-00FF, U+0131, U+0152-0153;
  src: url('/fonts/geist-latin.woff2');
}

@font-face {
  font-family: 'Geist';
  unicode-range: U+0400-045F, U+0490-0491;
  src: url('/fonts/geist-cyrillic.woff2');
}
```

### Arabic

- Noto Sans Arabic (Google, бесплатно)
- IBM Plex Sans Arabic
- Cairo, Tajawal (Google Fonts)

Критично: арабский = cursive скрипт. Буквы соединяются по-разному в зависимости от позиции в слове. ТОЛЬКО font с Arabic OpenType features. Обычные шрифты НЕ работают.

### CJK (Chinese/Japanese/Korean)

- CJK шрифты огромные: 5-10MB
- Google Fonts: Noto Sans SC/TC/JP/KR
- Стратегия: только нужные символы через Unicode subset
- Или: CDN с font subsetting

```css
@font-face {
  font-family: 'Noto Sans';
  unicode-range: U+4E00-9FFF;  /* CJK Unified */
  src: url('/fonts/noto-sans-cjk.woff2');
}
```

### Hebrew

- Noto Sans Hebrew, Heebo (Google Fonts)
- Похоже на арабский: RTL, специфичные глифы

## Line height по скриптам

| Скрипт | Line height | Причина |
|--------|-------------|---------|
| Latin | 1.5 | Стандарт |
| Cyrillic | 1.5 | То же |
| Arabic | 1.7-1.8 | Нужно больше места для диакритики |
| CJK | 1.6-1.75 | Иероглифы плотнее |
| Hebrew | 1.6-1.7 | Специфика глифов |

```css
:lang(ar) { line-height: 1.75; }
:lang(ja), :lang(zh) { line-height: 1.65; }
:lang(he) { line-height: 1.65; }
```

## Шрифтовая система — рекомендуемая архитектура

```css
:root {
  --font-body: 'Geist', 'Noto Sans Arabic', 'Noto Sans SC', sans-serif;
  --font-heading: 'Geist', 'Noto Sans Arabic', 'Noto Sans SC', sans-serif;
  --font-mono: 'Geist Mono', monospace;
}

/* Language-specific overrides */
:lang(ar) {
  --font-body: 'Noto Sans Arabic', sans-serif;
  --font-heading: 'Noto Sans Arabic', sans-serif;
}

:lang(ja) {
  --font-body: 'Noto Sans JP', sans-serif;
}

:lang(zh) {
  --font-body: 'Noto Sans SC', sans-serif;
}
```

## Чеклист проверки

- [ ] Все скрипты целевых языков покрыты шрифтами
- [ ] @font-face использует unicode-range для оптимизации загрузки
- [ ] Line-height адаптирован для каждого скрипта
- [ ] Arabic шрифты имеют OpenType features
- [ ] CJK шрифты подгружаются через subset или CDN
- [ ] Fallback шрифты указаны для каждого скрипта
- [ ] Font-display: swap для предотвращения FOIT

## Step-by-step execution protocol

1. **Identify target scripts:** Определить какие скрипты нужны (Latin, Cyrillic, Arabic, CJK, Hebrew)
2. **Select fonts:** Выбрать шрифты с coverage для каждого скрипта
3. **Setup @font-face:** Настроить unicode-range для каждого скрипта
4. **Adjust line-height:** Установить скрипт-специфичный line-height через :lang()
5. **Optimize loading:** Unicode subsetting, font-display: swap, preload critical fonts
6. **Test rendering:** Проверить рендеринг на всех целевых языках
7. **Test performance:** Измерить вес загружаемых шрифтов, оптимизировать если > 200KB

## Scope boundaries

### DOES
- Рекомендовать шрифты по скриптам
- Настраивать @font-face с unicode-range
- Устанавливать скрипт-специфичный line-height
- Оптимизировать загрузку шрифтов

### DOES NOT
- Проектировать layout (используй text-expansion skill)
- Настраивать RTL (используй rtl-design skill)
- Создавать кастомные шрифты
- Настраивать translation management

## Error handling

| Scenario | Response |
|----------|----------|
| CJK шрифт слишком тяжёлый (5-10MB) | Unicode subset через @font-face, CDN с font subsetting, system font fallback |
| Arabic текст не читается | Проверить: Arabic-specific font с OpenType features, line-height 1.7+ |
| Нет шрифта с Cyrillic support | Добавить отдельный @font-face для U+0400-045F, использовать Inter как fallback |
| FOIT (Flash of Invisible Text) | Добавить font-display: swap, preload critical fonts |

## References

- [SMMplan Design Specification](file:///d:/SMM_plan_2/docs/design_specification.md)
- [SMMplan Legal Audits](file:///d:/SMM_plan_2/production_readiness_audit.md)