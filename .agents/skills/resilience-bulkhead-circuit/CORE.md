# resilience-bulkhead-circuit (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** Per-Provider Bulkhead: строгая изоляция пулов конкурентных запросов к внешним провайдерам.
2. **Инвариант 2:** Mandatory Request Timeout: любой внешний HTTP-запрос обязан содержать AbortSignal.timeout(5000).
3. **Инвариант 3:** Circuit Breaker in Redis: при 50% сбоев шлюз переходит в состояние OPEN минимум на 5 секунд.
4. **Инвариант 4:** Graceful Fallback: при отказе внешнего шлюза возвращается безопасный ответ без падения процесса.
5. **Инвариант 5:** Fail-Closed on Auth/Money: в финансовых операциях отказ шлюза приводит к Fail-Closed блокировке.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=resilience-bulkhead-circuit`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
