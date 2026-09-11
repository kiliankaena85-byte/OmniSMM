---
name: maker-checker-protocol
description: Инженерный протокол разделения ролей Maker-Checker (Создатель vs Независимый Ревизор) с эпистемической изоляцией контекста, запретом записи (Zero-Write Sandbox) и 5-векторной матрицей вето для платформы OmniSMM 1.0.
---

# Maker-Checker Protocol (Разделение ролей: Создатель vs Ревизор)

> **Стандарт платформы OmniSMM 1.0 (2026)**  
> **Фундаментальный закон:** Агент, создавший код, **ни при каких условиях** не имеет права единолично валидировать и подтверждать свой PR. Любая модификация кодовой базы обязана пройти независимое перекрестное ревью изолированным агентом-ревизором (**Checker**).

---

## 1. Концепция Эпистемической Изоляции (Epistemic Isolation)

### 1.1. Проблема авторской предвзятости (Confirmation Bias)
В языковых моделях (LLM) контекстное окно накапливает след рассуждений (Chain of Thought). Если модель сама спроектировала и написала функцию, её вероятностное внимание уже предвзято: она склонна оправдывать собственные скрытые допущения, игнорировать граничные условия и пропускать до 87% собственных логических дефектов.

### 1.2. Решение: Чистый контекст (Clean-Slate Review)
* **Maker (Создатель / Кодер):**
  * Обладает правами на запись (`write_to_file`, `replace_file_content`, `run_command`).
  * Реализует требования спецификации `docs/specs/SPEC-*.md` в рамках цикла SDD-TDD (Red $\to$ Green).
* **Checker (Ревизор / Цензор):**
  * Запускается в **новом, изолированном потоке** (Subagent `qa_reviewer`).
  * **СТРОГО READ-ONLY:** физически лишен инструментов модификации файлов на диске (`enable_write_tools: false`).
  * Получает на вход исключительно готовый результат (Handoff Package) без промежуточных черновиков создателя.
  * Роль: состязательный ревизор (Adversarial Auditor). Его задача — не согласиться с кодом, а **найти основания для отклонения (REJECT)**.

---

## 2. Дерево Решений (Decision Tree)

```
                       [ MAKER: ЗАВЕРШЕНИЕ GREEN ФАЗЫ ]
                                      │
                                      ▼
                       [ ЗАПУСК ПРЕД-АУДИТА ХАРНЕССОМ ]
                       npx tsx scripts/maker-checker-harness.ts
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                  [ Найдены Lints ]         [ Пре-аудит чист ]
                  (any, TODO, diff)                │
                         │                         ▼
                         │               [ ИНИЦИАЛИЗАЦИЯ CHECKER ]
                         │               define_subagent: qa_reviewer
                         │               (enable_write_tools: false)
                         │                         │
                         │                         ▼
                         │               [ ПЕРЕДАЧА HANDOFF ПАКЕТА ]
                         │               - docs/specs/SPEC-*.md
                         │               - git diff
                         │               - Логи тестов и сборки
                         │                         │
                         │                         ▼
                         │               [ 5-ВЕКТОРНЫЙ АУДИТ ]
                         │                         │
                         │           ┌─────────────┴─────────────┐
                         │           ▼                           ▼
                         │     [ Вердикт: FAIL ]          [ Вердикт: PASS ]
                         │     (1+ Blocker/Major)         (0 Blocker, 0 Major)
                         │           │                           │
                         ◀───────────┘                           ▼
                   (Maker исправляет)                   [ HUMAN APPROVAL GATE ]
                                                        «Одобряю» / «Выкатывай»
```

---

## 3. 5-Векторная Матрица Вето (The 5-Vector Veto Matrix)

Checker оценивает изменения по 5 жестким векторам. Наличие хотя бы одного замечания уровня **BLOCKER** или **MAJOR** влечет мгновенный статус **`FAIL`**:

### Вектор 1: Соответствие спецификации и контрактам (Spec & Contracts)
* [ ] **DTO & Zod:** Все входные и выходные данные затипизированы строгими Zod-схемами.
* [ ] **Contract Purity:** Server Actions возвращают строго `{ success: boolean, error?: string, data?: T }`. Никаких сырых throw ошибок без перехвата.
* [ ] **Edge Cases:** Реализованы и протестированы все граничные условия из матрицы спецификации в `docs/specs/` (пустые массивы, таймауты, 401/403/429).

### Вектор 2: Финансовая целостность и ACID (Financial & ACID)
* [ ] **BigInt ExactMath:** Все денежные операции ведутся строго в `BigInt` (копейки) через `ExactMath`. Никаких операций с плавающей точкой (`number`, `Math.round()`).
* [ ] **Ledger-First:** Запись проводки в `tx.ledgerEntry.create()` создается ДО мутации баланса `tx.user.update()`.
* [ ] **No Transaction Escape:** Внутри транзакционных блоков `prisma.$transaction(async (tx) => { ... })` запрещены вызовы глобального `db.*`.
* [ ] **Идемпотентность:** Все мутации баланса содержат уникальный `idempotencyKey`.

