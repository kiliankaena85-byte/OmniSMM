# yandex-services-integrator (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Server-Side SmartCaptcha Verification:** ЗАПРЕЩЕНО доверять клиентскому флагу прохождения капчи. Проверка токена обязана происходить СТРОГО на сервере через API `https://smartcaptcha.yandexcloud.net/validate`.
2. **AdBlock-Safe Metrika Loading:** Код Яндекс.Метрики обязан загружаться асинхронно с проверкой наличия объекта (`typeof window.Ya !== 'undefined'`). Ошибка загрузки метрики НЕ ДОЛЖНА блокировать интерфейс.
3. **Fiscal 54-FZ Yandex Pay Invariant:** Платежи через Yandex Pay обязаны передавать корректные фискальные чеки (НДС 22%, `vat_code: 1` до 20 млн ₽, `vat_code: 10` свыше).
4. **No Secret Leaks:** Секретный серверный ключ SmartCaptcha (`SMARTCAPTCHA_SERVER_KEY`) ЗАПРЕЩЕНО публиковать в клиентский бандл или переменные `NEXT_PUBLIC_*`.
5. **Fail-Closed Security:** При сбое валидации SmartCaptcha мутация формы обязана возвращать `{ success: false, error: 'Проверка безопасности не пройдена' }`.

## ⚡ FAST RULES & FORMULAS
- Клиентская невидимая капча: `<SmartCaptcha sitekey={CLIENT_KEY} invisible={true} onChallengeHidden={...} />`.
- Безопасная отправка цели: `window.ym?.(COUNTER_ID, 'reachGoal', targetName)`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Серверный ключ капчи спрятан в process.env без NEXT_PUBLIC?
- [ ] Добавлен ли fallback при блокировке счетчика метрики?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
