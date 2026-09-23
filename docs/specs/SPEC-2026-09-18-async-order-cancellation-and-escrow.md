# SPEC-2026-09-18: Двухфазная асинхронная отмена заказов и защита от убытков (2PC Escrow Protocol)

## Контекст и проблематика
При отмене заказов, которые уже отправлены провайдеру (присвоен `externalId`, списана себестоимость у поставщика), старая реализация `cancelOrder()` безусловно переводила заказ в `CANCELED` и мгновенно возвращала 100% средств клиенту через `WalletOps.refund()`.
При этом:
1. Сетевой вызов `action: cancel` к провайдеру (Vexboost и др.) вообще не отправлялся.
2. Провайдер продолжал исполнение заказа и списывал баланс OmniSMM.
3. Клиент получал бесплатную накрутку и возврат денег (двойной убыток платформы, инцидент #174).
4. Демоны синхронизации опрашивали только `IN_PROGRESS`, прекращая отслеживание отменённого заказа.

## Архитектурное решение (ADR-2026-19)
Внедряется 2-фазный протокол отмены с эскроу-холдом:
1. **Заказ без `externalId`** (еще не ушел к провайдеру):
   - Мгновенная локальная отмена `status: 'CANCELED'` + возврат 100% средств клиенту.
2. **Заказ с `externalId`** (уже в работе у провайдера):
   - Если `service.isCancelEnabled === false`:
     - Роль `SUPPORT` не может отменить (ошибка «Услуга не поддерживает отмену у провайдера»).
     - Роль `ADMIN`/`OWNER` может выполнить принудительное списание в убыток (`isForceWriteOff: true`).
   - Если `service.isCancelEnabled === true`:
     - Заказ переводится в промежуточный статус **`CANCELING`**.
     - Отправляется API-запрос к провайдеру `action: cancel`.
     - **Средства клиенту НЕ возвращаются (Escrow Hold)** до подтверждения от провайдера.
     - Воркер синхронизации опрашивает статус заказа:
       - Если провайдер вернул `Canceled`: заказ переходит в `CANCELED`, вызывается `WalletOps.refund()`.
       - Если провайдер вернул `Partial`: заказ переходит в `PARTIAL`, вызывается пропорциональный возврат.
       - Если провайдер вернул `Completed`: заказ переходит в `COMPLETED`, средства НЕ возвращаются (услуга оказана!).

## Затрагиваемые компоненты и план изменений

1. **`src/services/providers/base-provider.ts` & `src/services/providers/universal.provider.ts`:**
   - Добавить интерфейс `ProviderCancelResultDto` и метод `cancelOrder(externalId: string | number)`.
   - Реализовать отправку `{ action: 'cancel', orders: String(externalId) }` (или `order: externalId`).

2. **`src/services/admin/order.service.ts`:**
   - Обновить `cancelOrder(orderId, admin, options?: { forceWriteOff?: boolean })`:
     - Если нет `externalId`: отменять сразу в `CANCELED` с возвратом.
     - Если есть `externalId` и `!service.isCancelEnabled` без `forceWriteOff`: бросать исключение с понятным текстом.
     - Если есть `externalId` и `service.isCancelEnabled`:
       - Вызывать `provider.cancelOrder(order.externalId)`.
       - Обновлять заказ в `status: 'CANCELING'`, сохранять метадату в `customData`.
       - НЕ делать возврат средств (Escrow Hold).

3. **`src/workers/jobs/provider-status-sync.job.ts`:**
   - Добавить выборку заказов `status: { in: ['IN_PROGRESS', 'CANCELING'] }`.
   - Для заказов в `CANCELING`:
     - Если провайдер вернул `Canceled` -> финализировать в `CANCELED` с `WalletOps.refund()`.
     - Если провайдер вернул `Partial` -> финализировать в `PARTIAL` с пропорциональным возвратом.
     - Если провайдер вернул `Completed` -> финализировать в `COMPLETED` без возврата.

4. **UI компоненты:**
   - `src/utils/status-helpers.ts`: добавить `CANCELING` (желтый/amber бейдж, «Отменяется»).
   - `src/components/orders/OrderStatusBadge.tsx`: отображение спиннера/пульсации для `CANCELING`.
   - `src/components/admin/OrderDetailsModal.tsx`: модалка подтверждения списания в убыток для `ADMIN`/`OWNER`.

5. **Тестирование (TDD):**
   - Создать падающий тест `src/__tests__/orders/order-cancellation-escrow-state-machine.test.ts`.
   - Добиться 100% PASS.
