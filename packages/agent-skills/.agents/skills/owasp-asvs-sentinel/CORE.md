# owasp-asvs-sentinel (L1 Core Invariants)
> **Статус:** CRITICAL GATE | **Бюджет:** < 450 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Strict-Dynamic CSP:** В директиве `script-src` строго запрещены `'unsafe-inline'` и `'unsafe-eval'`. Обязателен криптографический `x-nonce`.
2. **Guest-Proof IDOR:** Проверка прав обязана явно блокировать доступ к чужим данным, даже если пользователь не авторизован (null-check guard).
3. **Timing-Safe HMAC:** Проверка подписей вебхуков (ЮKassa, Robokassa) выполняется строго через `crypto.timingSafeEqual`. Запрещен обычный `===`.
4. **RFC 9331 RateLimit:** Все публичные и платежные роуты обязаны возвращать заголовки `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
5. **No Fail-Open Webhooks:** Запрещены проверки вида `if (secret) verify()`. При отсутствии секрета вебхук ОБЯЗАН падать с ошибкой 401/403.

## ⚡ FAST RULES & FORMULAS
- HMAC Timing-Safe: `crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))`.
- Nonce CSP Header: `Content-Security-Policy: script-src 'nonce-${nonce}' 'strict-dynamic' ...`

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Использован ли `timingSafeEqual`?
- [ ] Нет ли `'unsafe-inline'` в CSP?
- [ ] Закрыт ли роут от IDOR для гостей?

---
*Для полного дерева решений и премортема см. [SKILL.md](./SKILL.md) (L2 Deep).*\n