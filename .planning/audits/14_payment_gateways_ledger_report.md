# 💳 Аудит Дисциплины 14: Payment Gateways & Ledger
## Дата: 2026-05-05
## Научные Линзы: Double-Entry Bookkeeping, Idempotency, Race Conditions
## Файлы в Scope: `payment.service.ts`, `checkout.ts`, `crypto/route.ts`

---

## Summary

| Severity | Кол-во |
|----------|--------|
| 🔴 Critical | 1 |
| 🟠 High | 1 |
| 🟡 Medium | 0 |
| **Всего Findings** | **2** |

---

## ✅ Что уже хорошо
1. **Защита от двойных возвратов:** Отмена заказа администратором обернута в `Serializable` транзакцию с предварительной проверкой статуса `CANCELED`.
2. **Идемпотентность вебхуков:** Атомарный `updateMany` в `payment.service.ts` не дает одному вебхуку зачислить деньги дважды.
3. **Блокировка сиротских платежей:** Внедрен `[SECURITY] Orphan webhook rejected`, предотвращающий зачисление денег без контекста.
4. **Mutex-локи при оплате с баланса:** Защита `balance_lock_` предотвращает списывание баланса в "минус" при DDoS атаке запросами.

---

## Findings

### 🔴 CRITICAL-001: Двойной учет метрики LTV (`totalSpent`)

**Описание:**
Метрика `totalSpent` в модели `User` подвержена багу двойного счета:
1. Когда клиент **пополняет баланс** (Deposit Webhook), код в `payment.service.ts` делает `balance: {increment}, totalSpent: {increment}`.
2. Когда клиент **покупает заказ с баланса**, код в `checkout.ts` делает `balance: {decrement}, totalSpent: {increment}`.

**Научное обоснование:**
- *Double Accounting*: Если клиент пополнит 1000₽ и потратит 1000₽, его `totalSpent` станет 2000₽. Это в 2 раза завышает LTV в маркетинговой аналитике и ломает логику расчета Tier для реферальной системы.

**Рекомендация:**
Убрать `totalSpent: { increment: amount }` из блока "Direct top-up (Deposit)" в `payment.service.ts`. Показатель `totalSpent` должен расти только при покупке услуг (списании баланса) или при прямой покупке с шлюза.

---

### 🟠 HIGH-001: Отсутствие механизма Reconciliation (Сверка Леджера)

**Описание:**
Записи в `LedgerEntry` создаются при любом движении баланса (пополнение, списание, возврат, бонус). Идеальная система *Double-Entry Bookkeeping* требует, чтобы `User.balance` был всегда строго равен сумме всех транзакций в `LedgerEntry` для данного юзера.
В Smmplan нет механизма (Cron job), который ночью проверяет это равенство.

**Научное обоснование:**
- Если баг или ручное вмешательство админа в БД обойдет Mutex, баланс разойдется с историей. Сверка (Reconciliation) обнаружит это немедленно.

**Рекомендация:**
Создать скрипт/cron `ledgerReconciliationWorker`, который раз в 24 часа выполняет:
`SELECT userId, SUM(amount) as calculated_balance FROM LedgerEntry GROUP BY userId;`
и сравнивает это с `User.balance`. При расхождении > 0 выдает Critical Alert в Telegram.

---

## Приоритизированный План

| # | Finding | Сложность | Влияние на систему |
|---|---------|-----------|--------------------|
| CRITICAL-001| Исправить двойной рост `totalSpent` | 🟢 Low | Корректность LTV |
| HIGH-001 | Ночной Cron сверки Ledger | 🟠 Medium | 100% Финансовая точность |
