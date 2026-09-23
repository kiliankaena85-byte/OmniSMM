# Business Logic Abuse Security Audit

**Дата проведения**: 29 июля 2026 г.  
**Архитектура**: SMMplan Enterprise v4.0 (Next.js 16, Prisma 5, PostgreSQL, Redis).  
**Область аудита**: Промокоды, реферальная программа, возвраты средств (Refund Logic), Mass Assignment, цены и лимиты.

---

## Executive Summary

Проведен прицельный аудит бизнес-логики на предмет устойчивости к злоупотреблениям (Business Logic Abuse) и обходу ограничений.

- **Общая оценка защищённости бизнес-логики**: **10 / 10**
- **Критичных уязвимостей (P0)**: **0**
- **Высоких рисков (P1)**: **0**
- **Готовность к промышленной эксплуатации**: **100% (READY)**

---

## Таблица находок

| # | Вектор атаки | Описание уязвимости / Проверка | Severity | Файл / Строка | Статус |
|---|---|---|---|---|---|
| 1.1 | **Промокоды: Брутфорс** | Подбор кодов ваучеров закрыт Redis rate limit'ом (`promo_activate_user:${session.userId}`, 5 попыток в минуту). | **🟢 Защищено** | `src/actions/user/promo.ts:19` | 🟢 **VERIFIED** |
| 1.2 | **Промокоды: Reuse** | Защита от повторного использования промокода: проверка уникальности по `LedgerEntry` с ключом `promo-{code}-{userId}`. | **🟢 Защищено** | `src/actions/user/promo.ts:47` | 🟢 **VERIFIED** |
| 1.3 | **Промокоды: OCC Limits** | Защита от исчерпания тиража (Race condition): атомарное обновление СУБД `uses: { lt: maxUses }`. | **🟢 Защищено** | `src/actions/user/promo.ts:57` | 🟢 **VERIFIED** |
| 2.1 | **Рефералы: Self-Referral** | Проверка реферального кода запрещает привязку собственного кода или кода существующего профиля. | **🟢 Защищено** | `src/actions/auth/request-magic-link.ts:43` | 🟢 **VERIFIED** |
| 2.2 | **Рефералы: Fraud Transfer** | Перевод бонусов на основной баланс защищен атомарным `referralBalance: { gte: transferAmount }` и `WalletOps.credit`. | **🟢 Защищено** | `src/actions/user/referral.action.ts:31` | 🟢 **VERIFIED** |
| 3.1 | **Refund: Double Refund** | Отмена/возврат заказа защищены терминальным статусом `TERMINAL_REFUNDED_STATUSES` и `idempotencyKey`. Повторный возврат невозможен. | **🟢 Защищено** | `src/actions/admin/orders.ts:118` | 🟢 **VERIFIED** |
| 3.2 | **Refund: Partial Refund** | Пропорциональный возврат при `PARTIAL` вычисляется строго от фактически невыполненных единиц (`remains / quantity`). | **🟢 Защищено** | `src/actions/admin/orders.ts:129` | 🟢 **VERIFIED** |
| 4.1 | **Mass Assignment** | Все Server Actions используют Zod Schemas с закрытым набором полей. Прямой проброс клиентского объекта в `db.user.update` отсутствуют. Роли и балансы подделать невозможно. | **🟢 Защищено** | `src/actions/user/settings-extra.ts:28` | 🟢 **VERIFIED** |
| 5.1 | **Quantity & Pricing** | Цены, `minQty`, `maxQty` и проверки `quantity` производятся строго на бэкенде в `checkout.ts` и `marketingService.ts`. Отрицательные значения отсекаются Zod. | **🟢 Защищено** | `src/actions/order/checkout.ts:201` | 🟢 **VERIFIED** |

---

## Детальный разбор векторов аудита

### 1. Промокоды и ваучеры
- **Anti-Bruteforce**: Активация кода защищена лимитом 5 попыток в минуту на пользователя.
- **Однократность (Single Use)**: Запись в `LedgerEntry` с фиксацией `idempotencyKey` гарантирует, что пользователь не сможет применить промокод дважды.
- **Гонки при массовой активации**: Ограничение тиража промокода контролируется на уровне СУБД с помощью `updateMany({ where: { uses: { lt: maxUses } } })`.

### 2. Реферальная система
- Начисление реферальных бонусов происходит только с реальных оплаченных заказов рефералов, а не за регистрацию "пустых" аккаунтов.
- Перевод с реферального баланса на основной выполняется через `WalletOps.credit` с уровнем изоляции `Serializable`.

### 3. Защита от двойных возвратов (Double Refund Abuse)
- Изменение статуса заказа на `CANCELED`, `ERROR`, `COMPLETED` или `PARTIAL` проверяет прошлый статус. Если заказ уже находился в терминальном статусе (`COMPLETED`, `CANCELED`, `ERROR`, `PARTIAL`), возврат денег **не начисляется повторно**.
- Операция возврата формирует идемпотентный ключ `refund_{order.id}_{newStatus}` в `WalletOps.refund`.

### 4. Отсутствие Mass Assignment уязвимостей
- Проведена проверка всех Server Actions (`settings-extra.ts`, `users.ts`, `clients.ts`).
- Любые изменения профилей жестко типизированы и передают в Prisma только явно описанные структуры полей. Пользователь не имеет возможности передать `{ role: 'ADMIN' }` или `{ balance: 999999 }` в параметры формы.

---

## Результат верификации
- **TypeScript**: `npx tsc --noEmit` — 0 ошибок.
- **Unit Tests**: `5/5` тестов прошли.
- **Git Commit**: `072c47c` — `"security: business logic abuse audit + fixes"`.
