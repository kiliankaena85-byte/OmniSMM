---
name: design-boost
description: Используй этот скилл ВСЕГДА при вызове слэш-команды /boost, запросах на генерацию дизайна интерфейсов через единую модульную систему MCP (Gemini + Google Stitch + Laya + OmniDesign Hub + Web Benchmarking), отсечение AI-клише (Zero-Slop), нативную AST-мутацию классов и синтез React 19 + HeroUI v3 + Tailwind CSS 4.
metadata:
  tags:
    - boost
    - generative-ui
    - stitch-mcp
    - laya-mcp
    - omnidesign-hub
    - web-benchmarking
    - zero-slop
    - react-19
    - tailwind-4
---

# design-boost — Единый Модульный Конвейер Дизайна (/boost)
## Gemini ↔ Google Stitch ↔ Laya ↔ OmniDesign Hub ↔ Web Benchmarks

## Назначение и контекст (Overview & Scope)
Скилл `design-boost` регламентирует архитектуру и выполнение слэш-команды `/boost` для платформы OmniSMM 1.0 (SMMplan & SMMflux).
Решает ключевые проблемы генерации интерфейсов:
1. **Не просто копирование, а доказательное улучшение (Improvement Delta):** Сравнение с эталонами интернета (Stripe, Linear), расчет дельты плотности, WCAG 2.2 и эргономики тач-таргетов.
2. **Token & Latency Bottleneck:** Устранение оверхеда тяжелых LLM за счет сверхбыстрого System 1 энкодера Laya (~15–25 мс) на микро-решениях верстки.
3. **AI-Slop Degeneration:** Блокировка шаблонных клише (кислотный неон, эмодзи в бенто, пульсирующие пилюли, blob mesh).
4. **AST Precision (Zero-Token Edits):** Мутация стилей через `OmniAstEngine` и аудит токенов через `OmniDesign Hub` без галлюцинаций.

---

## 1. Модульная архитектура конвейера (Modular MCP Pipeline)

```
                          ┌─────────────────────────────┐
                          │    Слэш-команда: /boost     │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │     GEMINI 3 FLASH / PRO              │
                     │  (System 2 Cognitive Orchestrator)   │
                     │  - Анализ интернет-референсов (Web)   │
                     │  - Компиляция анти-slop промптов      │
                     │  - Замкнутый цикл сходимости          │
                     └───────┬───────────────────────▲───────┘
                             │                       │
           (1) High-level    │                       │ (4) Скорокарты Laya,
               Stitch Prompt │                       │     React 19 синтез
                             ▼                       │
              ┌──────────────────────────────────────┴────────┐
              │           GOOGLE STITCH MCP                   │
              │         (Generative UI Renderer)              │
              │   - Генерация пула кандидатов (A, B, C)       │
              │   - Адаптивные вьюпорты (375px / 768px / 1440)│
              │   - Отбор лучшего кандидата через Laya        │
              └───────────────┬───────────────────────────────┘
                              │                       ▲
            (2) Direct Inner  │                       │ (3) Быстрый скоринг
                Delegation    │                       │     (15-25 мс)
                (tools/call)  ▼                       │
              ┌───────────────────────────────────────┴───────┐
              │              LAYA MCP SERVER                  │
              │     (System 1 Fast Decision Engine)           │
              │   - laya_decide: Многозадачный гейтинг        │
              │   - laya_classify: 6 дизайн-ДНК платформы     │
              │   - laya_score: Плотность, WCAG, Touch Safe   │
              └───────────────┬───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────────────────┐
              │            OMNIDESIGN MCP HUB                 │
              │     (Native AST Engine & Token Guard)         │
              │   - inspect_jsx_nodes: Нативная AST-структура │
              │   - mutate_classes: Zero-Token тайлвинд правка│
              │   - validate_design_tokens: Obsidian Matrix   │
              │   - generate_design_candidate: React 19/HeroUI│
              └───────────────────────────────────────────────┘
```

