# clash-verge-atomics (L1 Core Invariants)
> **Статус:** ARCHITECTURAL GATE | **Бюджет:** < 400 токенов | **Слой:** L1 Fast Core

## 🛑 HARD INVARIANTS (КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО)
1. **Инвариант 1:** No Localhost Interception: запрещено заворачивать локальный трафик (127.0.0.1, :3000) в туннель.
2. **Инвариант 2:** Direct Russian Traffic: доступ к доменам .ru, .рф и банкам РФ направляется строго напрямую (DIRECT).
3. **Инвариант 3:** No Cloudflare Tunnel in RU: запрещено использование Cloudflare Tunnel из-за блокировок ТСПУ.
4. **Инвариант 4:** DNS Leak Immunity: DNS-запросы маршрутизируются без раскрытия IP-адреса хоста.
5. **Инвариант 5:** Tailscale Funnel Binding: внешняя маршрутизация осуществляется стабильно через ноду Tailscale.

## ⚡ FAST RULES & FORMULAS
- Основное правило: строгое следование стандартам платформы OmniSMM 1.0.
- Автоматическая проверка: `npm run lint:skills -- --skill=clash-verge-atomics`.

## 🔍 PRE-MORTEM QUICK CHECK
- [ ] Соблюдены ли ключевые архитектурные ограничения?
- [ ] Проверена ли обратная совместимость?
- [ ] Пройден ли автоматический аудит линтера?

---
*Для полного руководства см. [SKILL.md](./SKILL.md) (L2 Deep).*
