# bank-grade-db-guard (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** Ledger-First Invariant: запись в журнал создается строго ДО мутации баланса пользователя.
2. **Инвариант 2:** ExactMath BigInt: все денежные величины хранятся и рассчитываются строго в копейках BigInt.
3. **Инвариант 3:** Zero Transaction Escape: внутри методов с tx: PrismaTx запрещен вызов глобального db.*.
4. **Инвариант 4:** Distributed Idempotency Vault: финансовые операции защищаются атомарной резервацией в Redis.
5. **Инвариант 5:** No Long-Holding Locks: lock_timeout в OLTP транзакциях строго ограничен 2 секундами.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=bank-grade-db-guard`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
