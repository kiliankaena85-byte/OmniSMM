# SPEC-2026-09-29: Gemini-Stitch-Laya Tri-Partite UI Orchestration Pipeline (v1.0)

## 1. Metadata
- **Status:** APPROVED & DEPLOYED
- **Risk-Tier:** Tier 1 / Tier 2 (Core Frontend Architecture & Generative UI Pipeline)
- **Target Stack:** Next.js 16 (App Router), React 19, Google Stitch MCP, Laya Decision Engine MCP (ModernBERT 421M), Gemini 3 Flash / Pro
- **Compliance:** RAC-2026, WCAG 2.2 Level AA, Zero-Slop Anti-Cliche Standard, Multi-Tenant OmniSMM 1.0 (SMMplan / SMMflux)

---

## 2. Problem Statement & Motivation

При генерации пользовательских интерфейсов с помощью больших языковых моделей (LLM) возникают два фундаментальных барьера:
1. **Когнитивный и токеновый оверхед микро-решений (Latency & Token Bottleneck):**
   Если тяжелая модель (Gemini / Claude / GPT) вынуждена пошагово рассуждать над каждым микро-выбором вёрстки (оценка контрастности, ширина отступов `py-1.5` vs `py-3`, плотность строк таблицы, проверка 44px touch targets), каждая итерация занимает 5–15 секунд и сжигает сотни токенов. Это делает итеративный дизайн мучительно медленным и дорогостоящим.
2. **AI-Slop Cliche Degeneration (Деградация в шаблонные клише):**
   Генеративные модели по умолчанию склонны генерировать одинаковый визуальный мусор: фиолетовый неон на черном фоне, бенто-сетки со случайными эмодзи, пульсирующие пилюли-бейджи над заголовками и размытые цветные пятна (blob mesh).

### Архитектурное решение: Модель Tri-Partite (Триада)
Для решения этой проблемы мы разделяем генеративный конвейер на три специализированных слоя:
- **Gemini (System 2 — Оркестратор):** Медленное, глубокое когнитивное планирование, декомпозиция бизнес-требований пользователя, компиляция промптов и финальный синтез React 19 кода.
- **Google Stitch (Generative UI — Рендерер):** Движок генерации макетов, DOM-деревьев, адаптивных брекпоинтов и Tailwind 4 токенов.
- **Laya (System 1 — Неавторегрессионный Движок Решений):** Легковесная модель-энкодер (ModernBERT + decision heads, ~421M параметров), обученная по правилам калиброванного скоринга (Proper Scoring Rules). Выполняет оценку за **10–40 миллисекунд** без генерации текста, возвращая строго типизированные вероятностные распределения.

---

## 3. Архитектурная топология и протоколы взаимодействия

```
                          ┌─────────────────────────────┐
                          │    Human / Agent Prompt     │
                          │   "/boost продумай дизайн"  │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │     GEMINI 3 FLASH / PRO              │
                     │  (System 2 Cognitive Orchestrator)   │
                     │  - Business Goal Decomposition        │
                     │  - Strict Zero-Slop Prompt Compiler   │
                     │  - Closed-Loop Convergence Governor   │
                     └───────┬───────────────────────▲───────┘
                             │                       │
           (1) High-level    │                       │ (4) Telemetry, Laya Scorecard
               Stitch Prompt │                       │     & React 19 Synthesis
                             ▼                       │
              ┌──────────────────────────────────────┴────────┐
              │           GOOGLE STITCH MCP                   │
              │         (Generative UI Renderer)              │
              │   - Candidate Layouts Generation (A, B, C)    │
              │   - Responsive Viewports (375px / 768px)      │
              │   - DOM AST & Tailwind CSS 4 Structure        │
              └───────────────┬───────────────────────────────┘
                              │                       ▲
            (2) Direct Inner  │                       │ (3) Fast Probabilistic
                Delegation    │                       │     Scorecard (15-25ms)
                (tools/call)  ▼                       │
              ┌───────────────────────────────────────┴───────┐
              │              LAYA MCP SERVER                  │
              │     (System 1 Fast Decision Engine)           │
              │   - laya_decide: Multitask Gating             │
              │   - laya_classify: Design DNA (6 DNAs)        │
              │   - laya_score: Density / WCAG / Touch-Target │
              │   - laya_check: Hard Ternary Gates            │
              └───────────────────────────────────────────────┘
```

