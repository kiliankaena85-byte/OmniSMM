# Code Hygiene, Linting & Architecture Quality (OmniSMM 1.0)
# Стандарты чистоты кода, типизации TypeScript, React 19 и анти-костылей

## 1. Strict Typing & Zero Any
- ❌ **Strict Types:** Запрещено использовать `any` (`@typescript-eslint/no-explicit-any`). Используйте `unknown` с runtime-проверкой типов или Zod-схемы.
- ❌ **No Suppressions:** Запрещено использовать `@ts-ignore`, `@ts-nocheck` или `eslint-disable` без предварительного исправления корневой причины ошибки.
- ❌ **Clean Scope:** Удаляйте неиспользуемые импорты и переменные (`@typescript-eslint/no-unused-vars`).
- ❌ **Zero-Hallucination Prisma Schema:** КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО обращаться к полям моделей БД по памяти или через spread `...(tenantId ? { tenantId } : {})` без сверки с `prisma/schema.prisma` (например, у `PromoCode` нет `tenantId`). Перед написанием запроса проверьте модель в схеме.

## 2. No-Crutch Policy (Анти-Костыли)
- ❌ **ЗАПРЕЩЕНО** оставлять заглушки `// TODO`, `// FIXME` в продакшен-коде.
- ❌ **ЗАПРЕЩЕНО** писать пустые обертки `try { ... } catch (e) { throw e; }`.
- ❌ **ЗАПРЕЩЕНО** использовать inline-стили для цветов и отступов (`text-white`, `bg-black`, `border-[1px]`). Используйте строго семантические токены из `src/app/globals.css`.
- ✅ Все создаваемые файлы обязаны соблюдать лимит читаемости: компоненты **до 150–200 строк** с декомпозицией на субкомпоненты.

## 3. React 19 & Next.js 16 App Router Invariants
- ❌ **React 19:** Запрещен хук `useFormState` (он устарел). Используйте строго `useActionState`.
- ❌ **Server Actions:** Запрещено размещать `"use server"` в файлах страниц (`page.tsx`) — вызывает краш рантайма Next.js. Server Actions размещаются строго в `src/actions/`.
- ❌ **No Unhandled Throws in Actions:** Запрещено выбрасывать `throw new Error(...)` внутри Server Actions (Next.js маскирует их в продакшене в *"An unexpected response was received from the server"*).
- ✅ Все Server Actions обязаны возвращать типизированный результат: `return { success: false, error: 'Понятное сообщение' }` или `return { success: true, data: ... }`.
- ✅ Все действия аудита персонала в Server Actions, изменяющие права или финансы, ОБЯЗАНЫ вызываться через `await auditAdminAwaitable()` (вызов без await в serverless-рантайме приводит к потере логов).
- ❌ **Standalone Сборка:** Запрещено добавлять стандартные библиотеки (`ioredis`, `sanitize-html`, `bullmq`) в `serverExternalPackages` в `next.config.mjs`. Для продакшена сборка выполняется через `next build --webpack`.
- ✅ **Синтаксис батч-замен:** При использовании `multi_replace_file_content` всегда проверяйте баланс фигурных скобок `{}`.
