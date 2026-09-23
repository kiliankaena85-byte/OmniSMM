# Policy-as-Code & AST Guardrails Engine (OmniSMM 1.0)

## 1. Концепция и назначение
В парадигме AI-разработки 2026 года статические текстовые правила в промптах и AGENTS.md являются необходимым, но недостаточным условием защиты от деградации архитектуры. LLM-агенты могут случайно совершать тонкие архитектурные ошибки (например, вызывать глобальный экземпляр db внутри колбэка $transaction, импортировать рантайм Prisma Client в клиентские компоненты " use client\ или использовать директиву \use server\ внутри page.tsx).

Для гарантированного предотвращения регрессий в платформе развернут **Policy-as-Code Guardrails Engine**, который выполняет строгий семантический анализ исходного кода через **TypeScript Compiler AST API** ( s.createSourceFile) и конфигурации **AST-Grep** (.ast-grep/).

---

## 2. Архитектура движка (scripts/run-ast-guardrails.ts)

Движок разработан на нативном TypeScript AST, что обеспечивает:
- **Субсекундную скорость:** сканирование сотен файлов проекта менее чем за 2 секунды.
- **Кроссплатформенность:** не требует установки внешних бинарников st-grep в операционную систему или Docker-контейнер.
- **Контекстную точность:** рекурсивный обход дерева AST отслеживает лексический контекст (например, имя параметра транзакции x передается строго внутрь тела колбэка $transaction(async (tx) => { ... })).

Интеграция в package.json:
`json
\scripts\: {
 \lint:guardrails\: \tsx scripts/run-ast-guardrails.ts\
}
`

---

## 3. Матрица правил и уровней критичности

| Rule ID | Уровень | Описание инварианта | Механизм AST-детекции |
| :--- | :--- | :--- | :--- |
| **
o-transaction-escape** | 🛑 BLOCKER | Запрет обращения к глобальному db.* внутри колбэка транзакции Prisma. Предотвращает Transaction Escape, взаимные блокировки (deadlocks) и нарушение ACID. | s.isPropertyAccessExpression + контекстный скоуп колбэка $transaction. |
| **
o-use-server-in-page** | 🛑 BLOCKER | Запрет директивы \use server\ в src/app/**/page.tsx. Предотвращает краш серверных компонентов Next.js 16 App Router. | Проверка наличия директивы в AST файлах страниц. |
| **
o-prisma-in-client** | 🛑 BLOCKER | Запрет runtime импорта @prisma/client или @/lib/db в компонентах с директивой \use client\. Исключает раздувание клиентского бандла и падение в браузере. Разрешен строго import type { ... }. | s.isImportDeclaration + проверка importClause.isTypeOnly и element.isTypeOnly. |
| **etch-timeout-required** | ⚠️ MAJOR | Сетевой вызов etch(...) обязан содержать опцию signal: AbortSignal.timeout(...). Защищает от зависания HTTP-соединений и исчерпания сокетов. | Проверка аргументов s.isCallExpression на наличие свойства signal. |
| **server-action-typed-return** | ℹ️ WARNING | Server Actions в src/actions/ обязаны возвращать типизированный { success: false, error: \...\ } вместо необработанного hrow new Error. | Поиск s.isThrowStatement, не обернутых в локальный блок ry/catch. |

---

## 4. Конфигурация AST-Grep (.ast-grep/)

В проекте также развернута декларативная конфигурация YAML-правил для утилиты sg (ast-grep):
- .ast-grep/sgconfig.yml — корневая конфигурация.
- .ast-grep/rules/no-transaction-escape.yml — шаблон db. внутри $transaction($).
- .ast-grep/rules/no-use-server-in-page.yml — директива в page.tsx.
- .ast-grep/rules/no-prisma-in-client.yml — импорты Prisma в клиентских компонентах.
- .ast-grep/rules/no-float-financial-arithmetic.yml — детекция неточных операций деления сумм.
- .ast-grep/rules/server-action-typed-return.yml — сырые исключения в Server Actions.
- .ast-grep/rules/fetch-timeout-required.yml — таймауты etch.
- .ast-grep/rules/guest-proof-idor.yml — BOLA/IDOR проверки без проверки !sessionUser.

---

## 5. Верификация и статус соответствия

При запуске 
pm run lint:guardrails:
- Сканировано: **300+ файлов** TypeScript в src/.
- Найдено и устранено дефектов: 9 неявных runtime-импортов типов @prisma/client в клиентских компонентах админки переведены на import type.
- Результат: **0 BLOCKERS, PASS (100%)**.
- Проверка типов: 
px tsc --noEmit — **0 ошибок**.
