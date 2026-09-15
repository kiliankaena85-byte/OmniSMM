# ui-theme-architect (L1 Core Invariants)

## Жесткие инварианты (Hard Invariants)
1. **Zero Raw Hex Invariant:** Запрещены фиксированные цвета (`text-white`, `bg-black`, `#hex`) в `src/components/`. Только семантические токены (`text-foreground`, `bg-background`, `bg-card`, `border-border`).
2. **Tailwind 4 CSS-First:** Все темы объявляются строго в `src/app/globals.css` через `@theme` и CSS-переменные. Запрещен `tailwind.config.js`.
3. **WCAG 2.2 AA Contrast Gate:** Контраст пар `foreground/background` и `card-foreground/card` строго $\ge 4.5:1$. Бейджи и крупные элементы $\ge 3.0:1$.
4. **Tenant Isolation:** SMMplan (`smmplan.pro`) строго в Classic API Slate/Sky; SMMflux (`smmflux.ru`) строго в Radiant Aurora / Obsidian. Запрещено смешивать токены брендов.
5. **Data Density & Tabular Nums:** Все финансовые балансы, курсы и цены обязаны иметь класс `tabular-nums`.
6. **Touch Targets $\ge 44\text{px}$:** Все интерактивные кнопки переключения тем и контролы обязаны иметь размер $\ge 44\times 44\text{px}$ на мобильных устройствах.
