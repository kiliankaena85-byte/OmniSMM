# yandex-gravity-ui-steward (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Gravity Token First:** ЗАПРЕЩЕНО хардкодить цвета. Использовать строго CSS-переменные Gravity UI (`--g-color-base-background`, `--g-color-base-generic`, `--g-color-text-primary`, `--g-color-line-generic`).
2. **Compound Component Rigor:** Компоненты Gravity UI (`Table`, `ActionPanel`, `Dialog`, `Drawer`, `Select`) обязаны конфигурироваться строго по API @gravity-ui/uikit.
3. **Theme Layer Isolation:** Контейнер страницы обязан быть обернут в `<ThemeProvider theme="dark" | "light">` с корректным классом `yc-root`.
4. **High Data Density:** Таблицы данных обязаны использовать плотные размеры строк (`size="s"` или `size="m"`) без горизонтального скролла.
5. **Accessibility Standards:** Все интерактивные элементы обязаны поддерживать клавиатурный фокус и соответствовать WCAG 2.2 AA.

## ⚡ FAST RULES & FORMULAS
- Кнопка действия: `<Button view="action" size="l">Оформить</Button>`.
- Семантический бейдж: `<Label theme="success" size="s">Выполнен</Label>`.
- Карточка поверхности: `bg-[var(--g-color-base-generic)] border border-[var(--g-color-line-generic)] rounded-lg`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Обернут ли корень в ThemeProvider Gravity UI?
- [ ] Используются ли семантические токены поверхностей вместо Tailwind hex-цветов?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
