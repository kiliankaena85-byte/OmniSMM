# 🏛️ Smmplan Engineering Standards & Stack Manifesto (2026)

**Статус:** СТРОГО ОБЯЗАТЕЛЬНО К ИСПОЛНЕНИЮ (STRICT COMPLIANCE)
**Цель:** Обеспечить консистентность, производительность и "Zero-Defect" качество кодовой базы Smmplan.

---

## 1. Фундаментальные Архитектурные Правила (Hard Rules)

### 1.1. Граница Server / Client (Trust Boundary)
*   **Правило по умолчанию:** Все компоненты в `src/app` являются **Server Components**.
*   **Директива `"use client"`:** Допускается *только* на уровне leaf-компонентов (кнопки, формы, интерактивные таблицы), которые используют React Hooks (`useState`, `useOptimistic`, браузерные API).
*   **FATAL ERROR:** Категорически запрещено писать `"use server"` в файлах `page.tsx` или `layout.tsx`. Это вызывает фатальный краш Turbopack в Next.js 16. Server Actions должны лежать строго в `src/actions/`.

### 1.2. Изоляция Данных (Anti-Mass-Sync)
*   **Shadow Catalog:** Запрещено сохранять сырые каталоги провайдеров (тысячи услуг) напрямую в PostgreSQL. Данные провайдеров пишутся во временный Redis-кэш (`provider:{id}:catalog`).
*   **Cherry-Pick:** В основную базу `Service` услуги попадают только после ручного (или алгоритмического) отбора администратором через Import Wizard.

### 1.3. Обработка Финансов и Заказов
*   **Event-Driven Workers:** Веб-сервер (`next start`) не должен выполнять долгие задачи. Оформление заказа у провайдера, Drip-Feed и синхронизация статусов делегируются в BullMQ (папка `src/workers/`).
*   **Safety Floor:** При расчете маржи всегда должна учитываться минимальная граница безопасности (Safety Floor), привязанная к кросс-курсу ЦБ РФ (USD/RUB).

---

## 2. Стек Технологий и Жесткие Паттерны

### 2.1. Next.js 16 (App Router) & React 19
*   **Мутации и Формы:** Использовать хук `useActionState` (заменяет устаревший `useFormState`).
*   **Optimistic UI:** Все интерактивные списки, чекбоксы и кнопки лайков обязаны использовать `useOptimistic` для мгновенного отклика (Premium UX).
*   **Инвалидация Кэша:** Любой Server Action, изменяющий данные в Prisma, **ОБЯЗАН** завершаться вызовом `revalidatePath('/путь')` или `revalidateTag('tag')`. Клиентский `router.refresh()` недостаточен.
*   **Refs:** Запрещено использовать устаревший `forwardRef`. В React 19 `ref` передается как обычный prop.

### 2.2. Styling: Tailwind CSS v4 & HeroUI v3
*   **Дизайн-система (Strict Tokens):** Категорически запрещено использовать inline-цвета (`text-black`, `bg-blue-500`). Разрешены **только** семантические переменные из `@theme` директивы в `globals.css` (например, `text-foreground`, `bg-background`, `bg-card`, `text-primary`).
*   **HeroUI Dot Notation:** Использовать новый синтаксис HeroUI v3. Правильно: `<Table.Header>`, `<Modal.Content>`. Неправильно: `<TableHeader>`, `<ModalContent>`.

### 2.3. Database: Prisma 5 & PostgreSQL
*   **Singleton:** Импортировать инстанс БД строго из `src/lib/prisma.ts`.
*   **Transactions:** При списании баланса пользователя и создании заказа использовать строго `$transaction` с уровнем изоляции (Prevent Race Conditions).
*   **Client Isolation:** Запрещено импортировать `@prisma/client` в файлах, отмеченных как `"use client"`.

---

## 3. Политика "Zero-Defect" & DevSecOps

1. **Никаких "Silent Errors":** Нельзя оборачивать код в `try/catch` с пустым блоком. Ошибки должны логироваться в Sentry или `console.error`.
2. **Аутентификация (A01):** Любой экспортируемый Server Action обязан начинаться с `await requireAdmin()` или `await verifyUser()`.
3. **Безопасность типов:** Запрещено использовать `any`. В крайнем случае используется `unknown` с последующей валидацией через Zod. Использование `@ts-ignore` разрешено только с развернутым комментарием-обоснованием.
