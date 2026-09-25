# adr-architect (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** MADR 3.0 Format: все записи оформляются строго по шаблону Markdown Architectural Decision Records.
2. **Инвариант 2:** Immutable History: запрещено удалять принятые ADR; изменения оформляются статусом SUPERSEDED.
3. **Инвариант 3:** Consequences Section Mandatory: раздел компромиссов и последствий обязателен в каждом ADR.
4. **Инвариант 4:** Minimum 2 Alternatives: обязателен детальный разбор минимум двух отклоненных альтернатив.
5. **Инвариант 5:** Commit Linkage: каждый ADR обязан иметь дату, автора и ссылку на связанный коммит/PR.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=adr-architect`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
