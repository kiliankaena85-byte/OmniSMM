# payment-gateway-fuzzer (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** Fuzzing Sandbox Only: стресс-тестирование выполняется строго на тестовых ключах шлюзов.
2. **Инвариант 2:** Double-Crediting Immunity: параллельные вебхуки об оплате не должны вызывать повторное зачисление.
3. **Инвариант 3:** Price Tampering Guard: сумма платежа извлекается строго из локальной PaymentTransaction БД.
4. **Инвариант 4:** Timing-Safe Signatures: подписи вебхуков проверяются только через crypto.timingSafeEqual().
5. **Инвариант 5:** Idempotent Balance Credit: зачисление средств сопровождается строгим idempotencyKey.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=payment-gateway-fuzzer`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
