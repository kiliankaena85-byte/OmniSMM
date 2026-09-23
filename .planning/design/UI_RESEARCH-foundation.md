# 🎨 Smmplan — UI/UX Design Foundation

> Единый источник правды по дизайн-идентичности, терминологии и визуальным стандартам.
> Создан на основе мульти-пасс UI/UX Research (gsd-ui-researcher).

---

## 1. 📖 Глоссарий терминологии (RU ↔ EN)

Чтобы мы говорили на одном языке — во всём проекте (код, UI, документация) используем **единую** терминологию:

### Бизнес-сущности

| EN (в коде) | RU (в UI) | Описание |
|:---|:---|:---|
| **Order** | Заказ | Единица покупки услуги (followers, likes, views) |
| **Service** | Услуга | Конкретное предложение (напр. «Instagram Подписчики — HQ») |
| **Category** | Категория | Группировка услуг (Instagram, YouTube, TikTok) |
| **Platform** | Платформа | Соцсеть (Instagram, TikTok, YouTube, Telegram, VK) |
| **Provider** | Поставщик | Внешний API-поставщик, выполняющий заказы |
| **Client / User** | Клиент | Конечный пользователь, размещающий заказы |
| **Reseller** | Реселлер | Пользователь, перепродающий услуги через свою панель |
| **Balance / Wallet** | Баланс / Кошелёк | Средства пользователя на платформе |
| **Markup** | Наценка | Разница между ценой поставщика и ценой продажи (%) |
| **Rate** | Цена за 1000 | Стоимость в пересчёте на 1000 единиц |
| **Project** | Проект | Изолированное пространство (мульти-тенант) |

### Механики доставки

| EN (в коде) | RU (в UI) | Описание |
|:---|:---|:---|
| **Drip-Feed** | Плавная подача | Растягивание доставки по времени (100/день × 10 дней) |
| **Instant Delivery** | Мгновенная доставка | Одноразовая полная доставка |
| **Refill** | Пополнение | Восстановление потерянных подписчиков/лайков бесплатно |
| **Auto-Refill** | Авто-пополнение | Автоматическое восстановление при обнаружении потерь |
| **Partial** | Частичное выполнение | Заказ выполнен не полностью (возврат разницы) |
| **Mass Order** | Массовый заказ | Пакетная загрузка нескольких заказов |

### Статусы заказов

| EN (в коде) | RU (в UI) | Chip Color | Описание |
|:---|:---|:---|:---|
| `PENDING` | Ожидает | `warning` (amber) | Ждёт отправки провайдеру |
| `IN_PROGRESS` | Выполняется | `primary` (sky) | Провайдер обрабатывает |
| `COMPLETED` | Выполнен | `success` (emerald) | Доставлено полностью |
| `PARTIAL` | Частично | `warning` (amber) | Доставлено частично, возврат |
| `CANCELLED` | Отменён | `default` (slate) | Отменён с возвратом |
| `ERROR` | Ошибка | `danger` (rose) | Ошибка провайдера |
| `REFILLING` | Пополняется | `primary` (sky) | Идёт авто-пополнение |

### UI-элементы (внутренняя терминология)

| Термин | Описание |
|:---|:---|
| **Command Center** | Админ-панель — единый центр управления |
| **Smart Funnel** | Клиентская воронка — AI-driven поиск по URL |
| **Metric Bar** | Горизонтальная полоса ключевых KPI (3-5 карточек) |
| **Side Sheet / Drawer** | Боковая выдвижная панель для деталей |
| **Action Dropdown** | Меню действий (≤5 пунктов по Progressive Disclosure) |
| **Status Dot** | Минималистичный цветной индикатор (●) вместо залитых плашек |
| **Ghost Border** | Полупрозрачная граница (`border-border/50`) |
| **Bento Grid** | Модульная сетка карточек dashboard'а |

---

## 2. 🔍 Анализ индустрии — Тренды 2026

### Результаты Multi-Pass Research

#### PASS 1: Trend & Novelty Scout

| Тренд | Описание | Наше решение |
|:---|:---|:---|
| **Decision-First Architecture** | Интерфейс вокруг решений, не данных | Smart Funnel: пользователь вводит URL → AI подбирает услуги |
| **Liquid Glass / Glassmorphism 2.0** | Полупрозрачные слои с blur | `bg-card/80 backdrop-blur-lg` для overlays и sticky headers |
| **Bento Grid Layout** | Модульные карточки вместо монолитных таблиц | Metric Bar → Bento Grid на dashboard |
| **Purposeful Motion** | Анимации для UX, не декора | Только status-change и hover transitions |
| **AI-Native Integration** | AI встроен в контекст, не как отдельная фича | Link Analyzer анализирует URL и подсказывает услуги |
| **Command Palette (⌘K)** | Быстрый поиск по приложению | Планируем: глобальный Command Palette |
| **Role-Based UI** | Адаптивный интерфейс по ролям | Admin → Command Center, Client → Smart Funnel |

