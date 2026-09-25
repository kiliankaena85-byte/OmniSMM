# production-readiness-guard (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** Mandatory SEC-001: запрещен релиз без авторизации и шифрования Redis (rediss://...).
2. **Инвариант 2:** Mandatory SEC-002: запрещен релиз с unsafe-eval в CSP script-src (Strict-Dynamic Nonce).
3. **Инвариант 3:** Mandatory SEC-003: обязательна проверка прямой доставки почты по порту 465 без прокси.
4. **Инвариант 4:** Zero-Defect Blue-Green: переключение трафика только после успешного тестирования в Stage (:3005).
5. **Инвариант 5:** Human Approval Gate: релиз осуществляется строго после команды пользователя («Выкатывай»).

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=production-readiness-guard`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