### 3.1. Двухконтурное делегирование решений:
1. **Внутренний контур (Inner Loop: Stitch $\rightarrow$ Laya):**
   Когда Google Stitch генерирует несколько вариантов компоновки (например, вариант A — бенто-сетка, вариант B — 280px сайдбар Linear HUD, вариант C — карточки), Stitch **напрямую обращается к Laya MCP через `laya_decide`**.
   Laya за 15–20 мс отсекает варианты с низким скором плотности или признаками AI-Slop. Stitch отдает Оркестратору только отфильтрованного и оптимизированного кандидата!
2. **Внешний контур (Outer Loop: Gemini $\leftrightarrow$ Stitch $\leftrightarrow$ Laya):**
   Gemini проверяет итоговый результат на соответствие стратегическим инвариантам OmniSMM (Drip-Feed Floor, Ledger-First, мультитенантность SMMplan / SMMflux). Если Laya возвращает статус `NEEDS_REFINEMENT`, Gemini анализирует вектор дефектов Laya и точечно корректирует промпт для следующей итерации.

---

## 4. Спецификация инструментов MCP (Tool Contracts)

### 4.1. Laya MCP (`laya-decisions`)
- **`laya_decide`**:
  - *Вход:* `{ candidateLayout: string, context?: string }`
  - *Выход:*
    ```ts
    {
      decision: 'APPROVED' | 'REJECTED' | 'NEEDS_REFINEMENT',
      confidence: number, // 0.0 - 1.0
      latencyMs: number,  // 10 - 40ms
      scores: {
        informationDensity: number,
        visualHierarchy: number,
        wcagContrastScore: number,
        mobileTouchSafety: number,
        slopPenalty: number
      },
      classification: {
        designDna: DesignDnaType,
        slopDetected: boolean,
        slopType?: SlopClicheType
      },
      gates: {
        zeroSlopPass: boolean,
        wcagAaPass: boolean,
        mobileSafePass: boolean,
        readyForSynthesis: boolean
      },
      refinements: string[]
    }
    ```
- **`laya_classify`**: Классификация ДНК (Swiss Kinetic, Financial Terminal, Tactile Hardware, Neo-Editorial, Obsidian Monolith, Bio-Mechanical).
- **`laya_score`**: Калиброванный скоринг метрик.
- **`laya_check`**: Тернарный гейт (`YES` / `NO` / `UNKNOWN`).

### 4.2. Google Stitch MCP (`stitch-designer`)
- **`stitch_generate_screen`**: Генерация экрана с поддержкой флага `consultLayaDirectly: true`.
- **`stitch_create_variant`**: Создание адаптивных версий (мобильная 375px с Safe Area Insets, планшет, десктоп).
- **`stitch_consult_laya`**: Мост прямого обращения Stitch к Laya.
- **`stitch_synthesize_react`**: Генерация строго типизированного клиентского компонента React 19 (Server Actions ready).

---

## 5. Инварианты надежности и защиты (Hard Invariants)

1. **Zero-Slop Invariant:**
   Макеты с фиолетовым неоном на черном, случайными эмодзи в бенто, пульсирующими пилюлями над заголовками или blob mesh размытиями получают автоматический статус `REJECTED` от Laya и не допускаются до синтеза React-кода.
2. **High-Density Invariant:**
   Информационная плотность панели администрирования и чекаута обязана быть $\ge 0.65$ (оптимально $\ge 0.85$). Цены выводятся в формате `₽ / шт` со шрифтом `tabular-nums`.
3. **Mobile Touch Ergonomics Invariant:**
   Все интерактивные элементы (кнопки, инпуты, ссылки) обязаны иметь высоту $\ge 44\text{px}$ (`min-h-[44px]`). Горизонтальный скролл (`w-screen`) категорически запрещен; разрешен только `w-full` с `min-w-0`.
4. **Token Budget Conservation:**
   Использование System 1 энкодера Laya вместо текстовых рассуждений LLM экономит $\approx 1950$ токенов за цикл генерации при снижении задержки на 80%.

---

## 6. Верификация и тестирование
- Сквозные юнит-тесты: `src/__tests__/unit/gemini-stitch-laya-orchestration.test.ts`.
- Тест здоровья MCP пайплайна: `src/__tests__/mcp/mcp-pipeline.test.ts`.
- Проверка компиляции: `npx tsc --noEmit` (0 ошибок).
- Защита от `any`: `scripts/lint-zero-any.ts` (100% clean).