#### PASS 2: Competitor Deconstruction

##### Типичная SMM-панель (JustAnotherPanel, SMMRaja, Peakerr)

**Архитектура:**
- Sidebar → New Order / Orders / Services / Add Funds / Support
- Плоский flat UI, минимум визуальной иерархии
- Dense tables без whitespace
- Фильтры — выпадающие списки в одну строку

**Удачные решения (Steal This):**
- ✅ Вертикальная sidebar навигация — проверенный паттерн
- ✅ Balance в top bar — всегда видно
- ✅ Быстрый доступ к «New Order» как primary CTA
- ✅ Поиск по ID и фильтр по статусу в таблицах заказов

**Ошибки (Avoid This):**
- ❌ Визуальный «дата-дамп» — все данные на одном экране без иерархии
- ❌ Устаревший flat design (PHP-эра) — нет depth, shadows, blur
- ❌ Нет пустых состояний (empty states) — белый экран при 0 заказов
- ❌ Мелкий шрифт (12px body) — плохая читаемость
- ❌ Нет micro-interactions — интерфейс «мёртвый»
- ❌ Borders EVERYWHERE — линии как визуальный шум
- ❌ Нет контекстуальных данных (число без «+12% vs yesterday»)

---

## 3. 💎 Уникальная дизайн-идентичность: «Arctic Command Center»

### Концепция

> **Smmplan = «Arctic Command Center»** — чистый, холодный, профессиональный интерфейс для *управления*, а не *проcмотра*. Метафора: командный центр, откуда управляешь потоками соцсетей через стеклянные панели.

### Характер бренда

| Атрибут | Описание |
|:---|:---|
| **Tone** | Premium, Professional, Calm |
| **Metaphor** | «Командный центр» — контроль, скорость, точность |
| **Feel** | Глубокий, но не тяжёлый. Холодный, но дружелюбный |
| **Mood** | «Спокойная уверенность» — как центр управления полётами |

### Визуальная ДНК

#### 3.1 Палитра «Arctic Sky»

```
Light Mode:
┌─────────────────────────────────────────────────┐
│  Background  #f8fafc  ░░░░░░  Мягкий ледяной    │
│  Card        #ffffff  ████████  Чистый белый      │
│  Primary     #0ea5e9  ████████  Sky-500 — Акцент  │
│  Foreground  #0f172a  ████████  Slate-900 — Текст  │
│  Muted       #64748b  ████████  Slate-500 — Лейбл  │
│  Border      #e2e8f0  ────────  Slate-200 — Ghost  │
│  Success     #10b981  ████████  Emerald-500         │
│  Warning     #f59e0b  ████████  Amber-500           │
│  Danger      #f43f5e  ████████  Rose-500            │
└─────────────────────────────────────────────────┘

Dark Mode:
┌─────────────────────────────────────────────────┐
│  Background  #0f172a  ░░░░░░  Deep Space          │
│  Card        #1e293b  ████████  Elevated Surface   │
│  Primary     #38bdf8  ████████  Sky-400 — Brighter │
│  Foreground  #f8fafc  ████████  Slate-50 — Light   │
│  Muted       #94a3b8  ████████  Slate-400 — Soft   │
│  Border      #334155  ────────  Slate-700 — Subtle  │
└─────────────────────────────────────────────────┘
```

> **Принцип:** В dark mode поверхности становятся *светлее* при повышении elevation (не темнее). Card (`#1e293b`) светлее Background (`#0f172a`).

#### 3.2 Типографика

| Роль | Font | Weight | Size | Tracking | Класс |
|:---|:---|:---|:---|:---|:---|
| **Page Title** | Inter | Bold (700) | 24px | -0.01em | `text-2xl font-bold tracking-tight` |
| **Section Header** | Inter | Semibold (600) | 18px | normal | `text-lg font-semibold` |
| **Card Title** | Inter | Medium (500) | 16px | normal | `text-base font-medium` |
| **Body** | Inter | Regular (400) | 14px | normal | `text-sm text-foreground/80` |
| **Label** | Inter | Semibold (600) | 12px | 0.05em | `text-xs uppercase tracking-wider font-semibold text-muted-foreground` |
| **Data/Money** | Inter | Regular (400) | 14px | normal | `text-sm font-mono tabular-nums` |
| **Micro** | Inter | Medium (500) | 11px | normal | `text-xs` |

