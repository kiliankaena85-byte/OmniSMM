# Tenant Data Isolation Patterns — Защита от BOLA / IDOR в OmniSMM 1.0

> **Стандарт:** OWASP Top 10:2026 (A01: Broken Access Control), ASVS v4.0.3 L2  
> **Ключевой инвариант:** Полная изоляция сущностей тенантов на уровне запросов к базе данных.

---

## 1. Модель угроз (Threat Model)

При обслуживании $N$ тенантов (SMMplan, SMMflux, партнерские фронтенды инвесторов) в единой СУБД PostgreSQL возникает риск следующих атак:
1. **Broken Object Level Authorization (BOLA / IDOR):**
   - Пользователь тенанта `investor_alpha` запрашивает `/api/orders/order_xyz`.
   - Если бэкенд ищет заказ только по `id: "order_xyz"`, злоумышленник получает доступ к заказу пользователя SMMplan.
2. **Blind Modification:**
   - Попытка отменить чужой заказ или изменить ссылку через мутацию `db.order.update({ where: { id: "order_xyz" }, data: { ... } })`.
3. **Cross-Tenant User Enumeration:**
   - Попытка перебора чужих email адресов через форму восстановления пароля или регистрацию.

---

## 2. Защитные шаблоны в коде (Defense Patterns)

### Паттерн 1: `getTenantScopedDb(tenantId)` (Enterprise Extension)
В `src/lib/prisma-tenant-scope.ts` реализован расширенный Prisma-клиент через `$extends`:
```typescript
import { getTenantScopedDb } from '@/lib/prisma-tenant-scope';

export async function getUserOrders(tenantId: string, userId: string) {
  const tenantDb = getTenantScopedDb(tenantId);
  // tenantDb автоматически добавляет `where: { tenantId }` во ВСЕ операции!
  return await tenantDb.order.findMany({
    where: { userId }
  });
}
```

### Паттерн 2: Явное составное условие (Explicit Composite Where)
Если используется глобальный клиент `db`:
```typescript
// ❌ УЯЗВИМО:
const order = await db.order.findUnique({ where: { id: orderId } });

// ✅ БЕЗОПАСНО:
const order = await db.order.findFirst({
  where: {
    id: orderId,
    tenantId: ctx.tenantId, // Обязательный фильтр!
    userId: ctx.userId       // Проверка владения!
  }
});
```

### Паттерн 3: Составные уникальные индексы в Prisma
Все сущности, имеющие слаги или токены, используют составные ключи:
```prisma
model Service {
  id       String @id @default(cuid())
  slug     String
  tenantId String
  
  @@unique([tenantId, slug]) // Изоляция слагов между витринами!
}
```

---

## 3. Исключения и директива `// tenant-isolation-ignore`

В платформе есть системные задачи (Outbox Poller, фоновый воркер опроса провайдеров Vexboost, кроны очистки кэша), которым требуется обрабатывать заказы всех тенантов.
Для них введен строгий протокол:
```typescript
// tenant-isolation-ignore: Provider dispatch worker handles queued orders across all tenants
const pendingOutbox = await db.providerOutbox.findMany({
  where: { status: 'PENDING' },
  take: 50
});
```
AST-сканер валидирует наличие директивы и текста обоснования.