### 1.1. Пятифазный цикл работы:
1. **Фаза 1: Web & Competitive Intelligence (Benchmarking):** Извлечение паттернов (Stripe checkout, Linear density, 54-ФЗ расчет), формулирование целевых ориентиров.
2. **Фаза 2: Stitch Generative UI:** Генерация многокандидатного пула макетов с учетом ДНК и контекста бренда.
3. **Фаза 3: Laya System 1 Fast Pruning:** Мгновенный отсев кислотного неона, проверка контраста WCAG 2.2 и мобильных тач-зон.
4. **Фаза 4: OmniDesign Hub AST Assembly:** Верификация дизайн-токенов стандарта Obsidian Slate & Cobalt Matrix, точечная AST-мутация классов.
5. **Фаза 5: Verification & Zero-Defect Cutover:** Проверка CI-гейтов (`tsc`, `lint:zero-any`, секреты) и визуальный аудит на Stage (:3005).

---

## 2. Жесткие инварианты (Hard Invariants)

1. 🛑 **Zero-Slop Filter:** Кандидаты с фиолетовым неоном на черном, эмодзи в бенто, пульсирующими пилюлями или blob mesh получают вердикт `REJECTED`.
2. 🛑 **Genuine Improvement Invariant:** Сгенерированный компонент обязан превосходить референс по метрикам (`SUPERIOR_IMPROVEMENT` или `INCREMENTAL_UPGRADE`). Слепое копирование запрещено.
3. 🛑 **High-Density Invariant:** Информационная плотность панели $\ge 0.65$. Формат розничных цен — строго `₽ / шт` со шрифтом `tabular-nums`.
4. 🛑 **Mobile Touch Safety:** Интерактивные элементы обязаны иметь высоту `min-h-[44px]` (44px touch target). Горизонтальный скролл `w-screen` запрещен.
5. 🛑 **Obsidian Slate Standard:** Фоны `bg-[#0B0E14]`, карточки `border-border/40`, полупрозрачные акцентные бейджи `bg-primary/10 text-primary border border-primary/20`.

---

## 3. Слэш-команда и запуск (/boost)

### В чате Antigravity:
```
/boost <описание интерфейса>
```
Например:
- `/boost Быстрый чекаут с расчетом цены и выбором категории`
- `/boost smmflux Мобильный дашборд с плотными графиками`

### Через CLI раннер:
```bash
# Базовый запуск:
npm run design:boost

# Быстрый запуск с позиционным описанием:
npm run design:boost -- "Быстрый чекаут" --viewport mobile

# Запуск с указанием бренда, целевой ДНК и вьюпорта:
npm run design:boost -- --brand smmflux --dna financial_terminal --intent "Financial Order Terminal"

# Экспорт сгенерированного React 19 компонента в файл:
npm run design:boost -- --intent "Live Order Stream" --export src/components/generated/LiveOrderStream.tsx
```

---

## 4. Программный API

```typescript
import { GeminiStitchLayaOrchestrator } from '@/../scripts/mcp/gemini-stitch-laya-orchestrator';

const result = await GeminiStitchLayaOrchestrator.execute({
  userIntent: 'SMM High-Density Dashboard and Checkout Console',
  targetBrand: 'smmplan', // или 'smmflux'
  viewport: 'desktop',    // 'desktop' | 'mobile' | 'tablet'
  maxIterations: 3,
  webBenchmarkNotes: ['Stripe 2-column split', 'Linear key-value dense summary']
});

if (result.success) {
  console.log('Сгенерированный React 19 код:', result.synthesizedReactCode);
  console.log('Итог бенчмарка:', result.benchmarkResult?.verdict);
  console.log('Аудит токенов OmniDesign:', result.tokenValidationResult?.valid);
}
```

---

## 5. Чеклист верификации
- [ ] Зарегистрированы ли `laya-decisions`, `stitch-designer` и `omnidesign-hub` в `.mcp/mcp-servers.json`?
- [ ] Проходят ли юнит-тесты `npx vitest run src/__tests__/unit/modular-design-pipeline.test.ts`?
- [ ] Строго ли 0 ошибок `npx tsc --noEmit` и 0 ключевых слов `any` (`npm run lint:zero-any`)?
- [ ] Доказано ли улучшение (`isGenuineImprovement === true`) по сравнению с референсом?
- [ ] Все ли созданные и измененные файлы строго соблюдают лимит $\le 200$ строк?