#### 3.3 Elevation & Depth (Слои стекла)

```
┌── Layer 0: Background ──────────────────────────┐
│  bg-background (#f8fafc)                         │
│                                                   │
│  ┌── Layer 1: Card ─────────────────────────┐   │
│  │  bg-card, shadow-card                      │   │
│  │  (0 1px 3px 0 rgb(0 0 0 / 0.1))          │   │
│  │                                             │   │
│  │  ┌── Layer 2: Elevated ──────────────┐   │   │
│  │  │  bg-card, shadow-elevated           │   │   │
│  │  │  (0 4px 12px -2px rgb(0 0 0 / 0.1))│   │   │
│  │  └─────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────┘   │
│                                                   │
│  ┌── Glass Overlay ─────────────────────────┐   │
│  │  bg-card/80 backdrop-blur-lg              │   │
│  │  (Sticky headers, modals, drawers)        │   │
│  └─────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

#### 3.4 Spacing System

| Token | Значение | Использование |
|:---|:---|:---|
| `gap-1` | 4px | Между иконкой и текстом |
| `gap-2` | 8px | Внутри компактных групп |
| `gap-3` | 12px | Между элементами в card |
| `gap-4` | 16px | Между карточками |
| `gap-6` | 24px | Между секциями |
| `gap-8` | 32px | Между крупными блоками |
| `p-4` | 16px | Padding карточек |
| `p-6` | 24px | Padding секций/страниц |

#### 3.5 Border Radius

| Элемент | Radius | Класс |
|:---|:---|:---|
| Кнопки | 8px | `rounded-lg` |
| Карточки | 12px | `rounded-xl` |
| Chips/Badges | 6px | `rounded-md` |
| Inputs | 8px | `rounded-lg` |
| Аватары | 50% | `rounded-full` |
| Modals | 16px | `rounded-2xl` |

#### 3.6 Микро-анимации

| Элемент | Действие | CSS |
|:---|:---|:---|
| Кнопки | Hover | `transition-all duration-200 hover:shadow-md` |
| Карточки | Hover | `transition-all duration-200 hover:shadow-md hover:-translate-y-0.5` |
| Строки таблицы | Hover | `transition-colors duration-150 hover:bg-accent/50` |
| Sidebar links | Active | `transition-colors duration-150` |
| Modals | Open | `animate-in fade-in slide-in-from-bottom-4 duration-300` |
| Drawers | Open | `animate-in slide-in-from-right duration-300` |
| Числа (KPI) | Mount | `transition-all duration-500` (count-up эффект) |

#### 3.7 Иконография

| Правило | Описание |
|:---|:---|
| **Библиотека** | Lucide React (единый стиль) |
| **Размер** | `w-4 h-4` (16px) — default, `w-5 h-5` (20px) — emphasis |
| **Цвет** | `text-muted-foreground` по умолчанию, `text-primary` для акцентов |
| **Stroke** | `strokeWidth={1.5}` — тоньше, премиальнее |

---

## 4. 🏗️ Архитектура экранов

### 4.1 Admin → Command Center

```
┌─ Sidebar (w-64, bg-slate-950) ─┬─ Main Content (bg-background) ────────────┐
│                                  │                                            │
│  ◉ Smmplan                      │  ┌─ Top Bar (sticky, glass) ──────────┐   │
│  ─────────────────               │  │  🔍 Search    ₽ 12,340   👤 Admin  │   │
│  📊 Dashboard                   │  └──────────────────────────────────────┘   │
│  📦 Заказы                      │                                            │
│  🛒 Услуги                      │  Page Title + [Action Button]              │
│  👥 Клиенты                     │                                            │
│  💰 Финансы                     │  ┌──── Metric Bar (Bento) ──────────┐   │
│  🔗 Поставщики                  │  │ ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐ │   │
│  🎫 Тикеты                     │  │ │ KPI1│  │ KPI2│  │ KPI3│  │ KPI4│ │   │
│  ─────────────────               │  │ └─────┘  └─────┘  └─────┘  └─────┘ │   │
│  ⚙ Настройки                   │  └──────────────────────────────────────┘   │
│                                  │                                            │
│  [Balance: ₽ 12,340]           │  ┌──── Content Area ────────────────┐   │
│                                  │  │  Таблица / Карточки / Графики    │   │
│                                  │  │  (с фильтрами в toolbar)         │   │
│                                  │  └──────────────────────────────────┘   │
└──────────────────────────────────┴────────────────────────────────────────────┘
```

### 4.2 Client → Smart Funnel

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo    [Balance ₽ 1,200]    [📦 Мои заказы]  [👤]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│         🔗 Вставьте ссылку на соцсеть                          │
│         ┌─────────────────────────────────┐                     │
│         │  https://instagram.com/user...   │ ← Smart Input     │
│         └─────────────────────────────────┘                     │
│                AI анализирует...                                │
│                                                                  │
│  ┌──── Результаты AI ──────────────────────────────────┐       │
│  │                                                        │       │
│  │  ┌─ Service Card ─┐  ┌─ Service Card ─┐              │       │
│  │  │ 👥 Подписчики  │  │ ❤️ Лайки       │              │       │
│  │  │ от ₽ 2.50/1000 │  │ от ₽ 0.80/1000 │              │       │
│  │  │ [Заказать →]   │  │ [Заказать →]   │              │       │
│  │  └────────────────┘  └────────────────┘              │       │
│  └────────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌──── Drawer (Side Sheet) ──────────────────────────┐         │
│  │  Детали заказа, количество, drip-feed, оплата     │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. 📐 Правила насмотренности (Visual Guidelines)

Конкретные правила, выведенные из анализа трендов и конкурентов:

### DO (Делаем)

1. **Тональное разделение вместо линий** — `bg-card` на `bg-background`, `shadow-sm` вместо `border-b`
2. **F-pattern layout** — KPI слева вверху, действия справа
3. **Status Dots (●)** — маленькие цветные точки вместо залитых плашек для статусов в таблицах
4. **Contextual Numbers** — «142 заказа (+12% ↑)» вместо просто «142»
5. **Empty States** — иллюстрация + CTA «Создайте первый заказ →»
6. **Sticky Glass Headers** — `bg-card/80 backdrop-blur-md` при прокрутке
7. **Truncate + Tooltip** — длинные ID обрезаем, полное значение по hover
8. **Tabular-nums** — все числа и деньги с фиксированной шириной цифр
9. **Sparklines в карточках** — мини-графики трендов в KPI-карточках
10. **≤ 5 действий** — Progressive Disclosure: остальное в Dropdown

### DON'T (Не делаем)

1. ❌ `border-solid` / `divide-y` между строками таблиц
2. ❌ Inline colors (`text-white`, `bg-blue-500`)
3. ❌ Pure black (`#000000`) — используем `slate-900` (`#0f172a`)
4. ❌ Pie charts для сложных данных
5. ❌ >9 KPI-карточек на одном экране
6. ❌ Кнопки-пустышки (Dead UI)
7. ❌ `red-500` / `green-500` — используем `rose-500` / `emerald-500`
8. ❌ Анимации > 300ms (кроме modals/drawers)
9. ❌ 12px body text — минимум 14px (`text-sm`)
10. ❌ Монолитные формы — разбиваем на шаги (Steps)

