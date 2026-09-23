# 🚀 MVP Production Readiness: Финальный чек-лист стабильности и безопасности

Этот чек-лист содержит **минимально необходимый, критически важный набор проверок (Golden Path)**, который гарантирует 100% стабильность работы, прием платежей, создание заказов и безопасность перед запуском SMMplan в MVP (Production).

---

## 📋 БЛОК 1: Денежный контур и Чекаут (Revenue & Orders) — 5 проверок

| № | Проверка / Сценарий | Целевые файлы | Что проверяем руками/автотестом |
|---|---|---|---|
| 1.1 | **Оформление заказа гостем (Order Wizard)** | `src/components/landing/order-engine/useCheckoutOrchestrator.ts`, `src/actions/order/checkout.ts` | Выбор соцсети -> категории -> услуги -> ввод ссылки -> оплата. Проверить, что заказ создается, а цена считается корректно. |
| 1.2 | **Прием платежа ЮKassa (Webhook & Баланс)** | `src/app/api/webhooks/yookassa/route.ts`, `src/services/financial/wallet-ops.ts` | Симуляция успешной оплаты: баланс начисляется ровно 1 раз, повторный вебхук не удваивает деньги (идемпотентность). |
| 1.3 | **Прием платежа CryptoBot (USDT/TON)** | `src/app/api/webhooks/crypto/route.ts` | Проверка HMAC-SHA256 подписи, моментальное пополнение баланса клиента. |
| 1.4 | **Списание баланса и защита от ухода в минус** | `src/services/financial/wallet-ops.ts` | Попытка заказать услугу дороже текущего баланса -> получение корректной ошибки "Недостаточно средств". |
| 1.5 | **Частичный возврат (Partial Refund)** | `src/services/financial/refund-policy.service.ts`, `src/workers/processors/sync.processor.ts` | Если провайдер выполнил 500 из 1000, 50% денег автоматически возвращаются на баланс клиента. |

---

## 📋 БЛОК 2: Интеграция с провайдерами и Очереди (Dispatch & Sync) — 4 проверки

| № | Проверка / Сценарий | Целевые файлы | Что проверяем руками/автотестом |
|---|---|---|---|
| 2.1 | **Отправка заказа провайдеру (Order Worker)** | `src/workers/processors/order.processor.ts`, `src/services/providers/universal.provider.ts` | Воркер забирает заказ из BullMQ -> отправляет API-запрос -> получает `orderId` от поставщика -> переводит статус в `IN_PROGRESS`. |
| 2.2 | **Синхронизация статусов (Sync Worker)** | `src/workers/processors/sync.processor.ts` | Проверка периодического пинга провайдера, корректная смена статусов `COMPLETED`, `PARTIAL`, `CANCELED`. |
| 2.3 | **SSRF Защита внешних запросов** | `src/services/providers/universal.provider.ts`, `src/utils/ssrf-guard.ts` | Проверить, что `assertSafeUrl` блокирует `127.0.0.1` и `169.254.169.254`, а `redirect: 'error'` предотвращает 302-редиректы. |
| 2.4 | **Гарантийные докрутки (Refill)** | `src/workers/processors/refill.processor.ts`, `src/actions/order/refill.ts` | Клиент нажимает "Докрутка" -> создается задача в очереди -> поставщику уходит запрос на `refill`. |

---

## 📋 БЛОК 3: Аутентификация, Сессии и Доступ (Auth & RBAC) — 3 проверки

| № | Проверка / Сценарий | Целевые файлы | Что проверяем руками/автотестом |
|---|---|---|---|
| 3.1 | **Вход по Magic Link / Email** | `src/app/api/auth/verify/route.ts`, `src/lib/session.ts` | Отправка одноразовой ссылки на почту -> успешный вход -> запись безопасной сессионной cookie (`HttpOnly`). |
| 3.2 | **Защита чужих данных (IDOR)** | `src/actions/order/cancel.ts`, `src/actions/support/ticket.ts` | Попытка пользователя А отменить заказ или прочитать тикет пользователя Б -> жесткий отказ 404/403. |
| 3.3 | **Разграничение прав (Админы vs Операторы)** | `src/lib/server/rbac.ts`, `src/actions/admin/*` | Оператор поддержки не может менять системные API-ключи или глобальные наценки (доступ строго по ролям). |

---

## 📋 БЛОК 4: Поддержка, Чат и Telegram (Customer Care) — 3 проверки

| № | Проверка / Сценарий | Целевые файлы | Что проверяем руками/автотестом |
|---|---|---|---|
| 4.1 | **Создание тикета и ответы в чате** | `src/app/admin/tickets/components/unified-workspace.tsx`, `src/components/support/ChatWindow.tsx` | Клиент пишет в поддержку -> сообщение мгновенно появляется в админке оператора через SSE. |
| 4.2 | **Smart Bind Telegram в 1 клик** | `src/services/support/support-bot.service.ts`, `src/app/dashboard/settings/page.tsx` | Переход по ссылке бота -> автоматическая привязка Telegram к аккаунту без ручного ввода токенов. |
| 4.3 | **Опрос качества CSAT (⭐ 1-5)** | `src/services/support/support-bot.service.ts` | Оператор закрывает тикет -> клиенту в Telegram приходит интерактивная клавиатура оценки. |

---

## 📋 БЛОК 5: UI/UX и Адаптивность (Mobile & Desktop) — 3 проверки

| № | Проверка / Сценарий | Целевые файлы | Что проверяем руками/автотестом |
|---|---|---|---|
| 5.1 | **Zero Column Clipping в админке** | `src/app/admin/orders/page.tsx`, `src/app/admin/providers/client-table.tsx` | 100% ширина таблиц (Viewport Width Fit) без горизонтального скролла на экранах от 1366px до 4K. |
| 5.2 | **Мобильная верстка лендинга и форм** | `src/components/landing/order-engine/InlineCheckoutForm.tsx` | Открытие на смартфоне (iOS Safari / Android Chrome): форма не ломается при открытии клавиатуры, touch target >= 44px. |
| 5.3 | **Multi-Tenant переключение (SMMplan vs SMMflux)** | `src/tenants/factory.ts`, `src/components/layout/header.tsx` | Переключение сайта в шапке меняет брендинг, стили и фильтрацию каталога без смешивания данных. |
