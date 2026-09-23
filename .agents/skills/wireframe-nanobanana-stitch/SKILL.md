---
name: wireframe-nanobanana-stitch
description: Сквозной конвейер генеративного UI-дизайна — превращение идеи в wireframe, затем в фотореалистичный макет через Nano Banana (Gemini Flash Image) и в чистый React 19 / Tailwind 4 код через Google Stitch.
tags: [wireframe, nanobanana, gemini-flash-image, google-stitch, generative-ui, design-to-code, zero-slop, react-19, tailwind-4]
---

# wireframe-nanobanana-stitch — Generative UI Pipeline

## 1. Концепция: 4-Этапный Сквозной Конвейер
Скилл автоматизирует полный цикл создания интерфейса:
`Идея (Concept) -> Wireframe (Каркас) -> Nano Banana (Рендеринг) -> Google Stitch (Синтез кода)`

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     ИДЕЯ        │  ──>  │    WIREFRAME    │  ──>  │   NANO BANANA   │  ──>  │  GOOGLE STITCH  │
│ User Story / ТЗ │       │ HTML/SVG скелет │       │ Gemini Flash Img│       │ React 19 код    │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. Фаза 1: Идея -> Wireframe (Информационная Архитектура)

### Правила этапа:
1. **Декомпозиция пользовательского сценария:**
   - Определить главное целевое действие экрана (Primary Action / Focus).
   - Выбрать компоновку: Desktop 12-колоночная сетка или Mobile 1-колоночный стек.
2. **Монохромный стандарт (Monochrome Wireframe Law):**
   - Строго без цветов, финальных теней и украшений.
   - Фон: `bg-gray-50` или `bg-neutral-100`.
   - Контейнеры: `bg-white border border-dashed border-gray-300 rounded-lg`.
   - Текстовые заглушки: скелетоны `h-3 bg-gray-200 rounded animate-pulse`.
   - Картинки/Аватары: серые блоки с крестом `X` или плейсхолдером `[IMG]`.
   - Единственный темный акцент: кнопка главного действия `bg-gray-900 text-white`.
3. **Выходной артефакт:**
   - Интерактивный HTML-файл по шаблону `templates/wireframe-desktop.html` или `templates/wireframe-mobile.html`.
   - Фиксация скриншота экрана для передачи в Nano Banana.

---

## 3. Фаза 2: Wireframe -> Nano Banana (High-Fidelity рендеринг)

**Nano Banana** (Gemini Flash Image / Imagen) выполняет мультимодальную трансформацию скетча в финальный дизайн.

### Шаблон промпта для Nano Banana:
```text
[INPUT ANCHOR]: <FIRST_FRAME>: [Screenshot of the wireframe]
[TASK]: Transform this low-fidelity wireframe into a pixel-perfect, modern high-fidelity UI design.
[GEOMETRY LOCK]: Strictly preserve the exact layout, column grid, component positions, and spacing from the wireframe. Do not move, delete, or hallucinate new interface blocks.
[DESIGN DNA]: {Selected DNA: Swiss Kinetic / Financial Terminal / Obsidian Monolith / Radiant Aurora}
[COLOR SYSTEM]: Background: var(--background), Cards: var(--card), Text: var(--foreground), Accent: var(--primary).
[FIDELITY RULES]:
- Replace wireframe placeholder boxes with realistic high-density data, crisp icons, authentic typography, and tactile UI controls.
- Strictly zero blurry elements, crisp vector UI aesthetic.
- All on-screen text, numbers, and badges must be clean, crisp, and orthographically correct.
```

### 6 Дизайн-ДНК для стилизации:
1. **Swiss Kinetic Precision:** Строгая модульная сетка, плотная типографика sans-serif, сдержанные швейцарские акценты.
2. **Financial Terminal:** Эстетика Linear/Bloomberg: темный монохром, четкие цифры с `tabular-nums`, моноширинный акцент.
3. **Industrial Hardware:** Физические тумблеры, фрезерованные фаски, текстура анодированного алюминия, четкие границы.
4. **Neo-Editorial Luxury:** Контраст крупных заголовков и тонких линий, просторный ритм, журнальный стиль.
5. **Obsidian Monolith:** Глубокий темный монохром, игра матовых и зеркальных фактур, микро-грани света.
6. **Radiant Aurora (Flux DNA):** Темный обсидиановый фон, неоновые акценты (цианово-фиолетовое сияние), матовое стекло (backdrop-blur).

---

## 4. Фаза 3: Nano Banana -> Google Stitch (Декомпозиция & Zero-Slop)

Google Stitch принимает визуальный макет высокой четкости и переводит его в структуру компонентов.

### Анти-клише правила (Zero-Slop Filter):
- ❌ **Purple on Dark:** Запрет кислотного фиолетового неона на черном фоне (за исключением явно заданной темы Aurora).
- ❌ **Icon-Stuffed Bento:** Запрет случайных смайлов и иконок в каждом углу карточки.
- ❌ **Pill Badge Fatigue:** Запрет пульсирующей точки в пилюле над каждым H1.
- ❌ **Blob Mesh Overuse:** Запрет размытых бесформенных цветных пятен на фоне.
- ❌ **Gradient Keyword Fatigue:** Запрет градиентного текста поперек обычных слов.

### Декомпозиция компонентов:
- Главный контейнер (`<LayoutGrid />` или `<PageContainer />`).
- Навигационный блок (`<Sidebar />` или `<Navbar />`).
- Блоки контента / данных (`<DataTable />`, `<MetricCard />`, `<OrderForm />`).
- Панель действий (`<StickyActionBar />` или `<ModalSheet />`).

---

## 5. Фаза 4: Синтез в React 19 & Tailwind 4

Финальный код генерируется с соблюдением стандартов платформы OmniSMM:
1. **Server/Client границы:** `'use client'` только там, где есть хуки (`useState`, `useActionState`).
2. **Семантические токены:** Использование классов Tailwind 4 `@theme` (`bg-background`, `bg-card`, `border-border`, `text-foreground`). Запрет хардкода hex-цветов.
3. **Доступность и верстка:**
   - Zero Horizontal Scroll (100% Fit ширины).
   - Touch Targets $\ge 44\text{px}$ для мобильных устройств.
   - Контраст $\ge 4.5:1$ (WCAG 2.2 AA).
   - Лимит строк компонента $\le 200$ строк (декомпозиция на субкомпоненты).

---

## 6. Чеклист верификации результата
- [ ] Вайрфрейм сгенерирован в монохромном стиле без отвлекающих цветов.
- [ ] В Nano Banana зафиксирована геометрия через `[INPUT ANCHOR] & Geometry Lock`.
- [ ] В Stitch отсечены 5 ИИ-клише Zero-Slop.
- [ ] Сгенерированный код компилируется в TypeScript без ошибок (`tsc --noEmit`).
- [ ] Компоненты адаптивны и не вызывают горизонтального скролла.
