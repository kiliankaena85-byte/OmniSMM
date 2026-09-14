# СПЕЦИФИКАЦИЯ (CDD-TDD)
# Устранение ложной классификации приватности ссылок (Private IP vs Private Channel) и харденинг SSRF-фильтра шлюзов поставщиков

> **Статус:** DRAFT FOR APPROVAL (Human Approval Gate)  
> **Версия:** 1.0.0 (OmniSMM 1.0 RAC-2026)  
> **Дата:** 14.09.2026  
> **Контур:** Tier 1 (Критическая обработка заказов, triage-алертинг операторов, SSRF-защита шлюзов)  
> **Методология:** CDD (Contract-Driven Development) + TDD (Test-Driven Development)  

---

## 1. Executive Summary & Проблема инцидента

### 1.1. Описание инцидента (Заказ #170)
Клиент оформил заказ на открытый Telegram-канал `https://t.me/smmMarket69` (10 подписчиков). Заказ был оплачен и передан воркеру на исполнение через провайдера **Vexboost**.
Воркер перевёл заказ в статус `PENDING_CHECK` и отправил в Telegram-канал операторов P0 Critical Incident Alert:
```text
🚨 [ТРЕБУЕТСЯ ПРОВЕРКА ЗАКАЗА — САППОРТ] 
📦 Заказ: #170 (ID: cmu1ml4sg001a8h1ed9tsziwy)
🔗 Ссылка в заказе: https://t.me/smmMarket69 
🏢 Поставщик: Vexboost 
⚠️ Причина перевода на проверку: 🔒 Закрытый профиль / Приватный канал "Private IP blocked" 
💡 Что произошло: Целевой аккаунт, канал или группа закрыты настройками приватности.
```

### 1.2. Анатомия двойного сбоя (Root Cause):
1. **Ложная классификация (False Positive Semantic Drift):**
   В `order-error-classifier.ts` и `order-triage-alert.service.ts` классификация строилась по наивному вхождению:
   ```typescript
   if (lower.includes('private') || lower.includes('closed') || ...) {
     return { type: 'PRIVATE_ACCOUNT', code: 'ERR_LINK_PRIVATE', ... };
   }
   ```
   Строка системной сетевой ошибки `"Private IP blocked"` содержит подстроку `"private"`. В результате системный отказ сетевого шлюза был ошибочно квалифицирован как «Клиент указал закрытый Telegram-канал». Оператор получил ложную инструкцию «попросить клиента открыть канал», хотя канал 100% открыт.

2. **Первопричина сетевой ошибки `"Private IP blocked"`:**
   В `UniversalProvider.request()` перед отправкой заказа вызывается `await assertSafeUrl(this.apiUrl)`.
   Функция `assertSafeUrl` проверяет адрес через `assertSafeOutboundUrl` (`src/lib/security/ssrf-guard.ts`).
   Если DNS-резолвер возвращает адрес из диапазона Fake-IP (`198.18.0.0/15`, используемый Clash/Mihomo прокси) либо внутренний адрес (Docker-сеть, шлюз, петля DNS), или происходит сбой на Phase 2 (DNS Rebinding Check), SSRF-фильтр выбрасывает исключение:
   `throw new Error('Private IP blocked')`.
   При этом домены зарегистрированных активных поставщиков (например, `vexboost.ru`) не были явно включены в доверенный белый список `TRUSTED_PROVIDER_DOMAINS`, из-за чего провайдерский шлюз подвергался строгой фильтрации пользовательских URL.

---

## 2. Архитектурный контракт (CDD — Contract-Driven Design)

### 2.1. Контракт классификации ошибок (`ErrorClassifierContract`)
В классификаторах ошибок вводится строгое разделение между:
- Ошибками приватности пользовательского контента (`ERR_LINK_PRIVATE` / `PRIVATE_ACCOUNT`).
- Сетевыми системными ошибками безопасности (`ERR_GATEWAY_NETWORK` / `TIMEOUT_OR_NETWORK` / `GENERAL_PROVIDER_ERROR`).

#### Правило детекции:
Если строка ошибки содержит маркеры приватных сетей / SSRF:
- `private ip`
- `ip-.*-private`
- `ssrf`
- `blocked url`
- `loopback`
- `metadata`

То данная ошибка **КАТЕГОРИЧЕСКИ НЕ ДОЛЖНА** классифицироваться как `ERR_LINK_PRIVATE` или `PRIVATE_ACCOUNT`.  
Она обязана квалифицироваться как:
- В `order-error-classifier.ts`: `ERR_GATEWAY_NETWORK` или `ERR_SYSTEM_GENERAL` с понятным текстом для оператора:
  * Заголовок: `Сетевая блокировка шлюза (SSRF / Private IP)`
  * Описание: `Запрос к API поставщика заблокирован встроенным сетевым экраном SSRF (адрес шлюза разрешается в закрытый/приватный IP).`
  * Рекомендация: `Проверить URL шлюза поставщика, DNS-маршрутизацию или работу прокси-сервера Clash/Mihomo.`
