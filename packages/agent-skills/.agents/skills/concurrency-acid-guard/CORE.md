# concurrency-acid-guard (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **НЕТ прямому обновлению баланса:** ЗАПРЕЩЕНО мутировать `User.balance` в обход `WalletOps`.
2. **НЕТ Transaction Escape:** Внутри методов с `tx: PrismaTx` ЗАПРЕЩЕНО использовать глобальный инстанс `db.*`. Все вызовы строго через `tx.*`.
3. **Ledger-First Invariant:** Запись в `tx.ledgerEntry.create()` ОБЯЗАНА создаваться ДО мутации баланса в `tx.user.update()`.
4. **ExactMath Only:** Все расчеты ведутся строго в копейках `BigInt`. Запрещены вычисления с `number` и float.
5. **Idempotency Key:** Каждая финансовая операция обязана содержать уникальный `idempotencyKey` с обработкой коллизий P2002.

## ⚡ FAST RULES & FORMULAS
- Расчет суммы: `ExactMath.calculateOrderCostKopecks(qty, rateRubCents, markupBps)`.
- Блокировка строки: `await tx.$queryRaw\`SELECT * FROM "User" WHERE id = ${userId} FOR UPDATE;\``
- Обработка гонки: перехват PrismaClientKnownRequestError с кодом `P2002`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Все вызовы баланса идут через `WalletOps`?
- [ ] Нет ли вызова глобального `db` внутри транзакции?
- [ ] Есть ли `idempotencyKey` в проводке?

---
*Для полного дерева решений и премортема см. [SKILL.md](./SKILL.md) (L2 Deep).*\n