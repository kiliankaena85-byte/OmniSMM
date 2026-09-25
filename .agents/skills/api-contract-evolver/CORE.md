# api-contract-evolver (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** Zero Breaking Changes: запрещено ломать публичные API без переходного периода Dual-Read.
2. **Инвариант 2:** RFC 8594 Sunset: устаревшие эндпоинты обязаны возвращать заголовки Deprecation и Sunset.
3. **Инвариант 3:** Contract-First: входящие и исходящие DTO Server Actions валидируются через строгие Zod-схемы.
4. **Инвариант 4:** Typed Response Envelope: все мутации возвращают типизированный конверт { success, error, data }.
5. **Инвариант 5:** No Secret Bleed: запрещено передавать в клиентские DTO providerCost, ключи API и хэши.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=api-contract-evolver`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
