# mobile-first-responsive-architect (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Mobile-First Breakpoint Invariant:** Сначала пишется мобильный каркас (320–390px). Запрещено использовать `max-md:`, `max-lg:` как основу верстки. Только восходящие брейкпоинты (`base` -> `sm:` -> `md:` -> `lg:` -> `xl:`).
2. **Dynamic Viewport Height (`dvh`):** ЗАПРЕЩЕНО использовать `h-screen` / `100vh`. Использовать строго `h-dvh` или `min-h-dvh` для защиты от сдвигов адресной строки iOS Safari и Android Chrome.
3. **Safe Area Insets:** Все фиксированные нижние панели (Sticky CTA, Bottom Tabs) обязаны иметь отступ `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`.
4. **iOS Auto-Zoom Guard:** Шрифты всех полей ввода (`input`, `textarea`, `select`) на мобильном обязаны быть $\ge 16\text{px}$ (`text-base md:text-sm`). Шрифт < 16px на iOS вызывает принудительный зум.
5. **Touch Target Floor & Fast Taps:** Кликабельные элементы строго $\ge 44\text{px} \times 44\text{px}$ с `touch-action: manipulation`. Ховеры строго с защитой от залипания (`md:hover:...`).

## ⚡ FAST RULES & FORMULAS
- Контейнер экрана: `flex flex-col min-h-dvh w-full px-4 py-3 md:px-8 md:py-6`.
- Сетка карточек: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4`.
- Плавающий нижний бар: `fixed bottom-0 inset-x-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-background/95 backdrop-blur border-t border-border z-40 md:static md:p-0 md:border-0`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Базовые стили проверены на ширине 360px без горизонтальной прокрутки?
- [ ] Инпуты имеют размер `text-base` (16px) на мобильном?
- [ ] Учтен ли Home Indicator снизу (`safe-area-inset-bottom`)?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
