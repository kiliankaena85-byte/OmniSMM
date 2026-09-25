# postgres-query-doctor (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** No Unindexed Seq Scan: запрещены последовательные сканирования в таблицах объемом > 10 000 строк.
2. **Инвариант 2:** Statement Timeout Cap: каждый OLTP запрос в приложении ограничен жестким statement_timeout = 5s.
3. **Инвариант 3:** Explain Buffers Mandatory: любая оптимизация подтверждается планом EXPLAIN (ANALYZE, BUFFERS).
4. **Инвариант 4:** No Deep OFFSET: запрещено использование OFFSET > 100 в боевых запросах (только Keyset курсоры).
5. **Инвариант 5:** Selective Projections: запрещено запрашивать тяжелые поля в массовых выборках списков.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=postgres-query-doctor`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
