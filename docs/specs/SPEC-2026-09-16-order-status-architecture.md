# SPEC-2026-09-16: Архитектура статусов заказов и финансовая безопасность (Order Status State Machine)

## Контекст и проблематика (Обновлено после глубокого аудита)
В ходе аудита выявлены критические нарушения в бизнес-логике управления статусами заказов (Order Status), которые приводят к финансовым коллизиям и невозможности исправления ошибок оператором (Кейс #172):
1. **Отсутствие проверки `externalId`:** Оператор может через выпадающий список перевести заказ из `PENDING` в `COMPLETED`, даже если заказ находится в 3-минутной задержке (grace period) и не был отправлен провайдеру (нет `externalId`).
2. **Блокировка исправления ошибок (Dead-End State):** Если оператор случайно перевел заказ в `COMPLETED`, система намертво блокирует переход `COMPLETED -> CANCELED` (ошибка «Переход заказа не допускается бизнес-логикой»).
3. **Ловушка обнуленного остатка (Remains Trap):** При переходе в `COMPLETED` поле `remains` принудительно обнуляется. Даже если разблокировать отмену, стандартная формула `calculatePartialRefund` вернет `0 ₽`, оставив клиента без денег.
4. **Утечка реферальных комиссий:** При отмене через `setOrderStatusAction` (смена статуса в селекте) не вызывается `LoyaltyService.reverseCommission`, в отличие от кнопки "Отменить заказ".
5. **Опасность овер-рефанда:** Если заказ был частично выполнен (`PARTIAL`, возвращено 40%), затем ошибочно закрыт (`COMPLETED`), а затем отменен (`CANCELED`), слепой возврат полной суммы приведет к возврату 140% средств (прямой убыток).
6. **[NEW] Уязвимость бесплатной накрутки (Free Ride Exploit):** Матрица `VALID_STATUS_TRANSITIONS` разрешала ручной переход `ERROR -> PENDING`, однако в `setOrderStatusAction` отсутствует логика *повторного списания средств* (`WalletOps.charge`). Это позволяло операторам бесплатно перезапускать ошибочные заказы.

## 1. Матрица переходов статусов (State Machine Matrix)
Мы расширяем и одновременно ужесточаем матрицу `VALID_STATUS_TRANSITIONS` в `src/actions/admin/orders.ts`.

### Разрешенные переходы
- `AWAITING_PAYMENT` → `PENDING`, `CANCELED`, `ERROR`
- `PENDING` → `IN_PROGRESS`, `CANCELED`, `ERROR`, `COMPLETED` *(только при выполнении условий)*
- `PENDING_CHECK` → `PENDING`, `IN_PROGRESS`, `CANCELED`, `ERROR`
- `IN_PROGRESS` → `COMPLETED`, `PARTIAL`, `CANCELED`, `ERROR`
- `PARTIAL` → `COMPLETED`, `CANCELED` *(с учетом уже выплаченных возвратов)*
- `COMPLETED` → **`PARTIAL`, `CANCELED`** *(Разрешаем для исправления ошибок)*
- `CANCELED` → `PENDING` *(Только через официальный Restart/Reroute, напрямую запрещено)*
- `ERROR` → **`CANCELED`** *(Переходы в `PENDING` и `IN_PROGRESS` строго удалены. Рестарт возможен только через `restartOrderAction`, который корректно списывает деньги)*.

## 2. Защита от "пустых" завершений (Provider ID Constraint)
Чтобы исключить ситуации, когда заказ "Выполнен", но фактически не передан провайдеру:
- Если у заказа установлен `providerId`, **ЗАПРЕЩЕНО** переводить заказ в статусы `COMPLETED`, `PARTIAL` или `IN_PROGRESS`, если поле `externalId` пустое (`null` или `""`).
- **Где внедрить:** В `setOrderStatusAction` и `forceCompleteOrderAction`.

## 3. Ревизия финансовой логики возвратов (Refund Logic Overhaul)

### Защищенный алгоритм расчета `refundCents` (Ledger Delta):
Чтобы избежать овер-рефанда при сложных цепочках, возврат при отмене (в одиночном и массовом режиме) должен рассчитываться на основе Ledger'a:
```typescript
// 1. Считаем сколько МЫ ДОЛЖНЫ вернуть исходя из текущего состояния
let calculatedRefund = 0;
if (newStatus === 'CANCELED' && oldStatus === 'COMPLETED') {
    // Для полностью закрытого заказа отмена означает возврат всего объема
    calculatedRefund = calculatePartialRefund({ ...order, remains: order.quantity });
} else {
    calculatedRefund = calculatePartialRefund(order);
}

// 2. Вычитаем из этой суммы то, что УЖЕ вернули ранее (защита от двойного возврата)
const previousRefunds = await tx.ledgerEntry.aggregate({
  where: { userId: order.userId, idempotencyKey: { startsWith: `refund_${order.id}_` }, status: 'APPROVED' },
  _sum: { amount: true },
});
const alreadyRefunded = Number(previousRefunds._sum.amount || 0);

// 3. Финальный возврат (только разница)
const refundCents = Math.max(0, calculatedRefund - alreadyRefunded);
```

### Откат реферальных комиссий (Loyalty Sync)
Во все действия (`setOrderStatusAction`, `bulkCancelOrdersAction`), где заказ меняет статус, добавляется синхронизация:
- `COMPLETED` -> `LoyaltyService.confirmCommission()`
- `CANCELED` / `ERROR` -> `LoyaltyService.reverseCommission()`
- `PARTIAL` -> `LoyaltyService.handlePartialCommission()`

## 4. План реализации (Implementation Plan)

### Компонент 1: `src/actions/admin/orders.ts` (Одиночные действия)
1. Обновить константу `VALID_STATUS_TRANSITIONS` (разрешить отмену `COMPLETED`, запретить рестарт `ERROR`).
2. Добавить `Provider ID Constraint` (защита `externalId`).
3. Внедрить **Ledger Delta Refund** в `setOrderStatusAction`.
4. Внедрить синхронизацию `LoyaltyService`.

### Компонент 2: `src/actions/admin/orders.ts` (Массовые действия `bulkCancelOrdersAction`)
1. Убрать блокировку массовой отмены `COMPLETED` заказов (`hasCompletedOrders`).
2. Внедрить **Ledger Delta Refund** внутри транзакции отмены для корректного расчета остатков.
3. Добавить `LoyaltyService.reverseCommission`.

### Компонент 3: `src/services/admin/order.service.ts`
В методе `cancelOrder`:
1. Убрать `COMPLETED` из списка блокирующих терминальных статусов.
2. Внедрить **Ledger Delta Refund** для страховки от овер-рефандов.

### Компонент 4: `src/components/admin/OrderDetailsModal.tsx` & `order-standalone-view.tsx`
1. Заблокировать кнопку «Завершить», если `externalId` пустой.
2. Снять блокировку кнопки «Отменить» для администраторов даже при статусе `COMPLETED`.

## 5. Моделирование отказа (Pre-Mortem Analysis)
| Сценарий | Механизм защиты в коде |
| :--- | :--- |
| Оператор меняет ERROR -> PENDING в выпадающем списке | Переход удален из `VALID_STATUS_TRANSITIONS`. Транзакция отклонится. (Бесплатный рестарт закрыт). |
| Оператор закрывает зависший PENDING заказ в COMPLETED без провайдера | Сработает новая проверка `order.providerId && !order.externalId`, транзакция упадет с ошибкой. |
| Овер-рефанд: заказ был PARTIAL, стал COMPLETED, потом CANCELED | Код агрегирует Ledger. Возврат будет равен `calculatedRefund - already_refunded`. |
| Оператор отменяет заказ, но реферальная комиссия остается у партнера | Добавлен вызов `LoyaltyService.reverseCommission` во все мутации статусов. |
