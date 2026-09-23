# SPEC-2026-09-18: Комплексное устранение дефектов и выравнивание инвариантов Drip-Feed (OmniSMM / SMMplan / SMMflux)

## 1. Context & Problem Statement
В ходе независимого архитектурного аудита системы Drip-Feed платформы OmniSMM 1.0 (бренды SMMplan и SMMflux) выявлен раскол на два независимых контура (Regular Drip-Feed на уровне `Order` и Smart Drip-Feed на уровне `SmartCampaign`), повлекший критические дефекты:
1. **Ghost Drip Sync (P0)**: В `sync.processor.ts` нативные Drip-Feed заказы проверяются по пустому массиву `dripExternalIds = []`, что приводит к ложному моментальному статусу `COMPLETED` на 1-й минуте.
2. **Missing Partial Refund (P0)**: При статусе `PARTIAL` от провайдера для Drip-Feed в `sync.processor.ts` не вызывается `RefundPolicyService.processRefund()`.
3. **5x Multiplier Bug (P0)**: Коллизия Контракта A (объем = итого) и Контракта B (объем = на 1 запуск) в визарде дашборда (`useSmmplanOrderWizard.ts`, `WizardStepCheckout.tsx`) приводит к 5-кратному завышению объемов и стоимости.
4. **Smart Drip TTL Auto-Kill (P0)**: В `cleanup.processor.ts` заказы Smart Drip без `externalId` через 72ч помечаются как `ERROR` со 100% возвратом средств, в то время как кампания продолжает исполняться до 30 дней (прямой убыток).
5. **Zombie Execution (P0)**: В `order.processor.ts` проверка `smartCampaign` выполняется до проверки `order.status !== 'PENDING'`, что воскрешает отмененные клиентом заказы.
6. **Smart Drip Admin Cancellation Leak (P0)**: Отмена заказа в админке не останавливает связанную `SmartCampaign`, воркер продолжает платные запуски.
7. **Double Markup in useOrderEngine (P0)**: Наценка на Smart Drip (+15%) накладывается дважды в UI (+32.25%), создавая расхождение между витриной и списанием.
8. **Cross-Contamination (P0)**: При выборе Smart Drip флаг `runs` из формы делал `isDripFeed: true` в заказе, что вызывало моментальное закрытие заказа воркером `sync.processor`.
9. **No Distributed Lock in Smart Drip (P1)**: Минутный cron `runSmartDripfeedTick` не защищен Redis-мьютексом, провоцируя гонки и дублирование заказов у провайдеров.
10. **Boolean("0") Catalog Leak (P1)**: `isDripFeedEnabled: Boolean(liveExt.dripfeed)` превращает строку `"0"` в `true`, разрешая Drip-Feed на запрещенных услугах.
11. **Smart Drip Floor Invariant (P1)**: Генератор чанков `smart-drip.service.ts` не учитывает `service.minQty`, провоцируя отклонение микро-заказов поставщиком.

## 2. Invariants & Decision Tree
1. **Contract A Invariant (Quantity = Total Volume)**:
   Поле `quantity` во ВСЕХ интерфейсах (Landing OrderEngine, Dashboard Smmplan Wizard, Flux Wizard, Mobile Checkout, Telegram Bot) обозначает **ПОЛНЫЙ ИТОГОВЫЙ ОБЪЕМ** заказа.
   $\text{runQty} = \lfloor \text{quantity} / \text{runs} \rfloor \ge \text{service.minQty}$.
2. **Mutual Exclusion Invariant**:
   Заказ может быть ЛИБО обычным, ЛИБО `Regular Drip-Feed` (`isDripFeed: true`), ЛИБО `Smart Drip-Feed` (`smartCampaign` non-null, `isDripFeed: false`, `runs: null`, `interval: null`). Они никогда не пересекаются в одном заказе.
3. **Escrow & Safe TTL Invariant**:
   Заказы со связанной активной `SmartCampaign` (`RUNNING` или `PAUSED`) имеют TTL $\ge \text{totalDays} \times 24\text{h} + 48\text{h}$ и никогда не закрываются авто-клинапом как брошенные.
4. **Cascading Cancellation Invariant**:
   Отмена или ошибка родительского `Order` (клиентом, админом или тайм-аутом) обязана переводить `SmartCampaign` в терминальный статус `ERROR` и отменять все сопутствующие `SmartTask` в статусе `PLANNED`.

## 3. Data Transfer Objects & Implementation Scope
- `sync.processor.ts`: опрос нативных Drip-Feed через `externalId`, расчет возврата при `PARTIAL` и `CANCELED`.
- `cleanup.processor.ts`: учет `order.smartCampaign`, продление TTL, отмена `SmartCampaign` при отмене `AWAITING_PAYMENT`.
- `order.processor.ts`: проверка `status === 'PENDING'` ДО перехвата `smartCampaign`.
- `useOrderEngine.ts`: удаление вторичной наценки.
- `useSmmplanOrderWizard.ts`, `WizardStepCheckout.tsx`, `CheckoutDripFeed.tsx`, `FluxDashboardOrderWizard.tsx`: фиксация Контракта A.
- `checkout.ts`: при `isSmartDrip === true` принудительно обнулять `isDripFeed`, `runs`, `interval`.
- `order.service.ts` & `admin/orders.ts`: каскадная отмена `SmartCampaign` и `SmartTask`.
- `smart-drip.service.ts`: обеспечение $\text{effectiveMinChunk} \ge \text{service.minQty}$.
- `catalog.service.ts`: парсинг `dripfeed === true || dripfeed === 1 || dripfeed === '1'`.
- `dripfeed.processor.ts`: внедрение `MutexManager.withLock('lock:dripfeed:tick', ...)`.
