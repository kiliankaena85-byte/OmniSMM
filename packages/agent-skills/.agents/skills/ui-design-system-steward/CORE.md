# ui-design-system-steward (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Запрет хардкода цветов:** ЗАПРЕЩЕНО писать inline цвета (`bg-white`, `text-black`, `bg-blue-600`, `border-gray-200`). Разрешены строго семантические токены (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border-border`, `bg-card`).
2. **Tailwind CSS 4 First:** Никаких `tailwind.config.js` — все дизайн-токены объявляются через `@theme` в `src/app/globals.css`.
3. **Zero Brand Bleeding:** Запрещено всплытие неоновых стилей или классов SMMflux на страницах витрины SMMplan и наоборот.
4. **Contrast Ratio Floor:** Контрастность текста к фону обязана быть $\ge 4.5:1$ для стандартного текста и $\ge 3:1$ для крупных заголовков и бейджей.
5. **No Style Leaks in Portals:** Выпадающие меню и модалки обязаны наследовать базовые переменные темы корня приложения.

## ⚡ FAST RULES & FORMULAS
- Поверхность карточки: `bg-card text-card-foreground border border-border rounded-xl`.
- Приглушенный текст: `text-muted-foreground text-xs`.
- Семантический акцент: `bg-primary text-primary-foreground hover:bg-primary/90`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Нет ли хардкодных цветов (`text-white`, `bg-black`, `gray-*`)?
- [ ] Поддерживает ли верстка одинаково четкий контраст в светлой и темной теме?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*\n