### Вектор 3: Безопасность и Pentest Immunity (Security & RBAC)
* [ ] **Guest-Proof IDOR:** Проверки прав учитывают гостевой контекст (`if (item.userId && (!sessionUser || item.userId !== sessionUser.id))`).
* [ ] **Zero-Secrets in Bundles:** Никаких API-ключей, токенов или себестоимости поставщика в клиентских компонентах (`'use client'`).
* [ ] **SSRFGuard & SafeRegex:** Внешние URL проверяются через `SSRFGuard`, регулярные выражения защищены от ReDoS (< 25 мс).

### Вектор 4: Гигиена кода и No-Crutch Policy (Code Hygiene)
* [ ] **Анти-Костыли:** 0 заглушек (`// TODO`, `// FIXME`, `// XXX`), 0 подавлений (`@ts-ignore`, `eslint-disable`).
* [ ] **Zero-Any:** Отсутствие нетипизированного `any` в сигнатурах и логике.
* [ ] **Семантические токены CSS:** Запрет inline-стилей и хардкода цветов (`text-white`, `bg-black`, `bg-blue-500`). Разрешены только семантические токены Tailwind 4 (`text-foreground`, `bg-background`, `text-primary`).

### Вектор 5: Архитектура и NFR (Architecture & NFR)
* [ ] **Лимит размера компонентов:** Ни один созданный или отредактированный файл не превышает 150–200 строк. Крупные формы декомпозированы.
* [ ] **Запрет `"use server"` в `page.tsx`:** Директива `"use server"` вынесена строго в файлы директории `src/actions/`.
* [ ] **Сетевые таймауты:** Все вызовы `fetch` имеют обязательный `signal: AbortSignal.timeout(...)`.
* [ ] **Отсутствие N+1:** Запросы к Prisma оптимизированы через `include` / `select`, исключая циклы запросов в `map()`.

---

## 4. Эталонный Системный Промпт для Checker-Субагента

При инициализации Checker через `define_subagent` передается следующий строгий системный промпт:

```json
{
  "name": "qa_reviewer",
  "description": "Независимый состязательный QA-аудитор платформы OmniSMM (Checker). Проводит беспристрастный аудит предложенного Maker-кода.",
  "system_prompt": "Ты — строгий состязательный QA-ревьюер и Архитектурный Цензор платформы OmniSMM (Checker). Твоя цель — найти ЛЮБЫЕ дефекты, уязвимости, нарушение инвариантов и отклонения от спецификации.\n\nПРАВИЛА И ОГРАНИЧЕНИЯ:\n1. ТЕБЕ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО изменять файлы на диске. У тебя отключены инструменты записи. Ты только читаешь и оцениваешь.\n2. Твой аудит опирается на 5-векторную матрицу вето:\n   - Вектор 1 (Spec & Contracts): соответствие Zod-схемам, возврат { success, error, data }.\n   - Вектор 2 (Finance & ACID): BigInt копейки, Ledger-First, запрет db.* внутри транзакций tx.*, idempotencyKey.\n   - Вектор 3 (Security & RBAC): Guest-Proof IDOR, отсутствие утечек секретов и себестоимости в 'use client'.\n   - Вектор 4 (Code Hygiene): 0 'any', 0 'TODO', 0 '@ts-ignore', отсутствие inline-цветов (text-white/bg-black) — только токены globals.css.\n   - Вектор 5 (Architecture & NFR): компоненты <= 200 строк, запрет 'use server' в page.tsx, таймауты AbortSignal.timeout.\n\n3. Ты обязан сформировать структурированный отчет по стандарту CHECKER_AUDIT_REPORT.md.\n4. Выстави четкий итоговый вердикт: PASS или FAIL.\n   - FAIL ставится при наличии хотя бы ОДНОГО дефекта уровня BLOCKER или MAJOR.\n   - PASS ставится ТОЛЬКО при полном соответствии всем 5 векторам.",
  "enable_write_tools": false,
  "enable_mcp_tools": true,
  "enable_subagent_tools": false
}
```

---

## 5. Структурированный Шаблон Отчета Ревизора (`CHECKER_AUDIT_REPORT.md`)

Checker обязан предоставить отчет строго по следующей форме:

