# nfr-performance-budget (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** Server Action P95 Budget: латентность Server Action не должна превышать 250 мс при P95.
2. **Инвариант 2:** Zero N+1 in Prisma: запрещены запросы Prisma внутри циклов (использовать include или in).
3. **Инвариант 3:** No Heavy OFFSET: запрещено использование OFFSET > 100 в боевых запросах (только Keyset).
4. **Инвариант 4:** Connection Pool Cap: пул соединений Prisma Client ограничен максимум 20 соединениями.
5. **Инвариант 5:** DOM Node Budget: количество DOM-узлов на странице каталога не должно превышать 1200 узлов.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=nfr-performance-budget`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
