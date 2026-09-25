# db-evolution-zero-downtime (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** No Lock-Holding DDL: тяжелые DDL операции выполняются с обязательным lock_timeout <= 2s.
2. **Инвариант 2:** Concurrent Indexes Only: все индексы создаются строго через CREATE INDEX CONCURRENTLY.
3. **Инвариант 3:** Expand/Contract Pattern: любое изменение схемы выполняется в 5 безопасных фаз с Dual-Write.
4. **Инвариант 4:** Zero Downtime Backfills: фоновый перенос данных осуществляется микропакетами (<= 500 строк).
5. **Инвариант 5:** Reversible Migrations: каждая миграция обязана иметь документированный план безопасного отката.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=db-evolution-zero-downtime`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
