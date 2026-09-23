# Smmplan Enterprise SDLC & Compliance Protocol 2026

**Версия документа:** 1.0.0
**Статус:** Утвержден к обязательному исполнению всеми ИИ-агентами и разработчиками.
**Тип:** Политика (Policy) и Регламент (Procedure).

---

## 1. Назначение документа
Этот документ регламентирует жизненный цикл разработки ПО (Software Development Life Cycle — SDLC) платформы Smmplan. Он создан для перевода разработки из состояния "Agile/Indie" в состояние "Enterprise", с полным документированием и отслеживаемостью каждого изменения кода.

Процесс спроектирован на базе интеграции **Scrum Framework (2020)** и международных стандартов ISO/IEC. Ни одна строка кода не может быть отправлена в `main` в обход этого протокола.

---

## 2. Нормативные ссылки (Compliance Matrix)

Разработка ведется в строгом соответствии со следующими стандартами:

### 2.1. ISO/IEC/IEEE 12207:2017 (Системная и программная инженерия)
*   **Clause 6.4.2 (Stakeholder Needs and Requirements Definition):** Каждая задача обязана быть зафиксирована в `.planning/REQUIREMENTS.md`. Запрещено писать код по "устному" или "размытому" запросу без письменного ТЗ. (Обеспечивается `gsd-prompt-engineer`).
*   **Clause 7.1.5 (Software Design):** Любой новый модуль должен получить JSON UI/API спецификацию до имплементации. (Обеспечивается `gsd-ui-architect`).
*   **Clause 7.1.7 (Software Integration):** Интеграция допускается только после прохождения CI-гейтов (TypeScript, ESLint). (Обеспечивается `gsd-preflight-check`).

### 2.2. ISO/IEC 27001:2022 (Управление информационной безопасностью)
*   **Annex A.8.2.3 (Secure System Engineering Principles):** Внедрен принцип "Zero-Trust" между клиентом и сервером в Next.js 16. Все Server Actions обязаны валидировать сессию (`verifySession`) и права доступа (`requireAdmin`).
*   **Annex A.8.2.5 (Secure Development Life Cycle):** Безопасность встроена на этапе написания кода. (Проверяется гейтом 3 и 5 в `gsd-preflight-check`).

### 2.3. OWASP Top 10 (2021)
*   **A01: Broken Access Control**: Покрытие всех Server Actions аутентификационными гардами.
*   **A03: Injection**: Использование исключительно Prisma ORM. Прямые SQL запросы (raw) запрещены без апрува Security-агента.
*   **A06: Vulnerable and Outdated Components**: Обязательный запуск `npm audit --audit-level=high` перед релизом.

---

## 3. Методология Управления: Scrum Framework

### 3.1. Артефакты (Artifacts)
| Артефакт Scrum | GSD Эквивалент | Владелец | Описание |
| :--- | :--- | :--- | :--- |
| **Product Backlog** | `ROADMAP.md` | Product Owner | Утвержденные фичи, баги и инициативы (Эпики). |
| **Sprint Backlog** | `.planning/PLAN.md` | Dev Team | Декомпозированные технические шаги (Tasks) на текущую фазу. |
| **Increment** | Рабочий код в ветке `main` | Scrum Master | Код, прошедший Definition of Done (DoD). |

### 3.2. Роли (Roles)
*   **Product Owner (Владелец бизнеса / USER):** Задает курс, утверждает бизнес-ценность и принимает работу на этапе UAT.
*   **Scrum Master & Chief of Staff (`gsd-scrum-master` / `gsd-chief-of-staff`):** Архитектурный надзиратель. Контролирует соблюдение ISO-стандартов, не дает ИИ-агентам срезать углы (Technical Debt Defense).
*   **Development Team (ИИ-агенты):** Хирург, Ресерчер, Аналитики. Пишут код, несут ответственность за качество (Zero-Defect).

---

## 4. Жизненный цикл фичи (SDLC Pipeline)

Любое изменение в коде Smmplan обязано пройти 5 фаз (Quality Gates):

### Phase 1: Груминг и Требования (Requirements Engineering)
1. ПОЛЬЗОВАТЕЛЬ формулирует идею.
2. Агент `gsd-prompt-engineer` перехватывает инициативу и проводит интервью (3-5 вопросов).
3. Создается запись в `.planning/REQUIREMENTS.md` со ссылкой на бизнес-цель.
*   **ISO Compliance:** 12207 Clause 6.4.2 (Traceability).

### Phase 2: Оценка Рисков (Architecture & Risk Assessment)
1. Вступает `gsd-research-autopsy` (и `gsd-chief-of-staff`).
2. Генерируется Матрица Рисков (Risk Matrix P×I), оцениваются угрозы для маржи (CFO) и безопасности (Sec).
3. Пишется `PLAN.md` с атомарными шагами.

### Phase 3: Исполнение (Implementation)
1. Агент `gsd-surgeon` пишет код.
2. Код пишется изолированно. Если агент сталкивается с блокером (ошибка Auth), он вызывает остановку (Blocker Handling), а не пытается "нахардкодить" обходной путь.
3. Соблюдаются архитектурные правила Next.js (отсутствие "use server" в page.tsx, правильная инвалидация кэша).

### Phase 4: Архитектурный Надзиратель (Preflight & Integration)
Перед тем как агент пометит шаг как `[x]`, автоматически запускается скрипт `gsd-preflight-check`.
**The Definition of Done (DoD) Gate:**
*   [x] `npx tsc --noEmit` пройден (0 ошибок).
*   [x] `npm run lint` пройден (соответствие Flat Config).
*   [x] Все мутирующие действия имеют `revalidatePath`.
*   [x] Нет не зашифрованных секретов.
*   **ISO Compliance:** 12207 Clause 7.1.7, 27001 Annex A.8.2.5.

### Phase 5: Приемка и Ретроспектива (UAT & Review)
1. Проводится `gsd-verify-work`.
2. Владелец Продукта (USER) проверяет UI/функционал.
3. Ошибки заносятся в `DEBUG.md` и цикл возвращается на Phase 3.
4. При успехе: генерация `SUMMARY.md` и фиксация в Git.

---

## 5. Обработка Инцидентов (Exception Handling)
*   **Критические баги на проде (P0):** Пропускают Phase 1 и Phase 2. Формируется Hotfix-ветка. DoD (Phase 4) остается **обязательным**.
*   **Технический долг:** Любой "костыль" обязан сопровождаться комментарием `// TECH-DEBT: [REQ-ID] [Date] Reason`. `gsd-analytics-debt` раз в неделю собирает эти комментарии и формирует таски в бэклог.