---

## 6. 🎯 User Review Required

> [!IMPORTANT]
> **Ключевые решения, требующие вашего одобрения:**

### 6.1 Название дизайн-идентичности
Предлагаю **«Arctic Command Center»** как внутреннее название нашего дизайн-языка. Это определяет метафору: холодная Sky-палитра, стеклянные поверхности (glassmorphism), точность командного центра.

**Альтернативы:**
- «Frost Protocol» — более технократский
- «Skyline» — проще, легче запомнить
- «Control Tower» — акцент на управление

### 6.2 Light Mode vs Dark Mode — что Primary?
Текущая дизайн-система поддерживает оба режима. Нужно решить:
- **A)** Light Mode по умолчанию, Dark Mode опционально
- **B)** Dark Mode по умолчанию (как у большинства premium SaaS платформ 2026)
- **C)** Автоопределение по системным настройкам + toggle

### 6.3 Sidebar стиль
- **A)** Всегда развёрнут (w-64) — как сейчас
- **B)** Collapsible: иконки → hover/click для раскрытия
- **C)** Adaptive: полный на desktop, иконки на tablet, drawer на mobile

### 6.4 Command Palette (⌘K)
Внедрять ли глобальный Command Palette для быстрого поиска по заказам, услугам, клиентам?
- Это тренд 2026 для SaaS с >10 фич, но требует дополнительного backend-индекса.

---

## 7. 🚀 Следующие шаги

После утверждения фундамента:

1. **Визуальный прототип** — генерация экранов в StitchMCP с нашей палитрой
2. **Design Tokens JSON** — формализация в `.planning/design/tokens.json`
3. **Обновление `globals.css`** — добавление тенёй, переходов, новых токенов
4. **Компонентная библиотека** — создание базовых Card, MetricCard, StatusDot, SideSheet
5. **UI Knowledge update** — обновление `UI_KNOWLEDGE.md` с новыми правилами
