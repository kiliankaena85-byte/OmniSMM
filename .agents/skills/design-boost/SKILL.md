---
name: design-boost
description: Используй этот скилл ВСЕГДА при вызове слэш-команды /boost, запросах на генерацию дизайна интерфейсов через триаду Gemini + Google Stitch MCP + Laya MCP, оптимизацию UI-макетов, отсечение AI-клише (Zero-Slop), адаптацию под брекпоинты и синтез кода React 19 + Tailwind CSS 4.
metadata:
  tags:
    - boost
    - generative-ui
    - stitch-mcp
    - laya-mcp
    - gemini-orchestrator
    - zero-slop
    - react-19
    - tailwind-4
---

# design-boost — Триада Генеративного UI: Gemini ↔ Stitch ↔ Laya (/boost)

## Назначение и контекст (Overview & Scope)
Скилл `design-boost` регламентирует архитектуру и выполнение слэш-команды `/boost` для платформы OmniSMM 1.0 (SMMplan & SMMflux).
Решает две фундаментальные проблемы генерации интерфейсов:
1. **Token & Latency Bottleneck:** Устраняет токеновый и временной оверхед тяжелых LLM за счет сверхбыстрого System 1 энкодера Laya (~15–25 мс) на микро-решениях верстки.
2. **AI-Slop Degeneration:** Блокирует деградацию в шаблонные клише (фиолетовый неон на черном, эмодзи в бенто, пульсирующие пилюли, blob mesh).

---

## 1. Архитектурная триада (Tri-Partite System 1 + System 2)

```
                          ┌─────────────────────────────┐
                          │    Слэш-команда: /boost     │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │     GEMINI 3 FLASH / PRO              │
                     │  (System 2 Cognitive Orchestrator)   │
                     │  - Декомпозиция бизнес-целей          │
                     │  - Компиляция анти-slop промптов      │
                     │  - Замкнутый цикл сходимости          │
                     └───────┬───────────────────────▲───────┘
                             │                       │
           (1) High-level    │                       │ (4) Скорокарта Laya,
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
              │   - laya_check: Тернарные гейты (YES/NO)      │
              └───────────────────────────────────────────────┘
```

### 1.1. Двухконтурное делегирование:
- **Внутренний контур (Stitch ↔ Laya):** Stitch генерирует несколько кандидатов (High-Density HUD, Adaptive Grid, Compact Single-Column), опрашивает Laya через `laya_decide`, отсекает слабейших и отдает оркестратору только чистый макет с подтвержденным скорингом.
- **Внешний контур (Gemini ↔ Stitch):** Gemini проверяет инварианты тенанта (Drip-Feed Floor, ExactMath BigInt), транслирует вектор правок Laya при `NEEDS_REFINEMENT` и синтезирует клиентский компонент React 19.

---

## 2. Жесткие инварианты (Hard Invariants)

1. 🛑 **Zero-Slop Filter:** Кандидаты с фиолетовым неоном на черном, эмодзи в бенто, пульсирующими пилюлями или blob mesh получают вердикт `REJECTED` и не допускаются до синтеза.
2. 🛑 **High-Density Invariant:** Информационная плотность панели $\ge 0.65$. Формат розничных цен — строго `₽ / шт` со шрифтом `tabular-nums`.
3. 🛑 **Mobile Touch Safety:** Интерактивные элементы обязаны иметь высоту `min-h-[44px]` (44px touch target). Горизонтальный скролл `w-screen` запрещен.
4. 🛑 **Valid React 19 Identifier:** Любое название экрана (включая русский язык, спецсимволы и цифры) транслитерируется в валидный PascalCase идентификатор компонента (например, `Быстрый заказ` → `BystryyZakaz`).
5. 🛑 **Multi-Tenant Styling:** Поддержка брендов SMMplan (`smmplan.pro` — Linear Clean) и SMMflux (`smmflux.ru` — Dark Obsidian `#090d16`).

---

## 3. Слэш-команда и запуск (/boost)

### В чате Antigravity:
Пользователь или агент вводит:
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
  maxIterations: 3
});

if (result.success) {
  console.log('Сгенерированный React 19 код:', result.synthesizedReactCode);
  console.log('Экономия токенов:', result.estimatedTokensSaved);
}
```

---

## 5. Чеклист верификации
- [ ] Зарегистрированы ли `laya-decisions` и `stitch-designer` в `.mcp/mcp-servers.json`?
- [ ] Проходят ли юнит-тесты `npm test src/__tests__/unit/gemini-stitch-laya-orchestration.test.ts`?
- [ ] Строго ли 0 ошибок `npx tsc --noEmit` и 0 ключевых слов `any` (`npm run lint:zero-any`)?
- [ ] Отсекаются ли кандидаты с AI-Slop и отбирается ли лучший кандидат во внутреннем контуре?
- [ ] Генерируются ли валидные имена компонентов для кириллицы и чисел?