- В `order-triage-alert.service.ts`: `TIMEOUT_OR_NETWORK` или `GENERAL_PROVIDER_ERROR` со статусом `isBalanceRelated: false`.

Для клиентских закрытых аккаунтов проверка ужесточается до целевых словосочетаний:
- `account is private`, `profile is private`, `channel is private`, `group is private`, `target is private`
- `закрытый профиль`, `приватный канал`, `закрытый аккаунт`, `приватная группа`
- Изолированное слово `private` проверяется **только при отсутствии маркера `ip` / `ssrf` / `network`**.

### 2.2. Контракт сетевой безопасности SSRF (`SsrfGuardContract`)
1. В `src/lib/security/ssrf-guard.ts` расширяется список доверенных системных шлюзов и провайдеров:
   - Добавляются домены официальных интеграций поставщиков: `vexboost.ru`, `api.vexboost.ru`, `soc-rocket.ru` и др.
   - Поддерживается нормализация Fake-IP диапазонов Clash/Mihomo (`198.18.0.0/15`, `fdfe:dcba:9876::/48`) во всех стадиях валидации (Phase 1 и Phase 2 Rebinding Check).
2. В `src/utils/ssrf-guard.ts` формируется прозрачное диагностическое сообщение об ошибке:
   - Вместо сухой строки `Private IP blocked` выбрасывается информативное `SSRF: Target resolved to private IP (${reason})`, позволяющее мгновенно отличать сетевую защиту от статуса ссылки в соцсети.

---

## 3. Матрица тестирования (TDD — Test-Driven Development)

### 3.1. Красная фаза (Red Phase — падающие тесты)
Создаётся тестовый сьют `src/__tests__/unit/order-error-classifier-ssrf-disambiguation.test.ts`:
1. `Test 1: Disambiguation Private IP vs Private Account`:
   - Вход: `'Private IP blocked'`
   - Ожидание: `type !== 'PRIVATE_ACCOUNT'`, `code !== 'ERR_LINK_PRIVATE'`, `category === 'GATEWAY' | 'SYSTEM'`.
2. `Test 2: Preservation of True Private Channel Errors`:
   - Входы: `'Account is private'`, `'Channel is private or restricted'`, `'Целевой канал является приватным'`
   - Ожидание: `type === 'PRIVATE_ACCOUNT'`, `code === 'ERR_LINK_PRIVATE'`, `category === 'LINK'`.
3. `Test 3: SSRF Error Formats`:
   - Входы: `'SSRF blocked: ip-127.0.0.1-private'`, `'Blocked URL'`, `'Failed to resolve target hostname'`
   - Ожидание: Классифицируется как системная/сетевая ошибка шлюза, а не ошибка клиента.
4. `Test 4: SSRF Guard Provider Resolution`:
   - Проверка `assertSafeOutboundUrl('https://vexboost.ru/api/v2/')` возвращает `{ ok: true }` даже при возврате IP `198.18.0.79` (Clash Fake-IP).

### 3.2. Зелёная фаза (Green Phase — реализация)
- Обновление `src/lib/order-error-classifier.ts`.
- Обновление `src/services/orders/order-triage-alert.service.ts`.
- Обновление `src/lib/security/ssrf-guard.ts` и `src/utils/ssrf-guard.ts`.
- Все тесты переходят в `PASS (GREEN)`.

### 3.3. Рефакторинг и регрессионный сьют (Refactor Phase)
- Прогон сьюта заказов: `npx vitest run src/__tests__/orders/order-triage-and-autoflush-logic.test.ts`.
- Прогон сьюта SSRF: `npx vitest run src/lib/security/__tests__/ssrf-guard.test.ts`.
- Проверка компиляции TypeScript: `npx tsc --noEmit` (0 ошибок).
- Аудит секретов: `node scripts/check-bundle-secrets.mjs` (0 утечек).

---

## 4. План развёртывания и отката (Rollback & Blast Radius)
- **Радиус влияния:** Затрагивает исключительно строковую классификацию ошибок воркера и саппорта, а также SSRF-валидацию исходящих URL к поставщикам. Не затрагивает финансовый леджер (`WalletOps`), схему БД и фронтенд-витрину.
- **Откат:** Изменения чисто кодовые, откат выполняется возвратом коммита через `git revert` без миграций БД.
