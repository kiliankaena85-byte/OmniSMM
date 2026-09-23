# Архитектурные контракты Smmplan

## ОБЯЗАТЕЛЬНЫЕ правила для AI-агентов

Перед написанием ЛЮБОГО нового кода, агент ОБЯЗАН выполнить grep-поиск
по ключевым словам задачи и убедиться, что аналогичная функциональность
не реализована в одном из сервисов ниже.

## Контракты (нарушение = блокер)

| Домен | Единственный источник правды | Файл |
|-------|------------------------------|------|
| Финансовые операции (Standalone) | `WalletService.charge/credit/refund` | `src/services/financial/wallet.service.ts` |
| Финансовые операции (Внутри $transaction) | `WalletOps.charge/credit/refund` | `src/services/financial/wallet-ops.ts` |
| Расчёт цены | `marketingService.calculatePrice()` | `src/services/marketing.service.ts` |
| Формула рефанда | `calculatePartialRefund()` | `src/utils/refund.ts` |
| Создание платежа | `UnifiedPaymentService.createPayment()` | `src/services/financial/unified-payment.service.ts` |
| Авторизация админа | `requireStaffPermission()` | `src/lib/server/rbac.ts` |
| IP-адрес клиента | `getClientIp()` | `src/utils/ip.ts` |
| Аудит действий | `auditAdmin()` | `src/lib/admin-audit.ts` |
| Форматирование цены | `formatCents()` | `src/lib/utils.ts` |

## Запрещено
- ❌ Инлайн `balance: { increment }` или `balance: { decrement }` за пределами `WalletService` или `WalletOps`. 
  - **Исключения**: `checkout.ts` (использует Redis Mutex + Atomic updateMany для скорости), `escrow.service.ts` (resolveQuarantine, где ledger уже существует).
- ❌ Прямой `fetch('https://api.yookassa.ru/...')` за пределами UnifiedPaymentService
- ❌ Формула `(remains / quantity) * charge` за пределами `calculatePartialRefund()`
- ❌ `db.adminAuditLog.create()` за пределами `auditAdmin()` (Исключение: допускается внутри `$transaction` для атомарности)
- ❌ `requireAdmin()` или `requireManager()` — использовать `requireStaffPermission()`
