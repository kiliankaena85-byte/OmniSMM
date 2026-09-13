# omnismm-checkout-integrity-guard (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Zero Float Drift:** Запрещен сырой расчет `price * qty` с `toFixed(2)`. Расчет строго в копейках по ExactMath, отображение в UI строго "₽ / шт".
2. **Drip-Feed Floor Synchronizer:** При N запусках минимум объема обязан автоматически масштабироваться: min = service.minQty * N. Запрещен декремент ниже пола.
3. **Explicit Tenant Binding:** checkoutAction обязан явно принимать tenantId. Запрещено смешивать токены SMMplan и SMMflux.
4. **Active CTA Only:** Кнопка оплаты НИКОГДА не disabled! При ошибках — animate-shake и текст ошибки строго над CTA.
5. **Mobile Touch Ergonomics:** Инпуты объема строго type="text", inputMode="numeric" с onFocus select(), шрифт >= 16px. Контейнер формы с MobileStickyCTA обязан иметь pb-28.
6. **HeroUI v3 & Modal Hoisting:** selectedKeys строго Set<Key>. Модалки выносятся на верхний уровень дерева страницы.
7. **200-Line Decomposition:** Файлы > 200 строк декомпозируются на субкомпоненты с React 19 useActionState.

## ⚡ FAST RULES & FORMULAS
- Порог Drip-Feed: `const minTotalQty = service.minQty * (dripEnabled ? runs : 1)`.
- Мобильный инпут: `<input type="text" inputMode="numeric" pattern="[0-9]*" className="text-base md:text-sm" onFocus={(e) => setTimeout(() => e.target.select(), 10)} />`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Проброшен ли tenantId в checkoutAction?
- [ ] Кнопка CTA остается активной при ошибке с выводом хелпера над ней?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
