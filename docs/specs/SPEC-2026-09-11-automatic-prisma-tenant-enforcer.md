# SPEC-2026-09-11: Automatic Prisma Tenant Enforcer & Zero-BOLA Architecture

> **Статус:** APPROVED & IN EXECUTION  
> **Версия спецификации:** 1.0.0  
> **Целевой стандарт:** SDD-TDD 2026, OWASP Top 10:2026 (A01: Broken Access Control / BOLA / IDOR), ст. 54.1 НК РФ.  
> **Затрагиваемые компоненты:** `src/lib/tenant-context.ts`, `src/lib/prisma-tenant-enforcer.ts`, `src/lib/db.ts`, `.agents/skills/multi-tenant-isolation-arch/SKILL.md`.

---

## 1. Назначение и Цели

Перенос контроля мульти-тенантной изоляции с уровня прикладного кода (где разработчик может забыть фильтр `where: { tenantId }`) на фундаментальный уровень ORM (Prisma Client Extension).

### Инварианты:
1. **INVARIANT-TENANT-1 (Auto-Scoping):** Любой запрос к моделям `Order`, `Payment`, `Ticket`, `User`, `Service`, `Category`, `CustomerGroup`, `PromoCode`, `LedgerEntry` обязан автоматически фильтроваться по активному `tenantId`.
2. **INVARIANT-TENANT-2 (IDOR Prevention):** `findUnique({ where: { id } })` автоматически конвертируется в `findFirst({ where: { id, tenantId } })`.
3. **INVARIANT-TENANT-3 (Fail-Closed Context):** Если `tenantId` не может быть разрешен и байпас не активирован, операция завершается ошибкой `SECURITY_TENANT_UNRESOLVED`.
4. **INVARIANT-TENANT-4 (Auditable Bypass):** Доступ ко всем тенантам возможен только через явную функцию `runWithTenantBypass(reason, callback)` с обязательной фиксацией причины в аудите.

---

## 2. Архитектура Компонентов

### 2.1. Контекст Тенанта (`src/lib/tenant-context.ts`)
Использует нативный Node.js `AsyncLocalStorage`:
```typescript
interface TenantContextState {
  tenantId?: string;
  isBypass?: boolean;
  bypassReason?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextState>();
```
Методы:
- `runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T>`
- `runWithTenantBypass<T>(reason: string, fn: () => Promise<T>): Promise<T>`
- `resolveActiveTenantId(): string | null` (проверяет storage, затем `next/headers`, затем `null`)

### 2.2. Prisma Extension Enforcer (`src/lib/prisma-tenant-enforcer.ts`)
Использует Prisma Client Extension `$extends`:
- Модели под защитой: `order`, `payment`, `ticket`, `user`, `service`, `category`, `customerGroup`, `promoCode`, `ledgerEntry`.
- Перехватываемые операции: `findMany`, `findFirst`, `findUnique`, `count`, `aggregate`, `groupBy`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`.

---

## 3. План TDD

1. **Red Phase:** Тест `src/__tests__/architecture/automatic-prisma-tenant-enforcer.test.ts` проверяет:
   - Автоматическую подстановку `tenantId` в `findMany` при активном контексте.
   - Защиту от IDOR при `findUnique` (попытка прочитать сущность другого тенанта возвращает `null`).
   - Блокировку попытки создания сущности с чужим `tenantId`.
   - Работу `runWithTenantBypass()`.
2. **Green Phase:** Реализация `tenant-context.ts` и `prisma-tenant-enforcer.ts`, подключение к `db.ts`.
3. **Проверка регрессий:** Запуск всего сьюта тестов мульти-тенантности.
