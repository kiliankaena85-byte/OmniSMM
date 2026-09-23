---
name: design-guild-council
description: Флот из 15 узкоспециализированных дизайн-агентов (Atomic Design Guild v6.0 Optical Edition) для бескомпромиссного контроля шрифтов, кнопок, отступов, орфографии, CRO, анимаций, цветов, доступности WCAG 2.2, двух брендов (Dual-Brand), темной/светлой тем, UI Арсенала, токенов @theme Tailwind 4 и оптического рендеринга (Above-The-Fold, Occlusion, Computed Contrast).
---

# 🎨 DESIGN GUILD COUNCIL (Atomic Design Fleet v6.0 Optical Edition)

Флот из 15 узкоспециализированных дизайн-агентов Antigravity для предотвращения расфокусировки и автоматического аудита каждого визуального, оптического, тематического и смыслового слоя интерфейса.

---

## 👥 Полный Состав Гильдии Дизайна (15 Узких Ролей)

### 🅰️ 1. Блок Типографики и Текста
1. **🅰️ `Typography-Sentinel` (Шрифты и Иерархия):**
   * Контроль сжатия трекинга заголовков (`tracking-tight` для текстов $> 24\text{px}$);
   * Обязательное использование `font-mono tabular-nums` для всех финансовых сумм и счетчиков;
   * Выравнивание вертикального ритма и интерлиньяжа.
2. **✍️ `Orthography-UX-Writer` (Русский Язык и Микрокопирайтинг):**
   * Длинное тире («—») вместо минуса или дефиса;
   * Кавычки-ёлочки («...») вместо прямых кавычек;
   * Неразрывные пробелы перед союзами и предлогами;
   * Единая понятная терминология без англицизмов.
3. **🎯 `CRO-Marketing-Optimizer` (Конверсии и Призывы к Действию):**
   * Главный CTA-элемент в зоне первого экрана;
   * Яркие триггеры доверия (Trust Badges, логотипы МИР/СБП/ЮKassa);
   * Снижение когнитивного трения в формах.

---

### 🔘 2. Блок Интерактива, Сетки и Физики
4. **🔘 `Button-Interactive-Ops` (Кнопки и Интерактив):**
   * Минимальный размер touch-target: **$44 \times 44\text{px}$** (`min-h-[44px]`);
   * Обязательный плавный переход: `transition-all duration-200`;
   * Тактильный отклик при клике: `active:scale-[0.98]`;
   * Запрет `disabled` кнопок при невалидной форме (перехват с `animate-shake`).
5. **📐 `Spacing-Grid-Architect` (Сетки и 8pt Отступы):**
   * Строгий запрет произвольных отступов (`p-[13px]`, `gap-[7px]`);
   * Использование системной шкалы Tailwind 4 (`gap-1.5`, `gap-2`, `gap-3`, `gap-4`, `gap-6`);
   * Пропорциональные внутренние отступы карточек и внешние отступы секций.
6. **🪐 `Motion-Microphysics-Lead` (Микроанимации и Физика):**
   * Пружинная физика Framer Motion (`spring stiffness: 500, damping: 20`);
   * Длительность анимаций $150\text{–}250\text{ms}$ без задержек ввода;
   * 0 кумулятивных сдвигов макета (Cumulative Layout Shift = 0).
7. **📱 `Mobile-Ergonomics-Lead` (Мобильный UX):**
   * Управление в зоне большого пальца (Thumb Zone);
   * Защита от горизонтального скролла (`overflow-x-clip`);
   * Поддержка безопасных зон iOS/Android (`env(safe-area-inset-bottom)`).

---

### 🎨 3. Блок Темизации и Дизайн-Системы (v5.5)
8. **🎨 `Color-Token-Guardian` (Семантические Цвета):**
   * Запрет сырых цветов (`text-white`, `bg-black`, `text-blue-500`);
   * Строго семантические токены: `text-foreground`, `bg-background`, `bg-card`, `border-border`, `text-primary`.
9. **🎭 `Dual-Brand-Isolationist` (Архитектор Двух Брендов):**
   * Полная изоляция **SMMplan** (B2B Classic) и **SMMflux** (Radiant Aurora);
   * Запрет утечек стилей и упоминания несуществующего бренда *Lovable*.
10. **🌓 `Dark-Light-Contrast-Enforcer` (Двухрежимная Темизация):**
    * Идеальная читаемость в Dark Mode и Light Mode;
    * Запрет жестко захардкоженного темного фона без `dark:` префикса;
    * Предотвращение коллизий инвертированных токенов (`text-primary-foreground` на темном фоне).
11. **🧱 `UI-Arsenal-Component-Linter` (Хранитель Компонентного Арсенала):**
    * Запрет сырых HTML-тегов (`<table>`, `<button>`);
    * Обязательное использование готовых компонентов из `@/components/ui` и HeroUI v3 (dot notation).
12. **💎 `Elevation-Shadow-Director` (Режиссер Глубины и Свечений):**
    * Стандартизированные слои z-index: `z-10` (панели), `z-40` (сайдбар), `z-50` (модалки), `z-[100]` (тосты);
    * Неоновые диффузные свечения для SMMflux и строгие тени для SMMplan.
13. **🧬 `Design-Token-Validator` (Аудитор @theme Tailwind 4):**
    * Проверка CSS-first переменных в `src/app/globals.css`;
    * Исключение устаревших конструкций Tailwind 3 (`bg-opacity-*`).
14. **♿ `WCAG-Accessibility-Guard` (Доступность):**
    * Цветовой контраст $\ge 4.5:1$ (AA standard);
    * Поддержка навигации с клавиатуры, фокусные рамки (`focus-visible:ring-2`);
    * Наличие `aria-label` у иконочных кнопок.

---

### 👁️ 4. Блок Оптического и Пиксельного Контроля (NEW v6.0)
15. **👁️ `Visual-Pixel-Inspector` (Оптический и Визуальный Аудитор):**
    * **Above-The-Fold Guarantee:** Контроль высоты первого экрана (поле ввода и главный CTA обязаны быть видны без скролла);
    * **Click Hijack & Occlusion Guard:** Обязательное наличие `pointer-events-none` на всех фоновых блюрах (`blur-3xl`, `bg-*-500/10`), чтобы они не перехватывали клики по инпутам и кнопкам;
    * **Computed Contrast Matrix:** Проверка вычисленных цветов фона и текста в темной теме с учетом инверсии `--color-primary-foreground`;
    * **390px Viewport Overflow Guard:** Гарантия отсутствия горизонтального переполнения экрана.

---

## ⚡ Использование через CLI-Харнес

```bash
# Комплексный аудит всей B2B-экосистемы SMMplan (15 агентов)
npx tsx scripts/harness/design-guild.ts audit smmplan

# Комплексный аудит неоновой экосистемы SMMflux (15 агентов)
npx tsx scripts/harness/design-guild.ts audit smmflux

# Аудит конкретного компонента
npx tsx scripts/harness/design-guild.ts audit src/components/ab-test/FluxOrderClient.tsx
```
