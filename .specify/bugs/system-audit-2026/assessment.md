# Bug Assessment Report: system-audit-2026

**Slug:** `system-audit-2026`  
**Date:** 2026-09-12  
**Status:** `CONFIRMED`  
**Severity:** `HIGH`  

---

## 1. Summary of Identified Defects

В ходе сквозного аудита кодовой базы платформы OmniSMM 1.0 с применением новых навыков GitHub Spec Kit (`speckit-analyze`, `speckit-bug-assess`) и архитектурных скиллов (`concurrency-acid-guard`, `arch-boundary-guard`, `resilience-bulkhead-circuit`, `nfr-performance-budget`) выявлено 5 дефектов:

| ID | Область | Файл | Критичность | Описание |
|---|---|---|---|---|
| **BUG-01** | Вебхуки провайдеров | `src/app/api/webhooks/vexboost/route.ts` | **CRITICAL** | В фильтр заказов вебхука включены статусы `AWAITING_PAYMENT` и `PENDING`, что нарушает инвариант `AGENTS.md` (Раздел 12) и создает риск ложной активации/возврата неоплаченного заказа. |
| **BUG-02** | Списание с баланса | `src/services/financial/payment-gateway.service.ts` | **HIGH** | Вызов `WalletOps.charge()` при оплате с баланса не передает `opts.idempotencyKey`, что нарушает Ledger-First инвариант и создает риск повторного списания при ретраях. |
| **BUG-03** | Безопасность / IDOR | `src/app/api/payments/[id]/status/route.ts` | **HIGH** | Небезопасная проверка IDOR: неавторизованный гость (`session === null`) может получить статус платежа зарегистрированного пользователя (`payment.userId`). |
| **BUG-04** | Производительность БД | `src/actions/admin/finance/treasury.ts` | **MEDIUM** | Загрузка всех строк таблиц `users`, `orders`, `payments` в память Node.js через `findMany` вместо нативной агрегации СУБД `aggregate({ _sum: ... })` (риск OOM). |
| **BUG-05** | Клиентская устойчивость | `src/components/providers/MaintenanceGuardian.tsx` | **LOW-MEDIUM** | `fetch('/api/maintenance-status')` вызывается без таймаута `AbortSignal.timeout(5000)` и без AbortController при частой смене маршрутов. |

---

## 2. Proposed Remediation Strategy

1. **BUG-01:** Сузить фильтр статусов в `src/app/api/webhooks/vexboost/route.ts` строго до `['IN_PROGRESS', 'PENDING_CHECK']`.
2. **BUG-02:** Передать `idempotencyKey: 'balance-charge-' + params.paymentId` и `tenantId: params.tenantId` в `WalletOps.charge`.
3. **BUG-03:** Внедрить регламентный барьер `Guest-Proof IDOR`: `if (payment.userId && (!session || payment.userId !== session.userId) && !isStaff) { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }`.
4. **BUG-04:** Переписать подсчет сумм в `treasury.ts` на SQL-агрегации Prisma (`db.user.aggregate`, `db.order.aggregate`, `db.payment.aggregate`).
5. **BUG-05:** Добавить `AbortSignal.timeout(5000)` в `MaintenanceGuardian.tsx`.
