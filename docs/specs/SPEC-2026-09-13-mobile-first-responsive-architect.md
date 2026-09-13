# SPEC-2026-09-13: Mobile-First Responsive Architect

## 1. Metadata
- **Status:** APPROVED
- **Author:** Fullstack Architect & Senior Frontend Lead
- **Risk-Tier:** Tier 2 (Standard Architectural Skill)
- **Target Stack:** Next.js 16 (App Router), React 19, Tailwind CSS 4 (@theme), HeroUI v3

---

## 2. Problem Statement & Motivation
Разработка современных веб-интерфейсов часто страдает от синдрома «Desktop-First Retrofitting»: интерфейс проектируется под экран монитора 1920x1080, а затем мучительно ужимается под смартфоны с помощью хаотичных @media (max-width: ...) или max-md: костылей.
В результате на мобильных устройствах возникают критические дефекты:
- Горизонтальная прокрутка и неконтролируемое переполнение.
- «Залипание» :hover состояний на сенсорных экранах.
- Принудительный аппаратный зум страницы на iOS Safari из-за шрифтов < 16px в инпутах.
- Перекрытие кнопок действий системной панелью жестов (Home Indicator).
- Прыжки верстки из-за плавающей высоты адресной строки мобильного браузера (100vh).
- Неудобство использования интерфейса одной рукой (нажатие кнопок в верхней части экрана).

Скилл `mobile-first-responsive-architect` закрепляет единый норматив: **«Любой интерфейс платформы сначала проектируется и пишется под смартфон (320–390px), а затем прогрессивно обогащается под планшеты и десктоп»**.

---

## 3. Core Architectural Invariants

### Invariant 1: Mobile-First CSS Principle (Ascending Breakpoints Only)
- Все базовые классы Tailwind (`w-full`, `flex-col`, `gap-3`, `p-3`, `text-base`) описывают компактный смартфон (320–390px).
- Расширение под планшеты и десктоп выполняется строго через восходящие медиа-запросы:
  - `sm:` (>= 640px) — фаблеты / горизонтальный смартфон.
  - `md:` (>= 768px) — планшеты / iPad.
  - `lg:` (>= 1024px) — ноутбуки.
  - `xl:` (>= 1280px) — десктоп мониторы.
- ❌ **ЗАПРЕЩЕНО** использовать классы `max-sm:`, `max-md:`, `max-lg:` в качестве основного каркаса верстки.

### Invariant 2: Dynamic Viewport Units (`dvh`) & Safe Area Insets
- ❌ **ЗАПРЕЩЕНО** использовать фиксированные `h-screen` / `h-[100vh]` для полноэкранных мобильных контейнеров.
- ✅ Обязательно использовать динамические единицы: `min-h-dvh` или `h-dvh` (Dynamic Viewport Height).
- ✅ Все фиксированные или прилипающие нижние элементы (Sticky CTA, Bottom Navigation) обязаны учитывать системные отступы:
  `pb-[calc(1rem+env(safe-area-inset-bottom,0px))]` и `pt-[env(safe-area-inset-top,0px)]`.

### Invariant 3: iOS Safari Auto-Zoom Immunity (Input Font Floor >= 16px)
- Все поля ввода (`input`, `textarea`, `select`) на мобильном экране обязаны иметь размер шрифта не менее 16px (`text-base` или `text-[16px]`).
- На экранах планшетов и десктопов допускается компактный шрифт: `text-base md:text-sm`.
- ❌ Нарушение этого правила на iOS вызывает автоматический зум экрана при тапе на инпут, ломая макет страницы.

### Invariant 4: Touch Ergonomics & Thumb Zone
- Главные кнопки действий (CTA, «Оформить», «Пополнить», подтверждение) обязаны размещаться в нижней трети экрана (Natural Thumb Reach Zone).
- Все интерактивные элементы обязаны соответствовать стандарту WCAG 2.2 Target Size: >= 44px x 44px.
- Для устранения 300мс задержки двойного тапа используется `touch-action: manipulation`.
- Ховер-эффекты обязаны быть защищены от залипания на тач-экранах через `md:hover:...` или `@media (hover: hover)`.

### Invariant 5: Progressive Component Polymorphism
Компоненты трансформируются по схеме:
1. **Навигация:** Mobile Bottom Tabs / Drawer -> Desktop Sticky Header / Sidebar.
2. **Данные:** Mobile Card Stack -> Desktop Compact Table.
3. **Модальные окна:** Mobile Bottom Sheet (шторка снизу с жестом свайпа) -> Desktop Centered Modal.
4. **Сетки:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.

---

## 4. Verification & Testing Strategy
- Unit-тесты контрактов и валидности файлов в `src/__tests__/skills/mobile-first-responsive-architect.test.ts`.
- Тесты маршрутизации через JIT Router `routeSkillIntent`.
- Проверка сборки типов `tsc --noEmit` и сканирование секретов.
