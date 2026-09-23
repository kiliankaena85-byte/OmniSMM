# ddd-aggregate-invariants (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **1 Транзакция = 1 Агрегат:** Запрещено атомарно мутировать два независимых агрегата без Transactional Outbox.
2. **Drip-Feed Floor Invariant:** При $N$ запусках объем на один запуск $\lfloor Q/N \rfloor$ ОБЯЗАН быть $\ge \text{service.minQty}$.
3. **Инвариант Минимального Объема:** Минимальный общий объем заказа в UI и на бэкенде СТРОГО $\ge \text{service.minQty} \times N$.
4. **Shadow Catalog Buffer:** Все динамические изменения провайдеров буферизируются в Redis перед коммитом в PostgreSQL.
5. **Статусная Модель:** Заказ может переходить в терминальные статусы только через разрешенные переходы (State Machine).

## ⚡ FAST RULES & FORMULAS
- Drip-Feed валидация: `Math.floor(quantity / runs) >= service.minQty`.
- Отмена заказа: возможна только для статусов `PENDING`, `IN_PROGRESS`, `PENDING_CHECK`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Не нарушен ли Drip-Feed Floor при переключении ползунка?
- [ ] Обновляется ли только корень агрегата?

---
*Для полного дерева решений и премортема см. [SKILL.md](./SKILL.md) (L2 Deep).*\n