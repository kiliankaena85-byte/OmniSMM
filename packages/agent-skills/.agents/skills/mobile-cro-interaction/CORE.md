# mobile-cro-interaction (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Touch Target Floor:** Любой интерактивный элемент обязан иметь размер $\ge 44 \times 44\text{ px}$ (`min-h-[44px] min-w-[44px]` или достаточный padding).
2. **Numeric Input Auto-Select:** Числовые поля ввода (объем заказа, сумма) обязаны использовать `inputMode="numeric"`, `pattern="[0-9]*"` и выделение содержимого по клику/фокусу (`onFocus: select()`).
3. **Sticky Bottom Action Bar:** На экранах $< 768\text{px}$ кнопка действия (Купить / Пополнить) фиксируется внизу экрана с учетом `pb-safe`.
4. **Запрет чипсов пресетов:** Запрещено загромождать интерфейс чипсами пресетов количества (`[100, 500, 1000]`). Используется прямой ввод и степпер `-` / `+`.
5. **No Keyboard Overlap:** Поля формы чекаута не должны перекрываться всплывающей мобильной клавиатурой iOS/Android.

## ⚡ FAST RULES & FORMULAS
- Тач-кнопка степпера: `h-11 w-11 flex items-center justify-center text-lg active:scale-95`.
- Инпут количества: `<input type="text" inputMode="numeric" pattern="[0-9]*" onFocus={e => e.target.select()} />`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Все ли кнопки легко нажимаются пальцем ($\ge 44\text{px}$)?
- [ ] Выделяется ли число при тапе в инпут объема?
- [ ] Видна ли плашка чекаута внизу мобильного экрана?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*\n