```markdown
# CHECKER AUDIT REPORT: [Название задачи / PR]

- **Дата и время:** YYYY-MM-DD HH:MM:SS
- **Ревизор (Checker):** Subagent `qa_reviewer` (Read-Only)
- **Исполнитель (Maker):** [Имя или роль агента]
- **Спецификация:** [Ссылка на docs/specs/SPEC-*.md]
- **Итоговый вердикт:** 🛑 FAIL / 🟢 PASS

---

## 1. Сводная оценка по 5 векторам

| Вектор проверки | Статус | Найденные дефекты |
| :--- | :--- | :--- |
| **1. Spec & Contracts** | [PASS / FAIL] | 0 дефектов |
| **2. Finance & ACID** | [PASS / FAIL] | Обнаружен вызов db.user вместо tx.user (Line 42) |
| **3. Security & RBAC** | [PASS / FAIL] | 0 дефектов |
| **4. Code Hygiene** | [PASS / FAIL] | Обнаружен inline-класс text-white (Line 18) |
| **5. Architecture & NFR** | [PASS / FAIL] | Файл превышает 200 строк (245 строк) |

---

## 2. Детальный список выявленных дефектов (Findings)

### [BLOCKER] Transaction Escape в методе WalletOps.credit
- **Файл:** `src/lib/wallet-ops.ts:L42`
- **Проблема:** Внутри блока `tx.$transaction` использован вызов глобального `db.auditLog.create()`. Это разрывает границы транзакции.
- **Требуемое исправление:** Заменить на `tx.auditLog.create()`.

### [MAJOR] Использование inline-цвета вместо семантического токена
- **Файл:** `src/components/orders/OrderBadge.tsx:L18`
- **Проблема:** Использован класс `text-white bg-blue-600`.
- **Требуемое исправление:** Использовать семантические токены Tailwind 4: `text-primary-foreground bg-primary`.

---

## 3. Рекомендации и Вердикт
- **Количество Blocker:** 1
- **Количество Major:** 1
- **Количество Minor:** 0
- **ВЕРДИКТ:** 🛑 **FAIL — Требуется исправление Maker-агентом перед допуском к релизу.**
```

---

## 6. Защита от Зацикливания (Loop Circuit Breaker)

Чтобы исключить бесконечные дебаты между Maker и Checker:
1. **Лимит итераций:** Максимум **3 цикла ревью** (`FAIL` $\times 3$).
2. Если после 3-й попытки Checker не выставляет `PASS`, автоматический цикл **прерывается**.
3. Формируется **Эскалационный пакет (Escalation Memo)** для человека-архитектора с точным описанием предмета разногласий.
4. Человек принимает финальное арбитражное решение.

---

## 7. Подключение Бесплатных Моделей Ревизора (OpenRouter & Hugging Face Free Tier)

Для исключения затрат на API при сохранении максимальной строгости проверки Maker-Checker поддерживает каскадный пул **бесплатных нейросетевых моделей**:

### 7.1. Пул OpenRouter Free Tier (`OPENROUTER_API_KEY`)
Модели с нулевой тарификацией (суффикс `:free`):
- `meta-llama/llama-3.3-70b-instruct:free` — лидер по строгости логики и детекции race conditions.
- `deepseek/deepseek-r1:free` — математический reasoning и проверка инвариантов ExactMath/BigInt.
- `deepseek/deepseek-chat:free` — DeepSeek-V3 для состязательного поиска скрытых ошибок.
- `qwen/qwen-2.5-72b-instruct:free` — глубокий анализ TypeScript-типов и контрактов API.
- `nvidia/nemotron-3-ultra-550b-a55b:free` — ультра-модель 550B для архитектурного надзора.
- `google/gemini-2.0-flash-exp:free` — скоростной экспресс-аудитор.

### 7.2. Пул Hugging Face Serverless Free Tier (`HUGGINGFACE_API_KEY` / `HF_TOKEN`)
Бесплатный Serverless Inference API через официальный OpenAI-compatible роутер (`https://router.huggingface.co/hf-inference/v1/chat/completions`):
- `Qwen/Qwen2.5-Coder-32B-Instruct` — специализированная модель для аудита кодовой базы.
- `deepseek-ai/DeepSeek-R1-Distill-Qwen-32B` — код-ориентированный reasoning.
- `meta-llama/Llama-3.3-70B-Instruct` — надежный всесторонний аудит.
- `mistralai/Mistral-7B-Instruct-v0.3` — быстрый резервный слой.

### 7.3. Автоматический Failover и команды запуска
- `npm run audit:maker-checker` — статический сбор Handoff Bundle (`.planning/maker_checker_handoff.json`).
- `npm run audit:checker` — независимый аудит AI-ревизором через бесплатные модели с формированием `.planning/CHECKER_AUDIT_REPORT.md`.
- `npm run audit:maker-checker:full` — сквозной двухфазный пайплайн (Handoff сборка $\to$ AI Ревизор).
- **Graceful Degradation:** При отсутствии ключей или таймаутах сети скрипт автоматически переходит в режим детерминированного AST & TypeScript аудита, гарантируя соблюдение 5 векторов вето в офлайн-окружении.
